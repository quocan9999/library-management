import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { authApi } from './api';
import type { LoginCredentials } from './types';

interface AuthContextValue {
  accessToken: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  clearAccessToken: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const result = await authApi.login(credentials);
    setAccessToken(result.accessToken);
  }, []);

  const clearAccessToken = useCallback(() => setAccessToken(null), []);

  const value = useMemo(
    () => ({ accessToken, login, clearAccessToken }),
    [accessToken, login, clearAccessToken],
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
