import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/api';
import type { User, UserSettings } from '../types';

interface AuthContextValue {
  user: User | null;
  settings: UserSettings | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  register: (payload: {
    full_name: string;
    email: string;
    password: string;
    confirm_password: string;
    terms_accepted: boolean;
  }) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings | null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const data = await authApi.me();
      setUser(data.user);
      setSettings(data.settings);
    } catch {
      setUser(null);
      setSettings(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    const data = await authApi.login({ email, password, remember_me: rememberMe });
    setUser(data.user);
    setSettings(data.settings);
  }, []);

  const register = useCallback(
    async (payload: {
      full_name: string;
      email: string;
      password: string;
      confirm_password: string;
      terms_accepted: boolean;
    }) => {
      const data = await authApi.register(payload);
      setUser(data.user);
      setSettings(data.settings);
    },
    []
  );

  const loginDemo = useCallback(async () => {
    const data = await authApi.demo();
    setUser(data.user);
    setSettings(data.settings);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setSettings(null);
    document.documentElement.classList.remove('dark');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        isLoading,
        login,
        register,
        loginDemo,
        logout,
        refreshSession,
        setUser,
        setSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
