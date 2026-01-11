// Load environment variables from .env.local
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { app, BrowserWindow, ipcMain, session, shell, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { setupDatabaseHandlers } = require('./database.cjs');
const { setupAuthHandlers, ensureAuthenticated } = require('./auth.cjs');
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
    logger.info('[Main] Calling setupDatabaseHandlers...');
    await setupDatabaseHandlers();
    logger.info('[Main] setupDatabaseHandlers completed');
    logger.info('[Main] Calling setupAuthHandlers...');
    setupAuthHandlers();
    logger.info('[Main] setupAuthHandlers completed');
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

            console.log('[Main] Loading print page:', printPagePath);
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
            console.log('[Main] Generating PDF...');
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
            console.error('[Main] Failed to read file:', error);
            throw error;
        }
    }));

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
