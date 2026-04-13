const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // LICENSE ACTIVATION API (no auth required — called before login)
    getLicenseFingerprint: () => ipcRenderer.invoke('license:get-fingerprint'),
    checkLicense: () => ipcRenderer.invoke('license:check'),
    importLicense: () => ipcRenderer.invoke('license:import'),

    // LICENSE ADMIN API (developer-only, requires private key on disk)
    licenseAdminList:           ()     => ipcRenderer.invoke('license-admin:list'),
    licenseAdminGenerate:       (args) => ipcRenderer.invoke('license-admin:generate', args),
    licenseAdminRevoke:         (args) => ipcRenderer.invoke('license-admin:revoke', args),
    licenseAdminExtend:         (args) => ipcRenderer.invoke('license-admin:extend', args),
    licenseAdminExport:         (args) => ipcRenderer.invoke('license-admin:export', args),
    licenseAdminCheckKey:       ()     => ipcRenderer.invoke('license-admin:check-key'),
    licenseAdminImportKey:      ()     => ipcRenderer.invoke('license-admin:import-key'),
    licenseAdminGenerateOwnLicense: () => ipcRenderer.invoke('license-admin:generate-own-license'),
    licenseAdminCreateClientBundle: (args) => ipcRenderer.invoke('license-admin:create-client-bundle', args),

    // AUTH BOOTSTRAP API (no auth required — used before any users exist)
    isFirstRun:      ()     => ipcRenderer.invoke('auth:is-first-run'),
    firstRunSetup:   (data) => ipcRenderer.invoke('auth:first-run-setup', data),

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
    getVaccineCatalog: () => ipcRenderer.invoke('db:get-vaccine-catalog'),
    upsertVaccineCatalogEntry: (entry) => ipcRenderer.invoke('db:upsert-vaccine-catalog-entry', entry),
    setVaccineCatalogEntryDeleted: (vaccineId, isDeleted) => ipcRenderer.invoke('db:set-vaccine-catalog-entry-deleted', vaccineId, isDeleted),
    getVaccinePlans: () => ipcRenderer.invoke('db:get-vaccine-plans'),
    upsertVaccinePlan: (plan) => ipcRenderer.invoke('db:upsert-vaccine-plan', plan),
    setVaccinePlanDeleted: (planId, isDeleted) => ipcRenderer.invoke('db:set-vaccine-plan-deleted', planId, isDeleted),
    print: () => ipcRenderer.send('print-window'),
    // payload: { templateId, html, styles, metadata, options }
    // Renders HTML in a hidden window → native OS print dialog (no popup window)
    printDocument: (payload) => ipcRenderer.invoke('print-document', payload),
    // payload: { templateId, data, metadata, options, html?, styles? }
    exportPDF: (payload) => ipcRenderer.invoke('export-pdf', payload),
    closeApp: () => ipcRenderer.send('app-close'),
    openFile: (options) => ipcRenderer.invoke('dialog:open-file', options),
    readTextFile: (filePath) => ipcRenderer.invoke('file:read-text', filePath),
    getFileSize: (filePath) => ipcRenderer.invoke('file:get-size', filePath),

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
    updateUser: (data) => ipcRenderer.invoke('auth:update-user', data),
    setUserRoles: (data) => ipcRenderer.invoke('auth:set-user-roles', data),
    resetPassword: (data) => ipcRenderer.invoke('auth:reset-password', data),

    // PATIENT SHARING API
    sharePatient: (data) => ipcRenderer.invoke('db:share-patient', data),
    unsharePatient: (data) => ipcRenderer.invoke('db:unshare-patient', data),

    // PATIENT ALLERGIES API
    getPatientAllergies: (childId) => ipcRenderer.invoke('allergies:list-by-child', childId),
    createPatientAllergy: (data) => ipcRenderer.invoke('allergies:create', data),
    updatePatientAllergy: (id, data) => ipcRenderer.invoke('allergies:update', { id, data }),
    deletePatientAllergy: (id) => ipcRenderer.invoke('allergies:delete', id),

    // DISEASES MODULE API
    getDiseases: () => ipcRenderer.invoke('diseases:list'),
    getDisease: (id) => ipcRenderer.invoke('diseases:get-by-id', id),
    upsertDisease: (data) => ipcRenderer.invoke('diseases:upsert', data),
    deleteDisease: (id) => ipcRenderer.invoke('diseases:delete', id),
    uploadGuideline: (diseaseId, pdfPath) => ipcRenderer.invoke('diseases:upload-guideline', { diseaseId, pdfPath }),
    uploadGuidelinesBatch: (diseaseId, pdfPaths) => ipcRenderer.invoke('diseases:upload-guidelines-batch', { diseaseId, pdfPaths }),
    uploadGuidelinesAsync: (diseaseId, pdfPaths) => ipcRenderer.invoke('diseases:upload-guidelines-async', { diseaseId, pdfPaths }),
    getUploadStatus: (jobIds) => ipcRenderer.invoke('diseases:get-upload-status', jobIds),
    onUploadProgress: (callback) => {
        ipcRenderer.on('guideline:upload-progress', callback);
        return () => ipcRenderer.removeListener('guideline:upload-progress', callback);
    },
    onUploadBatchFinished: (callback) => {
        ipcRenderer.on('guideline:upload-batch-finished', callback);
        return () => ipcRenderer.removeListener('guideline:upload-batch-finished', callback);
    },
    updateGuideline: (id, data) => ipcRenderer.invoke('diseases:update-guideline', { id, data }),
    deleteGuideline: (guidelineId) => ipcRenderer.invoke('diseases:delete-guideline', guidelineId),
    searchDiseases: (symptoms) => ipcRenderer.invoke('diseases:search', symptoms),
    parsePdfOnly: (pdfPath) => ipcRenderer.invoke('diseases:parse-pdf-only', pdfPath),
    importDiseaseFromJson: (jsonString) => ipcRenderer.invoke('diseases:importFromJson', jsonString),
    resolveDiseaseTestName: (inputName) => ipcRenderer.invoke('diseases:resolve-test-name', inputName),
    getDiseaseCatalogTestNames: () => ipcRenderer.invoke('diseases:get-diagnostic-catalog-test-names'),
    linkDiseaseTestAlias: (aliasText, canonicalName) => ipcRenderer.invoke('diseases:link-test-alias', { aliasText, canonicalName }),
    // Diagnostic catalog CRUD
    listDiagnosticCatalogEntries: (search) => ipcRenderer.invoke('diseases:catalog-list', search),
    createDiagnosticCatalogEntry: (nameRu, type, aliases) => ipcRenderer.invoke('diseases:catalog-create', { nameRu, type, aliases }),
    updateDiagnosticCatalogEntry: (id, data) => ipcRenderer.invoke('diseases:catalog-update', { id, data }),
    deleteDiagnosticCatalogEntry: (id) => ipcRenderer.invoke('diseases:catalog-delete', id),
    getGuidelinePlan: (diseaseId) => ipcRenderer.invoke('diseases:get-guideline-plan', diseaseId),

    // Disease Notes
    getDiseaseNotes: (diseaseId) => ipcRenderer.invoke('diseases:notes-list', diseaseId),
    createDiseaseNote: (data) => ipcRenderer.invoke('diseases:notes-create', data),
    updateDiseaseNote: (id, data) => ipcRenderer.invoke('diseases:notes-update', { id, data }),
    deleteDiseaseNote: (id) => ipcRenderer.invoke('diseases:notes-delete', id),

    // PDF Notes
    getPdfNotes: (params) => ipcRenderer.invoke('pdf-notes:list', params),
    createPdfNote: (data) => ipcRenderer.invoke('pdf-notes:create', data),
    updatePdfNote: (id, data) => ipcRenderer.invoke('pdf-notes:update', { id, data }),
    deletePdfNote: (id) => ipcRenderer.invoke('pdf-notes:delete', id),

    // MEDICATIONS MODULE API
    getMedications: () => ipcRenderer.invoke('medications:list'),
    getMedicationsPaginated: (params) => ipcRenderer.invoke('medications:list-paginated', params),
    getMedication: (id) => ipcRenderer.invoke('medications:get-by-id', id),
    upsertMedication: (data, source) => ipcRenderer.invoke('medications:upsert', data, source),
    deleteMedication: (id) => ipcRenderer.invoke('medications:delete', id),
    linkMedicationToDisease: (data) => ipcRenderer.invoke('medications:link-disease', data),
    unlinkMedicationFromDisease: (diseaseId, medicationId) => ipcRenderer.invoke('medications:unlink-disease', diseaseId, medicationId),
    calculateDose: (params) => ipcRenderer.invoke('medications:calculate-dose', params),
    getMedicationsByDisease: (diseaseId) => ipcRenderer.invoke('medications:get-by-disease', diseaseId),
    checkDuplicateMedication: (nameRu, excludeId) => ipcRenderer.invoke('medications:checkDuplicate', nameRu, excludeId),
    importFromVidal: (url) => ipcRenderer.invoke('medications:importFromVidal', url),
    importFromJson: (jsonString) => ipcRenderer.invoke('medications:importFromJson', jsonString),
    getPharmacologicalGroups: () => ipcRenderer.invoke('medications:getPharmacologicalGroups'),
    getFormTypes: () => ipcRenderer.invoke('medications:getFormTypes'),
    searchMedicationsByGroup: (groupName) => ipcRenderer.invoke('medications:searchByGroup', groupName),
    toggleMedicationFavorite: (medicationId) => ipcRenderer.invoke('medications:toggleFavorite', medicationId),
    addMedicationTag: (medicationId, tag) => ipcRenderer.invoke('medications:addTag', medicationId, tag),
    getMedicationChangeHistory: (medicationId) => ipcRenderer.invoke('medications:getChangeHistory', medicationId),

    // VISITS MODULE API
    getVisits: (childId) => ipcRenderer.invoke('visits:list-for-child', childId),
    getVisit: (id) => ipcRenderer.invoke('visits:get-by-id', id),
    upsertVisit: (data) => ipcRenderer.invoke('visits:upsert', data),
    deleteVisit: (id) => ipcRenderer.invoke('visits:delete', id),
    analyzeVisit: (visitId) => ipcRenderer.invoke('visits:analyze', visitId),
    getMedicationsForDiagnosis: ({ diseaseId, childId }) => ipcRenderer.invoke('visits:get-medications-for-diagnosis', { diseaseId, childId }),
    getMedicationsByIcdCode: ({ icdCode, childId }) => ipcRenderer.invoke('visits:get-medications-by-icd-code', { icdCode, childId }),
    getExpandedIcdCodes: (icdCodes) => ipcRenderer.invoke('visits:get-expanded-icd-codes', { icdCodes }),

    // VISIT TEMPLATES MODULE API
    getVisitTemplate: (id) => ipcRenderer.invoke('visit-templates:get-by-id', id),
    getAllVisitTemplates: () => ipcRenderer.invoke('visit-templates:get-all'),
    getVisitTemplatesByType: (visitType) => ipcRenderer.invoke('visit-templates:get-by-visit-type', visitType),

    // MEDICATION TEMPLATES MODULE API
    getMedicationTemplate: (id) => ipcRenderer.invoke('medication-templates:get-by-id', id),
    getAllMedicationTemplates: (userId) => ipcRenderer.invoke('medication-templates:get-all', userId),
    upsertMedicationTemplate: (data) => ipcRenderer.invoke('medication-templates:upsert', data),
    deleteMedicationTemplate: (id, userId) => ipcRenderer.invoke('medication-templates:delete', id, userId),
    prepareMedicationTemplateApplication: (params) => ipcRenderer.invoke('medication-templates:prepare-application', params),

    // DIAGNOSTIC TEMPLATES MODULE API
    getDiagnosticTemplate: (id) => ipcRenderer.invoke('diagnostic-templates:get-by-id', id),
    getAllDiagnosticTemplates: (userId) => ipcRenderer.invoke('diagnostic-templates:get-all', userId),
    upsertDiagnosticTemplate: (data) => ipcRenderer.invoke('diagnostic-templates:upsert', data),
    deleteDiagnosticTemplate: (id, userId) => ipcRenderer.invoke('diagnostic-templates:delete', id, userId),
    getDiagnosticsByIcdCode: (icdCode) => ipcRenderer.invoke('visits:get-diagnostics-by-icd-code', icdCode),
    getAllDiagnosticTests: () => ipcRenderer.invoke('visits:get-all-diagnostic-tests'),
    getAllDiseaseRecommendations: () => ipcRenderer.invoke('visits:get-all-disease-recommendations'),
    getDiseaseRecommendationsByIcdCode: (icdCode) => ipcRenderer.invoke('visits:get-disease-recommendations-by-icd-code', icdCode),

    // RECOMMENDATION TEMPLATES MODULE API
    getRecommendationTemplates: (userId) => ipcRenderer.invoke('recommendation-templates:get-all', userId),
    getRecommendationTemplate: (id) => ipcRenderer.invoke('recommendation-templates:get-by-id', id),
    upsertRecommendationTemplate: (data) => ipcRenderer.invoke('recommendation-templates:upsert', data),
    deleteRecommendationTemplate: (id, userId) => ipcRenderer.invoke('recommendation-templates:delete', id, userId),

    // EXAM TEXT TEMPLATES MODULE API
    getExamTextTemplate: (id) => ipcRenderer.invoke('exam-text-templates:get-by-id', id),
    getExamTextTemplatesBySystem: (systemKey, userId) => ipcRenderer.invoke('exam-text-templates:get-by-system', systemKey, userId),
    getAllExamTextTemplates: (userId) => ipcRenderer.invoke('exam-text-templates:get-all', userId),
    getExamTextTemplatesByTags: (params) => ipcRenderer.invoke('exam-text-templates:get-by-tags', params),
    upsertExamTextTemplate: (data) => ipcRenderer.invoke('exam-text-templates:upsert', data),
    deleteExamTextTemplate: (id, userId) => ipcRenderer.invoke('exam-text-templates:delete', id, userId),
    upsertVisitTemplate: (data) => ipcRenderer.invoke('visit-templates:upsert', data),
    deleteVisitTemplate: (id) => ipcRenderer.invoke('visit-templates:delete', id),
    applyVisitTemplate: ({ templateId, existingData }) => ipcRenderer.invoke('visit-templates:apply', { templateId, existingData }),

    // ICD CODES MODULE API
    loadIcdCodes: () => ipcRenderer.invoke('icd-codes:load'),
    getIcdCodeByCode: (code) => ipcRenderer.invoke('icd-codes:get-by-code', code),
    searchIcdCodes: (params) => ipcRenderer.invoke('icd-codes:search', params),
    getIcdCodesByCategory: (params) => ipcRenderer.invoke('icd-codes:get-by-category', params),
    getAllIcdCodes: (params) => ipcRenderer.invoke('icd-codes:get-all', params),
    getIcdCategories: () => ipcRenderer.invoke('icd-codes:get-categories'),

    // DASHBOARD MODULE API
    getDashboardSummary: (date) => ipcRenderer.invoke('dashboard:get-summary', date),
    updateVisitNotes: (visitId, notes) => ipcRenderer.invoke('dashboard:update-visit-notes', visitId, notes),

    // LOGGING API
    log: (level, message, metadata) => ipcRenderer.invoke('logger:log', level, message, metadata),

    // LOCAL LLM API (HTTP client to LM Studio)
    llm: {
        healthCheck: () => ipcRenderer.invoke('llm:health-check'),
        generate: (messages, options) => ipcRenderer.invoke('llm:generate', { messages, options }),
        abort: () => ipcRenderer.invoke('llm:abort'),
        getStatus: () => ipcRenderer.invoke('llm:get-status'),
        onToken: (callback) => {
            ipcRenderer.on('llm:token', callback);
            return () => ipcRenderer.removeListener('llm:token', callback);
        },
        onError: (callback) => {
            ipcRenderer.on('llm:error', callback);
            return () => ipcRenderer.removeListener('llm:error', callback);
        },
        removeTokenListeners: () => ipcRenderer.removeAllListeners('llm:token'),
        removeErrorListeners: () => ipcRenderer.removeAllListeners('llm:error'),
        // Field refinement
        refineField: (field, text, options) => ipcRenderer.invoke('llm:refine-field', { field, text, options }),
        onFieldRefineToken: (callback) => {
            ipcRenderer.on('llm:field-refine-token', callback);
            return () => ipcRenderer.removeListener('llm:field-refine-token', callback);
        },
        onFieldRefineError: (callback) => {
            ipcRenderer.on('llm:field-refine-error', callback);
            return () => ipcRenderer.removeListener('llm:field-refine-error', callback);
        },
        removeFieldRefineListeners: () => {
            ipcRenderer.removeAllListeners('llm:field-refine-token');
            ipcRenderer.removeAllListeners('llm:field-refine-error');
        },
    },

    // API KEYS POOL MANAGEMENT API
    getApiKeysPoolStatus: () => ipcRenderer.invoke('api-keys:get-pool-status'),
    resetApiKey: (keyIndex) => ipcRenderer.invoke('api-keys:reset-key', keyIndex),
    resetAllApiKeys: () => ipcRenderer.invoke('api-keys:reset-all'),
    reloadApiKeysFromEnv: () => ipcRenderer.invoke('api-keys:reload-from-env'),
    testApiKeysConnectivity: (options) => ipcRenderer.invoke('api-keys:test-connectivity', options),
    onApiKeysLowWarning: (callback) => {
        ipcRenderer.on('api-keys:low-warning', callback);
        // Return cleanup function
        return () => ipcRenderer.removeListener('api-keys:low-warning', callback);
    },

    // BACKUP API
    createBackup: () => ipcRenderer.invoke('create-backup'),

    // CACHE MANAGEMENT API
    getCacheStats: () => ipcRenderer.invoke('cache:get-stats'),
    clearAllCache: () => ipcRenderer.invoke('cache:clear-all'),
    clearCacheNamespace: (namespace) => ipcRenderer.invoke('cache:clear-namespace', namespace),

    // SYSTEM API
    openExternalPath: (path) => ipcRenderer.invoke('app:open-path', path),
    openPdfAtPage: (path, page) => ipcRenderer.invoke('app:open-pdf-at-page', path, page),
    readPdfFile: (path) => ipcRenderer.invoke('app:read-pdf-file', path),

    // NUTRITION MODULE API
    getNutritionAgeNorms: () => ipcRenderer.invoke('nutrition:get-age-norms'),
    getNutritionProductCategories: () => ipcRenderer.invoke('nutrition:get-product-categories'),
    getNutritionProducts: (categoryId) => ipcRenderer.invoke('nutrition:get-products', categoryId),
    upsertNutritionProduct: (data) => ipcRenderer.invoke('nutrition:upsert-product', data),
    deleteNutritionProduct: (id) => ipcRenderer.invoke('nutrition:delete-product', id),
    bulkUpsertNutritionProducts: (products) => ipcRenderer.invoke('nutrition:bulk-upsert-products', products),
    getNutritionTemplates: (ageDays) => ipcRenderer.invoke('nutrition:get-templates', ageDays),
    getNutritionTemplateItems: (templateId) => ipcRenderer.invoke('nutrition:get-template-items', templateId),
    upsertNutritionTemplate: (data) => ipcRenderer.invoke('nutrition:upsert-template', data),
    deleteNutritionTemplate: (id) => ipcRenderer.invoke('nutrition:delete-template', id),
    getChildFeedingPlans: (childId) => ipcRenderer.invoke('nutrition:get-child-feeding-plans', childId),
    saveChildFeedingPlan: (data) => ipcRenderer.invoke('nutrition:save-child-feeding-plan', data),
    deleteChildFeedingPlan: (id) => ipcRenderer.invoke('nutrition:delete-child-feeding-plan', id),

    // KNOWLEDGE QUERY MODULE API
    queryKnowledge: (params) => ipcRenderer.invoke('knowledge:query', params),
    getLastKnowledgeQuery: () => ipcRenderer.invoke('knowledge:get-last-query'),

    // RAG AI ASSISTANT API
    rag: {
        query: (params) => ipcRenderer.invoke('rag:query', params),
        stream: (params) => ipcRenderer.send('rag:stream', params),
        reindex: (params) => ipcRenderer.invoke('rag:reindex', params),
        getLast: (params) => ipcRenderer.invoke('rag:get-last', params),
        onToken: (callback) => {
            ipcRenderer.on('rag:token', callback);
            return () => ipcRenderer.removeListener('rag:token', callback);
        },
        onDone: (callback) => {
            ipcRenderer.on('rag:done', callback);
            return () => ipcRenderer.removeListener('rag:done', callback);
        },
        onError: (callback) => {
            ipcRenderer.on('rag:error', callback);
            return () => ipcRenderer.removeListener('rag:error', callback);
        },
        onReindexProgress: (callback) => {
            ipcRenderer.on('rag:reindex:progress', callback);
            return () => ipcRenderer.removeListener('rag:reindex:progress', callback);
        },
        removeListeners: () => {
            ['rag:token', 'rag:done', 'rag:error', 'rag:reindex:progress'].forEach(ch => ipcRenderer.removeAllListeners(ch));
        },
    },
});
