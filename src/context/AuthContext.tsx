import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthSession } from '../types';

interface AuthContextType {
    isAuthenticated: boolean;
    currentUser: User | null;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    /** Обновить данные текущего пользователя из сессии (например, после редактирования своего профиля) */
    refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const session: AuthSession = await window.electronAPI.checkSession();
            setIsAuthenticated(session.isAuthenticated);
            setCurrentUser(session.user);
        } catch (error) {
            console.error('Failed to check auth session:', error);
            setIsAuthenticated(false);
            setCurrentUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (username: string, password: string) => {
        try {
            const result = await window.electronAPI.login({ username, password });
            if (result.success && result.user) {
                setIsAuthenticated(true);
                setCurrentUser(result.user);
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
            setCurrentUser(null);
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const refreshSession = async () => {
        try {
            const session: AuthSession = await window.electronAPI.checkSession();
            setIsAuthenticated(session.isAuthenticated);
            setCurrentUser(session.user);
        } catch (error) {
            console.error('Failed to refresh session:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, currentUser, isLoading, login, logout, refreshSession }}>
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
