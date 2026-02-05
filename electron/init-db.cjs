const { prisma } = require('./prisma-client.cjs');
const bcrypt = require('bcryptjs');
const { logger } = require('./logger.cjs');

/**
 * DATABASE INITIALIZATION
 * 
 * Creates the first admin user if the users table is empty.
 * Uses credentials from .env.local (ADMIN_LOGIN and ADMIN_PASSWORD).
 */
async function initializeDatabase() {
    try {
        logger.info('[DB Init] Checking database initialization status...');

        // Устанавливаем busy_timeout для SQLite перед операциями
        await prisma.$executeRawUnsafe(`PRAGMA busy_timeout = 5000`);

        // Check if users table is empty
        const userCount = await prisma.user.count();

        if (userCount === 0) {
            logger.info('[DB Init] No users found. Creating first admin user...');

            const adminLogin = process.env.ADMIN_LOGIN || 'admin';
            const adminPassword = process.env.ADMIN_PASSWORD;

            if (!adminPassword) {
                logger.error('[DB Init] CRITICAL: ADMIN_PASSWORD not set in .env.local');
                throw new Error('ADMIN_PASSWORD must be set in .env.local for first-time setup');
            }

            // Hash password (handle both plain text and bcrypt hash)
            let passwordHash;
            if (adminPassword.startsWith('$2a$') || adminPassword.startsWith('$2b$')) {
                // Already a bcrypt hash
                passwordHash = adminPassword;
            } else {
                // Plain text - hash it
                passwordHash = await bcrypt.hash(adminPassword, 10);
                logger.warn('[DB Init] Plain text password found in .env.local. Consider using bcrypt hash.');
            }

            // Create first admin user and assign admin+doctor roles (in one transaction)
            const admin = await prisma.$transaction(async (tx) => {
                const created = await tx.user.create({
                    data: {
                        username: adminLogin,
                        passwordHash: passwordHash,
                        lastName: 'Администратор',
                        firstName: '',
                        middleName: '',
                        isAdmin: true,
                        isActive: true
                    }
                });

                // Ensure roles exist and assign admin + doctor to first user
                const roleAdmin = await tx.role.upsert({
                    where: { key: 'admin' },
                    update: {},
                    create: { key: 'admin' }
                });
                const roleDoctor = await tx.role.upsert({
                    where: { key: 'doctor' },
                    update: {},
                    create: { key: 'doctor' }
                });

                await tx.userRole.createMany({
                    data: [
                        { userId: created.id, roleId: roleAdmin.id },
                        { userId: created.id, roleId: roleDoctor.id }
                    ]
                });

                return created;
            });

            logger.info(`[DB Init] First admin user created: ${admin.username} (ID: ${admin.id}) with roles admin+doctor`);

            return { initialized: true, adminCreated: true };
        } else {
            logger.info(`[DB Init] Database already initialized (${userCount} users found)`);

            // Ensure every user has roles (fix users created before role migration or without roles)
            // NOTE: Use raw SQL to avoid relying on Prisma relation field presence in generated client.
            const usersWithoutRoles = await prisma.$queryRawUnsafe(`
                SELECT u.id as id, u.is_admin as isAdmin
                FROM users u
                WHERE NOT EXISTS (
                    SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
                )
            `);
            if (usersWithoutRoles.length > 0) {
                logger.info(`[DB Init] Assigning roles to ${usersWithoutRoles.length} user(s) that have no roles`);
                const roleAdmin = await prisma.role.upsert({ where: { key: 'admin' }, update: {}, create: { key: 'admin' } });
                const roleDoctor = await prisma.role.upsert({ where: { key: 'doctor' }, update: {}, create: { key: 'doctor' } });
                for (const u of usersWithoutRoles) {
                    const roles = Boolean(u.isAdmin) ? [roleAdmin.id, roleDoctor.id] : [roleDoctor.id];
                    await prisma.userRole.createMany({
                        data: roles.map(roleId => ({ userId: u.id, roleId }))
                    });
                }
            }

            return { initialized: true, adminCreated: false };
        }

    } catch (error) {
        logger.error('[DB Init] Initialization failed:', error);
        throw error;
    }
}

module.exports = { initializeDatabase };
