import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
} from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { apiClient, authApi } from '../../auth/api';
import type { ApiEnvelope, LoginData } from '../../auth/types';

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
