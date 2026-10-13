// @vitest-environment jsdom
import {
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
} from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { apiClient } from '../../auth/api';
import { setAccessToken } from '../../auth/tokenStore';
import { profileApi } from '../../profile/api';
import type { ApiEnvelope } from '../../auth/types';

const originalAdapter = apiClient.defaults.adapter;

function response<T>(config: Parameters<AxiosAdapter>[0], data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config,
  };
}

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  setAccessToken(null);
});

describe('profile API', () => {
  it('posts only password fields to the authenticated profile endpoint', async () => {
    setAccessToken('active-user-token');
    let captured: { url?: string; data?: unknown; authorization?: string } | undefined;
    apiClient.defaults.adapter = (async (config) => {
      captured = {
        url: config.url,
        data: JSON.parse(String(config.data)),
        authorization: config.headers.get('Authorization')?.toString(),
      };
      return response(config, {
        success: true,
        status: 200,
        code: 'PASSWORD_CHANGED',
        message: 'Password changed.',
        data: null,
        timestamp: new Date().toISOString(),
      } satisfies ApiEnvelope<null>);
    }) satisfies AxiosAdapter;

    await profileApi.changePassword({
      currentPassword: 'Current1!',
      newPassword: 'NewPass2!',
      confirmNewPassword: 'NewPass2!',
    });

    expect(captured).toEqual({
      url: '/api/v1/profile/change-password',
      data: {
        currentPassword: 'Current1!',
        newPassword: 'NewPass2!',
        confirmNewPassword: 'NewPass2!',
      },
      authorization: 'Bearer active-user-token',
    });
  });
});
