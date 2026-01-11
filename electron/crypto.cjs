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
function decrypt(encryptedData) {
    if (!encryptedData || !encryptedData.includes(':')) return encryptedData;

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

module.exports = { encrypt, decrypt };
