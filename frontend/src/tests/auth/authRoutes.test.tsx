// @vitest-environment jsdom
import { StrictMode } from 'react';
import {
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { apiClient } from '../../auth/api';
import type { ApiEnvelope, RegisterData } from '../../auth/types';
import { MemoryRouter, useLocation } from 'react-router-dom';

const originalAdapter = apiClient.defaults.adapter;

function response<T>(
  config: InternalAxiosRequestConfig,
  data: T,
  status = 200,
  headers: Record<string, string> = {},
): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status === 201 ? 'Created' : 'OK',
    headers: new AxiosHeaders(headers),
    config,
  };
}

function success<T>(code: string, data: T | null, status = 200): ApiEnvelope<T> {
  return {
    success: true,
    status,
    code,
    message: 'Success.',
    data,
    timestamp: new Date().toISOString(),
  };
}

function apiFailure(
  config: InternalAxiosRequestConfig,
  status: number,
  code: string,
  headers: Record<string, string> = {},
  errors?: Record<string, string>,
): never {
  const body: ApiEnvelope<null> = {
    success: false,
    status,
    code,
    message: 'Private backend detail.',
    data: null,
    errors,
    timestamp: new Date().toISOString(),
  };
  throw new AxiosError(
    'Request failed',
    AxiosError.ERR_BAD_REQUEST,
    config,
    undefined,
    response(config, body, status, headers),
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current search">{location.search}</output>;
}

function renderApp(entry: string) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[entry]}>
        <App />
        <LocationProbe />
      </MemoryRouter>
    </StrictMode>,
  );
}

afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  window.sessionStorage.clear();
});

describe('public registration and verification routes', () => {
  it('renders the register form as a public route with password guidance and accessible labels', () => {
    renderApp('/register');

    expect(screen.getByRole('heading', { name: 'Tạo tài khoản' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeTruthy();
    expect(screen.getByLabelText('Mật khẩu')).toBeTruthy();
    expect(screen.getByLabelText('Xác nhận mật khẩu')).toBeTruthy();
    expect(screen.getByText(/8–20 ký tự/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toBeTruthy();
  });

  it('registers with normalized email, stores only email, then opens check-email', async () => {
    const user = userEvent.setup();
    let requestBody = '';
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/auth/register') {
        requestBody = String(config.data);
        const data: RegisterData = { email: 'reader@example.com', emailVerificationRequired: true };
        return response(config, success('REGISTER_SUCCESS', data, 201), 201);
      }
      throw new Error(`Unexpected request: ${config.url}`);
    }) satisfies AxiosAdapter;

    renderApp('/register');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), '  Reader@Example.COM  ');
    await user.type(screen.getByLabelText('Mật khẩu'), 'Strong1!');
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'Strong1!');
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByText('reader@example.com')).toBeTruthy();
    expect(window.sessionStorage.getItem('registrationEmail')).toBe('reader@example.com');
    expect(window.sessionStorage.getItem('verificationToken')).toBeNull();
    expect(window.sessionStorage.getItem('password')).toBeNull();
    expect(requestBody).toContain('reader@example.com');
    expect(requestBody).toContain('Strong1!');
    expect(requestBody).not.toContain('confirmPassword');
    expect(requestBody).not.toContain('Reader@Example.COM');
  });

  it('waits for blur before showing email validation, then clears the error after correction', async () => {
    const user = userEvent.setup();
    renderApp('/register');
    const email = screen.getByRole('textbox', { name: 'Email' });

    await user.type(email, 'not-an-email');
    expect(screen.queryByText('Vui lòng nhập địa chỉ email hợp lệ.')).toBeNull();
    await user.tab();
    expect(await screen.findByText('Vui lòng nhập địa chỉ email hợp lệ.')).toBeTruthy();
    await user.clear(email);
    await user.type(email, 'reader@example.com');
    await waitFor(() => expect(screen.queryByText('Vui lòng nhập địa chỉ email hợp lệ.')).toBeNull());
  });

  it('maps backend 422 validation fields to the register inputs', async () => {
    const user = userEvent.setup();
    apiClient.defaults.adapter = (async (config) => apiFailure(
      config,
      422,
      'VALIDATION_ERROR',
      {},
      { email: 'invalid', password: 'weak' },
    )) satisfies AxiosAdapter;

    renderApp('/register');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'reader@example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'Strong1!');
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'Strong1!');
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByText('Vui lòng nhập địa chỉ email hợp lệ.')).toBeTruthy();
    expect(screen.getByText('Mật khẩu chưa đáp ứng yêu cầu.')).toBeTruthy();
  });

  it('shows the verified duplicate link to login', async () => {
    const user = userEvent.setup();
    apiClient.defaults.adapter = (async (config) => apiFailure(config, 409, 'EMAIL_ALREADY_REGISTERED')) satisfies AxiosAdapter;

    renderApp('/register');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'reader@example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'Strong1!');
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'Strong1!');
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByText('Email đã được đăng ký')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Đăng nhập' })).toHaveLength(2);
  });

  it('disables registration while the request is pending and submits only once', async () => {
    const user = userEvent.setup();
    let registerCalls = 0;
    let resolveResponse: ((value: AxiosResponse<ApiEnvelope<RegisterData>>) => void) | undefined;
    apiClient.defaults.adapter = (async () => {
      registerCalls += 1;
      return await new Promise<AxiosResponse<ApiEnvelope<RegisterData>>>((resolve) => {
        resolveResponse = resolve;
      });
    }) satisfies AxiosAdapter;

    renderApp('/register');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'reader@example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'Strong1!');
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'Strong1!');
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    await waitFor(() => expect(registerCalls).toBe(1));
    const pendingButton = screen.getByRole('button', { name: /tạo tài khoản/i });

    expect((pendingButton as HTMLButtonElement).disabled).toBe(true);
    await user.click(pendingButton);
    expect(registerCalls).toBe(1);
    resolveResponse?.(response(
      {} as InternalAxiosRequestConfig,
      success('REGISTER_SUCCESS', { email: 'reader@example.com', emailVerificationRequired: true }, 201),
      201,
    ));
    expect(await screen.findByText('reader@example.com')).toBeTruthy();
  });

  it('shows actionable links for verified and unverified duplicate registration', async () => {
    const user = userEvent.setup();
    apiClient.defaults.adapter = (async (config) => {
      apiFailure(config, 409, 'EMAIL_NOT_VERIFIED_REGISTERED');
    }) satisfies AxiosAdapter;

    renderApp('/register');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'Reader@Example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'Strong1!');
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'Strong1!');
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByText(/chưa xác thực/)).toBeTruthy();
    await user.click(screen.getByRole('link', { name: 'Gửi lại email xác thực' }));
    expect(await screen.findByText('reader@example.com')).toBeTruthy();
    expect(window.sessionStorage.getItem('registrationEmail')).toBe('reader@example.com');
    expect(screen.getByRole('link', { name: 'Quay lại đăng nhập' })).toBeTruthy();
  });

  it('hides the duplicate email input but resends to the stored registration email', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem('registrationEmail', 'reader@example.com');
    let requestBody = '';
    apiClient.defaults.adapter = (async (config) => {
      requestBody = String(config.data);
      return response(config, success('VERIFICATION_EMAIL_REQUESTED', null));
    }) satisfies AxiosAdapter;

    renderApp('/check-email');

    expect(screen.getByText('reader@example.com')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Email' })).toBeNull();
    expect(screen.getByRole('button', { name: /Gửi lại/ }).hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText(/60 giây/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Gửi lại email xác thực' }));
    expect(await screen.findByText('Yêu cầu đã được tiếp nhận')).toBeTruthy();
    expect(requestBody).toContain('reader@example.com');
    expect(screen.getByRole('link', { name: 'Quay lại đăng nhập' })).toBeTruthy();
  });

  it('shows an email field when check-email has no session data', () => {
    renderApp('/check-email');

    expect(screen.getByRole('textbox', { name: 'Email' })).toBeTruthy();
    expect(screen.queryByText(/reader@example.com/)).toBeNull();
  });

  it('clears the token query and deduplicates verify POST under StrictMode', async () => {
    let verifyCalls = 0;
    let resolveResponse: ((value: AxiosResponse<ApiEnvelope<null>>) => void) | undefined;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/auth/verify-email') {
        verifyCalls += 1;
        return await new Promise<AxiosResponse<ApiEnvelope<null>>>((resolve) => {
          resolveResponse = resolve;
        });
      }
      throw new Error(`Unexpected request: ${config.url}`);
    }) satisfies AxiosAdapter;
    window.sessionStorage.setItem('registrationEmail', 'reader@example.com');

    renderApp('/verify-email?token=one-time-token');

    expect(await screen.findByText('Đang kiểm tra liên kết xác thực…')).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('current search').textContent).toBe(''));
    expect(verifyCalls).toBe(1);
    expect(window.sessionStorage.getItem('verificationToken')).toBeNull();
    resolveResponse?.(response(
      {} as InternalAxiosRequestConfig,
      success('EMAIL_VERIFIED', null),
    ));

    expect(await screen.findByText('Email đã được xác thực thành công.')).toBeTruthy();
    expect(window.sessionStorage.getItem('registrationEmail')).toBeNull();
    expect(screen.getByRole('link', { name: 'Đăng nhập ngay' })).toBeTruthy();
  });

  it('does not call verify without a token and shows an invalid-link state', async () => {
    let verifyCalls = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/auth/verify-email') verifyCalls += 1;
      throw new Error(`Unexpected request: ${config.url}`);
    }) satisfies AxiosAdapter;

    renderApp('/verify-email');

    expect(await screen.findByText('Liên kết xác thực không hợp lệ.')).toBeTruthy();
    expect(verifyCalls).toBe(0);
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeTruthy();
  });

  it('shows expired-token state and offers resend without treating it as success', async () => {
    apiClient.defaults.adapter = (async (config) => {
      apiFailure(config, 400, 'VERIFICATION_TOKEN_EXPIRED');
    }) satisfies AxiosAdapter;

    renderApp('/verify-email?token=expired-token');

    expect(await screen.findByText('Liên kết xác thực đã hết hạn.')).toBeTruthy();
    expect(screen.queryByText('Email đã được xác thực thành công.')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeTruthy();
    expect(screen.getByLabelText('current search').textContent).toBe('');
  });

  it('shows a retryable network error and only reports success after a confirmed response', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/auth/verify-email') {
        attempts += 1;
        if (attempts === 1) throw new AxiosError('Network unavailable');
        return response(config, success('EMAIL_VERIFIED', null));
      }
      throw new Error(`Unexpected request: ${config.url}`);
    }) satisfies AxiosAdapter;

    renderApp('/verify-email?token=retry-token');

    expect(await screen.findByText('Không thể kết nối để xác thực email. Vui lòng thử lại.')).toBeTruthy();
    expect(screen.queryByText('Email đã được xác thực thành công.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Email đã được xác thực thành công.')).toBeTruthy();
    expect(attempts).toBe(2);
  });

  it('maps the remaining token outcomes to distinct messages', async () => {
    const expected = [
      ['VERIFICATION_TOKEN_INVALID', 'Liên kết xác thực không hợp lệ.'],
      ['VERIFICATION_TOKEN_USED', 'Liên kết xác thực này đã được sử dụng.'],
      ['VERIFICATION_TOKEN_REVOKED', 'Liên kết xác thực đã được thay thế.'],
    ] as const;

    for (const [code, message] of expected) {
      apiClient.defaults.adapter = (async (config) => apiFailure(config, 400, code)) satisfies AxiosAdapter;
      const view = renderApp(`/verify-email?token=${code}`);
      expect(await screen.findByText(message)).toBeTruthy();
      view.unmount();
    }
  });

  it('displays a friendly rate-limit wait from the Retry-After header', async () => {
    const user = userEvent.setup();
    apiClient.defaults.adapter = (async (config) => {
      apiFailure(config, 429, 'RATE_LIMITED', { 'Retry-After': '23' });
    }) satisfies AxiosAdapter;

    renderApp('/check-email');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'reader@example.com');
    await user.click(screen.getByRole('button', { name: 'Gửi lại email xác thực' }));

    expect(await screen.findByText(/chờ 23 giây/)).toBeTruthy();
  });

  it('shows a generic resend confirmation without assuming SMTP succeeded', async () => {
    const user = userEvent.setup();
    let body = '';
    apiClient.defaults.adapter = (async (config) => {
      body = String(config.data);
      return response(config, success('VERIFICATION_EMAIL_REQUESTED', null));
    }) satisfies AxiosAdapter;

    renderApp('/check-email');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'Reader@Example.com');
    await user.click(screen.getByRole('button', { name: 'Gửi lại email xác thực' }));

    expect(await screen.findByText('Yêu cầu đã được tiếp nhận')).toBeTruthy();
    expect(screen.queryByText(/60 giây/)).toBeNull();
    // Ant Design có thể giữ icon loading trong accessible name sau khi submit hoàn tất.
    // Tìm nút theo phần tên ổn định, nhưng vẫn xác nhận nó được bật lại.
    await waitFor(() => {
      const resendButton = screen.getByRole('button', { name: /Gửi lại email xác thực/ });
      expect(resendButton.hasAttribute('disabled')).toBe(false);
    });
    expect(body).toContain('reader@example.com');
  });
});
