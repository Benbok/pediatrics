/**
 * migrate-db.cjs
 *
 * Applies Prisma migration SQL files to the SQLite database using better-sqlite3 directly.
 * Called on every app startup before any Prisma queries are executed.
 * Safe to call multiple times — already-applied migrations are skipped.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
);
`;

/**
 * Generates a UUID v4.
 */
function uuidv4() {
    return crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomBytes(16).toString('hex');
}

/**
 * Computes SHA-256 checksum of a string (matches Prisma's checksum format).
 */
function checksum(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Applies all pending Prisma migrations to the given database file.
 * Uses better-sqlite3 synchronously — safe to call before app.whenReady resolves.
 *
 * @param {string} dbFilePath  - Absolute path to the SQLite database file
 * @param {string} [logger]    - Optional logger object with .info() / .warn() / .error()
 */
function runMigrations(dbFilePath, log) {
    const info = log ? (msg) => log.info(msg) : (msg) => console.log('[Migrate]', msg);
    const warn = log ? (msg) => log.warn(msg) : (msg) => console.warn('[Migrate]', msg);
    const error = log ? (msg) => log.error(msg) : (msg) => console.error('[Migrate]', msg);

    const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');

    if (!fs.existsSync(migrationsDir)) {
        warn(`Migrations directory not found: ${migrationsDir}. Skipping.`);
        return;
    }

    let db;
    try {
        db = new Database(dbFilePath);
        db.pragma('journal_mode = WAL');
        db.pragma('busy_timeout = 5000');

        // Ensure _prisma_migrations table exists
        db.exec(MIGRATIONS_TABLE);

        // Load already-applied migration names
        const applied = new Set(
            db.prepare('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL').all()
                .map((r) => r.migration_name)
        );

        // Read and sort migration folders by name (timestamp prefix ensures order)
        const migrationFolders = fs.readdirSync(migrationsDir)
            .filter((name) => {
                const fullPath = path.join(migrationsDir, name);
                return fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'migration.sql'));
            })
            .sort();

        let appliedCount = 0;
        let skippedCount = 0;

        for (const folderName of migrationFolders) {
            if (applied.has(folderName)) {
                skippedCount++;
                continue;
            }

            const sqlPath = path.join(migrationsDir, folderName, 'migration.sql');
            const sql = fs.readFileSync(sqlPath, 'utf8');
            const sqlChecksum = checksum(sql);
            const id = uuidv4();
            const startedAt = new Date().toISOString();

            try {
                // Execute the migration SQL (may contain multiple statements)
                db.exec(sql);

                db.prepare(
                    `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
                     VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`
                ).run(id, sqlChecksum, new Date().toISOString(), folderName, startedAt);

                info(`Applied migration: ${folderName}`);
                appliedCount++;
            } catch (err) {
                error(`Failed to apply migration ${folderName}: ${err.message}`);
                // Record failed migration in _prisma_migrations so it's visible
                try {
                    db.prepare(
                        `INSERT OR IGNORE INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
                         VALUES (?, ?, NULL, ?, ?, NULL, ?, 0)`
                    ).run(id, sqlChecksum, folderName, err.message, startedAt);
                } catch (_) { /* ignore insert error */ }
                // Continue with remaining migrations — some may be additive and still work
            }
        }

        info(`Migrations complete. Applied: ${appliedCount}, Already up-to-date: ${skippedCount}`);
    } finally {
        if (db) {
            try { db.close(); } catch (_) { /* ignore */ }
        }
    }
}

module.exports = { runMigrations };
