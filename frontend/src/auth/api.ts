import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { getAccessToken, setAccessToken } from './tokenStore';
import type { ApiEnvelope, LoginCredentials, LoginData } from './types';

type AuthRequestConfig = InternalAxiosRequestConfig & {
  skipAccessToken?: boolean;
  authRetried?: boolean;
};

type AuthApiRequestConfig = AxiosRequestConfig & {
  skipAccessToken: true;
};

const apiBaseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081';

export const apiClient = axios.create({
  baseURL: apiBaseURL,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const authConfig = config as AuthRequestConfig;
  if (authConfig.skipAccessToken) return config;

  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  } else {
    config.headers.delete('Authorization');
  }

  return config;
});

let refreshInFlight: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = authApi.refresh()
      .then((result) => {
        setAccessToken(result.accessToken);
        return result.accessToken;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const config = error.config as AuthRequestConfig | undefined;
    const isExpiredAccessToken =
      error.response?.status === 401 && error.response.data?.code === 'AUTH_TOKEN_EXPIRED';

    if (!config || config.skipAccessToken || !isExpiredAccessToken) {
      return Promise.reject(error);
    }

    if (config.authRetried) {
      setAccessToken(null);
      return Promise.reject(error);
    }

    config.authRetried = true;
    try {
      await refreshAccessToken();
      return apiClient(config);
    } catch (refreshError) {
      setAccessToken(null);
      return Promise.reject(refreshError);
    }
  },
);

function readLoginData(envelope: ApiEnvelope<LoginData>): LoginData {
  const data = envelope.data;
  if (!envelope.success || !data?.accessToken) {
    throw new Error('The authentication response was incomplete.');
  }
  return data;
}

const authRequestConfig: AuthApiRequestConfig = {
  withCredentials: true,
  skipAccessToken: true,
};

let sessionRestore: Promise<LoginData> | null = null;

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginData> {
    const response = await apiClient.post<ApiEnvelope<LoginData>>(
      '/api/v1/auth/login',
      credentials,
      authRequestConfig,
    );
    return readLoginData(response.data);
  },

  async refresh(): Promise<LoginData> {
    const response = await apiClient.post<ApiEnvelope<LoginData>>(
      '/api/v1/auth/refresh',
      null,
      authRequestConfig,
    );
    return readLoginData(response.data);
  },

  restoreSession(): Promise<LoginData> {
    if (!sessionRestore) {
      sessionRestore = this.refresh();
    }
    return sessionRestore;
  },

  async logout(accessToken: string | null): Promise<void> {
    const headers = accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : undefined;

    const response = await apiClient.post<ApiEnvelope<null>>(
      '/api/v1/auth/logout',
      null,
      { ...authRequestConfig, headers },
    );

    if (
      response.data?.success !== true ||
      response.data.code !== 'AUTH_LOGOUT_SUCCESS'
    ) {
      throw new Error('Logout was not confirmed by the server.');
    }
  },
};
