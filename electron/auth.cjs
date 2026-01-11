const { ipcMain, safeStorage } = require('electron');
const bcrypt = require('bcryptjs');
const { logger, logAudit } = require('./logger.cjs');

/**
 * AUTHENTICATION SERVICE (Backend)
 * 
 * Handles:
 * - Admin login validation
 * - Session state (simple memory-based for now, as it's a desktop app)
 */

let isAuthenticated = false;

function setupAuthHandlers() {
    logger.info('[Auth] Setting up authentication handlers...');

    ipcMain.handle('auth:login', async (_, credentials) => {
        const { username, password } = credentials;

        logger.info(`[Auth] Login attempt for user: ${username}`);
        // Load credentials from environment
        const adminUser = process.env.ADMIN_LOGIN || 'admin';
        const adminPass = process.env.ADMIN_PASSWORD;

        if (!adminPass) {
            logger.error('[Auth] CRITICAL: ADMIN_PASSWORD not set in .env');
            return { success: false, error: 'Ошибка конфигурации сервера (ADMIN_PASSWORD не установлен)' };
        }

        // Secure comparison using bcrypt if it's a hash, otherwise direct comparison
        let isMatch = false;
        if (adminPass.startsWith('$2a$') || adminPass.startsWith('$2b$')) {
            // It's a bcrypt hash
            isMatch = await bcrypt.compare(password, adminPass);
        } else {
            // It's a plain text password (not recommended for production)
            isMatch = (password === adminPass);
            if (isMatch) {
                logger.warn('[Auth] Plain text password used in .env. Please replace with a bcrypt hash.');
            }
        }

        if (username === adminUser && isMatch) {
            isAuthenticated = true;
            logger.info(`[Auth] Login successful for user: ${username}`);
            logAudit('LOGIN_SUCCESS', { user: username });
            return { success: true };
        }

        logger.warn(`[Auth] Failed login attempt for user: ${username}`);
        logAudit('LOGIN_FAILED', { user: username });
        return { success: false, error: 'Неверный логин или пароль' };
    });

    ipcMain.handle('auth:logout', async () => {
        isAuthenticated = false;
        logger.info('[Auth] User logged out');
        logAudit('LOGOUT');
        return { success: true };
    });

    ipcMain.handle('auth:check-session', async () => {
        return isAuthenticated;
    });
}

/**
 * Middleware for other IPC handlers to ensure they are authorized
 */
function ensureAuthenticated(handler) {
    return async (event, ...args) => {
        if (!isAuthenticated) {
            logger.warn(`[Auth] Unauthorized IPC call attempted: ${event.channel}`);
            logAudit('UNAUTHORIZED_ACCESS_ATTEMPT', { channel: event.channel });
            throw new Error('Unauthorized');
        }
        return handler(event, ...args);
    };
}

module.exports = { setupAuthHandlers, ensureAuthenticated };
