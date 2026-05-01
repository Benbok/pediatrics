'use strict';

/**
 * PATHS MODULE
 *
 * Единственный источник истины для всех путей приложения.
 * Определяет режим работы (portable / standard) при первом вызове.
 *
 * PORTABLE MODE:
 *   Активируется наличием файла `portable.flag` рядом с exe.
 *   Все данные (БД, лицензия, логи, бэкапы) хранятся в <exeDir>/data/.
 *   Ничего не пишется в APPDATA.
 *
 * STANDARD MODE:
 *   Все данные в %APPDATA%\pediassist\ (app.getPath('userData')).
 *
 * Инициализировать вызовом initPaths() до любого require, который
 * нуждается в путях. Последующие вызовы возвращают кэшированный результат.
 */

const { app } = require('electron');
const path    = require('path');
const fs      = require('fs');

const PORTABLE_FLAG_FILENAME = 'portable.flag';
const PORTABLE_DATA_DIRNAME  = 'data';

let _paths = null;

/**
 * @typedef {Object} AppPaths
 * @property {boolean} isPortable
 * @property {string}  dataRoot           - Корневая папка данных
 * @property {string}  dbPath             - Путь к файлу БД
 * @property {string}  licenseFilePath    - Путь к license.json / portable-license.json
 * @property {string}  encryptionKeyPath  - Путь к encryption.key
 * @property {string}  logDir             - Папка логов
 * @property {string}  backupDir          - Папка бэкапов
 * @property {string|null} portableStatePath  - Путь к portable.state.json (null в standard-режиме)
 * @property {string|null} exeDir         - Директория exe (null в dev-режиме)
 */

/**
 * Инициализирует пути и кэширует результат.
 * Безопасно вызывать до app.ready — app.getPath('userData') доступен на Electron 20+.
 * @returns {AppPaths}
 */
function initPaths() {
    if (_paths) return _paths;

    const isDev = !app.isPackaged;

    let isPortable = false;
    let dataRoot;
    let exeDir = null;

    if (!isDev) {
        exeDir = path.dirname(process.execPath);
        const flagPath = path.join(exeDir, PORTABLE_FLAG_FILENAME);
        isPortable = fs.existsSync(flagPath);

        if (isPortable) {
            dataRoot = path.join(exeDir, PORTABLE_DATA_DIRNAME);
            // Создаём структуру папок при первом запуске
            fs.mkdirSync(path.join(dataRoot, 'logs'),    { recursive: true });
            fs.mkdirSync(path.join(dataRoot, 'backups'), { recursive: true });
        }
    }

    if (!isPortable) {
        dataRoot = app.getPath('userData');
    }

    _paths = {
        isPortable,
        dataRoot,
        dbPath: isDev
            ? path.join(__dirname, '../../prisma/dev.db')
            : path.join(dataRoot, 'pediatrics.db'),
        licenseFilePath: path.join(
            dataRoot,
            isPortable ? 'portable-license.json' : 'license.json'
        ),
        encryptionKeyPath: path.join(dataRoot, 'encryption.key'),
        logDir:   path.join(dataRoot, 'logs'),
        backupDir: path.join(dataRoot, 'backups'),
        portableStatePath: isPortable
            ? path.join(dataRoot, 'portable.state.json')
            : null,
        exeDir,
    };

    return _paths;
}

/**
 * Возвращает кэшированные пути (авто-инициализирует при первом вызове).
 * @returns {AppPaths}
 */
function getPaths() {
    if (!_paths) return initPaths();
    return _paths;
}

module.exports = { initPaths, getPaths, PORTABLE_FLAG_FILENAME };
