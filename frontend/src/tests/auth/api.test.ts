// @vitest-environment jsdom
import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
} from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { ACCOUNT_DISABLED_EVENT, apiClient, authApi } from '../../auth/api';
import { clearRevokedSessionAfterReset } from '../../auth/passwordResetSession';
import { getAccessToken, setAccessToken } from '../../auth/tokenStore';
import type { ApiEnvelope, LoginData, RegisterData } from '../../auth/types';

const originalAdapter = apiClient.defaults.adapter;

function response<T>(config: Parameters<AxiosAdapter>[0], data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Unauthorized',
    headers: new AxiosHeaders(),
    config,
  };
}

function unauthorized(config: Parameters<AxiosAdapter>[0], code: string): never {
  const body: ApiEnvelope<null> = {
    success: false,
    status: 401,
    code,
    message: 'Authentication required.',
    data: null,
    timestamp: new Date().toISOString(),
  };
  throw new AxiosError(
    'Request failed with status code 401',
    AxiosError.ERR_BAD_REQUEST,
    config,
    undefined,
    response(config, body, 401),
  );
}

function refreshedResponse(config: Parameters<AxiosAdapter>[0], accessToken: string) {
  const data: LoginData = {
    accessToken,
    tokenType: 'Bearer',
    accessTokenExpiresIn: 900,
  };
  const body: ApiEnvelope<LoginData> = {
    success: true,
    status: 200,
    code: 'AUTH_TOKEN_REFRESHED',
    message: 'Token refreshed.',
    data,
    timestamp: new Date().toISOString(),
  };
  return response(config, body);
}

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  delete apiClient.defaults.headers.common.Authorization;
  setAccessToken(null);
  window.sessionStorage.clear();
});

describe('API base URL configuration', () => {
  it('continues an expired account B session through refresh after a reset signal for A', async () => {
    const expired = `header.${btoa(JSON.stringify({ sub: '2' }))}.signature`;
    setAccessToken(expired);
    let refreshes = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/auth/refresh') { refreshes++; return refreshedResponse(config, 'fresh-B'); }
      if (config.url === '/api/v1/auth/me' && config.headers.get('Authorization') === `Bearer ${expired}`) {
        unauthorized(config, 'AUTH_TOKEN_EXPIRED');
      }
      if (config.url === '/api/v1/auth/me') return response(config, {
        success: true, code: 'AUTH_ME_SUCCESS', status: 200, message: '', timestamp: new Date().toISOString(),
        data: { id: 2, username: 'B', email: 'b@example.com', role: 'ROLE_USER', permissions: [] },
      });
      throw new Error(`Unexpected request ${config.url}`);
    }) satisfies AxiosAdapter;
    expect(await clearRevokedSessionAfterReset()).toBe(false);
    expect(getAccessToken()).toBe('fresh-B');
    expect((await authApi.getMe()).id).toBe(2);
    expect(refreshes).toBe(1);
  });
  it('validates the specified session without refresh or clearing a newer token on rejection', async () => {
    setAccessToken('current-account-B');
    const requests: string[] = [];
    apiClient.defaults.adapter = (async (config) => {
      requests.push(config.url ?? '');
      expect(config.headers.get('Authorization')).toBe('Bearer old-account-A');
      expect(config.withCredentials).toBe(false);
      unauthorized(config, 'AUTH_TOKEN_EXPIRED');
    }) satisfies AxiosAdapter;
    await expect(authApi.validateSession('old-account-A')).rejects.toBeInstanceOf(AxiosError);
    expect(requests).toEqual(['/api/v1/auth/me']);
    expect(getAccessToken()).toBe('current-account-B');
  });
  it('uses the configured backend origin or the develop fallback', () => {
    const expectedUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081';
    expect(apiClient.defaults.baseURL).toBe(expectedUrl);
  });
});

describe('public password recovery API', () => {
  it('exposes forgot-password and reset-password calls', () => {
    expect(typeof (authApi as unknown as Record<string, unknown>).forgotPassword).toBe('function');
    expect(typeof (authApi as unknown as Record<string, unknown>).resetPassword).toBe('function');
  });

  it('sends both recovery calls without an access token or credential cookies', async () => {
    type RecoveryApi = {
      forgotPassword(email: string): Promise<void>;
      resetPassword(request: { token: string; newPassword: string; confirmNewPassword: string }): Promise<void>;
    };
    const recoveryApi = authApi as unknown as RecoveryApi;
    const requests: Array<{ url: string; body: string; authorization: string; withCredentials: boolean }> = [];
    setAccessToken('stale-access-token');
    apiClient.defaults.adapter = (async (config) => {
      requests.push({
        url: config.url ?? '',
        body: String(config.data),
        authorization: config.headers.get('Authorization')?.toString() ?? '',
        withCredentials: config.withCredentials === true,
      });
      const code = config.url === '/api/v1/auth/forgot-password'
        ? 'FORGOT_PASSWORD_REQUESTED'
        : 'PASSWORD_RESET_SUCCESS';
      return response(config, {
        success: true,
        status: 200,
        code,
        message: 'Accepted.',
        data: null,
        timestamp: new Date().toISOString(),
      } satisfies ApiEnvelope<null>);
    }) satisfies AxiosAdapter;

    await recoveryApi.forgotPassword('reader@example.com');
    await recoveryApi.resetPassword({
      token: 'one-time-token',
      newPassword: 'Fresh3!Password',
      confirmNewPassword: 'Fresh3!Password',
    });

    expect(requests).toEqual([
      {
        url: '/api/v1/auth/forgot-password',
        body: JSON.stringify({ email: 'reader@example.com' }),
        authorization: '',
        withCredentials: false,
      },
      {
        url: '/api/v1/auth/reset-password',
        body: JSON.stringify({
          token: 'one-time-token',
          newPassword: 'Fresh3!Password',
          confirmNewPassword: 'Fresh3!Password',
        }),
        authorization: '',
        withCredentials: false,
      },
    ]);
  });
});

describe('authenticated API client', () => {
  it('refreshes only an expired access token and retries the protected request once', async () => {
    let protectedAttempts = 0;
    let refreshAttempts = 0;
    let refreshUsedCredentials = false;
    const retryAuthorization: string[] = [];

    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/auth/refresh') {
        refreshAttempts += 1;
        refreshUsedCredentials = config.withCredentials === true;
        return refreshedResponse(config, 'rotated-access-token');
      }

      if (config.url === '/protected') {
        protectedAttempts += 1;
        const authorization = config.headers.get('Authorization');
        retryAuthorization.push(String(authorization ?? ''));
        if (authorization === 'Bearer rotated-access-token') {
          return response(config, { ok: true });
        }
        return unauthorized(config, 'AUTH_TOKEN_EXPIRED');
      }

      throw new Error(`Unexpected request: ${config.url}`);
    }) satisfies AxiosAdapter;

    const result = await apiClient.get<{ ok: boolean }>('/protected');

    expect(result.data).toEqual({ ok: true });
    expect(refreshAttempts).toBe(1);
    expect(protectedAttempts).toBe(2);
    expect(retryAuthorization).toEqual(['', 'Bearer rotated-access-token']);
    expect(refreshUsedCredentials).toBe(true);
  });

  it('does not refresh for a 401 response whose API code is not AUTH_TOKEN_EXPIRED', async () => {
    let refreshAttempts = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/auth/refresh') {
        refreshAttempts += 1;
        return refreshedResponse(config, 'should-not-be-issued');
      }
      return unauthorized(config, 'AUTH_TOKEN_INVALID');
    }) satisfies AxiosAdapter;

    await expect(apiClient.get('/protected')).rejects.toMatchObject({
      response: { data: { code: 'AUTH_TOKEN_INVALID' } },
    });
    expect(refreshAttempts).toBe(0);
  });

  it('shares one refresh request across concurrent expired requests', async () => {
    let protectedAttempts = 0;
    let refreshAttempts = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/auth/refresh') {
        refreshAttempts += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return refreshedResponse(config, 'shared-access-token');
      }

      if (config.url === '/first' || config.url === '/second') {
        protectedAttempts += 1;
        if (config.headers.get('Authorization') === 'Bearer shared-access-token') {
          return response(config, { ok: config.url });
        }
        return unauthorized(config, 'AUTH_TOKEN_EXPIRED');
      }

      throw new Error(`Unexpected request: ${config.url}`);
    }) satisfies AxiosAdapter;

    const results = await Promise.all([
      apiClient.get('/first'),
      apiClient.get('/second'),
    ]);

    expect(results.map((item) => item.status)).toEqual([200, 200]);
    expect(refreshAttempts).toBe(1);
    expect(protectedAttempts).toBe(4);
  });

  it('does not start a refresh loop if the single retried request is still expired', async () => {
    let protectedAttempts = 0;
    let refreshAttempts = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/auth/refresh') {
        refreshAttempts += 1;
        return refreshedResponse(config, 'still-expired-access-token');
      }
      protectedAttempts += 1;
      return unauthorized(config, 'AUTH_TOKEN_EXPIRED');
    }) satisfies AxiosAdapter;

    await expect(apiClient.get('/protected')).rejects.toMatchObject({
      response: { data: { code: 'AUTH_TOKEN_EXPIRED' } },
    });
    expect(refreshAttempts).toBe(1);
    expect(protectedAttempts).toBe(2);
  });

  it('does not retry a denied mutation and requests one capability sync for PERMISSION_DENIED', async () => {
    const { subscribeToCapabilityRefresh } = await import('../../auth/capabilityEvents');
    let syncEvents = 0;
    let mutationAttempts = 0;
    setAccessToken('still-authorized-token');
    const unsubscribe = subscribeToCapabilityRefresh(() => { syncEvents += 1; });
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/roles/ROLE_USER/permissions') {
        mutationAttempts += 1;
        const body: ApiEnvelope<null> = {
          success: false,
          status: 403,
          code: 'PERMISSION_DENIED',
          message: 'Forbidden.',
          data: null,
          timestamp: new Date().toISOString(),
        };
        throw new AxiosError(
          'Request failed with status code 403',
          AxiosError.ERR_BAD_REQUEST,
          config,
          undefined,
          response(config, body, 403),
        );
      }
      throw new Error(`Unexpected request: ${config.url}`);
    }) satisfies AxiosAdapter;

    try {
      await expect(apiClient.patch('/api/v1/roles/ROLE_USER/permissions', {
        expectedVersion: 0,
        addPermissions: ['book:read'],
        removePermissions: [],
      })).rejects.toMatchObject({ response: { status: 403, data: { code: 'PERMISSION_DENIED' } } });
    } finally {
      unsubscribe();
    }

    expect(mutationAttempts).toBe(1);
    expect(syncEvents).toBe(1);
    expect(getAccessToken()).toBe('still-authorized-token');
  });

  it('clears the access token and only the Member search state for a disabled account', async () => {
    let disabledEvents = 0;
    const onDisabled = () => { disabledEvents += 1; };
    setAccessToken('disabled-account-token');
    window.sessionStorage.setItem('memberManagement:listState:v1', 'member filters');
    window.sessionStorage.setItem('registrationEmail', 'reader@example.test');
    window.addEventListener(ACCOUNT_DISABLED_EVENT, onDisabled);
    apiClient.defaults.adapter = (async (config) => {
      const body: ApiEnvelope<null> = {
        success: false,
        status: 403,
        code: 'AUTH_ACCOUNT_DISABLED',
        message: 'Disabled.',
        data: null,
        timestamp: new Date().toISOString(),
      };
      throw new AxiosError('Forbidden', AxiosError.ERR_BAD_REQUEST, config, undefined, response(config, body, 403));
    }) satisfies AxiosAdapter;

    try {
      await expect(apiClient.get('/api/v1/members')).rejects.toMatchObject({
        response: { status: 403, data: { code: 'AUTH_ACCOUNT_DISABLED' } },
      });
    } finally {
      window.removeEventListener(ACCOUNT_DISABLED_EVENT, onDisabled);
    }

    expect(getAccessToken()).toBeNull();
    expect(window.sessionStorage.getItem('memberManagement:listState:v1')).toBeNull();
    expect(window.sessionStorage.getItem('registrationEmail')).toBe('reader@example.test');
    expect(disabledEvents).toBe(1);
  });

  it('loads /auth/me from its envelope without decoding the access token', async () => {
    let requestedUrl = '';
    let authorization = '';
    setAccessToken('opaque-access-token');
    apiClient.defaults.adapter = (async (config) => {
      requestedUrl = config.url ?? '';
      authorization = config.headers.get('Authorization')?.toString() ?? '';
      return response(config, {
        success: true,
        status: 200,
        code: 'AUTH_ME_SUCCESS',
        message: 'Current account.',
        data: {
          id: 21,
          username: null,
          email: 'admin@example.com',
          role: 'ROLE_ADMIN',
          permissions: ['role:read', 'role:update'],
        },
        timestamp: new Date().toISOString(),
      } satisfies ApiEnvelope<{
        id: number;
        username: string | null;
        email: string | null;
        role: string;
        permissions: string[];
      }>);
    }) satisfies AxiosAdapter;

    const current = await authApi.getMe();

    expect(requestedUrl).toBe('/api/v1/auth/me');
    expect(authorization).toBe('Bearer opaque-access-token');
    expect(current).toEqual({
      id: 21,
      username: null,
      email: 'admin@example.com',
      role: 'ROLE_ADMIN',
      permissions: ['role:read', 'role:update'],
    });
  });

  it('does not recursively request capability sync when /auth/me itself is denied', async () => {
    const { subscribeToCapabilityRefresh } = await import('../../auth/capabilityEvents');
    let syncEvents = 0;
    setAccessToken('opaque-access-token');
    const unsubscribe = subscribeToCapabilityRefresh(() => { syncEvents += 1; });
    apiClient.defaults.adapter = (async (config) => {
      const body: ApiEnvelope<null> = {
        success: false,
        status: 403,
        code: 'PERMISSION_DENIED',
        message: 'Forbidden.',
        data: null,
        timestamp: new Date().toISOString(),
      };
      throw new AxiosError(
        'Request failed with status code 403', AxiosError.ERR_BAD_REQUEST, config, undefined,
        response(config, body, 403),
      );
    }) satisfies AxiosAdapter;

    try {
      await expect(authApi.getMe()).rejects.toMatchObject({
        response: { status: 403, data: { code: 'PERMISSION_DENIED' } },
      });
    } finally {
      unsubscribe();
    }

    expect(syncEvents).toBe(0);
  });

  it('clears the active token after the backend rejects it as invalid', async () => {
    setAccessToken('invalid-access-token');
    apiClient.defaults.adapter = (async (config) => unauthorized(config, 'AUTH_TOKEN_INVALID')) satisfies AxiosAdapter;

    await expect(apiClient.get('/api/v1/books')).rejects.toMatchObject({
      response: { status: 401, data: { code: 'AUTH_TOKEN_INVALID' } },
    });

    expect(getAccessToken()).toBeNull();
  });

  it('clears the in-memory token when refresh fails', async () => {
    let refreshAttempts = 0;
    let accessTokenAfterFailure: string | undefined;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/auth/refresh') {
        refreshAttempts += 1;
        if (refreshAttempts === 1) {
          return refreshedResponse(config, 'temporary-access-token');
        }
        return unauthorized(config, 'AUTH_REFRESH_TOKEN_REVOKED');
      }

      if (config.url === '/rotate-once') {
        return config.headers.get('Authorization') === 'Bearer temporary-access-token'
          ? response(config, { ok: true })
          : unauthorized(config, 'AUTH_TOKEN_EXPIRED');
      }

      if (config.url === '/always-expired') {
        return unauthorized(config, 'AUTH_TOKEN_EXPIRED');
      }

      if (config.url === '/after-failure') {
        accessTokenAfterFailure = config.headers.get('Authorization')?.toString();
        return response(config, { ok: true });
      }

      throw new Error(`Unexpected request: ${config.url}`);
    }) satisfies AxiosAdapter;

    await apiClient.get('/rotate-once');
    await expect(apiClient.get('/always-expired')).rejects.toMatchObject({
      response: { data: { code: 'AUTH_REFRESH_TOKEN_REVOKED' } },
    });
    await apiClient.get('/after-failure');

    expect(refreshAttempts).toBe(2);
    expect(accessTokenAfterFailure).toBeUndefined();
  });

  it('sends logout with credentials and the supplied access token', async () => {
    let logoutConfig: Parameters<AxiosAdapter>[0] | undefined;
    apiClient.defaults.adapter = (async (config) => {
      logoutConfig = config;
      return response(config, {
        success: true,
        status: 200,
        code: 'AUTH_LOGOUT_SUCCESS',
        message: 'Signed out.',
        data: null,
        timestamp: new Date().toISOString(),
      } satisfies ApiEnvelope<null>);
    }) satisfies AxiosAdapter;

    await authApi.logout('explicit-access-token');

    expect(logoutConfig?.withCredentials).toBe(true);
    expect(logoutConfig?.headers.get('Authorization')).toBe('Bearer explicit-access-token');
  });

  it('sends register, verify, and resend as public requests without cookies or access tokens', async () => {
    const captured: Array<{
      url: string;
      data: unknown;
      withCredentials: boolean | undefined;
      authorization: string | undefined;
    }> = [];
    setAccessToken('stale-access-token');
    apiClient.defaults.adapter = (async (config) => {
      captured.push({
        url: config.url ?? '',
        data: config.data,
        withCredentials: config.withCredentials,
        authorization: config.headers.get('Authorization')?.toString(),
      });

      if (config.url === '/api/v1/auth/register') {
        const data: RegisterData = {
          email: 'reader@example.com',
          emailVerificationRequired: true,
        };
        return response(config, {
          success: true, status: 201, code: 'REGISTER_SUCCESS',
          message: 'Created.', data, timestamp: new Date().toISOString(),
        } satisfies ApiEnvelope<RegisterData>, 201);
      }
      if (config.url === '/api/v1/auth/verify-email') {
        return response(config, {
          success: true, status: 200, code: 'EMAIL_VERIFIED',
          message: 'Verified.', data: null, timestamp: new Date().toISOString(),
        } satisfies ApiEnvelope<null>);
      }
      return response(config, {
        success: true, status: 200, code: 'VERIFICATION_EMAIL_REQUESTED',
        message: 'Requested.', data: null, timestamp: new Date().toISOString(),
      } satisfies ApiEnvelope<null>);
    }) satisfies AxiosAdapter;

    await authApi.register({ email: 'reader@example.com', password: 'Strong1!' });
    await authApi.verifyEmail('one-time-raw-token');
    await authApi.resendVerification('reader@example.com');

    expect(captured.map(({ url }) => url)).toEqual([
      '/api/v1/auth/register',
      '/api/v1/auth/verify-email',
      '/api/v1/auth/resend-verification',
    ]);
    expect(captured.every(({ withCredentials, authorization }) =>
      withCredentials === false && authorization === undefined)).toBe(true);
    expect(JSON.stringify(captured[0]?.data)).not.toContain('confirmPassword');
  });

  it('does not enable credentials on protected API requests', async () => {
    let sentWithCredentials: boolean | undefined;
    let authorization: string | undefined;
    setAccessToken('protected-test-token');

    apiClient.defaults.adapter = (async (config) => {
      sentWithCredentials = config.withCredentials;
      authorization = config.headers.get('Authorization')?.toString();
      return response(config, { ok: true });
    }) satisfies AxiosAdapter;

    await apiClient.get('/api/v1/books');
    expect(sentWithCredentials).toBe(false);
    expect(authorization).toBe('Bearer protected-test-token');
  });

  it('keeps credentials enabled for login refresh and logout', async () => {
    const values: Record<string, boolean | undefined> = {};
    apiClient.defaults.adapter = (async (config) => {
      values[config.url ?? ''] = config.withCredentials;
      if (config.url === '/api/v1/auth/logout') {
        return response(config, {
          success: true, status: 200, code: 'AUTH_LOGOUT_SUCCESS',
          message: 'Signed out.', data: null,
          timestamp: new Date().toISOString(),
        } satisfies ApiEnvelope<null>);
      }
      return refreshedResponse(config, 'valid-test-token');
    }) satisfies AxiosAdapter;

    await authApi.login({ identifier: 'admin', password: 'admin' });
    await authApi.refresh();
    await authApi.logout('valid-test-token');

    expect(values['/api/v1/auth/login']).toBe(true);
    expect(values['/api/v1/auth/refresh']).toBe(true);
    expect(values['/api/v1/auth/logout']).toBe(true);
  });

  it('rejects logout when HTTP 200 does not confirm success', async () => {
    apiClient.defaults.adapter = (async (config) => response(config, {
      success: false,
      status: 200,
      code: 'AUTH_LOGOUT_FAILED',
      message: 'Logout not confirmed.',
      data: null,
      timestamp: new Date().toISOString(),
    } satisfies ApiEnvelope<null>)) satisfies AxiosAdapter;

    await expect(authApi.logout('access-token')).rejects.toThrow(
      'Logout was not confirmed by the server.',
    );
  });

  it('deduplicates the initial refresh when the auth provider bootstraps twice', async () => {
    let refreshAttempts = 0;
    apiClient.defaults.adapter = (async (config) => {
      refreshAttempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return refreshedResponse(config, 'restored-access-token');
    }) satisfies AxiosAdapter;

    const [first, second] = await Promise.all([
      authApi.restoreSession(),
      authApi.restoreSession(),
    ]);

    expect(refreshAttempts).toBe(1);
    expect(first.accessToken).toBe('restored-access-token');
    expect(second.accessToken).toBe('restored-access-token');
  });
});
