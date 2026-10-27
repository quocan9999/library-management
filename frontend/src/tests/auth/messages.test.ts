import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { describe, expect, it } from 'vitest';
import {
  getForgotPasswordError,
  getLoginError,
  getLogoutErrorMessage,
  getRegisterError,
  getResendError,
  getVerificationError,
  isMaintenanceError,
  mapLoginValidationErrors,
  mapRegisterValidationErrors,
} from '../../auth/messages';
import type { ApiEnvelope } from '../../auth/types';

function apiError(
  status: number,
  code: string,
  errors?: Record<string, string>,
  headers?: Record<string, string>,
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
    headers: new AxiosHeaders(headers),
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

  it('maps HTTP 503 with MAINTENANCE_MODE_ACTIVE to maintenance message', () => {
    const error = apiError(503, 'MAINTENANCE_MODE_ACTIVE');
    expect(getLoginError(error)).toEqual({
      title: 'Hệ thống đang bảo trì',
      description: 'Hệ thống đang bảo trì. Vui lòng thử lại sau ít phút.',
      code: 'MAINTENANCE_MODE_ACTIVE',
    });
    expect(getRegisterError(error)).toEqual({
      title: 'Hệ thống đang bảo trì',
      description: 'Hệ thống đang bảo trì. Vui lòng thử lại sau ít phút.',
      code: 'MAINTENANCE_MODE_ACTIVE',
    });
    expect(getForgotPasswordError(error)).toEqual({
      title: 'Hệ thống đang bảo trì',
      description: 'Hệ thống đang bảo trì. Vui lòng thử lại sau ít phút.',
    });
    expect(getResendError(error)).toEqual({
      title: 'Hệ thống đang bảo trì',
      description: 'Hệ thống đang bảo trì. Vui lòng thử lại sau ít phút.',
    });
    expect(getLogoutErrorMessage(error)).toBe(
      'Hệ thống đang bảo trì. Vui lòng thử lại sau ít phút.',
    );
    expect(isMaintenanceError(error)).toBe(true);
    expect(isMaintenanceError(apiError(503, 'OTHER_CODE'))).toBe(false);
    expect(isMaintenanceError(apiError(500, 'MAINTENANCE_MODE_ACTIVE'))).toBe(false);
    expect(isMaintenanceError(new Error('network error'))).toBe(false);
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

  it('maps an unverified login to a distinct safe message and code', () => {
    expect(getLoginError(apiError(403, 'EMAIL_NOT_VERIFIED'))).toEqual({
      title: 'Email chưa được xác thực',
      description: 'Hãy xác thực email trước khi đăng nhập. Vui lòng kiểm tra hộp thư và thư spam.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('maps registration duplicate states to actionable safe copy', () => {
    expect(getRegisterError(apiError(409, 'EMAIL_ALREADY_REGISTERED')).code)
      .toBe('EMAIL_ALREADY_REGISTERED');
    expect(getRegisterError(apiError(409, 'EMAIL_NOT_VERIFIED_REGISTERED')).description)
      .toContain('chưa xác thực');
  });

  it('maps registration server validation fields without showing backend details', () => {
    expect(mapRegisterValidationErrors(apiError(422, 'VALIDATION_ERROR', {
      email: 'must be an email',
      password: 'must contain a digit',
      internalField: 'SQL exception',
    }))).toEqual({
      email: 'Vui lòng nhập địa chỉ email hợp lệ.',
      password: 'Mật khẩu chưa đáp ứng yêu cầu.',
    });
  });

  it.each([
    ['VERIFICATION_TOKEN_INVALID', 'invalid'],
    ['VERIFICATION_TOKEN_EXPIRED', 'expired'],
    ['VERIFICATION_TOKEN_USED', 'used'],
    ['VERIFICATION_TOKEN_REVOKED', 'revoked'],
  ])('maps verification code %s to the %s state', (code, expectedState) => {
    expect(getVerificationError(apiError(400, code))).toBe(expectedState);
  });

  it('reads a positive Retry-After value for resend rate limits', () => {
    expect(getResendError(apiError(429, 'RATE_LIMITED', undefined, { 'Retry-After': '17' })))
      .toMatchObject({ retryAfterSeconds: 17 });
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
