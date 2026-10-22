import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  CitizenRegisterData,
  LoginCredentials,
  ManagerRegisterData,
  StaffRegisterData,
  UserProfile,
} from '../types/auth';
import { authService } from '../services/authService';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<UserProfile>;
  signInWithGoogle: (requestedRole?: string) => Promise<void>;
  syncGoogleSession: (token: string, requestedRole?: string) => Promise<UserProfile>;
  registerCitizen: (data: CitizenRegisterData) => Promise<UserProfile>;
  registerStaff: (data: StaffRegisterData) => Promise<void>;
  registerManager: (data: ManagerRegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<UserProfile | null>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => authService.getStoredUser());
  const [token, setToken] = useState<string | null>(() => authService.getStoredToken());
  const [loading, setLoading] = useState<boolean>(() => !authService.getStoredToken());
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    const currentToken = authService.getStoredToken();
    if (!currentToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return null;
    }

    try {
      const fetchedUser = await authService.getCurrentUser();
      setUser(fetchedUser);
      setToken(currentToken);
      return fetchedUser;
    } catch {
      // Token might be invalid or expired
      authService.logout();
      setUser(null);
      setToken(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    const handleUnauthorized = () => {
      authService.logout();
      setUser(null);
      setToken(null);
    };

    window.addEventListener('awm:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('awm:unauthorized', handleUnauthorized);
  }, [refreshUser]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<UserProfile> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.login(credentials);
      setUser(res.user);
      setToken(res.access_token || null);
      return res.user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const registerCitizen = useCallback(async (data: CitizenRegisterData): Promise<UserProfile> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.registerCitizen(data);
      setUser(res.user);
      setToken(res.access_token || null);
      return res.user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Citizen registration failed.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const registerStaff = useCallback(async (data: StaffRegisterData): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await authService.registerStaff(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Staff registration failed.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const registerManager = useCallback(async (data: ManagerRegisterData): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await authService.registerManager(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Manager registration failed.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async (requestedRole?: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await authService.signInWithGoogle(requestedRole);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google authentication failed.';
      setError(message);
      setLoading(false);
      throw err;
    }
  }, []);

  const syncGoogleSession = useCallback(async (token: string, requestedRole?: string): Promise<UserProfile> => {
    setLoading(true);
    setError(null);
    try {
      const syncedUser = await authService.syncGoogleUser(token, { requested_role: requestedRole });
      setUser(syncedUser);
      setToken(token);
      return syncedUser;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google synchronization failed.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setToken(null);
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        signInWithGoogle,
        syncGoogleSession,
        registerCitizen,
        registerStaff,
        registerManager,
        logout,
        refreshUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
