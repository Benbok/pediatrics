const fs = require('fs');
const path = require('path');
const { logger, logAudit } = require('./logger.cjs');
const { getPaths } = require('./config/paths.cjs');

/**
 * BACKUP SERVICE
 *
 * Manages automated and manual backups of the database.
 * Backup directory is determined by paths.cjs (supports portable mode).
 */

const MAX_BACKUPS = 10;
const backupDir = getPaths().backupDir;

/**
 * Create a backup of the current database
 */
async function createBackup(dbPath) {
    logger.info('[Backup] Starting database backup...');

    try {
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
        const dateStr = timestamp[0];
        const timeStr = timestamp[1].split('Z')[0];

        const backupFileName = `pediatrics_backup_${dateStr}_${timeStr}.db`;
        const backupPath = path.join(backupDir, backupFileName);

        // Perform the copy
        await fs.promises.copyFile(dbPath, backupPath);

        logger.info(`[Backup] Created backup: ${backupPath}`);
        logAudit('DATABASE_BACKUP_CREATED', { path: backupFileName });

        // Cleanup old backups
        await cleanupOldBackups();

        return { success: true, path: backupPath };
    } catch (error) {
        logger.error('[Backup] Failed to create backup:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Cleanup old backups, keeping only the most recent ones
 */
async function cleanupOldBackups() {
    try {
        const files = await fs.promises.readdir(backupDir);
        const backupFiles = files
            .filter(f => f.startsWith('pediatrics_backup_') && f.endsWith('.db'))
            .map(f => ({
                name: f,
                path: path.join(backupDir, f),
                time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Newest first

        if (backupFiles.length > MAX_BACKUPS) {
            const toDelete = backupFiles.slice(MAX_BACKUPS);
            for (const file of toDelete) {
                await fs.promises.unlink(file.path);
                logger.info(`[Backup] Deleted old backup: ${file.name}`);
            }
        }
    } catch (error) {
        logger.error('[Backup] Failed to cleanup old backups:', error);
    }
}

/**
 * Check if a backup was already made today
 */
async function shouldBackupToday() {
    try {
        if (!fs.existsSync(backupDir)) return true;

        const files = await fs.promises.readdir(backupDir);
        const today = new Date().toISOString().split('T')[0];

        const backupToday = files.some(f => f.includes(`backup_${today}`));
        return !backupToday;
    } catch (error) {
        return true;
    }
}

/**
 * Create a backup only if the database has been modified since the last backup.
 * Used on app close to capture any changes made during the session.
 */
async function createBackupIfChanged(dbPath) {
    try {
        if (!fs.existsSync(dbPath)) return { success: false, reason: 'db_not_found' };

        const dbMtime = fs.statSync(dbPath).mtimeMs;

        // Find the most recent backup
        if (fs.existsSync(backupDir)) {
            const files = await fs.promises.readdir(backupDir);
            const backupFiles = files
                .filter(f => f.startsWith('pediatrics_backup_') && f.endsWith('.db'))
                .map(f => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
                .sort((a, b) => b.mtime - a.mtime);

            if (backupFiles.length > 0 && backupFiles[0].mtime >= dbMtime) {
                logger.info('[Backup] DB unchanged since last backup — skipping close-backup.');
                return { success: true, skipped: true };
            }
        }

        logger.info('[Backup] DB changed since last backup — creating close-backup...');
        return await createBackup(dbPath);
    } catch (error) {
        logger.error('[Backup] createBackupIfChanged failed:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { createBackup, shouldBackupToday, createBackupIfChanged };
