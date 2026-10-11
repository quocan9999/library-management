import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { getAccessToken, setAccessToken } from './tokenStore';
import type {
  ApiEnvelope,
  AuthMeData,
  LoginCredentials,
  LoginData,
  RegisterCredentials,
  RegisterData,
} from './types';
import { requestCapabilityRefresh } from './capabilityEvents';

type AuthRequestConfig = InternalAxiosRequestConfig & {
  skipAccessToken?: boolean;
  authRetried?: boolean;
};

type AuthApiRequestConfig = AxiosRequestConfig & {
  skipAccessToken: true;
};

type PublicAuthRequestConfig = AxiosRequestConfig & {
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
    const errorCode = error.response?.data?.code;
    const isPermissionDenied = error.response?.status === 403 && errorCode === 'PERMISSION_DENIED';
    const isCurrentAccountRequest = config?.url?.includes('/api/v1/auth/me');
    if (isPermissionDenied && !isCurrentAccountRequest) requestCapabilityRefresh();
    const isExpiredAccessToken =
      error.response?.status === 401 && errorCode === 'AUTH_TOKEN_EXPIRED';

    if (!config || config.skipAccessToken || !isExpiredAccessToken) {
      if (config && !config.skipAccessToken && error.response?.status === 401 && !isExpiredAccessToken) {
        setAccessToken(null);
      }
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

const publicAuthRequestConfig: PublicAuthRequestConfig = {
  withCredentials: false,
  skipAccessToken: true,
};

function readRequiredData<T>(envelope: ApiEnvelope<T>, expectedCode: string): T {
  if (!envelope.success || envelope.code !== expectedCode || envelope.data === null) {
    throw new Error('The authentication response was incomplete.');
  }
  return envelope.data;
}

function assertSuccess(envelope: ApiEnvelope<unknown>, expectedCode: string): void {
  if (!envelope.success || envelope.code !== expectedCode) {
    throw new Error('The authentication response was incomplete.');
  }
}

let sessionRestore: Promise<LoginData> | null = null;

export const authApi = {
  async register(credentials: RegisterCredentials): Promise<RegisterData> {
    const response = await apiClient.post<ApiEnvelope<RegisterData>>(
      '/api/v1/auth/register',
      credentials,
      publicAuthRequestConfig,
    );
    return readRequiredData(response.data, 'REGISTER_SUCCESS');
  },

  async verifyEmail(rawToken: string): Promise<void> {
    const response = await apiClient.post<ApiEnvelope<null>>(
      '/api/v1/auth/verify-email',
      { token: rawToken },
      publicAuthRequestConfig,
    );
    assertSuccess(response.data, 'EMAIL_VERIFIED');
  },

  async resendVerification(email: string): Promise<void> {
    const response = await apiClient.post<ApiEnvelope<null>>(
      '/api/v1/auth/resend-verification',
      { email },
      publicAuthRequestConfig,
    );
    assertSuccess(response.data, 'VERIFICATION_EMAIL_REQUESTED');
  },

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
      const sharedRestore = this.refresh().finally(() => {
        sessionRestore = null;
      });
      sessionRestore = sharedRestore;
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

  async getMe(): Promise<AuthMeData> {
    const response = await apiClient.get<ApiEnvelope<AuthMeData>>('/api/v1/auth/me');
    return readRequiredData(response.data, 'AUTH_ME_SUCCESS');
  },
};
