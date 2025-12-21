import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ChildProfile } from '../types';

interface ChildContextType {
    selectedChild: ChildProfile | null;
    setSelectedChild: (child: ChildProfile | null) => void;
}

const ChildContext = createContext<ChildContextType | undefined>(undefined);

export const ChildProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [selectedChild, setSelectedChild] = useState<ChildProfile | null>(() => {
        const saved = localStorage.getItem('selected_child');
        return saved ? JSON.parse(saved) : null;
    });

    useEffect(() => {
        if (selectedChild) {
            localStorage.setItem('selected_child', JSON.stringify(selectedChild));
        } else {
            localStorage.removeItem('selected_child');
        }
    }, [selectedChild]);

    return (
        <ChildContext.Provider value={{ selectedChild, setSelectedChild }}>
            {children}
        </ChildContext.Provider>
    );
};

export const useChild = () => {
    const context = useContext(ChildContext);
    if (!context) {
        throw new Error('useChild must be used within a ChildProvider');
    }
    return context;
};
