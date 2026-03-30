import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import React from 'react';

interface User {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    plan: 'free' | 'starter' | 'pro' | 'founder';
    aiGenerationsUsed: number;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    signup: (name: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    clearError: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const AUTH_STORAGE_KEY = 'papergrid_auth';
const SESSION_STORAGE_KEY = 'papergrid_session';
const API_BASE = import.meta.env.VITE_API_URL || '';

function authBackendErrorMessage() {
    return API_BASE
        ? 'Auth backend returned an unexpected response.'
        : 'Auth backend is not configured for local dev. Set VITE_API_URL to your Convex HTTP endpoint.';
}

function normalizeAuthError(error: unknown) {
    if (error instanceof Error) {
        if (error.message === 'Failed to fetch') {
            return API_BASE
                ? 'Unable to reach the server. Please check your connection and try again.'
                : authBackendErrorMessage();
        }
        return error.message;
    }
    return 'Request failed';
}

type AuthApiUser = {
    _id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    plan: 'free' | 'starter' | 'pro' | 'founder';
    aiGenerationsUsed?: number;
};

function mapUser(user: AuthApiUser): User {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        plan: user.plan,
        aiGenerationsUsed: user.aiGenerationsUsed ?? 0,
    };
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const clearPersistedAuth = useCallback(() => {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setSessionToken(null);
        setUser(null);
    }, []);

    const persistAuth = useCallback((nextUser: User, token: string) => {
        setSessionToken(token);
        setUser(nextUser);
        localStorage.setItem(SESSION_STORAGE_KEY, token);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
    }, []);

    const fetchCurrentUser = useCallback(async (token: string) => {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        const isJson = response.headers.get('content-type')?.includes('application/json');
        if (!isJson) {
            throw new Error(authBackendErrorMessage());
        }

        if (!response.ok) {
            throw new Error(response.status === 401 ? 'Session expired' : 'Failed to load user');
        }

        const data = await response.json() as { user?: AuthApiUser };
        if (!data.user) {
            throw new Error('User not found');
        }
        return mapUser(data.user);
    }, []);

    useEffect(() => {
        const bootstrap = async () => {
            try {
                const storedToken = localStorage.getItem(SESSION_STORAGE_KEY);
                if (!storedToken) {
                    clearPersistedAuth();
                    return;
                }
                const resolvedUser = await fetchCurrentUser(storedToken);
                persistAuth(resolvedUser, storedToken);
            } catch {
                clearPersistedAuth();
            } finally {
                setIsLoading(false);
            }
        };
        void bootstrap();
    }, [clearPersistedAuth, fetchCurrentUser, persistAuth]);

    const login = useCallback(async (email: string, password: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const isJson = response.headers.get('content-type')?.includes('application/json');
            if (!isJson) {
                throw new Error(authBackendErrorMessage());
            }
            const data = await response.json().catch(() => ({})) as {
                error?: string;
                sessionToken?: string;
                user?: AuthApiUser;
            };
            if (!response.ok || !data.sessionToken || !data.user) {
                throw new Error(data.error || 'Login failed');
            }
            persistAuth(mapUser(data.user), data.sessionToken);
        } catch (e) {
            setError(normalizeAuthError(e));
        } finally {
            setIsLoading(false);
        }
    }, [persistAuth]);

    const signup = useCallback(async (name: string, email: string, password: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });
            const isJson = response.headers.get('content-type')?.includes('application/json');
            if (!isJson) {
                throw new Error(authBackendErrorMessage());
            }
            const data = await response.json().catch(() => ({})) as {
                error?: string;
                sessionToken?: string;
                user?: AuthApiUser;
            };
            if (!response.ok || !data.sessionToken || !data.user) {
                throw new Error(data.error || 'Signup failed');
            }
            persistAuth(mapUser(data.user), data.sessionToken);
        } catch (e) {
            setError(normalizeAuthError(e));
        } finally {
            setIsLoading(false);
        }
    }, [persistAuth]);

    const logout = useCallback(() => {
        const token = sessionToken ?? localStorage.getItem(SESSION_STORAGE_KEY);
        if (token) {
            void fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ sessionToken: token }),
            }).catch(() => undefined);
        }
        clearPersistedAuth();
        setError(null);
    }, [clearPersistedAuth, sessionToken]);

    const clearError = useCallback(() => setError(null), []);

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            error,
            login,
            signup,
            logout,
            clearError,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
