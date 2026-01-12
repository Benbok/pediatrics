const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // PATIENTS MODULE API
    getChildren: () => ipcRenderer.invoke('db:get-children'),
    getChild: (id) => ipcRenderer.invoke('db:get-child', id),
    createChild: (child) => ipcRenderer.invoke('db:create-child', child),
    updateChild: (id, updates) => ipcRenderer.invoke('db:update-child', id, updates),
    deleteChild: (id) => ipcRenderer.invoke('db:delete-child', id),

    // VACCINATION MODULE API
    getVaccinationProfile: (childId) => ipcRenderer.invoke('db:get-vaccination-profile', childId),
    updateVaccinationProfile: (profile) => ipcRenderer.invoke('db:update-vaccination-profile', profile),
    getRecords: (childId) => ipcRenderer.invoke('db:get-records', childId),
    saveRecord: (record) => ipcRenderer.invoke('db:save-record', record),
    deleteRecord: (childId, vaccineId) => ipcRenderer.invoke('db:delete-record', childId, vaccineId),
    print: () => ipcRenderer.send('print-window'),
    exportPDF: (certificateData) => ipcRenderer.invoke('export-pdf', certificateData),
    closeApp: () => ipcRenderer.send('app-close'),
    openFile: (options) => ipcRenderer.invoke('dialog:open-file', options),
    readTextFile: (filePath) => ipcRenderer.invoke('file:read-text', filePath),

    // AUTH API
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
    logout: () => ipcRenderer.invoke('auth:logout'),
    checkSession: () => ipcRenderer.invoke('auth:check-session'),

    // USER MANAGEMENT API (Admin only)
    registerUser: (data) => ipcRenderer.invoke('auth:register-user', data),
    getAllUsers: () => ipcRenderer.invoke('auth:get-all-users'),
    deactivateUser: (userId) => ipcRenderer.invoke('auth:deactivate-user', userId),
    activateUser: (userId) => ipcRenderer.invoke('auth:activate-user', userId),
    changePassword: (data) => ipcRenderer.invoke('auth:change-password', data),

    // PATIENT SHARING API
    sharePatient: (data) => ipcRenderer.invoke('db:share-patient', data),
    unsharePatient: (data) => ipcRenderer.invoke('db:unshare-patient', data),

    // DISEASES MODULE API
    getDiseases: () => ipcRenderer.invoke('diseases:list'),
    getDisease: (id) => ipcRenderer.invoke('diseases:get-by-id', id),
    upsertDisease: (data) => ipcRenderer.invoke('diseases:upsert', data),
    deleteDisease: (id) => ipcRenderer.invoke('diseases:delete', id),
    uploadGuideline: (diseaseId, pdfPath) => ipcRenderer.invoke('diseases:upload-guideline', { diseaseId, pdfPath }),
    searchDiseases: (symptoms) => ipcRenderer.invoke('diseases:search', symptoms),
    parsePdfOnly: (pdfPath) => ipcRenderer.invoke('diseases:parse-pdf-only', pdfPath),

    // Disease Notes
    getDiseaseNotes: (diseaseId) => ipcRenderer.invoke('diseases:notes-list', diseaseId),
    createDiseaseNote: (data) => ipcRenderer.invoke('diseases:notes-create', data),
    updateDiseaseNote: (id, data) => ipcRenderer.invoke('diseases:notes-update', { id, data }),
    deleteDiseaseNote: (id) => ipcRenderer.invoke('diseases:notes-delete', id),

    // MEDICATIONS MODULE API
    getMedications: () => ipcRenderer.invoke('medications:list'),
    getMedication: (id) => ipcRenderer.invoke('medications:get-by-id', id),
    upsertMedication: (data) => ipcRenderer.invoke('medications:upsert', data),
    deleteMedication: (id) => ipcRenderer.invoke('medications:delete', id),
    linkMedicationToDisease: (data) => ipcRenderer.invoke('medications:link-disease', data),
    calculateDose: (params) => ipcRenderer.invoke('medications:calculate-dose', params),

    // VISITS MODULE API
    getVisits: (childId) => ipcRenderer.invoke('visits:list-for-child', childId),
    getVisit: (id) => ipcRenderer.invoke('visits:get-by-id', id),
    upsertVisit: (data) => ipcRenderer.invoke('visits:upsert', data),
    deleteVisit: (id) => ipcRenderer.invoke('visits:delete', id),
    analyzeVisit: (visitId) => ipcRenderer.invoke('visits:analyze', visitId),

    // BACKUP API
    createBackup: () => ipcRenderer.invoke('create-backup'),

    // SYSTEM API
    openExternalPath: (path) => ipcRenderer.invoke('app:open-path', path),
    openPdfAtPage: (path, page) => ipcRenderer.invoke('app:open-pdf-at-page', path, page),
    readPdfFile: (path) => ipcRenderer.invoke('app:read-pdf-file', path),
});
