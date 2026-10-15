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
  ResetPasswordCredentials,
} from './types';
import { requestCapabilityRefresh } from './capabilityEvents';
import { clearMemberListState } from '../features/members/listState';
import { publishSessionTabEvent } from './sessionTabEvents';

export const ACCOUNT_DISABLED_EVENT = 'auth:account-disabled';
export const ACCOUNT_ROLE_CHANGED_EVENT = 'auth:role-changed';
export const ACCOUNT_SESSION_REVOKED_EVENT = 'auth:session-revoked';

type AuthRequestConfig = InternalAxiosRequestConfig & {
  skipAccessToken?: boolean;
  authRetried?: boolean;
  refreshForToken?: string | null;
};

type AuthApiRequestConfig = AxiosRequestConfig & {
  skipAccessToken: true;
  refreshForToken?: string | null;
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

class SessionChangedDuringRefreshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionChangedDuringRefreshError';
  }
}

let refreshInFlight: { expectedToken: string | null; promise: Promise<string> } | null = null;

function getTokenSubject(token: string | null): string | null {
  const encodedPayload = token?.split('.')[1];
  if (!encodedPayload) return null;
  try {
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { sub?: unknown };
    return payload.sub === undefined || payload.sub === null ? null : String(payload.sub);
  } catch {
    return null;
  }
}

function refreshAccessToken(expectedToken: string | null): Promise<string> {
  if (refreshInFlight) {
    if (refreshInFlight.expectedToken !== expectedToken) {
      return Promise.reject(new SessionChangedDuringRefreshError('The session changed while refreshing.'));
    }
    return refreshInFlight.promise;
  }

  const promise = authApi.refresh(expectedToken)
    .then((result) => {
      if (getAccessToken() !== expectedToken) {
        throw new SessionChangedDuringRefreshError('The session changed while refreshing.');
      }
      const expectedSubject = getTokenSubject(expectedToken);
      if (expectedSubject !== null && getTokenSubject(result.accessToken) !== expectedSubject) {
        if (getAccessToken() === expectedToken) {
          setAccessToken(null);
          clearMemberListState();
          publishSessionTabEvent('session-revoked');
          window.dispatchEvent(new Event(ACCOUNT_SESSION_REVOKED_EVENT));
        }
        throw new SessionChangedDuringRefreshError('The current session belongs to a different account.');
      }
      setAccessToken(result.accessToken);
      return result.accessToken;
    })
    .finally(() => {
      if (refreshInFlight?.promise === promise) refreshInFlight = null;
    });
  refreshInFlight = { expectedToken, promise };
  return promise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const config = error.config as AuthRequestConfig | undefined;
    const requestAuthorization = config?.headers?.get('Authorization');
    const requestToken = typeof requestAuthorization === 'string' && requestAuthorization.startsWith('Bearer ')
      ? requestAuthorization.slice('Bearer '.length)
      : null;
    const errorCode = error.response?.data?.code;
    const isAccountDisabled = error.response?.status === 403 && errorCode === 'AUTH_ACCOUNT_DISABLED';
    const isAccountRoleChanged = error.response?.status === 401 && errorCode === 'AUTH_ROLE_CHANGED';
    const isRefreshRequest = config?.url?.includes('/api/v1/auth/refresh') === true;
    const isCurrentAuthRequest = Boolean(requestToken) && getAccessToken() === requestToken;
    const isRelevantRefreshRequest = isRefreshRequest
      && (config?.refreshForToken === undefined || getAccessToken() === config.refreshForToken);
    if (isAccountDisabled && (isRelevantRefreshRequest || isCurrentAuthRequest)) {
      // Backend xác nhận tài khoản đã khóa; xóa phiên và bộ lọc Member trước khi chuyển về đăng nhập.
      setAccessToken(null);
      clearMemberListState();
      publishSessionTabEvent('session-revoked');
      window.dispatchEvent(new Event(ACCOUNT_DISABLED_EVENT));
    }
    if (isAccountRoleChanged && (isRelevantRefreshRequest || isCurrentAuthRequest)) {
      // Role đổi làm mất mọi phiên; không thử refresh lại access token đã bị backend thu hồi.
      setAccessToken(null);
      clearMemberListState();
      publishSessionTabEvent('session-revoked');
      window.dispatchEvent(new Event(ACCOUNT_ROLE_CHANGED_EVENT));
    }
    const isPermissionDenied = error.response?.status === 403 && errorCode === 'PERMISSION_DENIED';
    const isCurrentAccountRequest = config?.url?.includes('/api/v1/auth/me');
    if (isPermissionDenied && !isCurrentAccountRequest) requestCapabilityRefresh();
    const isExpiredAccessToken =
      error.response?.status === 401 && errorCode === 'AUTH_TOKEN_EXPIRED';

    if (!config || config.skipAccessToken || !isExpiredAccessToken) {
      if (config && !config.skipAccessToken && error.response?.status === 401 && !isExpiredAccessToken) {
        if (getAccessToken() === requestToken) setAccessToken(null);
      }
      return Promise.reject(error);
    }

    if (config.authRetried) {
      if (getAccessToken() === requestToken) setAccessToken(null);
      return Promise.reject(error);
    }

    config.authRetried = true;
    try {
      await refreshAccessToken(requestToken);
      return apiClient(config);
    } catch (refreshError) {
      if (!(refreshError instanceof SessionChangedDuringRefreshError) && getAccessToken() === requestToken) {
        setAccessToken(null);
      }
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

  async resendLoginVerification(identifier: string): Promise<void> {
    const response = await apiClient.post<ApiEnvelope<null>>(
      '/api/v1/auth/resend-login-verification',
      { identifier },
      publicAuthRequestConfig,
    );
    assertSuccess(response.data, 'VERIFICATION_EMAIL_REQUESTED');
  },

  async resendVerification(email: string): Promise<void> {
    const response = await apiClient.post<ApiEnvelope<null>>(
      '/api/v1/auth/resend-verification',
      { email },
      publicAuthRequestConfig,
    );
    assertSuccess(response.data, 'VERIFICATION_EMAIL_REQUESTED');
  },

  async forgotPassword(email: string): Promise<void> {
    const response = await apiClient.post<ApiEnvelope<null>>(
      '/api/v1/auth/forgot-password',
      { email },
      publicAuthRequestConfig,
    );
    assertSuccess(response.data, 'FORGOT_PASSWORD_REQUESTED');
  },

  async resetPassword(credentials: ResetPasswordCredentials): Promise<void> {
    const response = await apiClient.post<ApiEnvelope<null>>(
      '/api/v1/auth/reset-password',
      credentials,
      publicAuthRequestConfig,
    );
    assertSuccess(response.data, 'PASSWORD_RESET_SUCCESS');
  },

  async login(credentials: LoginCredentials): Promise<LoginData> {
    const response = await apiClient.post<ApiEnvelope<LoginData>>(
      '/api/v1/auth/login',
      credentials,
      authRequestConfig,
    );
    return readLoginData(response.data);
  },

  async refresh(refreshForToken?: string | null): Promise<LoginData> {
    const refreshConfig: AuthApiRequestConfig = { ...authRequestConfig, refreshForToken };
    const response = await apiClient.post<ApiEnvelope<LoginData>>(
      '/api/v1/auth/refresh',
      null,
      refreshConfig,
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

  async validateSession(accessToken: string): Promise<AuthMeData> {
    // Không refresh hoặc tự clear token: caller kiểm tra token vẫn hiện hành trước khi xử lý.
    const response = await apiClient.get<ApiEnvelope<AuthMeData>>('/api/v1/auth/me', {
      ...publicAuthRequestConfig,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return readRequiredData(response.data, 'AUTH_ME_SUCCESS');
  },
};
