const winston = require('winston');
const path = require('path');
const { app } = require('electron');

/**
 * LOGGER SERVICE
 * 
 * Provides centralized logging with rotation and audit trail capabilities.
 * Logs are stored in the user data directory.
 */

const logDir = path.join(app.getPath('userData'), 'logs');

// Custom format for readable logs
const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] : ${message} `;
    if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
        msg += JSON.stringify(metadata);
    }
    if (metadata.stack) {
        msg += `\n${metadata.stack}`;
    }
    return msg;
});

// Main App Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'pediassist-main' },
    transports: [
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
        }),
    ],
});

// Audit Trail Logger (Strictly for security events)
const auditLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
    ),
    defaultMeta: { service: 'audit-trail' },
    transports: [
        new winston.transports.File({
            filename: path.join(logDir, 'audit.log'),
            maxsize: 20971520, // 20MB
            maxFiles: 10,
        }),
    ],
});

// If in development, log to console as well
if (process.env.NODE_ENV !== 'production') {
    const consoleFormat = winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        customFormat
    );

    logger.add(new winston.transports.Console({
        format: consoleFormat,
    }));

    auditLogger.add(new winston.transports.Console({
        format: consoleFormat,
    }));
}

/**
 * Standardized Audit Action Logging
 */
function logAudit(action, details = {}) {
    auditLogger.info(action, {
        ...details,
        timestamp: new Date().toISOString(),
    });
}

module.exports = { logger, auditLogger, logAudit };
