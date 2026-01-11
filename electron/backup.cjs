const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { logger, logAudit } = require('./logger.cjs');

/**
 * BACKUP SERVICE
 * 
 * Manages automated and manual backups of the database.
 * Stores backups in the user data directory.
 */

const MAX_BACKUPS = 10;
const backupDir = path.join(app.getPath('userData'), 'backups');

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

module.exports = { createBackup, shouldBackupToday };
