// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../../pages/LoginPage';
import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }));
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ login: loginMock }),
}));

const originalAdapter = apiClient.defaults.adapter;

function response<T>(config: InternalAxiosRequestConfig, data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config,
  };
}

function unverifiedError(): AxiosError<ApiEnvelope<null>> {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const body: ApiEnvelope<null> = {
    success: false,
    status: 403,
    code: 'EMAIL_NOT_VERIFIED',
    message: 'Private backend detail.',
    data: null,
    timestamp: new Date().toISOString(),
  };
  return new AxiosError(
    'Request failed',
    AxiosError.ERR_BAD_REQUEST,
    config,
    undefined,
    response(config, body),
  );
}

afterEach(() => {
  cleanup();
  loginMock.mockReset();
  apiClient.defaults.adapter = originalAdapter;
});

describe('login verification guidance', () => {
  it('provides a public forgot-password link', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    const link = screen.getByRole('link', { name: 'Quên mật khẩu?' });
    expect(link.getAttribute('href')).toBe('/forgot-password');
  });

  it('preserves the email, clears the password, and resends without reusing credentials', async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(unverifiedError());
    let resendBody = '';
    apiClient.defaults.adapter = (async (config) => {
      resendBody = String(config.data);
      return response(config, {
        success: true,
        status: 200,
        code: 'VERIFICATION_EMAIL_REQUESTED',
        message: 'Requested.',
        data: null,
        timestamp: new Date().toISOString(),
      } satisfies ApiEnvelope<null>);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    const identifier = screen.getByRole('textbox', { name: 'Tên đăng nhập hoặc email' });
    await user.type(identifier, 'Reader@Example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'Strong1!');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Email chưa được xác thực')).toBeTruthy();
    expect((identifier as HTMLInputElement).value).toBe('Reader@Example.com');
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).value).toBe('');

    const resendEmail = screen.getByRole('textbox', { name: 'Email' });
    expect((resendEmail as HTMLInputElement).value).toBe('Reader@Example.com');
    await user.click(screen.getByRole('button', { name: 'Gửi lại email xác thực' }));

    expect(await screen.findByText('Yêu cầu đã được tiếp nhận')).toBeTruthy();
    expect(resendBody).toContain('reader@example.com');
    expect(resendBody).not.toContain('Strong1!');
  });

  it('offers the inline resend form for a username without sending it as an email', async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(unverifiedError());
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByRole('textbox', { name: 'Tên đăng nhập hoặc email' }), 'reader');
    await user.type(screen.getByLabelText('Mật khẩu'), 'Strong1!');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Email chưa được xác thực')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Email' }) as HTMLInputElement).value).toBe('');
  });
});
