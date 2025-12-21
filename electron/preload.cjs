const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // PATIENTS MODULE API
    getChildren: () => ipcRenderer.invoke('db:get-children'),
    getChild: (id) => ipcRenderer.invoke('db:get-child', id),
    createChild: (child) => ipcRenderer.invoke('db:create-child', child),
    updateChild: (id, updates) => ipcRenderer.invoke('db:update-child', id, updates),

    // VACCINATION MODULE API
    getVaccinationProfile: (childId) => ipcRenderer.invoke('db:get-vaccination-profile', childId),
    updateVaccinationProfile: (profile) => ipcRenderer.invoke('db:update-vaccination-profile', profile),
    getRecords: (childId) => ipcRenderer.invoke('db:get-records', childId),
    saveRecord: (record) => ipcRenderer.invoke('db:save-record', record),
    print: () => ipcRenderer.send('print-window'),
    exportPDF: (certificateData) => ipcRenderer.invoke('export-pdf', certificateData),
});
