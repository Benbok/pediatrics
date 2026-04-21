const { ipcMain, app } = require('electron');
const bcrypt = require('bcryptjs');
const { prisma } = require('./prisma-client.cjs');
const { z } = require('zod');
const { logger, logAudit } = require('./logger.cjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PUBLIC_KEY } = require('./license/verify.cjs');

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

const RoleKeySchema = z.enum(['admin', 'doctor']);

const UserRegistrationSchema = z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(6),
    lastName: z.string().min(1).max(100),
    firstName: z.string().max(100),
    middleName: z.string().max(100).optional().default(''),
    isAdmin: z.boolean().default(false)
});

const UpdateUserSchema = z.object({
    userId: z.number().int().positive(),
    username: z.string().min(3).max(50),
    lastName: z.string().min(1).max(100),
    firstName: z.string().max(100),
    middleName: z.string().max(100).optional().default(''),
    isActive: z.boolean()
});

const SetUserRolesSchema = z.object({
    userId: z.number().int().positive(),
    roles: z.array(RoleKeySchema).min(1)
});

const ResetPasswordSchema = z.object({
    userId: z.number().int().positive(),
    newPassword: z.string().min(6)
});

const DeleteUserSchema = z.object({
    userId: z.number().int().positive()
});

const ChangePasswordSchema = z.object({
    userId: z.number().int().positive(),
    oldPassword: z.string().min(1).optional(),
    newPassword: z.string().min(6)
});

async function getUserRoleKeys(userId) {
    const userRoles = await prisma.userRole.findMany({
        where: { userId },
        select: { role: { select: { key: true } } }
    });
    return userRoles.map(ur => ur.role.key);
}

async function setRolesForUser(tx, userId, roleKeys) {
    const roles = [];
    for (const key of roleKeys) {
        // Ensure role exists (safe for both fresh DB and migrated DB)
        const role = await tx.role.upsert({
            where: { key },
            update: {},
            create: { key },
            select: { id: true, key: true }
        });
        roles.push(role);
    }

    await tx.userRole.deleteMany({ where: { userId } });
    await tx.userRole.createMany({
        data: roles.map(r => ({ userId, roleId: r.id }))
    });

    // Keep legacy is_admin field in sync for now (DB compatibility)
    await tx.user.update({
        where: { id: userId },
        data: { isAdmin: roleKeys.includes('admin') }
    });
}

function privateKeyMatchesEmbeddedPublicKey(privateKeyPath) {
    try {
        const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        const probe = `pediassist-auth-proof:${crypto.randomBytes(24).toString('hex')}`;

        const sign = crypto.createSign('RSA-SHA256');
        sign.update(probe);
        const signature = sign.sign(privateKey, 'base64');

        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(probe);
        return verify.verify(PUBLIC_KEY, signature, 'base64');
    } catch {
        return false;
    }
}

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
                    lastName: true,
                    firstName: true,
                    middleName: true,
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

            const roles = await getUserRoleKeys(user.id);

            // Successful login - set session
            currentSession = {
                isAuthenticated: true,
                user: {
                    id: user.id,
                    username: user.username,
                    lastName: user.lastName,
                    firstName: user.firstName,
                    middleName: user.middleName || '',
                    roles,
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
            const { username, password, lastName, firstName, middleName, isAdmin } = UserRegistrationSchema.parse(userData);

            logger.info(`[Auth] User registration attempt: ${username}`);

            // Check if username already exists
            const existing = await prisma.user.findUnique({ where: { username } });
            if (existing) {
                return { success: false, error: 'Пользователь с таким логином уже существует' };
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            const rolesToAssign = isAdmin ? ['admin', 'doctor'] : ['doctor'];

            const newUser = await prisma.$transaction(async (tx) => {
                const created = await tx.user.create({
                    data: {
                        username,
                        passwordHash,
                        lastName,
                        firstName: firstName ?? '',
                        middleName: middleName ?? '',
                        isAdmin // legacy sync (will be overwritten by setRolesForUser anyway)
                    },
                    select: {
                        id: true,
                        username: true,
                        lastName: true,
                        firstName: true,
                        middleName: true,
                        isActive: true,
                        createdAt: true
                    }
                });

                await setRolesForUser(tx, created.id, rolesToAssign);

                return {
                    ...created,
                    roles: rolesToAssign
                };
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
                    lastName: true,
                    firstName: true,
                    middleName: true,
                    isActive: true,
                    createdAt: true,
                    userRoles: {
                        select: { role: { select: { key: true } } }
                    }
                },
                orderBy: { createdAt: 'asc' }
            });

            return users.map(u => ({
                id: u.id,
                username: u.username,
                lastName: u.lastName,
                firstName: u.firstName || '',
                middleName: u.middleName || '',
                isActive: u.isActive,
                createdAt: u.createdAt,
                roles: u.userRoles.map(ur => ur.role.key)
            }));

        } catch (error) {
            logger.error('[Auth] Get users error:', error);
            throw new Error('Ошибка при загрузке списка пользователей');
        }
    })));

    /**
     * Update User (Admin Only)
     */
    ipcMain.handle('auth:update-user', ensureAuthenticated(ensureAdmin(async (_, data) => {
        try {
            const { userId, username, lastName, firstName, middleName, isActive } = UpdateUserSchema.parse(data);

            // Prevent self-deactivation
            if (userId === currentSession.user.id && !isActive) {
                return { success: false, error: 'Нельзя деактивировать свою учетную запись' };
            }

            const existing = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, username: true }
            });
            if (!existing) {
                return { success: false, error: 'Пользователь не найден' };
            }

            // Username uniqueness check (only if changed)
            if (existing.username !== username) {
                const usernameTaken = await prisma.user.findUnique({
                    where: { username },
                    select: { id: true }
                });
                if (usernameTaken) {
                    return { success: false, error: 'Пользователь с таким логином уже существует' };
                }
            }

            const updated = await prisma.user.update({
                where: { id: userId },
                data: { username, lastName, firstName: firstName ?? '', middleName: middleName ?? '', isActive },
                select: { id: true, username: true, lastName: true, firstName: true, middleName: true, isActive: true, createdAt: true }
            });

            const roles = await getUserRoleKeys(userId);

            // Если обновили текущего пользователя — обновляем сессию, чтобы в шапке сразу отобразились новые данные
            if (userId === currentSession.user.id) {
                currentSession.user = {
                    ...currentSession.user,
                    username: updated.username,
                    lastName: updated.lastName,
                    firstName: updated.firstName || '',
                    middleName: updated.middleName || '',
                    isActive: updated.isActive,
                    roles
                };
            }

            logAudit('USER_UPDATED', { userId, updatedBy: currentSession.user.id });

            return { success: true, user: { ...updated, roles } };
        } catch (error) {
            logger.error('[Auth] Update user error:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: error.errors.map(e => e.message).join(', ') };
            }
            return { success: false, error: 'Ошибка при обновлении пользователя' };
        }
    })));

    /**
     * Set User Roles (Admin Only)
     */
    ipcMain.handle('auth:set-user-roles', ensureAuthenticated(ensureAdmin(async (_, data) => {
        try {
            const { userId, roles } = SetUserRolesSchema.parse(data);

            await prisma.$transaction(async (tx) => {
                await setRolesForUser(tx, userId, roles);
            });

            if (userId === currentSession.user.id) {
                currentSession.user.roles = roles;
            }

            logAudit('USER_ROLES_UPDATED', { userId, roles, updatedBy: currentSession.user.id });

            return { success: true };
        } catch (error) {
            logger.error('[Auth] Set user roles error:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: error.errors.map(e => e.message).join(', ') };
            }
            return { success: false, error: error.message || 'Ошибка при обновлении ролей' };
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
     * Delete User (Admin Only)
     */
    ipcMain.handle('auth:delete-user', ensureAuthenticated(ensureAdmin(async (_, data) => {
        try {
            const { userId } = DeleteUserSchema.parse(data);

            // Cannot delete self
            if (userId === currentSession.user.id) {
                return { success: false, error: 'Нельзя удалить свою учетную запись' };
            }

            const existing = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, username: true }
            });

            if (!existing) {
                return { success: false, error: 'Пользователь не найден' };
            }

            const blockers = await prisma.$transaction(async (tx) => {
                const [
                    childrenCount,
                    visitsCount,
                    notesCount,
                    pdfNotesCount,
                    medicationChangesCount,
                    informedConsentsCount,
                    visitTemplatesCount,
                    medicationTemplatesCount,
                    examTemplatesCount,
                    diagnosticTemplatesCount,
                    recommendationTemplatesCount,
                    feedingPlansCount,
                    sharedByCount,
                    sharedWithCount,
                ] = await Promise.all([
                    tx.child.count({ where: { createdByUserId: userId } }),
                    tx.visit.count({ where: { doctorId: userId } }),
                    tx.diseaseNote.count({ where: { authorId: userId } }),
                    tx.pdfNote.count({ where: { authorId: userId } }),
                    tx.medicationChangeLog.count({ where: { userId } }),
                    tx.informedConsent.count({ where: { doctorId: userId } }),
                    tx.visitTemplate.count({ where: { createdById: userId } }),
                    tx.medicationTemplate.count({ where: { createdById: userId } }),
                    tx.examTextTemplate.count({ where: { createdById: userId } }),
                    tx.diagnosticTemplate.count({ where: { createdById: userId } }),
                    tx.recommendationTemplate.count({ where: { createdById: userId } }),
                    tx.childFeedingPlan.count({ where: { createdByUserId: userId } }),
                    tx.patientShare.count({ where: { sharedBy: userId } }),
                    tx.patientShare.count({ where: { sharedWith: userId } }),
                ]);

                const items = [
                    { label: 'карты пациентов', count: childrenCount },
                    { label: 'приемы', count: visitsCount },
                    { label: 'заметки по заболеваниям', count: notesCount },
                    { label: 'pdf-заметки', count: pdfNotesCount },
                    { label: 'изменения медикаментов', count: medicationChangesCount },
                    { label: 'информированные согласия', count: informedConsentsCount },
                    { label: 'шаблоны приемов', count: visitTemplatesCount },
                    { label: 'шаблоны назначений', count: medicationTemplatesCount },
                    { label: 'шаблоны текста осмотра', count: examTemplatesCount },
                    { label: 'диагностические шаблоны', count: diagnosticTemplatesCount },
                    { label: 'шаблоны рекомендаций', count: recommendationTemplatesCount },
                    { label: 'планы питания', count: feedingPlansCount },
                    { label: 'расшаривания как владелец', count: sharedByCount },
                    { label: 'расшаривания как получатель', count: sharedWithCount },
                ];

                return items.filter((item) => item.count > 0);
            });

            if (blockers.length > 0) {
                const blockerText = blockers.map((b) => `${b.label}: ${b.count}`).join(', ');
                return {
                    success: false,
                    error: `Нельзя удалить пользователя: найдены связанные данные (${blockerText}). Сначала передайте данные другому врачу или деактивируйте учетную запись.`
                };
            }

            await prisma.$transaction(async (tx) => {
                await tx.userRole.deleteMany({ where: { userId } });
                await tx.receptionDaySchedule.deleteMany({ where: { doctorId: userId } });
                await tx.vaccinationRecord.updateMany({ where: { createdByUserId: userId }, data: { createdByUserId: null } });
                await tx.user.delete({ where: { id: userId } });
            });

            logger.info(`[Auth] User deleted: ID ${userId}, username ${existing.username}`);
            logAudit('USER_DELETED', { userId, username: existing.username, deletedBy: currentSession.user.id });

            return { success: true };
        } catch (error) {
            logger.error('[Auth] Delete user error:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: error.errors.map(e => e.message).join(', ') };
            }
            return { success: false, error: 'Ошибка при удалении пользователя' };
        }
    })));

    /**
     * Change Password (Own or Admin for others)
     */
    ipcMain.handle('auth:change-password', ensureAuthenticated(async (_, data) => {
        try {
            const { userId, oldPassword, newPassword } = ChangePasswordSchema.parse(data);

            const isAdmin = Boolean(currentSession.user.roles?.includes('admin'));

            // Users can only change their own password unless they're admin
            if (userId !== currentSession.user.id && !isAdmin) {
                return { success: false, error: 'Недостаточно прав' };
            }

            // If changing own password, verify old password
            if (userId === currentSession.user.id) {
                if (!oldPassword) {
                    return { success: false, error: 'Нужно указать текущий пароль' };
                }
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
            if (error instanceof z.ZodError) {
                return { success: false, error: error.errors.map(e => e.message).join(', ') };
            }
            return { success: false, error: 'Ошибка при смене пароля' };
        }
    }));

    /**
     * Reset Password (Admin Only)
     */
    ipcMain.handle('auth:reset-password', ensureAuthenticated(ensureAdmin(async (_, data) => {
        try {
            const { userId, newPassword } = ResetPasswordSchema.parse(data);

            // Hash new password
            const passwordHash = await bcrypt.hash(newPassword, 10);

            await prisma.user.update({
                where: { id: userId },
                data: { passwordHash }
            });

            logger.info(`[Auth] Password reset for user ID: ${userId}`);
            logAudit('PASSWORD_RESET', { userId, resetBy: currentSession.user.id });

            return { success: true };
        } catch (error) {
            logger.error('[Auth] Reset password error:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: error.errors.map(e => e.message).join(', ') };
            }
            return { success: false, error: 'Ошибка при сбросе пароля' };
        }
    })));

    // ── auth:is-first-run ──────────────────────────────────────────────────────
    // Возвращает { isFirstRun: boolean } — нет ли пользователей в БД.
    // Не требует аутентификации.
    ipcMain.handle('auth:is-first-run', async () => {
        try {
            const count = await prisma.user.count();
            return { isFirstRun: count === 0 };
        } catch (err) {
            logger.error('[Auth] is-first-run error:', err.message);
            return { isFirstRun: false };
        }
    });

    // ── auth:first-run-user-setup ──────────────────────────────────────────────
    // Создаёт первого пользователя (doctor) на клиентской машине при первом запуске.
    // Требует: userCount === 0 И валидная лицензия (license.json на диске).
    // НЕ требует private.pem — это пользовательский сценарий, не администраторский.
    // Не требует аутентификации.
    ipcMain.handle('auth:first-run-user-setup', async (_, data) => {
        try {
            const { username, password, lastName } = data || {};

            if (!username || username.trim().length < 3) {
                return { success: false, error: 'Логин должен быть минимум 3 символа' };
            }
            if (!password || password.length < 6) {
                return { success: false, error: 'Пароль должен быть минимум 6 символов' };
            }

            // Guard 1: no users yet (idempotency — cannot call twice)
            const count = await prisma.user.count();
            if (count > 0) {
                return { success: false, error: 'Первоначальная настройка уже была выполнена' };
            }

            // Guard 2: valid license must already be imported on this machine.
            // We reuse checkCurrentLicense from license/handlers.cjs.
            const { checkCurrentLicense } = require('./license/handlers.cjs');
            const licenseResult = await checkCurrentLicense();
            if (!licenseResult.valid && !licenseResult.devMode) {
                return { success: false, error: 'Лицензия не найдена или недействительна. Сначала импортируйте license.json.' };
            }

            const passwordHash = await bcrypt.hash(password.trim(), 10);

            const newUser = await prisma.$transaction(async (tx) => {
                const created = await tx.user.create({
                    data: {
                        username: username.trim(),
                        passwordHash,
                        lastName: (lastName || '').trim(),
                        firstName: '',
                        middleName: '',
                        isAdmin: false,
                        isActive: true,
                    },
                });

                const roleDoctor = await tx.role.upsert({
                    where: { key: 'doctor' },
                    update: {},
                    create: { key: 'doctor' },
                });

                await tx.userRole.create({
                    data: { userId: created.id, roleId: roleDoctor.id },
                });

                return created;
            });

            logger.info(`[Auth] First-run user setup complete. Doctor user "${newUser.username}" created.`);
            logAudit('FIRST_RUN_USER_SETUP', { userId: newUser.id, username: newUser.username });

            return { success: true, username: newUser.username };
        } catch (err) {
            logger.error('[Auth] first-run-user-setup error:', err.message);
            return { success: false, error: err.message };
        }
    });

    // ── auth:first-run-setup ───────────────────────────────────────────────────
    // Создаёт первого пользователя (admin) при первом запуске.
    // Защищено двойной проверкой: userCount === 0 И приватный ключ уже импортирован.
    // Не требует аутентификации.
    ipcMain.handle('auth:first-run-setup', async (_, data) => {
        try {
            const { username, password } = data || {};

            if (!username || username.trim().length < 3) {
                return { success: false, error: 'Логин должен быть минимум 3 символа' };
            }
            if (!password || password.length < 6) {
                return { success: false, error: 'Пароль должен быть минимум 6 символов' };
            }

            // Guard 1: no users yet
            const count = await prisma.user.count();
            if (count > 0) {
                return { success: false, error: 'Первоначальная настройка уже была выполнена' };
            }

            // Guard 2: private key must exist and match embedded PUBLIC_KEY
            const keyInUserData = path.join(app.getPath('userData'), 'private.pem');
            const keyDevFallback = path.join(__dirname, '..', 'keys', 'private.pem');

            let selectedKeyPath = null;
            if (fs.existsSync(keyInUserData)) {
                selectedKeyPath = keyInUserData;
            } else if (!app.isPackaged && fs.existsSync(keyDevFallback)) {
                selectedKeyPath = keyDevFallback;
            }

            if (!selectedKeyPath) {
                return { success: false, error: 'Приватный ключ не найден. Сначала импортируйте private.pem.' };
            }

            if (!privateKeyMatchesEmbeddedPublicKey(selectedKeyPath)) {
                return { success: false, error: 'Приватный ключ не соответствует PUBLIC_KEY приложения.' };
            }

            const passwordHash = await bcrypt.hash(password.trim(), 10);

            const newUser = await prisma.$transaction(async (tx) => {
                const created = await tx.user.create({
                    data: {
                        username: username.trim(),
                        passwordHash,
                        lastName: 'Разработчик',
                        firstName: '',
                        middleName: '',
                        isAdmin: true,
                        isActive: true,
                    },
                });

                const roleAdmin = await tx.role.upsert({
                    where: { key: 'admin' },
                    update: {},
                    create: { key: 'admin' },
                });

                await tx.userRole.create({
                    data: { userId: created.id, roleId: roleAdmin.id },
                });

                return created;
            });

            logger.info(`[Auth] First-run setup complete. Admin user "${newUser.username}" created.`);
            logAudit('FIRST_RUN_SETUP', { userId: newUser.id, username: newUser.username });

            return { success: true, username: newUser.username };
        } catch (err) {
            logger.error('[Auth] first-run-setup error:', err.message);
            return { success: false, error: err.message };
        }
    });
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
        const roles = currentSession.user?.roles || [];
        if (!roles.includes('admin')) {
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
