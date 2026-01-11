import React from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './modules/dashboard/Dashboard';
import { PatientsModule } from './modules/patients/PatientsModule';
import { PatientDetails } from './modules/patients/PatientDetails';
import { VaccinationModule } from './modules/vaccination/VaccinationModule';
import { SettingsModule } from './modules/settings/SettingsModule';
import { PrintPreviewManager } from './modules/printing/components/PrintPreviewManager';
// Register vaccination certificate template
import './modules/printing/templates/vaccination/register';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './modules/auth/LoginPage';
import { ChildProvider } from './context/ChildContext';

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
                path: 'patients/:id',
                element: <PatientDetails />,
            },
            {
                path: 'vaccination/:childId', // URL parameter for module isolation
                element: <VaccinationModule />,
            },
            {
                path: 'settings',
                element: <SettingsModule />,
            }
        ]
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
        <ChildProvider>
            <RouterProvider router={router} />
            <PrintPreviewManager />
        </ChildProvider>
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
