import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { authApi } from './api';
import { subscribeToCapabilityRefresh } from './capabilityEvents';
import { logoutAndClearAccessToken } from './logout';
import { publishSessionTabEvent } from './sessionTabEvents';
import { getAccessToken, setAccessToken, subscribeToAccessToken } from './tokenStore';
import type { AuthMeData, LoginCredentials } from './types';

export type CapabilityStatus = 'loading' | 'ready' | 'error';

interface AuthContextValue {
  accessToken: string | null;
  isBootstrapping: boolean;
  currentUser: AuthMeData | null;
  role: string | null;
  permissions: string[];
  capabilityStatus: CapabilityStatus;
  refreshCapabilities: (options?: { force?: boolean }) => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

interface CapabilityRequest {
  token: string;
  generation: number;
  promise: Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useSyncExternalStore(subscribeToAccessToken, getAccessToken, getAccessToken);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [currentUserState, setCurrentUserState] = useState<AuthMeData | null>(null);
  const [capabilityTokenState, setCapabilityTokenState] = useState<string | null>(null);
  const [capabilityState, setCapabilityState] = useState<CapabilityStatus>('loading');
  const capabilityRequest = useRef<CapabilityRequest | null>(null);
  const requestGeneration = useRef(0);
  const capabilityTokenRef = useRef<string | null>(null);

  const refreshCapabilities = useCallback((options: { force?: boolean } = {}): Promise<void> => {
    const token = getAccessToken();
    if (!token) {
      requestGeneration.current += 1;
      capabilityRequest.current = null;
      setCurrentUserState(null);
      setCapabilityTokenState(null);
      capabilityTokenRef.current = null;
      setCapabilityState('ready');
      return Promise.resolve();
    }

    if (!options.force && capabilityRequest.current?.token === token) return capabilityRequest.current.promise;

    const generation = ++requestGeneration.current;
    if (capabilityTokenRef.current !== token) setCapabilityState('loading');
    const request = authApi.getMe()
      .then((user) => {
        if (getAccessToken() !== token || requestGeneration.current !== generation) return;
        setCurrentUserState(user);
        setCapabilityTokenState(token);
        capabilityTokenRef.current = token;
        setCapabilityState('ready');
      })
      .catch((error: unknown) => {
        if (getAccessToken() === token && requestGeneration.current === generation) {
          setCurrentUserState(null);
          setCapabilityTokenState(token);
          capabilityTokenRef.current = null;
          setCapabilityState('error');
        }
        throw error;
      })
      .finally(() => {
        if (capabilityRequest.current?.generation === generation) capabilityRequest.current = null;
      });
    capabilityRequest.current = { token, generation, promise: request };
    return request;
  }, []);

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

  useEffect(() => {
    let mounted = true;
    const handleTokenChange = () => {
      const token = getAccessToken();
      requestGeneration.current += 1;
      capabilityRequest.current = null;
      capabilityTokenRef.current = null;
      setCurrentUserState(null);
      setCapabilityTokenState(null);
      setCapabilityState(token ? 'loading' : 'ready');
      if (token) {
        queueMicrotask(() => {
          if (mounted && getAccessToken() === token) {
            void refreshCapabilities().catch(() => undefined);
          }
        });
      }
    };
    const unsubscribe = subscribeToAccessToken(handleTokenChange);
    queueMicrotask(() => {
      if (mounted && getAccessToken()) handleTokenChange();
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [refreshCapabilities]);

  useEffect(() => subscribeToCapabilityRefresh(() => {
    if (getAccessToken()) void refreshCapabilities({ force: true }).catch(() => undefined);
  }), [refreshCapabilities]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const result = await authApi.login(credentials);
    setAccessToken(result.accessToken);
    publishSessionTabEvent('signed-in');
    try {
      await refreshCapabilities();
    } catch {
      // Authentication succeeded; protected routes display a retry state if /auth/me is unavailable.
    }
  }, [refreshCapabilities]);

  const logout = useCallback(async () => {
    await logoutAndClearAccessToken();
  }, []);

  const isCurrentTokenLoaded = Boolean(accessToken) && capabilityTokenState === accessToken;
  const currentUser = isCurrentTokenLoaded ? currentUserState : null;
  const capabilityStatus: CapabilityStatus = !accessToken
    ? 'ready'
    : isCurrentTokenLoaded ? capabilityState : 'loading';
  const value = useMemo(() => ({
    accessToken,
    isBootstrapping,
    currentUser,
    role: currentUser?.role ?? null,
    permissions: currentUser?.permissions ?? [],
    capabilityStatus,
    refreshCapabilities,
    login,
    logout,
  }), [accessToken, isBootstrapping, currentUser, capabilityStatus, refreshCapabilities, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}

export function useOptionalAuth() {
  return useContext(AuthContext);
}
