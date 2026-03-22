'use strict';

/**
 * MACHINE FINGERPRINT MODULE
 *
 * Считывает стабильный идентификатор машины из реестра Windows (MachineGuid)
 * и объединяет с hostname. Хеширует SHA-256 → 64 hex символа.
 *
 * MachineGuid хранится по пути:
 *   HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography\MachineGuid
 * Он создаётся при установке Windows и не меняется при перезагрузках/обновлениях.
 */

const { execSync } = require('child_process');
const os = require('os');
const crypto = require('crypto');

/**
 * Читает MachineGuid из реестра Windows через консольную утилиту reg.exe.
 * @returns {string|null} UUID-строка или null если не удалось получить
 */
function getMachineGuid() {
    try {
        const result = execSync(
            'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
            { encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
        );
        // Expect line: "    MachineGuid    REG_SZ    xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        const match = result.match(/MachineGuid\s+REG_SZ\s+([\w\-]+)/i);
        return match ? match[1].trim() : null;
    } catch {
        return null;
    }
}

/**
 * Возвращает полный SHA-256 fingerprint машины (64 hex символа).
 * Бросает Error если не удалось получить MachineGuid (не Windows или нет прав).
 * @returns {string}
 */
function getFingerprint() {
    const machineGuid = getMachineGuid();
    if (!machineGuid) {
        throw new Error(
            'Не удалось получить идентификатор машины. ' +
            'Убедитесь, что приложение запущено на Windows с достаточными правами.'
        );
    }
    const hostname = os.hostname().toLowerCase().trim();
    const raw = `${machineGuid}::${hostname}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Возвращает читаемое представление fingerprint для отображения пользователю.
 * Формат: XXXX-XXXX-XXXX-XXXX (первые 16 символов SHA-256 в верхнем регистре)
 * @returns {string}
 */
function getDisplayFingerprint() {
    try {
        const fp = getFingerprint();
        // Full 64-char hex split into groups of 8 for readability
        return fp.substring(0, 32).toUpperCase().match(/.{8}/g).join('-');
    } catch {
        return 'ОШИБКА-ПОЛУЧЕНИЯ-ID-МАШИНЫ';
    }
}

module.exports = { getFingerprint, getDisplayFingerprint, getMachineGuid };
