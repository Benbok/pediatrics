import React from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './modules/dashboard/Dashboard';
import { PatientsModule } from './modules/patients/PatientsModule';
import { CreatePatientPage } from './modules/patients/CreatePatientPage';
import { PatientDetails } from './modules/patients/PatientDetails';
import { VaccinationModule } from './modules/vaccination/VaccinationModule';
import { SettingsModule } from './modules/settings/SettingsModule';
import { UserManagementModule } from './modules/users/UserManagementModule';
import { DiseasesModule } from './modules/diseases/DiseasesModule';
import { DiseaseFormPage } from './modules/diseases/DiseaseFormPage';
import { DiseaseDetailPage } from './modules/diseases/DiseaseDetailPage';
import { IcdCodesModule } from './modules/icd-codes/IcdCodesModule';
import { MedicationsModule } from './modules/medications/MedicationsModule';
import { MedicationFormPage } from './modules/medications/MedicationFormPage';
import { VisitsModule } from './modules/visits/VisitsModule';
import { VisitFormPage } from './modules/visits/VisitFormPage';
import { PrintPreviewManager } from './modules/printing/components/PrintPreviewManager';
// Register print templates
import './modules/printing/templates/vaccination/register';
import './modules/printing/templates/visit/register';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './modules/auth/LoginPage';
import { ChildProvider } from './context/ChildContext';
import { DataCacheProvider } from './context/DataCacheContext';
import { PdfViewerPage } from './pages/PdfViewerPage';
import { ApiKeyWarningToast } from './components/ApiKeyWarningToast';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/ui/ToastContainer';

const router = createHashRouter([
    {
        path: '/',
        element: <AppShell />,
        children: [
            {
                index: true,
                element: <Dashboard />,
            },
            {
                path: 'patients',
                element: <PatientsModule />,
            },
            {
                path: 'patients/new',
                element: <CreatePatientPage />,
            },
            {
                path: 'patients/:id',
                element: <PatientDetails />,
            },
            {
                path: 'vaccination/:childId', // URL parameter for module isolation
                element: <VaccinationModule />,
            },
            {
                path: 'users',
                element: <UserManagementModule />,
            },
            {
                path: 'diseases',
                element: <DiseasesModule />,
            },
            {
                path: 'diseases/new',
                element: <DiseaseFormPage />,
            },
            {
                path: 'diseases/:id',
                element: <DiseaseDetailPage />,
            },
            {
                path: 'diseases/edit/:id',
                element: <DiseaseFormPage />,
            },
            {
                path: 'icd-codes',
                element: <IcdCodesModule />,
            },
            {
                path: 'medications',
                element: <MedicationsModule />,
            },
            {
                path: 'medications/new',
                element: <MedicationFormPage />,
            },
            {
                path: 'medications/:id',
                element: <MedicationFormPage />,
            },
            {
                path: 'patients/:childId/visits',
                element: <VisitsModule />,
            },
            {
                path: 'patients/:childId/visits/new',
                element: <VisitFormPage />,
            },
            {
                path: 'patients/:childId/visits/:id',
                element: <VisitFormPage />,
            },
            {
                path: 'settings',
                element: <SettingsModule />,
            }
        ]
    },
    {
        path: '/pdf-viewer',
        element: <PdfViewerPage />,
    }
]);

const AppContent: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
                    <span className="text-slate-500 font-medium">Загрузка системы...</span>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return (
        <DataCacheProvider>
            <ChildProvider>
                <ToastProvider>
                    <RouterProvider router={router} />
                    <PrintPreviewManager />
                    <ApiKeyWarningToast />
                    <ToastContainer />
                </ToastProvider>
            </ChildProvider>
        </DataCacheProvider>
    );
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
};

export default App;
