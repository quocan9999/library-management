// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordPage } from '../../pages/ForgotPasswordPage';

const mocks = vi.hoisted(() => ({ forgotPassword: vi.fn() }));
vi.mock('../../auth/api', () => ({ authApi: { forgotPassword: mocks.forgotPassword } }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  mocks.forgotPassword.mockReset();
});

async function requestLink() {
  vi.useFakeTimers();
  mocks.forgotPassword.mockResolvedValue(undefined);
  render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' Reader@Example.com ' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại mật khẩu' })));
}

describe('forgot password resend', () => {
  it('waits 60 seconds then resends the same normalized email without leaving confirmation', async () => {
    await requestLink();
    expect(!!screen.getByText('gửi lại sau 60 giây')).toBe(true);
    expect(mocks.forgotPassword).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(59_000));
    expect(!!screen.getByText('gửi lại sau 1 giây')).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'gửi lại' })));
    expect(mocks.forgotPassword).toHaveBeenCalledTimes(2);
    expect(mocks.forgotPassword).toHaveBeenNthCalledWith(2, 'reader@example.com');
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.getByText('Kiểm tra email của bạn!')).toBeTruthy();
    expect(!!screen.getByText('gửi lại sau 60 giây')).toBe(true);
  });

  it('locks resend while pending and keeps confirmation visible after a send failure', async () => {
    await requestLink();
    act(() => vi.advanceTimersByTime(60_000));
    let rejectRequest!: (reason: unknown) => void;
    mocks.forgotPassword.mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectRequest = reject; }));
    const resend = screen.getByRole('button', { name: 'gửi lại' });
    await act(async () => fireEvent.click(resend));
    expect(resend.hasAttribute('disabled')).toBe(true);
    fireEvent.click(resend);
    expect(mocks.forgotPassword).toHaveBeenCalledTimes(2);
    await act(async () => rejectRequest({ isAxiosError: true, response: { status: 503, data: {} } }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.getByText('Kiểm tra email của bạn!')).toBeTruthy();
  });

  it('honors the server Retry-After on rate limited resend', async () => {
    await requestLink();
    act(() => vi.advanceTimersByTime(60_000));
    mocks.forgotPassword.mockRejectedValueOnce({ isAxiosError: true, response: { status: 429, headers: { 'retry-after': '120' }, data: {} } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'gửi lại' })));
    expect(!!screen.getByText('gửi lại sau 120 giây')).toBe(true);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByLabelText('Email')).toBeNull();
  });
});
