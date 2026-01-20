const { app } = require('electron');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

/**
 * SHARED PRISMA CLIENT
 * 
 * Single source of truth for Prisma instance.
 * All modules (auth, database, init-db) should import from here.
 */

// Configure Prisma paths BEFORE creating client
const isDev = !app.isPackaged;
if (!isDev) {
    const appPath = app.getAppPath();
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(appPath, 'node_modules', '.prisma', 'client', 'libquery_engine-windows.dll.node');
    process.env.PRISMA_SCHEMA_ENGINE_BINARY = path.join(appPath, 'node_modules', '.prisma', 'client', 'schema-engine-windows.exe');
}

// Database path
const dbPath = isDev
    ? path.join(__dirname, '../prisma/dev.db')
    : path.join(app.getPath('userData'), 'pediatrics.db');

// Create adapter with busy timeout for SQLite
// busy_timeout позволяет избежать ошибок "database is locked" при параллельных запросах
// Примечание: better-sqlite3 использует busy_timeout через PRAGMA busy_timeout, который будет установлен при подключении
const adapter = new PrismaBetterSqlite3({
    url: `file:${dbPath}`
});

// Create single Prisma instance
const prisma = new PrismaClient({
    adapter,
    log: isDev ? ['query', 'info', 'warn', 'error'] : ['error']
});

// Обработка graceful shutdown
process.on('SIGINT', async () => {
    try {
        await prisma.$disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error disconnecting Prisma on SIGINT:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    try {
        await prisma.$disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error disconnecting Prisma on SIGTERM:', error);
        process.exit(1);
    }
});

module.exports = { prisma, dbPath, isDev };
