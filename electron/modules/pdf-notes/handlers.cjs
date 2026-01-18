const { ipcMain } = require('electron');
const { ensureAuthenticated, getSession } = require('../../auth.cjs');
const { logAudit } = require('../../logger.cjs');
const { PdfNoteService } = require('./service.cjs');

const setupPdfNoteHandlers = () => {
    ipcMain.handle('pdf-notes:list', ensureAuthenticated(async (_, params) => {
        const session = getSession();
        const { pdfPath, page } = params || {};
        if (!pdfPath) {
            throw new Error('PDF путь обязателен');
        }
        return await PdfNoteService.listNotes(pdfPath, page, session.user.id);
    }));

    ipcMain.handle('pdf-notes:create', ensureAuthenticated(async (_, data) => {
        const session = getSession();
        const note = await PdfNoteService.createNote(data, session.user.id);
        logAudit('PDF_NOTE_CREATED', { pdfPath: data?.pdfPath, page: data?.page, noteId: note.id });
        return note;
    }));

    ipcMain.handle('pdf-notes:update', ensureAuthenticated(async (_, { id, data }) => {
        const session = getSession();
        const note = await PdfNoteService.updateNote(id, data, session.user.id);
        logAudit('PDF_NOTE_UPDATED', { noteId: id });
        return note;
    }));

    ipcMain.handle('pdf-notes:delete', ensureAuthenticated(async (_, id) => {
        const session = getSession();
        await PdfNoteService.deleteNote(id, session.user.id);
        logAudit('PDF_NOTE_DELETED', { noteId: id });
        return true;
    }));
};

module.exports = { setupPdfNoteHandlers };
