const { ipcMain } = require('electron');
const bcrypt = require('bcryptjs');
const { prisma } = require('./prisma-client.cjs');
const { z } = require('zod');
const { logger, logAudit } = require('./logger.cjs');

/**
 * AUTHENTICATION SERVICE (Backend)
 * 
 * Multi-User System:
 * - Database-backed user authentication
 * - Session management with current user context
 * - User registration (admin only)
 * - Password management
 */

// Session state (in-memory for desktop app)
let currentSession = {
    isAuthenticated: false,
    user: null // Full User object
};

// Validation schemas
const LoginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1)
});

const UserRegistrationSchema = z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(6),
    fullName: z.string().min(2).max(100),
    isAdmin: z.boolean().default(false)
});

function setupAuthHandlers() {
    logger.info('[Auth] Setting up multi-user authentication handlers...');

    /**
     * Login Handler
     */
    ipcMain.handle('auth:login', async (_, credentials) => {
        try {
            const { username, password } = LoginSchema.parse(credentials);

            logger.info(`[Auth] Login attempt for user: ${username}`);

            // Find user in database
            const user = await prisma.user.findUnique({
                where: { username },
                select: {
                    id: true,
                    username: true,
                    passwordHash: true,
                    fullName: true,
                    isAdmin: true,
                    isActive: true
                }
            });

            if (!user) {
                logger.warn(`[Auth] User not found: ${username}`);
                logAudit('LOGIN_FAILED', { user: username, reason: 'user_not_found' });
                return { success: false, error: 'Неверный логин или пароль' };
            }

            if (!user.isActive) {
                logger.warn(`[Auth] Inactive user attempted login: ${username}`);
                logAudit('LOGIN_FAILED', { user: username, reason: 'user_inactive' });
                return { success: false, error: 'Учетная запись деактивирована' };
            }

            // Verify password
            const isMatch = await bcrypt.compare(password, user.passwordHash);

            if (!isMatch) {
                logger.warn(`[Auth] Invalid password for user: ${username}`);
                logAudit('LOGIN_FAILED', { user: username, reason: 'invalid_password' });
                return { success: false, error: 'Неверный логин или пароль' };
            }

            // Successful login - set session
            currentSession = {
                isAuthenticated: true,
                user: {
                    id: user.id,
                    username: user.username,
                    fullName: user.fullName,
                    isAdmin: user.isAdmin,
                    isActive: user.isActive
                }
            };

            logger.info(`[Auth] Login successful for user: ${username} (ID: ${user.id})`);
            logAudit('LOGIN_SUCCESS', { userId: user.id, username: user.username });

            return {
                success: true,
                user: currentSession.user
            };

        } catch (error) {
            logger.error('[Auth] Login error:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: 'Некорректные данные входа' };
            }
            return { success: false, error: 'Ошибка при входе в систему' };
        }
    });

    /**
     * Logout Handler
     */
    ipcMain.handle('auth:logout', async () => {
        const username = currentSession.user?.username || 'unknown';
        currentSession = { isAuthenticated: false, user: null };

        logger.info(`[Auth] User logged out: ${username}`);
        logAudit('LOGOUT', { username });

        return { success: true };
    });

    /**
     * Check Session Handler
     */
    ipcMain.handle('auth:check-session', async () => {
        return {
            isAuthenticated: currentSession.isAuthenticated,
            user: currentSession.user
        };
    });

    /**
     * Register New User (Admin Only)
     */
    ipcMain.handle('auth:register-user', ensureAuthenticated(ensureAdmin(async (_, userData) => {
        try {
            const { username, password, fullName, isAdmin } = UserRegistrationSchema.parse(userData);

            logger.info(`[Auth] User registration attempt: ${username}`);

            // Check if username already exists
            const existing = await prisma.user.findUnique({ where: { username } });
            if (existing) {
                return { success: false, error: 'Пользователь с таким логином уже существует' };
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // Create user
            const newUser = await prisma.user.create({
                data: {
                    username,
                    passwordHash,
                    fullName,
                    isAdmin
                },
                select: {
                    id: true,
                    username: true,
                    fullName: true,
                    isAdmin: true,
                    isActive: true,
                    createdAt: true
                }
            });

            logger.info(`[Auth] User registered: ${username} (ID: ${newUser.id})`);
            logAudit('USER_REGISTERED', {
                userId: newUser.id,
                username: newUser.username,
                registeredBy: currentSession.user.id
            });

            return { success: true, user: newUser };

        } catch (error) {
            logger.error('[Auth] User registration error:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: error.errors.map(e => e.message).join(', ') };
            }
            return { success: false, error: 'Ошибка при создании пользователя' };
        }
    })));

    /**
     * Get All Users (Admin Only)
     */
    ipcMain.handle('auth:get-all-users', ensureAuthenticated(ensureAdmin(async () => {
        try {
            const users = await prisma.user.findMany({
                select: {
                    id: true,
                    username: true,
                    fullName: true,
                    isAdmin: true,
                    isActive: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'asc' }
            });

            return users;

        } catch (error) {
            logger.error('[Auth] Get users error:', error);
            throw new Error('Ошибка при загрузке списка пользователей');
        }
    })));

    /**
     * Deactivate User (Admin Only)
     */
    ipcMain.handle('auth:deactivate-user', ensureAuthenticated(ensureAdmin(async (_, userId) => {
        try {
            // Cannot deactivate self
            if (userId === currentSession.user.id) {
                return { success: false, error: 'Нельзя деактивировать свою учетную запись' };
            }

            await prisma.user.update({
                where: { id: userId },
                data: { isActive: false }
            });

            logger.info(`[Auth] User deactivated: ID ${userId}`);
            logAudit('USER_DEACTIVATED', { userId, deactivatedBy: currentSession.user.id });

            return { success: true };

        } catch (error) {
            logger.error('[Auth] Deactivate user error:', error);
            return { success: false, error: 'Ошибка при деактивации пользователя' };
        }
    })));

    /**
     * Activate User (Admin Only)
     */
    ipcMain.handle('auth:activate-user', ensureAuthenticated(ensureAdmin(async (_, userId) => {
        try {
            await prisma.user.update({
                where: { id: userId },
                data: { isActive: true }
            });

            logger.info(`[Auth] User activated: ID ${userId}`);
            logAudit('USER_ACTIVATED', { userId, activatedBy: currentSession.user.id });

            return { success: true };

        } catch (error) {
            logger.error('[Auth] Activate user error:', error);
            return { success: false, error: 'Ошибка при активации пользователя' };
        }
    })));

    /**
     * Change Password (Own or Admin for others)
     */
    ipcMain.handle('auth:change-password', ensureAuthenticated(async (_, data) => {
        try {
            const { userId, oldPassword, newPassword } = data;

            // Users can only change their own password unless they're admin
            if (userId !== currentSession.user.id && !currentSession.user.isAdmin) {
                return { success: false, error: 'Недостаточно прав' };
            }

            // If changing own password, verify old password
            if (userId === currentSession.user.id) {
                const user = await prisma.user.findUnique({ where: { id: userId } });
                const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);

                if (!isMatch) {
                    return { success: false, error: 'Неверный текущий пароль' };
                }
            }

            // Hash new password
            const passwordHash = await bcrypt.hash(newPassword, 10);

            // Update password
            await prisma.user.update({
                where: { id: userId },
                data: { passwordHash }
            });

            logger.info(`[Auth] Password changed for user ID: ${userId}`);
            logAudit('PASSWORD_CHANGED', { userId, changedBy: currentSession.user.id });

            return { success: true };

        } catch (error) {
            logger.error('[Auth] Change password error:', error);
            return { success: false, error: 'Ошибка при смене пароля' };
        }
    }));
}

/**
 * Middleware: Ensure user is authenticated
 */
function ensureAuthenticated(handler) {
    return async (event, ...args) => {
        if (!currentSession.isAuthenticated) {
            logger.warn(`[Auth] Unauthorized IPC call attempted: ${event.channel}`);
            logAudit('UNAUTHORIZED_ACCESS_ATTEMPT', { channel: event.channel });
            throw new Error('Unauthorized');
        }
        return handler(event, ...args);
    };
}

/**
 * Middleware: Ensure user is admin
 */
function ensureAdmin(handler) {
    return async (event, ...args) => {
        if (!currentSession.user?.isAdmin) {
            logger.warn(`[Auth] Non-admin user attempted admin action: ${event.channel}`);
            logAudit('ADMIN_ACCESS_DENIED', {
                userId: currentSession.user?.id,
                channel: event.channel
            });
            throw new Error('Admin access required');
        }
        return handler(event, ...args);
    };
}

/**
 * Get current session (for use by other backend modules)
 */
function getSession() {
    return currentSession;
}

/**
 * Get current user from event or session
 */
function getCurrentUser(event) {
    // In Electron, we can get user from session
    // Event is passed but we use session for simplicity
    return currentSession.user;
}

module.exports = {
    setupAuthHandlers,
    ensureAuthenticated,
    ensureAdmin,
    getSession,
    getCurrentUser
};
