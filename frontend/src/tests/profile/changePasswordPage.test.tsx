// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App } from '../../app/App';

const mocks = vi.hoisted(() => ({
  auth: {
    accessToken: 'active-user-token',
    isBootstrapping: false,
    currentUser: {
      id: 17,
      username: 'reader',
      email: 'reader@example.com',
      role: 'USER',
      permissions: ['account:change-password'],
    },
    role: 'USER',
    permissions: ['account:change-password'],
    capabilityStatus: 'ready',
    refreshCapabilities: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
  },
  changePassword: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => mocks.auth,
  useOptionalAuth: () => null,
}));

vi.mock('../../profile/api', () => ({
  profileApi: { changePassword: mocks.changePassword },
}));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current path">{location.pathname}</output>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/profile/change-password']}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  mocks.changePassword.mockReset();
  Object.assign(mocks.auth, {
    accessToken: 'active-user-token',
    currentUser: {
      id: 17,
      username: 'reader',
      email: 'reader@example.com',
      role: 'USER',
      permissions: ['account:change-password'],
    },
    role: 'USER',
    permissions: ['account:change-password'],
    isBootstrapping: false,
    capabilityStatus: 'ready',
  });
});

describe('ChangePasswordPage', () => {
  it('submits valid values, shows success, clears inputs and keeps the active session', async () => {
    mocks.changePassword.mockResolvedValue(undefined);
    renderPage();

    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'Current1!' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'NewPass2!' } });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới'), { target: { value: 'NewPass2!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(await screen.findByText('Mật khẩu đã được thay đổi thành công.')).toBeTruthy();
    expect(mocks.changePassword).toHaveBeenCalledWith({
      currentPassword: 'Current1!',
      newPassword: 'NewPass2!',
      confirmNewPassword: 'NewPass2!',
    });
    await waitFor(() => {
      expect((screen.getByLabelText('Mật khẩu hiện tại') as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText('Mật khẩu mới') as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText('Xác nhận mật khẩu mới') as HTMLInputElement).value).toBe('');
    });
    expect(mocks.auth.accessToken).toBe('active-user-token');
    expect(screen.getByLabelText('current path').textContent).toBe('/profile/change-password');
  });

  it('locks the submit action while the request is pending', async () => {
    let completeRequest!: () => void;
    mocks.changePassword.mockImplementation(() => new Promise<void>((resolve) => { completeRequest = resolve; }));
    renderPage();

    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'Current1!' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'NewPass2!' } });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới'), { target: { value: 'NewPass2!' } });
    const submit = screen.getByRole('button', { name: 'Đổi mật khẩu' });
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.changePassword).toHaveBeenCalledTimes(1));
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(submit);
    expect(mocks.changePassword).toHaveBeenCalledTimes(1);

    await act(async () => completeRequest());
    expect(await screen.findByText('Mật khẩu đã được thay đổi thành công.')).toBeTruthy();
  });

  it('shows field errors without sending invalid form values', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'Current1!' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'weak' } });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    const newPasswordErrors = await screen.findByRole('list', { name: 'Lỗi mật khẩu mới' });
    expect(newPasswordErrors.textContent).toContain('Mật khẩu cần có ít nhất 8 ký tự.');
    expect(screen.getByText('Mật khẩu xác nhận không khớp.')).toBeTruthy();
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password before sending the request', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'Current1!' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'Current1!' } });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới'), { target: { value: 'Current1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(await screen.findByText('Mật khẩu mới phải khác mật khẩu hiện tại.')).toBeTruthy();
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it('maps a wrong current password to a clear server error and remains on the form', async () => {
    mocks.changePassword.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { code: 'CURRENT_PASSWORD_INVALID' } },
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'Wrong1!' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'NewPass2!' } });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới'), { target: { value: 'NewPass2!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(await screen.findByText('Mật khẩu hiện tại không chính xác.')).toBeTruthy();
    expect(screen.getByLabelText('current path').textContent).toBe('/profile/change-password');
    expect(mocks.auth.accessToken).toBe('active-user-token');
  });
});
