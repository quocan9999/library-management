import React, { createContext, useContext, useEffect, useState } from 'react';

import { authService, User } from '@/services/authService';
import { storage } from '@/utils/storage';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = async () => {
    try {
      const savedToken = await storage.getToken();
      const savedUser = await storage.getUser<User>();

      if (savedToken) {
        setToken(savedToken);
        if (savedUser) {
          setUser(savedUser);
        }
        // Verify with backend
        try {
          const freshUser = await authService.getMe();
          setUser(freshUser);
          await storage.saveUser(freshUser);
        } catch {
          // Token might be expired
          if (!savedUser) {
            await storage.clearAuth();
            setToken(null);
            setUser(null);
          }
        }
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (identifier: string, password: string) => {
    const data = await authService.login(identifier, password);
    setToken(data.accessToken);
    await storage.saveToken(data.accessToken);

    try {
      const userProfile = await authService.getMe();
      setUser(userProfile);
      await storage.saveUser(userProfile);
    } catch {
      // Failed to get me, but login succeeded
    }
  };

  const logout = async () => {
    await storage.clearAuth();
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const freshUser = await authService.getMe();
      setUser(freshUser);
      await storage.saveUser(freshUser);
    } catch {
      // Failed
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
