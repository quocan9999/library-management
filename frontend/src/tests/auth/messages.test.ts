import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { describe, expect, it } from 'vitest';
import {
  getLoginError,
  getLogoutErrorMessage,
  mapLoginValidationErrors,
} from '../../auth/messages';
import type { ApiEnvelope } from '../../auth/types';

function apiError(
  status: number,
  code: string,
  errors?: Record<string, string>,
): AxiosError<ApiEnvelope<unknown>> {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const response: AxiosResponse<ApiEnvelope<unknown>> = {
    data: {
      success: false,
      status,
      code,
      message: 'English backend detail with private exception text',
      data: null,
      errors,
      timestamp: new Date().toISOString(),
    },
    status,
    statusText: 'Request failed',
    headers: new AxiosHeaders(),
    config,
  };

  return new AxiosError(
    'Technical exception: SQL connection detail',
    'ERR_BAD_RESPONSE',
    config,
    undefined,
    response,
  );
}

describe('authentication error messages', () => {
  it('shows a neutral retry message when the login service has no response', () => {
    const failure = new AxiosError('ECONNREFUSED: private connection detail');

    expect(getLoginError(failure)).toEqual({
      title: 'Không thể kết nối đến hệ thống',
      description: 'Hệ thống hiện chưa sẵn sàng. Vui lòng thử lại sau ít phút.',
    });
  });

  it.each([500, 503])('maps HTTP %i to a temporary system error', (status) => {
    expect(getLoginError(apiError(status, 'INTERNAL_ERROR')).description).toBe(
      'Hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau ít phút.',
    );
  });

  it('maps invalid credentials to the Vietnamese sign-in message', () => {
    expect(getLoginError(apiError(401, 'AUTH_INVALID_CREDENTIALS')).description).toBe(
      'Tên đăng nhập/email hoặc mật khẩu không chính xác.',
    );
  });

  it('maps disabled accounts to a safe Vietnamese message', () => {
    expect(getLoginError(apiError(403, 'AUTH_ACCOUNT_DISABLED')).description).toBe(
      'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.',
    );
  });

  it('maps backend login validation by field without showing backend messages', () => {
    expect(mapLoginValidationErrors(apiError(422, 'VALIDATION_ERROR', {
      identifier: 'must not be blank',
      password: 'password must not be blank',
    }))).toEqual({
      identifier: 'Vui lòng nhập tên đăng nhập hoặc email.',
      password: 'Vui lòng nhập mật khẩu.',
    });
  });

  it('uses safe fallback copy for unrecognized backend validation fields', () => {
    const failure = apiError(422, 'VALIDATION_ERROR', {
      internalField: 'SQL exception: sensitive detail',
    });

    expect(mapLoginValidationErrors(failure)).toBeNull();
    expect(getLoginError(failure).description).not.toContain('SQL');
    expect(getLoginError(failure).description).not.toContain('English');
  });

  it('maps logout service failures and hides exception details', () => {
    expect(getLogoutErrorMessage(apiError(503, 'INTERNAL_ERROR'))).toBe(
      'Hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau ít phút.',
    );
    expect(getLogoutErrorMessage(new Error('SQL exception: private detail'))).toBe(
      'Không thể đăng xuất lúc này. Vui lòng thử lại.',
    );
  });
});
