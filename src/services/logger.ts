/**
 * FRONTEND LOGGER SERVICE
 * 
 * Provides centralized logging for renderer process.
 * Logs are forwarded to main process via IPC and written to files.
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogMetadata {
    [key: string]: any;
}

class Logger {
    private async logToMain(level: LogLevel, message: string, metadata?: LogMetadata): Promise<void> {
        try {
            if (window.electronAPI?.log) {
                await window.electronAPI.log(level, message, metadata);
            } else {
                // Fallback to console if IPC is not available (e.g., in browser)
                const logFn = console[level] || console.log;
                logFn(`[${level.toUpperCase()}] ${message}`, metadata || '');
            }
        } catch (error) {
            // Fallback to console if IPC fails
            console.error('[Logger] Failed to send log to main process:', error);
            const logFn = console[level] || console.log;
            logFn(`[${level.toUpperCase()}] ${message}`, metadata || '');
        }
    }

    error(message: string, metadata?: LogMetadata): void {
        this.logToMain('error', message, metadata);
    }

    warn(message: string, metadata?: LogMetadata): void {
        this.logToMain('warn', message, metadata);
    }

    info(message: string, metadata?: LogMetadata): void {
        this.logToMain('info', message, metadata);
    }

    debug(message: string, metadata?: LogMetadata): void {
        this.logToMain('debug', message, metadata);
    }
}

export const logger = new Logger();
