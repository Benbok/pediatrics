/**
 * Тестовый CLI для проверки CDSS: поиск карточек из Базы знаний по клиническим симптомам.
 * Повторяет логику модуля Приемы: парсинг жалоб (Gemini) -> semantic search -> ранжирование (Gemini).
 *
 * Запуск из корня проекта:
 *   npm run test:cdss-cli
 *   npx electron scripts/cdss-test-cli.cjs "температура 38, кашель сухой, насморк"
 *
 * Требуется: .env.local с VITE_GEMINI_API_KEY или GEMINI_API_KEYS.
 */

const path = require('path');
const readline = require('readline');

// Сразу переключаем консоль Windows на UTF-8 (до любого вывода), иначе кириллица будет "кракозябрами"
if (process.platform === 'win32' && process.stdout.isTTY) {
    try {
        require('child_process').execSync('chcp 65001', { stdio: 'inherit', windowsHide: false });
    } catch (_) {}
}

// Загружаем .env.local до инициализации Electron и сервисов
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Приоритет GEMINI_API_KEYS: чтобы apiKeyManager использовал список ключей (и ротацию), а не одиночный VITE_GEMINI_API_KEY
if (process.env.GEMINI_API_KEYS) {
    delete process.env.VITE_GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
}

// Валидация ключа как в apiKeyManager: должен начинаться с AIza, длина >= 30
function isGeminiKeyValid(key) {
    return key && typeof key === 'string' && key.length >= 30 && /^AIza[A-Za-z0-9_-]+$/.test(key);
}
const singleKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const keysString = process.env.GEMINI_API_KEYS;
const hasValidKey = keysString
    ? keysString.split(',').some((k) => isGeminiKeyValid(k.trim()))
    : isGeminiKeyValid(singleKey);

if (!hasValidKey) {
    if (singleKey || keysString) {
        console.error('');
        console.error('Ошибка: в .env.local указан Gemini API ключ, но он не прошел проверку.');
        console.error('Ключ должен начинаться с AIza, длина не менее 30 символов.');
        console.error('Получить ключ: https://makersuite.google.com/app/apikey');
        console.error('');
    } else {
        console.warn('Предупреждение: не задан VITE_GEMINI_API_KEY / GEMINI_API_KEY / GEMINI_API_KEYS.');
        console.warn('Парсинг жалоб и semantic search будут недоступны (только keyword fallback).');
    }
}

const { app } = require('electron');

function createCli() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    function ask(question) {
        return new Promise((resolve) => {
            rl.question(question, (answer) => resolve(answer ? answer.trim() : ''));
        });
    }

    return { ask, close: () => rl.close() };
}

function formatDiseaseCard(d, rank) {
    const symptoms = Array.isArray(d.symptoms) ? d.symptoms : JSON.parse(d.symptoms || '[]');
    const icdCodes = Array.isArray(d.icd10Codes) ? d.icd10Codes : JSON.parse(d.icd10Codes || '[]');
    const lines = [
        `  ${rank}. ${d.nameRu || d.name_ru || '—'}`,
        `     МКБ-10: ${(d.icd10Code || d.icd10_code) || (icdCodes && icdCodes[0]) || '—'}`,
        `     Симптомы в карточке: ${symptoms.slice(0, 8).join(', ')}${symptoms.length > 8 ? '...' : ''}`,
    ];
    return lines.join('\n');
}

function formatRanked(suggestion) {
    const d = suggestion.disease;
    const pct = Math.round((suggestion.confidence || 0) * 100);
    const lines = [
        `  • ${d.nameRu || d.name_ru || '—'} (уверенность: ${pct}%)`,
        `    МКБ-10: ${d.icd10Code || (d.icd10Codes && d.icd10Codes[0]) || '—'}`,
        `    Обоснование: ${suggestion.reasoning || '—'}`,
        `    Совпавшие симптомы: ${(suggestion.matchedSymptoms || []).join(', ') || '—'}`,
    ];
    return lines.join('\n');
}

async function runAnalysis(complaintsText, ageMonths = 24, weight = null) {
    const { parseComplaints, rankDiagnoses } = require('../electron/services/cdssService.cjs');
    const { DiseaseService } = require('../electron/modules/diseases/service.cjs');

    console.log('\n[1/3] Парсинг жалоб через Gemini...');
    const parsed = await parseComplaints(complaintsText, ageMonths, weight);
    console.log('      Извлечённые симптомы:', parsed.symptoms.join(', '));
    console.log('      Степень тяжести:', parsed.severity);

    if (!parsed.symptoms || parsed.symptoms.length === 0) {
        console.log('\nНе удалось извлечь симптомы. Попробуйте сформулировать жалобы иначе.');
        return;
    }

    console.log('\n[2/3] Поиск по базе знаний (semantic search по симптомам)...');
    const candidateDiseases = await DiseaseService.searchBySymptoms(parsed.symptoms);

    if (candidateDiseases.length === 0) {
        console.log('\nПо запросу карточки не найдены. Проверьте, что в БД есть заболевания с embeddings (см. scripts/generate_embeddings.cjs).');
        return;
    }

    console.log(`      Найдено кандидатов: ${candidateDiseases.length}`);

    const topCandidates = candidateDiseases.slice(0, 20);
    console.log('\n[3/3] Ранжирование диагнозов через Gemini...');
    const rankings = await rankDiagnoses(parsed.symptoms, topCandidates, {
        ageMonths,
        weight,
        height: null,
    });

    const suggestions = rankings
        .map((ranking) => {
            const disease = topCandidates.find((d) => d.id === ranking.diseaseId);
            if (!disease) return null;
            return {
                disease: {
                    ...disease,
                    symptoms: Array.isArray(disease.symptoms) ? disease.symptoms : JSON.parse(disease.symptoms || '[]'),
                    icd10Codes: Array.isArray(disease.icd10Codes) ? disease.icd10Codes : JSON.parse(disease.icd10Codes || '[]'),
                },
                confidence: ranking.confidence,
                reasoning: ranking.reasoning,
                matchedSymptoms: ranking.matchedSymptoms || [],
            };
        })
        .filter(Boolean);

    console.log('\n--- Найденные карточки (совпадающие с жалобами) ---\n');
    suggestions.forEach((s, i) => console.log(formatRanked(s) + '\n'));

    console.log('--- Все кандидаты поиска (топ-10 без ранжирования) ---\n');
    candidateDiseases.slice(0, 10).forEach((d, i) => console.log(formatDiseaseCard(d, i + 1) + '\n'));
}

async function main() {
    // В CLI точкой входа является этот скрипт, а не main.cjs — apiKeyManager.initialize() не вызывается.
    // Инициализируем вручную, чтобы ключи из GEMINI_API_KEYS загрузились и ротация работала.
    const { apiKeyManager } = require('../electron/services/apiKeyManager.cjs');
    await apiKeyManager.initialize();

    const argv = process.argv.slice(2);
    const forceFallback = argv.includes('--force-fallback');
    const argsWithoutFlags = argv.filter((a) => a !== '--force-fallback');
    const complaintsFromArgv = argsWithoutFlags.length > 0 ? argsWithoutFlags.join(' ').trim() : null;

    if (forceFallback) {
        const { setCircuitOpen } = require('../electron/services/aiSymptomNormalizer.cjs');
        setCircuitOpen(true);
        console.log('Режим --force-fallback: AI-нормализация отключена (circuit breaker открыт).');
    }

    const cli = createCli();

    const complaintsText = complaintsFromArgv || (await cli.ask('Введите клинические симптомы (жалобы) в свободной форме: '));

    if (!complaintsText) {
        console.log('Ввод пустой. Завершение.');
        cli.close();
        app.quit();
        return;
    }

    console.log('\nЖалобы:', complaintsText);

    const ageMonths = 24; // для теста можно захардкодить или спросить
    const weight = null;

    try {
        await runAnalysis(complaintsText, ageMonths, weight);
    } catch (err) {
        console.error('\nОшибка:', err.message);
        if (process.env.DEBUG) console.error(err.stack);
    }

    cli.close();
    app.quit();
}

app.whenReady().then(() => {
    main().catch((e) => {
        console.error('Fatal:', e);
        process.exit(1);
    });
});

app.on('window-all-closed', () => {});
