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

    // BACKUP API
    createBackup: () => ipcRenderer.invoke('create-backup'),
});
