import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (password: string, username?: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const isAuth = await window.electronAPI.checkSession();
            setIsAuthenticated(isAuth);
        } catch (error) {
            console.error('Failed to check auth session:', error);
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (password: string, username: string = 'admin') => {
        try {
            const result = await window.electronAPI.login({ username, password });
            if (result.success) {
                setIsAuthenticated(true);
            }
            return result;
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Ошибка соединения с сервером' };
        }
    };

    const logout = async () => {
        try {
            await window.electronAPI.logout();
            setIsAuthenticated(false);
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
