// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App } from '../../app/App';

const mocks = vi.hoisted(() => ({
  auth: {
    accessToken: 'active-user-token',
    isBootstrapping: false,
    currentUser: { id: 17, username: 'reader', email: 'reader@example.com', role: 'ROLE_USER', permissions: ['account:change-email'] },
    role: 'ROLE_USER',
    permissions: ['account:change-email'],
    capabilityStatus: 'ready',
    refreshCapabilities: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
  },
  requestEmailChange: vi.fn(),
  verifyEmailChange: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => mocks.auth,
  useOptionalAuth: () => null,
}));

vi.mock('../../profile/api', () => ({
  profileApi: {
    changePassword: vi.fn(),
    requestEmailChange: mocks.requestEmailChange,
    verifyEmailChange: mocks.verifyEmailChange,
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current path">{location.pathname}</output>;
}

function renderPage() {
  return render(<MemoryRouter initialEntries={['/profile/change-email']}><App /><LocationProbe /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  mocks.requestEmailChange.mockReset();
  mocks.verifyEmailChange.mockReset();
  mocks.auth.refreshCapabilities.mockClear();
  Object.assign(mocks.auth, {
    accessToken: 'active-user-token',
    currentUser: { id: 17, username: 'reader', email: 'reader@example.com', role: 'ROLE_USER', permissions: ['account:change-email'] },
    role: 'ROLE_USER',
    permissions: ['account:change-email'],
    isBootstrapping: false,
    capabilityStatus: 'ready',
  });
});

describe('ChangeEmailPage', () => {
  it('keeps the OTP step and expired-code error across capability refresh', async () => {
    mocks.requestEmailChange.mockResolvedValue(undefined);
    let rejectVerification!: (error: unknown) => void;
    mocks.verifyEmailChange.mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectVerification = reject; }));
    const view = renderPage();
    fireEvent.change(screen.getByLabelText('Email mới'), { target: { value: 'new.reader@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'Current1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã xác thực' }));
    await screen.findByText(/Mã xác thực đã được gửi/);
    fireEvent.change(screen.getByLabelText('Mã xác thực 6 chữ số'), { target: { value: '012345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đổi email' }));
    await waitFor(() => expect(mocks.verifyEmailChange).toHaveBeenCalledTimes(1));
    mocks.auth.capabilityStatus = 'loading';
    view.rerender(<MemoryRouter initialEntries={['/profile/change-email']}><App /><LocationProbe /></MemoryRouter>);
    await act(async () => rejectVerification({ isAxiosError: true, response: { status: 400, data: { code: 'EMAIL_CHANGE_CODE_INVALID' } } }));
    mocks.auth.capabilityStatus = 'ready';
    view.rerender(<MemoryRouter initialEntries={['/profile/change-email']}><App /><LocationProbe /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByLabelText('Mã xác thực 6 chữ số')).toBeTruthy();
    expect(screen.queryByLabelText('Email mới')).toBeNull();
    expect(screen.getByLabelText('current path').textContent).toBe('/profile/change-email');
  });

  it('requests a code, verifies leading-zero code, refreshes profile and keeps session', async () => {
    mocks.requestEmailChange.mockResolvedValue(undefined);
    mocks.verifyEmailChange.mockResolvedValue(undefined);
    renderPage();

    expect(screen.getByText('reader@example.com')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Email mới'), { target: { value: ' New.Reader@Example.com ' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'Current1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã xác thực' }));

    expect(await screen.findByText(/Mã xác thực đã được gửi/)).toBeTruthy();
    expect(mocks.requestEmailChange).toHaveBeenCalledWith({ newEmail: 'new.reader@example.com', currentPassword: 'Current1!' });
    fireEvent.change(screen.getByLabelText('Mã xác thực 6 chữ số'), { target: { value: '012345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đổi email' }));

    expect(await screen.findByText('Email đã được thay đổi thành công.')).toBeTruthy();
    expect(mocks.verifyEmailChange).toHaveBeenCalledWith({ code: '012345' });
    expect(mocks.auth.refreshCapabilities).toHaveBeenCalledWith({ force: true });
    expect(mocks.auth.accessToken).toBe('active-user-token');
  });

  it('rejects invalid and current email before requesting a code', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Email mới'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'Current1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã xác thực' }));
    expect(await screen.findByText('Vui lòng nhập địa chỉ email hợp lệ.')).toBeTruthy();
    expect(mocks.requestEmailChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Email mới'), { target: { value: ' READER@EXAMPLE.COM ' } });
    fireEvent.click(screen.getByRole('button', { name: /Gửi mã xác thực/ }));
    expect(await screen.findByText('Email mới phải khác email hiện tại.')).toBeTruthy();
    expect(mocks.requestEmailChange).not.toHaveBeenCalled();
  });

  it('keeps request form on server failure and supports resend cooldown state', async () => {
    mocks.requestEmailChange.mockResolvedValue(undefined);
    let completeRequest!: () => void;
    mocks.requestEmailChange.mockImplementationOnce(() => new Promise<void>((resolve) => { completeRequest = resolve; }));
    renderPage();
    fireEvent.change(screen.getByLabelText('Email mới'), { target: { value: 'new.reader@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'Current1!' } });
    const submit = screen.getByRole('button', { name: 'Gửi mã xác thực' });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.requestEmailChange).toHaveBeenCalledTimes(1));
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    await act(async () => completeRequest());
    expect(await screen.findByRole('button', { name: /Gửi lại sau/ })).toBeTruthy();
  });

  it('shows invalid-code errors and preserves the six-digit string', async () => {
    mocks.requestEmailChange.mockResolvedValue(undefined);
    mocks.verifyEmailChange.mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { code: 'EMAIL_CHANGE_CODE_INVALID' } } });
    renderPage();
    fireEvent.change(screen.getByLabelText('Email mới'), { target: { value: 'new.reader@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'Current1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã xác thực' }));
    await screen.findByText(/Mã xác thực đã được gửi/);
    fireEvent.change(screen.getByLabelText('Mã xác thực 6 chữ số'), { target: { value: '012345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đổi email' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(mocks.verifyEmailChange).toHaveBeenCalledWith({ code: '012345' });
    expect(screen.getByLabelText('current path').textContent).toBe('/profile/change-email');
  });
});
