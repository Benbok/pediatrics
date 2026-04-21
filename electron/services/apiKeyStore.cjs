/**
 * API Key Store — Encrypted In-App Storage
 *
 * Stores Google Gemini API keys encrypted (AES-256-GCM) in:
 *   {userData}/gemini-keys.enc.json
 *
 * Raw key values are NEVER exposed outside this module or sent to the renderer.
 * Consumers (apiKeyManager) call `getDecryptedKeys()` only inside the main process.
 */

'use strict';

const { logger } = require('../logger.cjs');
const { encrypt, decrypt } = require('../crypto.cjs');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

const STORE_FILE = path.join(app.getPath('userData'), 'gemini-keys.enc.json');
const STORE_VERSION = 1;

async function _storeFileExists() {
    try {
        await fs.access(STORE_FILE);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') return false;
        logger.warn('[ApiKeyStore] Failed to check store file existence:', err.message);
        return false;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Read raw store from disk. Returns `null` if file doesn't exist. */
async function _readStore() {
    try {
        const raw = await fs.readFile(STORE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.keys)) {
            logger.warn('[ApiKeyStore] Malformed store file, resetting');
            return _emptyStore();
        }
        return parsed;
    } catch (err) {
        if (err.code === 'ENOENT') return _emptyStore();
        logger.error('[ApiKeyStore] Failed to read store:', err.message);
        return _emptyStore();
    }
}

/** Write store to disk atomically via temp file. */
async function _writeStore(store) {
    const dir = path.dirname(STORE_FILE);
    await fs.mkdir(dir, { recursive: true });
    const tmp = STORE_FILE + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf8');
    await fs.rename(tmp, STORE_FILE);
}

function _emptyStore() {
    return { version: STORE_VERSION, primaryId: null, keys: [] };
}

function _generateId() {
    return crypto.randomBytes(12).toString('hex');
}

const DEFAULT_MODEL = 'gemini-2.5-flash';

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * List keys — returns metadata only (NO raw or encrypted values).
 * Safe to send to renderer.
 * @returns {Promise<{id: string, label: string, model: string, isPrimary: boolean, createdAt: string, updatedAt: string}[]>}
 */
async function listKeys() {
    const store = await _readStore();
    return store.keys.map(({ id, label, model, createdAt, updatedAt }) => ({
        id,
        label,
        model: model || DEFAULT_MODEL,
        isPrimary: id === (store.primaryId ?? store.keys[0]?.id ?? null),
        createdAt,
        updatedAt,
    }));
}

/**
 * Add a new key. Encrypts the raw value before storing.
 * @param {string} label - Human-readable label
 * @param {string} rawValue - Actual API key (AIza...)
 * @param {string} [model] - Gemini model ID
 * @returns {Promise<{id: string}>}
 */
async function addKey(label, rawValue, model) {
    if (!label || typeof label !== 'string' || label.trim().length === 0) {
        throw new Error('Метка ключа не может быть пустой');
    }
    if (!rawValue || typeof rawValue !== 'string') {
        throw new Error('Значение ключа обязательно');
    }
    if (!rawValue.startsWith('AIza') || rawValue.length < 30) {
        throw new Error('Неверный формат API ключа (должен начинаться с AIza и быть длиннее 30 символов)');
    }

    const store = await _readStore();
    const now = new Date().toISOString();
    const id = _generateId();

    store.keys.push({
        id,
        label: label.trim(),
        model: model || DEFAULT_MODEL,
        encryptedValue: encrypt(rawValue),
        createdAt: now,
        updatedAt: now,
    });

    // First key becomes primary automatically
    if (store.keys.length === 1) {
        store.primaryId = id;
    }

    await _writeStore(store);
    logger.info(`[ApiKeyStore] Key added: id=${id}, label="${label.trim()}", model=${model || DEFAULT_MODEL}`);
    return { id };
}

/**
 * Delete a key by id.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function deleteKey(id) {
    if (!id) throw new Error('id обязателен');

    const store = await _readStore();
    const before = store.keys.length;
    store.keys = store.keys.filter(k => k.id !== id);

    if (store.keys.length === before) {
        throw new Error(`Ключ с id "${id}" не найден`);
    }

    // If deleted key was primary, reassign to first remaining
    if (store.primaryId === id) {
        store.primaryId = store.keys[0]?.id ?? null;
    }

    await _writeStore(store);
    logger.info(`[ApiKeyStore] Key deleted: id=${id}`);
    return true;
}

/**
 * Set a key as primary (used first by apiKeyManager).
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function setPrimary(id) {
    if (!id) throw new Error('id обязателен');
    const store = await _readStore();
    if (!store.keys.find(k => k.id === id)) {
        throw new Error(`Ключ с id "${id}" не найден`);
    }
    store.primaryId = id;
    await _writeStore(store);
    logger.info(`[ApiKeyStore] Primary key set: id=${id}`);
    return true;
}

/**
 * Update a key's label.
 * @param {string} id
 * @param {string} newLabel
 * @returns {Promise<boolean>}
 */
async function updateLabel(id, newLabel) {
    if (!id) throw new Error('id обязателен');
    if (!newLabel || newLabel.trim().length === 0) throw new Error('Новая метка не может быть пустой');

    const store = await _readStore();
    const key = store.keys.find(k => k.id === id);
    if (!key) throw new Error(`Ключ с id "${id}" не найден`);

    key.label = newLabel.trim();
    key.updatedAt = new Date().toISOString();

    await _writeStore(store);
    logger.info(`[ApiKeyStore] Key label updated: id=${id}, label="${newLabel.trim()}"`);
    return true;
}

/**
 * Get all decrypted key values — for use in apiKeyManager (main process only).
 * NEVER expose this to renderer via IPC.
 *
 * Entries that fail decryption (encrypted with a different key) are automatically
 * removed from the store so they don't appear as phantom entries in the UI.
 * @returns {Promise<{id: string, label: string, value: string}[]>}
 */
async function getDecryptedKeys() {
    const store = await _readStore();

    const decrypted = store.keys.map(k => ({
        ...k,
        value: decrypt(k.encryptedValue),
    }));

    // Remove entries whose encryption is broken (key mismatch / corruption)
    const broken = decrypted.filter(k => k.value === '[DECRYPTION_ERROR]' || !k.value);
    if (broken.length > 0) {
        const brokenIds = new Set(broken.map(k => k.id));
        logger.warn(`[ApiKeyStore] Removing ${broken.length} undecryptable key(s) from store: ${[...brokenIds].join(', ')}`);
        store.keys = store.keys.filter(k => !brokenIds.has(k.id));
        if (brokenIds.has(store.primaryId)) {
            store.primaryId = store.keys[0]?.id ?? null;
        }
        await _writeStore(store);
    }

    const primaryId = store.primaryId ?? store.keys[0]?.id ?? null;
    const valid = decrypted.filter(k => !broken.includes(k));
    // Sort: primary key first so apiKeyManager uses it as first in rotation
    const sorted = [
        ...valid.filter(k => k.id === primaryId),
        ...valid.filter(k => k.id !== primaryId),
    ];
    return sorted.map(({ id, label, model, value }) => ({
        id,
        label,
        model: model || DEFAULT_MODEL,
        value,
    }));
}

/**
 * Update a key's model.
 * @param {string} id
 * @param {string} model
 * @returns {Promise<boolean>}
 */
async function updateModel(id, model) {
    if (!id) throw new Error('id обязателен');
    if (!model || model.trim().length === 0) throw new Error('Модель не может быть пустой');

    const store = await _readStore();
    const key = store.keys.find(k => k.id === id);
    if (!key) throw new Error(`Ключ с id "${id}" не найден`);

    key.model = model.trim();
    key.updatedAt = new Date().toISOString();

    await _writeStore(store);
    logger.info(`[ApiKeyStore] Key model updated: id=${id}, model="${model.trim()}"`);
    return true;
}

module.exports = { listKeys, addKey, deleteKey, updateLabel, updateModel, setPrimary, getDecryptedKeys };
