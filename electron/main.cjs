const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { setupDatabaseHandlers } = require('./database.cjs');
const isDev = !app.isPackaged;

setupDatabaseHandlers();

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
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
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    ipcMain.on('print-window', (event) => {
        console.log('[Main] Received print-window request');
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            console.log('[Main] Found window, initiating print...');
            // Удален параметр deviceName: '' который мог вызывать ошибки
            win.webContents.print({
                silent: false,
                printBackground: true
            }, (success, failureReason) => {
                if (!success) {
                    console.error(`[Main] Print failed: ${failureReason}`);
                } else {
                    console.log('[Main] Print dialog opened successfully');
                }
            });
        } else {
            console.error('[Main] Could not find window for print-window request');
        }
    });

    // New clean PDF export using dedicated print window
    ipcMain.handle('export-pdf', async (event, certificateData) => {
        console.log('[Main] Received export-pdf request with data');

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
            console.log('[Main] PDF saved to:', tempPath);

            // Close the print window
            printWin.close();

            // Open PDF in default viewer
            await shell.openPath(tempPath);
            return { success: true, path: tempPath };

        } catch (error) {
            console.error('[Main] Failed to export PDF:', error);
            return { success: false, error: error.message };
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
