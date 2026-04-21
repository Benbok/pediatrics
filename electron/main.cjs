// Load environment variables from .env.local
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { app, BrowserWindow, ipcMain, session, shell, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Ensure DB_ENCRYPTION_KEY is set in process.env.
 *
 * In dev: loaded from .env.local (dotenv above).
 * In prod: persisted in {userData}/encryption.key.
 *   - First run: generate 32 random bytes (64 hex), save to file, set env var.
 *   - Subsequent runs: read from file, set env var.
 *
 * Called synchronously before any module that uses crypto.cjs is imported.
 * userData path is resolved manually before app.whenReady() via app.getPath(),
 * which works after the app module is loaded even before 'ready' event.
 */
function ensureEncryptionKey() {
    if (process.env.DB_ENCRYPTION_KEY) return; // dev: already set from .env.local

    // app.getPath('userData') is safe to call before app ready on Electron 20+
    let userDataDir;
    try {
        userDataDir = app.getPath('userData');
    } catch (_) {
        // Fallback for edge cases: derive from APPDATA / home
        const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        userDataDir = path.join(base, 'PediAssist');
    }

    const keyPath = path.join(userDataDir, 'encryption.key');

    if (fs.existsSync(keyPath)) {
        const key = fs.readFileSync(keyPath, 'utf8').trim();
        if (key && key.length >= 32) {
            process.env.DB_ENCRYPTION_KEY = key;
            return;
        }
    }

    // First run in prod — generate a new 256-bit key and persist it permanently
    const newKey = crypto.randomBytes(32).toString('hex'); // 64 hex chars
    try {
        fs.mkdirSync(userDataDir, { recursive: true });
        fs.writeFileSync(keyPath, newKey, { encoding: 'utf8', mode: 0o600 });
    } catch (writeErr) {
        // Non-fatal: key will only live in memory this session
        console.error('[Crypto] Failed to persist encryption key:', writeErr.message);
    }
    process.env.DB_ENCRYPTION_KEY = newKey;
}

// Must run synchronously before any module that uses crypto.cjs
ensureEncryptionKey();
const { setupDatabaseHandlers } = require('./database.cjs');
const { setupAuthHandlers, ensureAuthenticated } = require('./auth.cjs');
const { createBackupIfChanged } = require('./backup.cjs');
const { dbPath } = require('./prisma-client.cjs');
const { setupDiseaseHandlers } = require('./modules/diseases/handlers.cjs');
const { setupPdfNoteHandlers } = require('./modules/pdf-notes/handlers.cjs');
const { setupMedicationHandlers } = require('./modules/medications/handlers.cjs');
const { setupVisitHandlers } = require('./modules/visits/handlers.cjs');
const { setupIcdCodeHandlers } = require('./modules/icd-codes/handlers.cjs');
const { setupAllergyHandlers } = require('./modules/allergies/handlers.cjs');
const { setupVisitTemplateHandlers } = require('./modules/visits/template-handlers.cjs');
const { setupMedicationTemplateHandlers } = require('./modules/medication-templates/handlers.cjs');
const { setupDiagnosticTemplateHandlers } = require('./modules/diagnostic-templates/handlers.cjs');
const { setupRecommendationTemplateHandlers } = require('./modules/recommendation-templates/handlers.cjs');
const { setupExamTextTemplateHandlers } = require('./modules/exam-text-templates/handlers.cjs');
const { setupDashboardHandlers } = require('./modules/dashboard/handlers.cjs');
const { setupNutritionHandlers } = require('./modules/nutrition/handlers.cjs');
const { initializeDatabase, seedNutritionData, seedReferenceData } = require('./init-db.cjs');
const { logger, logAudit } = require('./logger.cjs');
const { setupLicenseHandlers } = require('./license/handlers.cjs');
const { setupLicenseAdminHandlers } = require('./license/admin-handlers.cjs');
const { setupLlmHandlers } = require('./modules/llm/handlers.cjs');
const { setupUpdaterHandlers } = require('./modules/updater/handlers.cjs');
const { runMigrations } = require('./migrate-db.cjs');
const isDev = !app.isPackaged;

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'icon.png'),
        show: false, // Don't show until ready
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        // Modern window styling
        frame: true,
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 10, y: 10 }, // For macOS only
        webgl: true,
        v8Code: true,
    });

    // Скрыть стандартное меню
    win.removeMenu();

    win.maximize();
    
    // Показать окно после загрузки контента
    win.webContents.on('dom-ready', () => {
        win.show();
    });

    // Set Content Security Policy
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    isDev
                        ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://esm.sh https://cdn.tailwindcss.com https://fonts.googleapis.com https://fonts.gstatic.com https://generativelanguage.googleapis.com; img-src 'self' data: https:;"
                        : "default-src 'self'; script-src 'self' 'unsafe-inline' https://esm.sh https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://generativelanguage.googleapis.com; img-src 'self' data:;"
                ]
            }
        });
    });

    if (isDev) {
        win.webContents.session.clearCache();
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    return win;
}

app.whenReady().then(async () => {
    logger.info('[Main] ========== APP READY ==========');

    // Apply DB migrations FIRST — before any Prisma queries (runs synchronously via better-sqlite3)
    if (!isDev) {
        logger.info('[Main] Running database migrations...');
        runMigrations(dbPath, logger);
        logger.info('[Main] Database migrations complete');
    }

    // Register license handlers FIRST (no auth required, needed before window for checkLicense IPC)
    setupLicenseHandlers();
    setupLicenseAdminHandlers();
    logger.info('[Main] License handlers registered');

    // Register auth handlers before creating window to avoid IPC race on login/check-session.
    // DB-dependent operations still happen inside handlers at call time.
    setupAuthHandlers();
    logger.info('[Main] setupAuthHandlers completed (early registration)');

    // Logger IPC: renderer uses this immediately on load — register before window
    ipcMain.handle('logger:log', async (_, level, message, metadata) => {
        try {
            const logMetadata = metadata || {};
            switch (level) {
                case 'error': logger.error(`[Renderer] ${message}`, logMetadata); break;
                case 'warn':  logger.warn(`[Renderer] ${message}`, logMetadata);  break;
                case 'info':  logger.info(`[Renderer] ${message}`, logMetadata);  break;
                case 'debug': logger.debug(`[Renderer] ${message}`, logMetadata); break;
                default:      logger.info(`[Renderer] ${message}`, logMetadata);
            }
            return { success: true };
        } catch (error) {
            logger.error('[Main] Logger IPC handler error:', error);
            return { success: false, error: error.message };
        }
    });

    // Create window IMMEDIATELY — native HTML splash shows right away, no white screen
    logger.info('[Main] Creating window...');
    const win = createWindow();

    // Setup auto-updater in production only (requires packaged app + GitHub releases)
    if (!isDev) {
        setupUpdaterHandlers(win);
        logger.info('[Main] Auto-updater initialized');
    }

    // ── Critical minimum: DB + auth handlers (must complete before login page) ──
    logger.info('[Main] Initializing database...');
    await initializeDatabase();
    await seedNutritionData();
    await seedReferenceData();
    logger.info('[Main] Database initialization completed');

    // ── Background init — CDSS indexes, all feature handlers, API keys ──────────
    (async () => {
        // CDSS in-memory indexes (heaviest: loads all embeddings into memory)
        try {
            const { ChunkIndexService } = require('./services/chunkIndexService.cjs');
            await ChunkIndexService.rebuildFts();
            await ChunkIndexService.loadOnStartup();
        } catch (error) {
            logger.warn('[Main] ChunkIndexService initialization failed:', error.message);
        }

        logger.info('[Main] Calling setupDatabaseHandlers...');
        await setupDatabaseHandlers();
        logger.info('[Main] setupDatabaseHandlers completed');

        logger.info('[Main] Setting up CDSS handlers...');
        setupDiseaseHandlers();
    setupPdfNoteHandlers();
    setupMedicationHandlers();
    setupVisitHandlers();
    setupIcdCodeHandlers();
    setupAllergyHandlers();
    setupVisitTemplateHandlers();
    setupMedicationTemplateHandlers();
    setupDiagnosticTemplateHandlers();
    setupRecommendationTemplateHandlers();
    setupExamTextTemplateHandlers();
    setupDashboardHandlers();
    setupNutritionHandlers();
    setupLlmHandlers();

    // Cache Service handlers
    const { CacheService } = require('./services/cacheService.cjs');
    ipcMain.handle('cache:get-stats', ensureAuthenticated(async () => {
        return CacheService.getStats();
    }));

    ipcMain.handle('cache:clear-all', ensureAuthenticated(async () => {
        CacheService.invalidateAll();
        return { success: true };
    }));

    ipcMain.handle('cache:clear-namespace', ensureAuthenticated(async (_, namespace) => {
        CacheService.invalidate(namespace);
        return { success: true };
    }));

    logger.info('[Main] Cache service handlers registered');

    // Initialize API Key Manager
    logger.info('[Main] Initializing API Key Manager...');
    const { apiKeyManager } = require('./services/apiKeyManager.cjs');
    await apiKeyManager.initialize();
    logger.info('[Main] API Key Manager initialized');

    // Setup API Key handlers
    const { setupApiKeyHandlers } = require('./modules/apiKeys/handlers.cjs');
    setupApiKeyHandlers();
    logger.info('[Main] API Key handlers registered');

    const { setupAiRoutingHandlers } = require('./modules/aiRouting/handlers.cjs');
    setupAiRoutingHandlers();
    logger.info('[Main] AI Routing handlers registered');

        logger.info('[Main] Background setup complete');
    })().catch(err => logger.error('[Main] Background setup failed:', err));

    ipcMain.on('print-window', (event) => {
        logger.info('[Main] Received print-window request');
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            logger.info('[Main] Found window, initiating print...');
            // Удален параметр deviceName: '' который мог вызывать ошибки
            win.webContents.print({
                silent: false,
                printBackground: true
            }, (success, failureReason) => {
                logger.info(`[Main] Print finished. Success: ${success}, Reason: ${failureReason}`);
            });
        }
    });

    ipcMain.on('app-close', () => {
        logger.info('[Main] Received app-close request, quitting...');
        logAudit('APP_SHUTDOWN');
        app.quit();
    });

    // Window control handlers
    ipcMain.handle('window:minimize', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.minimize();
    });

    ipcMain.handle('window:maximize', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.maximize();
    });

    ipcMain.handle('window:unmaximize', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.unmaximize();
    });

    ipcMain.handle('window:close', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.close();
    });

    ipcMain.handle('window:is-maximized', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return win ? win.isMaximized() : false;
    });

    // Backup on close: create backup only if DB changed since last backup
    let closeBackupDone = false;
    app.on('before-quit', (event) => {
        if (closeBackupDone) return;
        event.preventDefault();
        createBackupIfChanged(dbPath)
            .then((result) => {
                if (result.skipped) {
                    logger.info('[Main] Close-backup skipped (no changes).');
                } else if (result.success) {
                    logger.info('[Main] Close-backup created successfully.');
                    logAudit('DATABASE_BACKUP_ON_CLOSE');
                }
            })
            .catch((err) => logger.error('[Main] Close-backup error:', err))
            .finally(() => {
                closeBackupDone = true;
                app.quit();
            });
    });

    // Direct document print: renders HTML in hidden window → native OS print dialog (no popup)
    ipcMain.handle('print-document', ensureAuthenticated(async (event, payload) => {
        logger.info('[Main] Received print-document request', { templateId: payload?.templateId });
        logAudit('PRINT_DOCUMENT_ATTEMPT');

        try {
            const options = payload?.options || {};
            const pageSize = options.pageSize || 'A4';
            const orientation = options.orientation || 'portrait';
            const marginsMm = options.margins || { top: 20, right: 15, bottom: 20, left: 15 };

            const title = payload?.metadata?.title || 'Document';
            const styles = payload?.styles || '';
            const pageCss = `
                @page {
                    size: ${pageSize} ${orientation};
                    margin: ${marginsMm.top}mm ${marginsMm.right}mm ${marginsMm.bottom}mm ${marginsMm.left}mm;
                }
                body { margin: 0; padding: 0; }
            `;

            const htmlDoc = `<!doctype html>
<html><head><meta charset="utf-8"><title>${String(title).replace(/</g, '&lt;')}</title>
<style>${pageCss}\n${styles}</style>
</head><body>${payload.html}</body></html>`;

            const printWin = new BrowserWindow({
                width: 1200,
                height: 900,
                show: false,
                webPreferences: {
                    preload: path.join(__dirname, 'preload.cjs'),
                    nodeIntegration: false,
                    contextIsolation: true,
                }
            });

            await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlDoc)}`);
            // Wait for fonts/layout to settle
            await new Promise(resolve => setTimeout(resolve, 400));

            logger.info('[Main] Opening OS print dialog for hidden window', { pageSize, orientation });

            const mmToIn = (mm) => mm / 25.4;
            const marginsIn = {
                top: mmToIn(marginsMm.top),
                bottom: mmToIn(marginsMm.bottom),
                left: mmToIn(marginsMm.left),
                right: mmToIn(marginsMm.right),
            };

            const fallbackToPDF = async () => {
                logger.info('[Main] Falling back to PDF viewer (no printer available)', { pageSize, orientation });
                try {
                    const pdfBuffer = await printWin.webContents.printToPDF({
                        printBackground: true,
                        landscape: orientation === 'landscape',
                        pageSize,
                        preferCSSPageSize: true,
                        margins: marginsIn,
                    });
                    printWin.destroy();
                    const safeTemplate = payload?.templateId
                        ? String(payload.templateId).replace(/[^a-z0-9_-]+/gi, '-')
                        : 'document';
                    const tempPath = path.join(os.tmpdir(), `${safeTemplate}-${Date.now()}.pdf`);
                    await fs.promises.writeFile(tempPath, pdfBuffer);
                    logger.info('[Main] PDF fallback saved to:', tempPath);
                    await shell.openPath(tempPath);
                    logAudit('PRINT_DOCUMENT_PDF_FALLBACK', { templateId: payload?.templateId, path: tempPath });
                    return { success: true, fallback: 'pdf', path: tempPath };
                } catch (pdfErr) {
                    if (!printWin.isDestroyed()) printWin.destroy();
                    logger.error('[Main] PDF fallback also failed:', pdfErr);
                    return { success: false, error: pdfErr.message };
                }
            };

            return new Promise((resolve) => {
                printWin.webContents.print(
                    { silent: false, printBackground: true },
                    async (success, failureReason) => {
                        if (success) {
                            if (!printWin.isDestroyed()) printWin.destroy();
                            logAudit('PRINT_DOCUMENT_SUCCESS', { templateId: payload?.templateId });
                            logger.info('[Main] Document printed successfully', { templateId: payload?.templateId });
                            resolve({ success: true });
                        } else {
                            logger.warn('[Main] Print callback failed', { failureReason });
                            // If no printer is configured → automatically open as PDF in system viewer
                            const noPrinterError = /no printer|not available|network/i.test(failureReason || '');
                            if (noPrinterError) {
                                resolve(await fallbackToPDF());
                            } else {
                                // User cancelled the dialog or other non-recoverable reason
                                if (!printWin.isDestroyed()) printWin.destroy();
                                resolve({ success: false, error: failureReason || 'Print cancelled' });
                            }
                        }
                    }
                );
            });
        } catch (error) {
            logger.error('[Main] Failed to print document:', error);
            return { success: false, error: error.message };
        }
    }));

    // PDF export (supports both legacy and new contract)
    ipcMain.handle('export-pdf', ensureAuthenticated(async (event, payload) => {
        logger.info('[Main] Received export-pdf request', { hasHtml: !!payload?.html, templateId: payload?.templateId });
        logAudit('EXPORT_PDF_ATTEMPT');

        try {
            const options = payload?.options || {};
            const pageSize = options.pageSize || 'A4';
            const orientation = options.orientation || 'portrait';
            const marginsMm = options.margins || { top: 20, right: 15, bottom: 20, left: 15 };
            const mmToIn = (mm) => mm / 25.4;
            const marginsIn = {
                top: mmToIn(marginsMm.top),
                bottom: mmToIn(marginsMm.bottom),
                left: mmToIn(marginsMm.left),
                right: mmToIn(marginsMm.right),
            };

            let pdfBuffer;

            if (payload?.html) {
                // Clean export: render provided HTML in hidden window
                const printWin = new BrowserWindow({
                    width: 1200,
                    height: 900,
                    show: false,
                    webPreferences: {
                        preload: path.join(__dirname, 'preload.cjs'),
                        nodeIntegration: false,
                        contextIsolation: true,
                    }
                });

                const title = payload?.metadata?.title || 'Document';
                const styles = payload?.styles || '';
                const pageCss = `
                    @page {
                        size: ${pageSize} ${orientation};
                        margin: ${marginsMm.top}mm ${marginsMm.right}mm ${marginsMm.bottom}mm ${marginsMm.left}mm;
                    }
                    body { margin: 0; padding: 0; }
                `;

                const htmlDoc = `<!doctype html>
<html><head><meta charset="utf-8"><title>${String(title).replace(/</g, '&lt;')}</title>
<style>${pageCss}\n${styles}</style>
</head><body>${payload.html}</body></html>`;

                await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlDoc)}`);

                // Wait for layout/fonts
                await new Promise(resolve => setTimeout(resolve, 300));

                logger.info('[Main] Generating PDF (clean window)', { pageSize, orientation, marginsIn });
                pdfBuffer = await printWin.webContents.printToPDF({
                    printBackground: true,
                    landscape: orientation === 'landscape',
                    pageSize,
                    preferCSSPageSize: true,
                    margins: marginsIn,
                });

                printWin.close();
            } else {
                // Legacy export: print current renderer window to PDF
                const win = BrowserWindow.fromWebContents(event.sender);
                if (!win) throw new Error('No sender window for PDF export');

                logger.info('[Main] Generating PDF (sender window)', { pageSize, orientation, marginsIn });
                pdfBuffer = await win.webContents.printToPDF({
                    printBackground: true,
                    landscape: orientation === 'landscape',
                    pageSize,
                    preferCSSPageSize: true,
                    margins: marginsIn,
                });
            }

            // Save to temp file
            const safeTemplate = payload?.templateId ? String(payload.templateId).replace(/[^a-z0-9_-]+/gi, '-') : 'document';
            const tempPath = path.join(os.tmpdir(), `${safeTemplate}-${Date.now()}.pdf`);
            await fs.promises.writeFile(tempPath, pdfBuffer);
            logger.info('[Main] PDF saved to:', tempPath);

            // Open PDF in default viewer
            await shell.openPath(tempPath);
            logAudit('EXPORT_PDF_SUCCESS', { path: tempPath });
            return { success: true, path: tempPath };

        } catch (error) {
            logger.error('[Main] Failed to export PDF:', error);
            return { success: false, error: error.message };
        }
    }));

    // File Dialog and Operations
    ipcMain.handle('dialog:open-file', ensureAuthenticated(async (event, options = {}) => {
        const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
            properties: ['openFile'],
            filters: [
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            ...options
        });
        return result;
    }));

    ipcMain.handle('file:read-text', ensureAuthenticated(async (_, filePath) => {
        try {
            return await fs.promises.readFile(filePath, 'utf8');
        } catch (error) {
            logger.error('[Main] Failed to read file', { error, filePath });
            throw error;
        }
    }));

    ipcMain.handle('file:get-size', ensureAuthenticated(async (_, filePath) => {
        try {
            const stat = await fs.promises.stat(filePath);
            return stat.size;
        } catch (error) {
            logger.error('[Main] Failed to stat file', { error, filePath });
            throw error;
        }
    }));
    ipcMain.handle('app:open-path', async (_, filePath) => {
        try {
            return await shell.openPath(filePath);
        } catch (error) {
            logger.error('[Main] Failed to open path', { error, filePath });
            throw error;
        }
    });

    ipcMain.handle('app:open-pdf-at-page', async (_, filePath, page) => {
        try {
            logger.info(`[Main] Opening PDF viewer: ${filePath} at page ${page}`);

            const pdfWin = new BrowserWindow({
                width: 1200,
                height: 900,
                title: 'Просмотр клинических рекомендаций',
                icon: path.join(__dirname, 'icon.png'),
                webPreferences: {
                    preload: path.join(__dirname, 'preload.cjs'),
                    nodeIntegration: false,
                    contextIsolation: true,
                }
            });

            pdfWin.maximize();
            pdfWin.setMenu(null);

            const encodedPath = encodeURIComponent(filePath);
            const url = isDev
                ? `http://localhost:5173/#/pdf-viewer?file=${encodedPath}&page=${page}`
                : `file://${path.join(__dirname, '../dist/index.html')}#/pdf-viewer?file=${encodedPath}&page=${page}`;

            logger.info(`[Main] Loading PDF viewer URL: ${url}`);
            await pdfWin.loadURL(url);

            return { success: true };
        } catch (error) {
            logger.error('[Main] Failed to open PDF viewer:', error);
            throw error;
        }
    });

    ipcMain.handle('app:get-version', () => {
        return app.getVersion();
    });

    ipcMain.handle('app:read-pdf-file', async (_, filePath) => {
        try {
            logger.info(`[Main] Reading PDF file: ${filePath}`);
            // Read as binary buffer
            const buffer = await fs.promises.readFile(filePath);
            // Convert to Uint8Array for pdfjs
            return new Uint8Array(buffer);
        } catch (error) {
            logger.error('[Main] Failed to read PDF file:', error);
            throw error;
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async (event) => {
    logger.info('[Main] Application is closing, disconnecting Prisma...');
    try {
        const { prisma } = require('./prisma-client.cjs');
        await prisma.$disconnect();
        logger.info('[Main] Prisma disconnected successfully');
    } catch (error) {
        logger.error('[Main] Error disconnecting Prisma:', error);
    }
});

app.on('will-quit', async (event) => {
    // Финальная очистка
    try {
        const { prisma } = require('./prisma-client.cjs');
        await prisma.$disconnect();
    } catch (error) {
        // Игнорируем ошибки при финальном закрытии
    }
});
