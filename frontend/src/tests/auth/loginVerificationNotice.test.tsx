// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginVerificationNotice } from '../../pages/LoginVerificationNotice';

const mocks = vi.hoisted(() => ({ resendLoginVerification: vi.fn() }));
vi.mock('../../auth/api', () => ({ authApi: mocks }));
afterEach(() => { cleanup(); vi.useRealTimers(); mocks.resendLoginVerification.mockReset(); });

describe('automatic login verification notice', () => {
  it('sends once in StrictMode, counts down, and permits a manual resend after 60 seconds', async () => {
    vi.useFakeTimers();
    mocks.resendLoginVerification.mockResolvedValue(undefined);
    await act(async () => { render(<StrictMode><LoginVerificationNotice identifier="reader" /></StrictMode>); });
    expect(mocks.resendLoginVerification).toHaveBeenCalledExactlyOnceWith('reader');
    expect(screen.getByRole('button', { name: 'gửi lại trong 60s' }).hasAttribute('disabled')).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('button', { name: 'gửi lại trong 59s' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(59_000));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'gửi lại' })); });
    expect(mocks.resendLoginVerification).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'gửi lại trong 60s' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows a failed manual resend without retaining the previous success message', async () => {
    vi.useFakeTimers();
    mocks.resendLoginVerification.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline'));
    await act(async () => { render(<LoginVerificationNotice identifier="reader" />); });
    act(() => vi.advanceTimersByTime(60_000));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'gửi lại' })); });
    expect(screen.queryByText(/Yêu cầu gửi lại email xác thực đã được tiếp nhận/)).toBeNull();
    expect(screen.getByText('Không thể gửi yêu cầu lúc này. Vui lòng thử lại.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'gửi lại' }).hasAttribute('disabled')).toBe(false);
  });

  it('honors server Retry-After without claiming that the request succeeded', async () => {
    vi.useFakeTimers();
    mocks.resendLoginVerification.mockRejectedValue({
      isAxiosError: true, response: { status: 429, headers: { 'retry-after': '120' } },
    });
    await act(async () => { render(<LoginVerificationNotice identifier="reader" />); });
    expect(screen.getByRole('button', { name: 'gửi lại trong 120s' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText(/Yêu cầu gửi lại email xác thực đã được tiếp nhận/)).toBeNull();
    expect(screen.getByText('Vui lòng chờ trước khi thử gửi lại email xác thực.')).toBeTruthy();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('button', { name: 'gửi lại trong 60s' }).hasAttribute('disabled')).toBe(true);
  });
});
