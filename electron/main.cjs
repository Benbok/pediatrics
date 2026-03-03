// Load environment variables from .env.local
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { app, BrowserWindow, ipcMain, session, shell, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { setupDatabaseHandlers } = require('./database.cjs');
const { setupAuthHandlers, ensureAuthenticated } = require('./auth.cjs');
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
const { initializeDatabase } = require('./init-db.cjs');
const { logger, logAudit } = require('./logger.cjs');
const isDev = !app.isPackaged;

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    win.maximize();

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
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(async () => {
    logger.info('[Main] ========== APP READY ==========');

    // Initialize database (create first admin if needed)
    logger.info('[Main] Initializing database...');
    await initializeDatabase();
    logger.info('[Main] Database initialization completed');

    // Initialize CDSS indexes (FTS rebuild + in-memory embeddings)
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
    logger.info('[Main] Calling setupAuthHandlers...');
    setupAuthHandlers();
    logger.info('[Main] setupAuthHandlers completed');

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

    // Cache Service handlers
    const { CacheService } = require('./services/cacheService.cjs');
    ipcMain.handle('cache:get-stats', ensureAuthenticated(async () => {
        return CacheService.getStats();
    }));

    // Logger IPC handler (for renderer process logging)
    ipcMain.handle('logger:log', async (_, level, message, metadata) => {
        try {
            const logMetadata = metadata || {};
            switch (level) {
                case 'error':
                    logger.error(`[Renderer] ${message}`, logMetadata);
                    break;
                case 'warn':
                    logger.warn(`[Renderer] ${message}`, logMetadata);
                    break;
                case 'info':
                    logger.info(`[Renderer] ${message}`, logMetadata);
                    break;
                case 'debug':
                    logger.debug(`[Renderer] ${message}`, logMetadata);
                    break;
                default:
                    logger.info(`[Renderer] ${message}`, logMetadata);
            }
            return { success: true };
        } catch (error) {
            logger.error('[Main] Logger IPC handler error:', error);
            return { success: false, error: error.message };
        }
    });

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

    logger.info('[Main] Creating window...');
    createWindow();

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

    // New clean PDF export using dedicated print window
    ipcMain.handle('export-pdf', ensureAuthenticated(async (event, certificateData) => {
        logger.info('[Main] Received export-pdf request with data');
        logAudit('EXPORT_PDF_ATTEMPT');

        try {
            // Create a hidden window for clean PDF rendering
            const printWin = new BrowserWindow({
                width: 1123, // A4 landscape width at 96 DPI
                height: 794, // A4 landscape height at 96 DPI
                show: false, // Hidden window
                webPreferences: {
                    preload: path.join(__dirname, 'preload.cjs'),
                    nodeIntegration: false,
                    contextIsolation: true,
                }
            });

            // Load the standalone print page
            const printPagePath = isDev
                ? path.join(__dirname, '../public/print-certificate.html')
                : path.join(__dirname, '../dist/print-certificate.html');

            logger.info('[Main] Loading print page', { printPagePath });
            await printWin.loadFile(printPagePath);

            // Inject the certificate data and render
            await printWin.webContents.executeJavaScript(`
                window.__PRINT_DATA__ = ${JSON.stringify(certificateData)};
                if (typeof renderCertificate === 'function') {
                    renderCertificate(window.__PRINT_DATA__);
                }
            `);

            // Wait for content to render
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Generate PDF from the clean window
            logger.info('[Main] Generating PDF');
            const data = await printWin.webContents.printToPDF({
                printBackground: true,
                landscape: true,
                pageSize: 'A4',
                preferCSSPageSize: true, // CRITICAL: Respect CSS @page and break-inside rules
                margins: {
                    top: 0.4,
                    bottom: 0.4,
                    left: 0.4,
                    right: 0.4
                }
            });

            // Save to temp file
            const tempPath = path.join(os.tmpdir(), `vaccination-certificate-${Date.now()}.pdf`);
            await fs.promises.writeFile(tempPath, data);
            logger.info('[Main] PDF saved to:', tempPath);

            // Close the print window
            printWin.close();

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
