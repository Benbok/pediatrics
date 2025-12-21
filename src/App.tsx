import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './modules/dashboard/Dashboard';
import { PatientsModule } from './modules/patients/PatientsModule';
import { PatientDetails } from './modules/patients/PatientDetails';
import { VaccinationModule } from './modules/vaccination/VaccinationModule';

const router = createBrowserRouter([
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
            }
        ]
    }
]);

import { ChildProvider } from './context/ChildContext';

const App: React.FC = () => {
    return (
        <ChildProvider>
            <RouterProvider router={router} />
        </ChildProvider>
    );
};

export default App;
