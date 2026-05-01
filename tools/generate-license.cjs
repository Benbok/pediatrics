#!/usr/bin/env node
/**
 * PediAssist — License Generation CLI Tool
 * Используется ТОЛЬКО разработчиком (вы).
 *
 * Команды:
 *   node tools/generate-license.cjs --generate-keys [--out-dir ./keys]
 *       Генерирует пару RSA-2048 ключей: private.pem и public.pem
 *
 *   node tools/generate-license.cjs --fingerprint <hex> --user "Иванов И.И." [--expires 2027-01-01] [--key ./keys/private.pem] [--out ./license.json]
 *       Создаёт подписанный файл лицензии для конкретного пользователя/машины
 *
 *   node tools/generate-license.cjs --portable --drive D: [--user "Разработчик"] [--expires 2027-01-01] [--allow-host <fingerprint>] [--key ./keys/private.pem] [--out ./portable-license.json]
 *       Создаёт portable-лицензию v2 для конкретного USB-диска
 *
 *   node tools/generate-license.cjs --verify ./license.json --pub ./keys/public.pem
 *       Проверяет лицензионный файл (без привязки к fingerprint)
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ─── Parse CLI args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name) {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

function hasFlag(name) {
    return args.includes(name);
}

// ─── Generate RSA key pair ────────────────────────────────────────────────────

if (hasFlag('--generate-keys')) {
    const outDir = getArg('--out-dir') || '.';
    fs.mkdirSync(outDir, { recursive: true });

    console.log('\n🔑  Генерация RSA-2048 ключей...');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const privPath = path.join(outDir, 'private.pem');
    const pubPath  = path.join(outDir, 'public.pem');

    fs.writeFileSync(privPath, privateKey, { mode: 0o600 });
    fs.writeFileSync(pubPath, publicKey);

    console.log(`\n✅  Приватный ключ: ${privPath}`);
    console.log(`✅  Публичный ключ:  ${pubPath}`);
    console.log('\n⚠️   ВАЖНО: Храните private.pem в SECRET — никогда не добавляйте в git!');
    console.log('\n📋  Содержимое public.pem (вставить в electron/license/verify.cjs):');
    console.log('─'.repeat(70));
    console.log(publicKey);
    console.log('─'.repeat(70));
    process.exit(0);
}

// ─── Generate license ─────────────────────────────────────────────────────────

if (getArg('--fingerprint')) {
    const fingerprint = getArg('--fingerprint');
    const userName    = getArg('--user') || 'Пользователь';
    const expiresAt   = getArg('--expires') || null; // ISO date string or null = never
    const keyPath     = getArg('--key') || path.join(__dirname, '..', 'keys', 'private.pem');
    const outPath     = getArg('--out') || path.join(process.cwd(), 'license.json');

    if (!fs.existsSync(keyPath)) {
        console.error(`\n❌  Приватный ключ не найден: ${keyPath}`);
        console.error('    Сначала запустите: node tools/generate-license.cjs --generate-keys');
        process.exit(1);
    }

    // Validate fingerprint format (64 hex chars)
    if (!/^[a-f0-9]{64}$/i.test(fingerprint)) {
        console.error('\n❌  Неверный fingerprint. Должно быть 64 hex символа (SHA-256).');
        console.error('    Запустите приложение на машине пользователя и скопируйте Machine ID из экрана активации.');
        process.exit(1);
    }

    // Validate expiry date if provided
    if (expiresAt) {
        const expDate = new Date(expiresAt);
        if (isNaN(expDate.getTime())) {
            console.error(`\n❌  Неверный формат даты: ${expiresAt}. Используйте формат YYYY-MM-DD`);
            process.exit(1);
        }
        if (expDate < new Date()) {
            console.error('\n⚠️   Предупреждение: дата истечения лицензии уже в прошлом!');
        }
    }

    const payloadObj = {
        fingerprint,
        userName,
        issuedAt: new Date().toISOString(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        version: 1,
    };

    const payloadB64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64');

    const privateKey = fs.readFileSync(keyPath, 'utf8');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(payloadB64);
    const signature = sign.sign(privateKey, 'base64');

    const licenseFile = { payload: payloadB64, signature };
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(licenseFile, null, 2), 'utf8');

    console.log('\n✅  Лицензия создана:', outPath);
    console.log('\n📋  Параметры:');
    console.log(`    Пользователь:  ${payloadObj.userName}`);
    console.log(`    Fingerprint:   ${payloadObj.fingerprint}`);
    console.log(`    Выдана:        ${payloadObj.issuedAt}`);
    console.log(`    Истекает:      ${payloadObj.expiresAt || 'Бессрочно'}`);
    console.log('\n📤  Отправьте этот файл пользователю. Он должен импортироватез экран активации.ь его чер');
    process.exit(0);
}

// ─── Generate portable license (v2) ──────────────────────────────────────────

if (hasFlag('--portable')) {
    const driveLetter = getArg('--drive');
    const userName    = getArg('--user') || 'Разработчик';
    const expiresAt   = getArg('--expires') || null;
    const keyPath     = getArg('--key') || path.join(__dirname, '..', 'keys', 'private.pem');
    const outPath     = getArg('--out') || path.join(process.cwd(), 'portable-license.json');

    // Collect all --allow-host values (can be specified multiple times)
    const allowedHostFingerprints = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--allow-host' && args[i + 1]) {
            allowedHostFingerprints.push(args[i + 1]);
        }
    }

    if (!driveLetter) {
        console.error('\n❌  Укажите букву диска: --drive D:');
        console.error('    Пример: node tools/generate-license.cjs --portable --drive D: --user "Разработчик"');
        process.exit(1);
    }

    if (!fs.existsSync(keyPath)) {
        console.error(`\n❌  Приватный ключ не найден: ${keyPath}`);
        console.error('    Сначала запустите: node tools/generate-license.cjs --generate-keys');
        process.exit(1);
    }

    if (expiresAt) {
        const expDate = new Date(expiresAt);
        if (isNaN(expDate.getTime())) {
            console.error(`\n❌  Неверный формат даты: ${expiresAt}. Используйте YYYY-MM-DD`);
            process.exit(1);
        }
        if (expDate < new Date()) {
            console.warn('\n⚠️   Предупреждение: дата истечения лицензии уже в прошлом!');
        }
    }

    // Validate allowed host fingerprints format
    for (const fp of allowedHostFingerprints) {
        if (!/^[a-f0-9]{64}$/i.test(fp)) {
            console.error(`\n❌  Неверный формат host fingerprint: ${fp}`);
            console.error('    Fingerprint должен быть 64 hex-символа (SHA-256).');
            process.exit(1);
        }
    }

    // Get portable device ID from the specified drive
    const { execSync } = require('child_process');
    const letter = driveLetter.replace(/[:\\/]+/g, '').toUpperCase().charAt(0);

    console.log(`\n🔍  Определение ID диска ${letter}:...`);

    let portableDeviceId;
    try {
        const volOutput = execSync(`vol ${letter}:`, {
            encoding: 'utf8',
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        const serialMatch = volOutput.match(/\b([A-F0-9]{4}-[A-F0-9]{4})\b/i);
        const labelMatch  = volOutput.match(/(?:Volume in drive [A-Z] is|Том в устройстве [A-Z] имеет метку)\s+(.+)/i);

        if (!serialMatch) {
            console.error(`\n❌  Не удалось определить серийный номер тома ${letter}:`);
            console.error('    Убедитесь, что диск подключён и отформатирован.');
            process.exit(1);
        }

        const volumeSerial = serialMatch[1].toUpperCase();
        const volumeLabel  = labelMatch ? labelMatch[1].trim().toUpperCase() : 'NO_LABEL';
        const input        = `PORTABLE::${letter}:${volumeSerial}:${volumeLabel}`;
        portableDeviceId   = crypto.createHash('sha256').update(input).digest('hex');

        console.log(`    Метка тома:     ${volumeLabel}`);
        console.log(`    Серийный номер: ${volumeSerial}`);
        console.log(`    Device ID:      ${portableDeviceId.substring(0, 32).toUpperCase().match(/.{8}/g).join('-')}`);
    } catch (err) {
        console.error(`\n❌  Ошибка получения данных тома: ${err.message}`);
        process.exit(1);
    }

    const payloadObj = {
        licenseType:             'PORTABLE_PERSONAL',
        portableDeviceId,
        allowedHostFingerprints: allowedHostFingerprints.length > 0 ? allowedHostFingerprints : [],
        ownerId:                 'developer',
        userName,
        issuedAt:                new Date().toISOString(),
        expiresAt:               expiresAt ? new Date(expiresAt).toISOString() : null,
        version:                 2,
    };

    const payloadB64   = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
    const privateKey   = fs.readFileSync(keyPath, 'utf8');
    const sign         = crypto.createSign('RSA-SHA256');
    sign.update(payloadB64);
    const signature    = sign.sign(privateKey, 'base64');
    const licenseFile  = { payload: payloadB64, signature };

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(licenseFile, null, 2), 'utf8');

    console.log('\n✅  Portable-лицензия создана:', outPath);
    console.log('\n📋  Параметры:');
    console.log(`    Тип:           PORTABLE_PERSONAL (v2)`);
    console.log(`    Пользователь:  ${payloadObj.userName}`);
    console.log(`    Диск:          ${letter}:`);
    console.log(`    Выдана:        ${payloadObj.issuedAt}`);
    console.log(`    Истекает:      ${payloadObj.expiresAt || 'Бессрочно'}`);
    console.log(`    Whitelist:     ${allowedHostFingerprints.length > 0 ? allowedHostFingerprints.join(', ') : 'Любой ПК'}`);
    console.log('\n📂  Куда положить:');
    console.log(`    ${letter}:\\<папка с exe>\\data\\portable-license.json`);
    console.log('\n⚠️   При замене/форматировании диска пересоздайте лицензию этой командой.');
    process.exit(0);
}

// ─── Verify license (without machine check) ────────────────────────────────────

if (hasFlag('--verify')) {
    const licensePath = args[args.indexOf('--verify') + 1];
    const pubPath     = getArg('--pub') || path.join(__dirname, '..', 'keys', 'public.pem');

    if (!licensePath || !fs.existsSync(licensePath)) {
        console.error('\n❌  Файл лицензии не найден:', licensePath);
        process.exit(1);
    }
    if (!fs.existsSync(pubPath)) {
        console.error('\n❌  Публичный ключ не найден:', pubPath);
        process.exit(1);
    }

    const { payload, signature } = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
    const publicKey = fs.readFileSync(pubPath, 'utf8');

    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(payload);
    const valid = verify.verify(publicKey, signature, 'base64');

    if (!valid) {
        console.error('\n❌  Подпись недействительна — файл лицензии повреждён или подделан!');
        process.exit(1);
    }

    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    const expired = data.expiresAt && new Date(data.expiresAt) < new Date();

    console.log('\n✅  Подпись RSA-SHA256 действительна');
    console.log('\n📋  Содержимое лицензии:');
    console.log(`    Пользователь:  ${data.userName}`);
    console.log(`    Fingerprint:   ${data.fingerprint}`);
    console.log(`    Выдана:        ${data.issuedAt}`);
    console.log(`    Истекает:      ${data.expiresAt || 'Бессрочно'}`);
    if (expired) {
        console.log('\n⚠️   Лицензия ИСТЕКЛА');
        process.exit(1);
    } else {
        console.log('\n✅  Лицензия действительна');
    }
    process.exit(0);
}

// ─── Help ──────────────────────────────────────────────────────────────────────

console.log(`
PediAssist License Generator
==============================

Генерация ключей:
  node tools/generate-license.cjs --generate-keys [--out-dir ./keys]

Выпуск лицензии (machine-bound v1):
  node tools/generate-license.cjs \\
    --fingerprint <64-hex-chars> \\
    --user "Иванов Иван Иванович" \\
    [--expires 2027-12-31] \\
    [--key ./keys/private.pem] \\
    [--out ./license.json]

Выпуск portable-лицензии (v2) для USB-диска:
  node tools/generate-license.cjs \\
    --portable \\
    --drive D: \\
    --user "Разработчик" \\
    [--expires 2027-12-31] \\
    [--allow-host <machine-fingerprint-hex>] \\
    [--key ./keys/private.pem] \\
    [--out ./portable-license.json]

  Примечание: --allow-host можно указать несколько раз (до 3 машин).
  Без --allow-host: диск работает на любом ПК.

Проверка лицензии:
  node tools/generate-license.cjs --verify ./license.json [--pub ./keys/public.pem]
`);
process.exit(0);
