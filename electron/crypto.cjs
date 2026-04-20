const crypto = require('crypto');

/**
 * CRYPTO SERVICE
 * 
 * Handles sensing data encryption and key derivation.
 * Uses PBKDF2 for key derivation and AES-256-GCM for field-level encryption.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

/**
 * Derive a 32-byte key from the environment secret
 */
function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a string
 */
function encrypt(text) {
    if (!text) return text;
    const secret = process.env.DB_ENCRYPTION_KEY;
    if (!secret) throw new Error('DB_ENCRYPTION_KEY is not set');

    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(secret, salt);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Format: salt:iv:tag:encrypted
    return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string
 */
/**
 * Check if a string is in the encrypted format: salt(32h):iv(24h):tag(32h):data(hex)
 * More reliable than a simple colon check — JSON strings often contain colons too.
 */
function isEncrypted(value) {
    if (!value || typeof value !== 'string') return false;
    // salt=32 hex, colon at 32, iv=24 hex, colon at 57, tag=32 hex, colon at 90, data follows
    if (value.length <= 91) return false;
    if (value[32] !== ':' || value[57] !== ':' || value[90] !== ':') return false;
    const salt = value.slice(0, 32);
    const iv   = value.slice(33, 57);
    const tag  = value.slice(58, 90);
    return /^[0-9a-f]+$/i.test(salt) &&
           /^[0-9a-f]+$/i.test(iv) &&
           /^[0-9a-f]+$/i.test(tag);
}

/**
 * Decrypt a string
 */
function decrypt(encryptedData) {
    if (!isEncrypted(encryptedData)) return encryptedData;

    const secret = process.env.DB_ENCRYPTION_KEY;
    if (!secret) throw new Error('DB_ENCRYPTION_KEY is not set');

    try {
        const [saltHex, ivHex, tagHex, encryptedText] = encryptedData.split(':');

        const salt = Buffer.from(saltHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const key = deriveKey(secret, salt);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error);
        return '[DECRYPTION_ERROR]';
    }
}

module.exports = { encrypt, decrypt, isEncrypted };
