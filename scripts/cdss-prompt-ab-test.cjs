/**
 * A/B тест prompt-ов ранжирования CDSS на одинаковых тестовых данных.
 *
 * Запуск:
 *   npx electron scripts/cdss-prompt-ab-test.cjs
 *   npx electron scripts/cdss-prompt-ab-test.cjs --complaints="ночной кашель..." --age-months=4 --delay-ms=12000
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { app } = require('electron');
const { callGeminiAPI, parseComplaints } = require('../electron/services/cdssService.cjs');
const { DiseaseService } = require('../electron/modules/diseases/service.cjs');
const { apiKeyManager } = require('../electron/services/apiKeyManager.cjs');

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
    const args = process.argv.slice(2);
    const out = {
        complaints: null,
        ageMonths: 4,
        delayMs: 12000,
    };

    for (const arg of args) {
        if (arg.startsWith('--complaints=')) {
            out.complaints = arg.slice('--complaints='.length).trim();
        } else if (arg.startsWith('--age-months=')) {
            const n = Number(arg.slice('--age-months='.length));
            if (Number.isFinite(n) && n > 0) out.ageMonths = n;
        } else if (arg.startsWith('--delay-ms=')) {
            const n = Number(arg.slice('--delay-ms='.length));
            if (Number.isFinite(n) && n >= 0) out.delayMs = n;
        }
    }

    return out;
}

function extractJson(text) {
    let jsonText = String(text || '').trim();
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '').trim();
    }
    return JSON.parse(jsonText);
}

function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

function buildOriginalPrompt(symptoms, diseases, patientContext = {}) {
    const symptomsText = symptoms.join(', ');
    const ageText = patientContext.ageMonths
        ? `${patientContext.ageMonths} месяцев`
        : 'возраст не указан';

    const diseasesList = diseases.map((d) => {
        const dSymptoms = Array.isArray(d.symptoms) ? d.symptoms : JSON.parse(d.symptoms || '[]');
        return {
            id: d.id,
            name: d.nameRu,
            icd10: d.icd10Code,
            symptoms: dSymptoms,
        };
    });

    return `На основе симптомов оцени вероятность каждого диагноза для ребенка.

Симптомы пациента: ${symptomsText}
Возраст: ${ageText}
${patientContext.weight ? `Вес: ${patientContext.weight} кг` : ''}
${patientContext.height ? `Рост: ${patientContext.height} см` : ''}

Список кандидатов (JSON):
${JSON.stringify(diseasesList, null, 2)}

Верни ТОЛЬКО валидный JSON массив без каких-либо пояснений и markdown-разметки.
Для каждого диагноза укажи его id (число из поля "id" выше), confidence (от 0.0 до 1.0), 
reasoning (краткое объяснение на русском) и matchedSymptoms (массив совпавших симптомов).

Пример ответа:
[
  {
    "diseaseId": 42,
    "confidence": 0.85,
    "reasoning": "Симптомы соответствуют клинической картине",
    "matchedSymptoms": ["лихорадка", "кашель"]
  }
]

ВАЖНО: diseaseId должен быть числом из поля "id" кандидата, например 42, а не строкой и не null.`;
}

function buildConservativePrompt(symptoms, diseases, patientContext = {}) {
    const symptomsText = symptoms.join(', ');
    const ageText = patientContext.ageMonths
        ? `${patientContext.ageMonths} месяцев`
        : 'возраст не указан';

    const diseasesList = diseases.map((d) => {
        const dSymptoms = Array.isArray(d.symptoms) ? d.symptoms : JSON.parse(d.symptoms || '[]');
        return {
            id: d.id,
            name: d.nameRu,
            icd10: d.icd10Code,
            symptoms: dSymptoms,
        };
    });

    return `Ты педиатрический клинический ранжировщик. Твоя цель — осторожная дифференциальная оценка, а не подтверждение одного диагноза.

Симптомы пациента: ${symptomsText}
Возраст: ${ageText}
${patientContext.weight ? `Вес: ${patientContext.weight} кг` : ''}
${patientContext.height ? `Рост: ${patientContext.height} см` : ''}

Список кандидатов (JSON):
${JSON.stringify(diseasesList, null, 2)}

Требования:
1) Оцени каждый диагноз только по данным из входа.
2) Для каждого диагноза ОБЯЗАТЕЛЬНО укажи:
   - supportingFindings: признаки из входа, поддерживающие диагноз
   - missingExpectedFindings: ожидаемые признаки, которых нет во входе
   - conflictingFindings: признаки, против диагноза (если есть)
   - matchedSymptoms: только реально совпавшие симптомы из входа
3) Консервативность confidence:
   - если совпал 1 неспецифичный симптом, confidence не должен быть высоким
   - отсутствие ключевых ожидаемых признаков снижает confidence
   - при конкурирующих диагнозах confidence лидера должен быть умеренным
4) Верни валидный JSON-массив, отсортированный по убыванию confidence.
5) Никакого markdown, только JSON.

Формат ответа:
[
  {
    "diseaseId": 123,
    "confidence": 0.62,
    "reasoning": "Краткое клиническое обоснование",
    "matchedSymptoms": ["..."],
    "supportingFindings": ["..."],
    "missingExpectedFindings": ["..."],
    "conflictingFindings": ["..."],
    "uncertaintyLevel": "low|moderate|high",
    "nextDataToConfirm": ["..."]
  }
]

ВАЖНО: diseaseId должен быть числом из поля "id" кандидата, например 42, а не строкой и не null.`;
}

async function runRanking(prompt, diseasesById) {
    const raw = await callGeminiAPI(prompt);
    const parsed = extractJson(raw);
    if (!Array.isArray(parsed)) {
        throw new Error('LLM response is not array');
    }

    return parsed
        .map((item) => {
            const diseaseId = Number(item.diseaseId);
            const disease = diseasesById.get(diseaseId);
            if (!diseaseId || !disease) return null;
            return {
                diseaseId,
                diseaseName: disease.nameRu,
                confidence: clamp01(item.confidence),
                reasoning: String(item.reasoning || ''),
                matchedSymptoms: Array.isArray(item.matchedSymptoms) ? item.matchedSymptoms : [],
                supportingFindings: Array.isArray(item.supportingFindings) ? item.supportingFindings : [],
                missingExpectedFindings: Array.isArray(item.missingExpectedFindings) ? item.missingExpectedFindings : [],
                conflictingFindings: Array.isArray(item.conflictingFindings) ? item.conflictingFindings : [],
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
}

function printTop(title, rows) {
    console.log(`\n${title}`);
    rows.slice(0, 3).forEach((r, idx) => {
        const pct = Math.round(r.confidence * 100);
        console.log(`${idx + 1}. ${r.diseaseName} (${pct}%)`);
        console.log(`   matched: ${r.matchedSymptoms.join(', ') || '—'}`);
        if (r.supportingFindings.length || r.missingExpectedFindings.length || r.conflictingFindings.length) {
            console.log(`   support: ${r.supportingFindings.join('; ') || '—'}`);
            console.log(`   missing: ${r.missingExpectedFindings.join('; ') || '—'}`);
            console.log(`   conflict: ${r.conflictingFindings.join('; ') || '—'}`);
        }
    });
}

async function runCase(testCase, delayMs) {
    const patientContext = { ageMonths: testCase.ageMonths || 4, weight: null, height: null };

    const parsed = await parseComplaints(testCase.complaints, patientContext.ageMonths, patientContext.weight);
    const candidates = await DiseaseService.searchBySymptoms(parsed.symptoms);
    const topCandidates = candidates.slice(0, 8);

    if (topCandidates.length === 0) {
        console.log(`\nCASE: ${testCase.name}`);
        console.log('No candidates found');
        return;
    }

    const diseasesById = new Map(topCandidates.map((d) => [Number(d.id), d]));

    const originalPrompt = buildOriginalPrompt(parsed.symptoms, topCandidates, patientContext);
    const conservativePrompt = buildConservativePrompt(parsed.symptoms, topCandidates, patientContext);

    const oldRank = await runRanking(originalPrompt, diseasesById);
    if (delayMs > 0) {
        console.log(`\nПауза ${delayMs} ms перед новым prompt...`);
        await sleep(delayMs);
    }
    const newRank = await runRanking(conservativePrompt, diseasesById);

    console.log('\n============================================================');
    console.log(`CASE: ${testCase.name}`);
    console.log(`Жалоба: ${testCase.complaints}`);
    console.log(`Извлеченные симптомы: ${parsed.symptoms.join(', ')}`);

    printTop('OLD PROMPT (Top-3)', oldRank);
    printTop('NEW PROMPT (Top-3)', newRank);

    if (oldRank[0] && newRank[0]) {
        const delta = Math.round((newRank[0].confidence - oldRank[0].confidence) * 100);
        console.log(`\nLeader delta: ${oldRank[0].diseaseName} ${Math.round(oldRank[0].confidence * 100)}% -> ${newRank[0].diseaseName} ${Math.round(newRank[0].confidence * 100)}% (${delta > 0 ? '+' : ''}${delta} pp)`);
    }
}

async function main() {
    await apiKeyManager.initialize();
    const cli = parseArgs();

    const testCases = cli.complaints
        ? [{ name: 'Custom case', complaints: cli.complaints, ageMonths: cli.ageMonths }]
        : [
            { name: 'Размытая жалоба 1', complaints: 'частый кашель ночью', ageMonths: 4 },
            { name: 'Размытая жалоба 2', complaints: 'кашель ночью, иногда рвота после кашля', ageMonths: 5 },
            { name: 'Более специфичная жалоба', complaints: 'приступообразный кашель, репризы, посткашлевая рвота', ageMonths: 4 },
        ];

    for (const tc of testCases) {
        // eslint-disable-next-line no-await-in-loop
        await runCase(tc, cli.delayMs);
    }
}

app.whenReady().then(() => {
    main()
        .then(() => app.quit())
        .catch((error) => {
            console.error('\nA/B test failed:', error.message);
            if (process.env.DEBUG) console.error(error.stack);
            app.quit();
            process.exit(1);
        });
});

app.on('window-all-closed', () => {});
