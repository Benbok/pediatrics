const winston = require('winston');
const path = require('path');
const { app } = require('electron');

/**
 * LOGGER SERVICE
 * 
 * Provides centralized logging with rotation and audit trail capabilities.
 * Logs are stored in the user data directory.
 */

const userDataPath = app && typeof app.getPath === 'function'
    ? app.getPath('userData')
    : process.cwd();
const logDir = path.join(userDataPath, 'logs');

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

/**
 * CDSS degradation stats (in-memory, for monitoring which fallbacks are used)
 */
const degradationStats = {
    parseAI: 0,
    parseFallback: 0,
    normalizeAI: 0,
    normalizeDictionary: 0,
    searchSemantic: 0,
    searchKeyword: 0,
    rankAI: 0,
    rankSimple: 0,
};

function logDegradation(step, method) {
    const key = step + method; // e.g. 'parse' + 'AI' => parseAI, 'search' + 'Keyword' => searchKeyword
    if (degradationStats[key] !== undefined) {
        degradationStats[key]++;
    }
    logger.info(`[CDSS Degradation] ${step} using ${method}`);
}

function getDegradationStats() {
    return { ...degradationStats };
}

module.exports = { logger, auditLogger, logAudit, logDegradation, getDegradationStats };
