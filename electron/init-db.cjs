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

            // Create first admin user
            const admin = await prisma.user.create({
                data: {
                    username: adminLogin,
                    passwordHash: passwordHash,
                    fullName: 'Администратор',
                    isAdmin: true,
                    isActive: true
                }
            });

            logger.info(`[DB Init] First admin user created: ${admin.username} (ID: ${admin.id})`);

            return { initialized: true, adminCreated: true };
        } else {
            logger.info(`[DB Init] Database already initialized (${userCount} users found)`);
            return { initialized: true, adminCreated: false };
        }

    } catch (error) {
        logger.error('[DB Init] Initialization failed:', error);
        throw error;
    }
}

module.exports = { initializeDatabase };
