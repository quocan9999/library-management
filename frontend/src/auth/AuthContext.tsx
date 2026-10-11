import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { authApi } from './api';
import { logoutAndClearAccessToken } from './logout';
import { getAccessToken, setAccessToken, subscribeToAccessToken } from './tokenStore';
import type { LoginCredentials } from './types';

interface AuthContextValue {
  accessToken: string | null;
  isBootstrapping: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useSyncExternalStore(subscribeToAccessToken, getAccessToken, getAccessToken);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void authApi.restoreSession()
      .then((result) => {
        if (isMounted) setAccessToken(result.accessToken);
      })
      .catch(() => {
        if (isMounted) setAccessToken(null);
      })
      .finally(() => {
        if (isMounted) setIsBootstrapping(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const result = await authApi.login(credentials);
    setAccessToken(result.accessToken);
  }, []);

  const logout = useCallback(async () => {
    await logoutAndClearAccessToken();
  }, []);

  const value = useMemo(
    () => ({ accessToken, isBootstrapping, login, logout }),
    [accessToken, isBootstrapping, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}
