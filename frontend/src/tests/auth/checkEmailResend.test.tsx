// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckEmailPage } from '../../pages/CheckEmailPage';
import { saveRegistrationEmail } from '../../auth/registrationStorage';
const mocks = vi.hoisted(() => ({ resendVerification: vi.fn() }));
vi.mock('../../auth/api', () => ({ authApi: mocks }));
afterEach(() => { cleanup(); vi.useRealTimers(); sessionStorage.clear(); mocks.resendVerification.mockReset(); });
function mount() {
  vi.useFakeTimers();
  sessionStorage.setItem('registrationEmail', 'reader@example.com');
  render(<MemoryRouter><CheckEmailPage /></MemoryRouter>);
}
describe('check email inline resend', () => {
  it('starts registration cooldown immediately and preserves the remaining time when remounted', () => {
    vi.useFakeTimers();
    saveRegistrationEmail('reader@example.com', 60);
    mount();
    expect(screen.getByText('gửi lại sau 60 giây')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'gửi lại' })).toBeNull();
    act(() => vi.advanceTimersByTime(4000));
    cleanup();
    mount();
    expect(screen.getByText('gửi lại sau 56 giây')).toBeTruthy();
    act(() => vi.advanceTimersByTime(56_000));
    expect(screen.getByRole('button', { name: 'gửi lại' })).toBeTruthy();
  });
  it('shows both inline states and resends the stored email after 60 seconds', async () => {
    mocks.resendVerification.mockResolvedValue(undefined);
    mount();
    const button = screen.getByRole('button', { name: 'gửi lại' });
    expect(button.closest('p')?.textContent).toBe('Không thấy email? Hãy kiểm tra thư rác hoặc gửi lại.');
    await act(async () => fireEvent.click(button));
    expect(screen.queryByText('Yêu cầu đã được tiếp nhận')).toBeNull();
    expect(screen.getByText('gửi lại sau 60 giây').closest('p')?.textContent)
      .toBe('Không thấy email? Hãy kiểm tra thư rác hoặc gửi lại sau 60 giây.');
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText('gửi lại sau 56 giây')).toBeTruthy();
    act(() => vi.advanceTimersByTime(56_000));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'gửi lại' })));
    expect(mocks.resendVerification).toHaveBeenCalledTimes(2);
    expect(mocks.resendVerification).toHaveBeenLastCalledWith('reader@example.com');
  });
  it('locks the inline action while sending and honors Retry-After', async () => {
    let reject!: (error: unknown) => void;
    mocks.resendVerification.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    mount();
    const button = screen.getByRole('button', { name: 'gửi lại' });
    await act(async () => fireEvent.click(button));
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(mocks.resendVerification).toHaveBeenCalledTimes(1);
    await act(async () => reject({ isAxiosError: true, response: { status: 429, headers: { 'retry-after': '120' }, data: {} } }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('gửi lại sau 120 giây')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'gửi lại' })).toBeNull();
  });
  it('centers the page and removes the decorative rail and eyebrow', () => {
    mount();
    expect(document.querySelector('.auth-stage--centered')).toBeTruthy();
    expect(document.querySelector('.auth-rail')).toBeNull();
    expect(document.querySelector('.eyebrow')).toBeNull();
  });
});
