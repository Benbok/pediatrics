import React from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './modules/dashboard/Dashboard';
import { PatientsModule } from './modules/patients/PatientsModule';
import { CreatePatientPage } from './modules/patients/CreatePatientPage';
import { EditPatientPage } from './modules/patients/EditPatientPage';
import { PatientDetails } from './modules/patients/PatientDetails';
import { VaccinationModule } from './modules/vaccination/VaccinationModule';
import { SettingsModule } from './modules/settings/SettingsModule';
import { UserManagementModule } from './modules/users/UserManagementModule';
import { CreateUserPage } from './modules/users/CreateUserPage';
import { EditUserPage } from './modules/users/EditUserPage';
import { DiseasesModule } from './modules/diseases/DiseasesModule';
import { DiseaseFormPage } from './modules/diseases/DiseaseFormPage';
import { DiseaseDetailPage } from './modules/diseases/DiseaseDetailPage';
import { IcdCodesModule } from './modules/icd-codes/IcdCodesModule';
import { MedicationsModule } from './modules/medications/MedicationsModule';
import { MedicationFormPage } from './modules/medications/MedicationFormPage';
import { VisitsModule } from './modules/visits/VisitsModule';
import { VisitFormPage } from './modules/visits/VisitFormPage';
import { PrintPreviewManager } from './modules/printing/components/PrintPreviewManager';
import { NutritionModule } from './modules/nutrition/NutritionModule';
// Register print templates
import './modules/printing/templates/vaccination/register';
import './modules/printing/templates/visit/register';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './modules/auth/LoginPage';
import FirstRunSetupPage from './modules/license/FirstRunSetupPage';
import FirstRunUserWaitPage from './modules/license/FirstRunUserWaitPage';
import { ActivationPage } from './modules/license/ActivationPage';
import { ChildProvider } from './context/ChildContext';
import { DataCacheProvider } from './context/DataCacheContext';
import { PdfViewerPage } from './pages/PdfViewerPage';
import { ApiKeyWarningToast } from './components/ApiKeyWarningToast';
import { UpdateNotification } from './components/UpdateNotification';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/ui/ToastContainer';
import { UploadProgressProvider } from './context/UploadProgressContext';
import FirstRunScenarioPage from './modules/license/FirstRunScenarioPage';

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
                path: 'patients/:id/edit',
                element: <EditPatientPage />,
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
                path: 'users/new',
                element: <CreateUserPage />,
            },
            {
                path: 'users/:id/edit',
                element: <EditUserPage />,
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
                path: 'patients/:childId/nutrition',
                element: <NutritionModule />,
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
    const isDevMode = import.meta.env.DEV;
    const [licenseValid, setLicenseValid] = React.useState<boolean | null>(null);
    const [isFirstRun, setIsFirstRun] = React.useState<boolean | null>(null);
    const [firstRunMode, setFirstRunMode] = React.useState<'choice' | 'admin' | 'user'>('choice');
    const [loginPrefill, setLoginPrefill] = React.useState<{ login: string; password: string } | null>(null);

    React.useEffect(() => {
        if (isDevMode) {
            // Dev exception: go directly to login/password flow.
            setIsFirstRun(false);
            setLicenseValid(true);
            setLoginPrefill({ login: 'admin', password: 'admin' });
            return;
        }

        // Check first-run before license (no users = first install)
        window.electronAPI?.isFirstRun?.().then((res) => {
            setIsFirstRun(res.isFirstRun);
        }).catch(() => {
            setIsFirstRun(false);
        });

        window.electronAPI.checkLicense().then((result) => {
            setLicenseValid(result.valid);
        }).catch(() => {
            setLicenseValid(false);
        });
    }, [isDevMode]);

    // Show loading indicator during initial app initialization
    const showInitialLoading = isLoading || licenseValid === null || isFirstRun === null;

    if (isDevMode) {
        if (showInitialLoading) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                    <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
            );
        }

        if (!isAuthenticated) {
            return <LoginPage initialLogin={loginPrefill?.login ?? 'admin'} initialPassword={loginPrefill?.password ?? ''} />;
        }

        return (
            <DataCacheProvider>
                <ChildProvider>
                    <ToastProvider>
                        <UploadProgressProvider>
                            <RouterProvider router={router} />
                            <PrintPreviewManager />
                            <ApiKeyWarningToast />
                            <UpdateNotification />
                            <ToastContainer />
                        </UploadProgressProvider>
                    </ToastProvider>
                </ChildProvider>
            </DataCacheProvider>
        );
    }

    if (showInitialLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (isFirstRun) {
        if (firstRunMode === 'choice') {
            return (
                <FirstRunScenarioPage
                    onChooseAdmin={() => setFirstRunMode('admin')}
                    onChooseUser={() => setFirstRunMode('user')}
                />
            );
        }

        if (firstRunMode === 'user') {
            return (
                <FirstRunUserWaitPage
                    onBack={() => setFirstRunMode('choice')}
                    onAccessGranted={() => {
                        setIsFirstRun(false);
                        window.electronAPI.checkLicense().then((result) => {
                            setLicenseValid(result.valid);
                        }).catch(() => setLicenseValid(false));
                    }}
                />
            );
        }

        return (
            <FirstRunSetupPage
                onSetupComplete={() => {
                    setIsFirstRun(false);
                    setFirstRunMode('choice');
                    setLoginPrefill({ login: 'admin', password: 'admin' });
                    // Re-check license after setup (own license was auto-generated)
                    window.electronAPI.checkLicense().then((result) => {
                        setLicenseValid(result.valid);
                    }).catch(() => setLicenseValid(false));
                }}
            />
        );
    }

    if (!licenseValid) {
        return <ActivationPage onActivated={() => setLicenseValid(true)} />;
    }

    if (!isAuthenticated) {
        return <LoginPage initialLogin={loginPrefill?.login} initialPassword={loginPrefill?.password} />;
    }

    return (
        <DataCacheProvider>
            <ChildProvider>
                <ToastProvider>
                    <UploadProgressProvider>
                        <RouterProvider router={router} />
                        <PrintPreviewManager />
                        <ApiKeyWarningToast />
                        <UpdateNotification />
                        <ToastContainer />
                    </UploadProgressProvider>
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
