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

// ─── Portable Device ID ───────────────────────────────────────────────────────

/**
 * Возвращает уникальный ID носителя (тома диска) для portable-лицензии.
 * Привязка к диску, а не к машине — диск работает на любом ПК, но только с этим томом.
 *
 * Алгоритм: SHA-256(буква + серийный_номер_тома + метка_тома).
 * Серийник меняется при форматировании диска (желаемое поведение).
 *
 * @param {string} driveLetter - Буква диска: 'D', 'D:' или 'D:\'
 * @returns {string} SHA-256 hex (64 символа)
 */
function getPortableDeviceId(driveLetter) {
    // Нормализация: 'D', 'D:', 'D:\' → 'D'
    const letter = driveLetter.replace(/[:\\/]+/g, '').toUpperCase().charAt(0);
    if (!letter || !/[A-Z]/.test(letter)) {
        throw new Error(`Некорректная буква диска: ${driveLetter}`);
    }

    let raw;
    try {
        raw = execSync(`vol ${letter}:`, {
            encoding: 'utf8',
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    } catch (err) {
        throw new Error(`Не удалось получить информацию о томе ${letter}: ${err.message}`);
    }

    // Поддерживаем локализованный вывод Windows (EN/RU и др.):
    // серийный номер всегда имеет стабильный формат XXXX-XXXX.
    const serialMatch = raw.match(/\b([A-F0-9]{4}-[A-F0-9]{4})\b/i);
    const labelMatch  = raw.match(/(?:Volume in drive [A-Z] is|Том в устройстве [A-Z] имеет метку)\s+(.+)/i);

    if (!serialMatch) {
        throw new Error(
            `Не удалось определить серийный номер тома ${letter}: ` +
            `Убедитесь, что диск подключён и имеет файловую систему (FAT32, exFAT, NTFS).`
        );
    }

    const volumeSerial = serialMatch[1].toUpperCase();
    const volumeLabel  = labelMatch ? labelMatch[1].trim().toUpperCase() : 'NO_LABEL';
    const input        = `PORTABLE::${letter}:${volumeSerial}:${volumeLabel}`;

    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Читаемое представление portable device ID (первые 32 символа, группами по 8).
 * Формат: XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX
 * @param {string} driveLetter
 * @returns {string}
 */
function getDisplayPortableDeviceId(driveLetter) {
    try {
        const id = getPortableDeviceId(driveLetter);
        return id.substring(0, 32).toUpperCase().match(/.{8}/g).join('-');
    } catch {
        return 'ОШИБКА-ПОЛУЧЕНИЯ-ID-ДИСКА';
    }
}

module.exports = {
    getFingerprint,
    getDisplayFingerprint,
    getMachineGuid,
    getPortableDeviceId,
    getDisplayPortableDeviceId,
};
