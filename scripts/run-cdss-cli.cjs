/**
 * Запуск CDSS CLI с корректной кодировкой консоли (UTF-8 на Windows).
 * Использование: node scripts/run-cdss-cli.cjs [аргументы для cdss-test-cli]
 */
const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const electronScript = path.join(__dirname, 'cdss-test-cli.cjs');
const args = process.argv.slice(2);

// Путь к electron (без npx, иначе при shell:false может не находиться)
const binDir = path.join(rootDir, 'node_modules', '.bin');
const electronBin = process.platform === 'win32'
    ? path.join(binDir, 'electron.cmd')
    : path.join(binDir, 'electron');

if (!fs.existsSync(electronBin)) {
    console.error('Ошибка: electron не найден. Выполните npm install.');
    process.exit(1);
}

if (process.platform === 'win32') {
    execSync('chcp 65001 >nul 2>&1', { stdio: 'inherit', shell: true, cwd: rootDir });
}

// На Windows .cmd нужно запускать через shell
const spawnOpts = {
    stdio: 'inherit',
    cwd: rootDir,
    env: process.env,
    shell: process.platform === 'win32',
};

const result = spawnSync(electronBin, [electronScript, ...args], spawnOpts);

if (result.error) {
    console.error('Ошибка запуска:', result.error.message);
    process.exit(1);
}

process.exit(result.status !== null ? result.status : 1);
