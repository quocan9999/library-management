// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfilePage } from '../../profile/ProfilePage';
import { profileApi } from '../../profile/api';

if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

const mockProfileData = {
  accountId: 17,
  username: 'reader',
  email: 'reader@example.com',
  role: 'USER',
  memberId: 5,
  memberCode: 'M000005',
  fullName: 'Nguyễn Văn A',
  dateOfBirth: '1995-05-15',
  phone: '0912345678',
  address: '123 Đường Sách, Hà Nội',
  version: 0,
};

const mocks = vi.hoisted(() => ({
  auth: {
    accessToken: 'signed-in-token',
    currentUser: {
      id: 17,
      username: 'reader',
      email: 'reader@example.com',
      role: 'USER',
      permissions: ['account:change-password'],
    },
    role: 'USER',
    permissions: ['account:change-password'],
  },
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => mocks.auth,
  useOptionalAuth: () => null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mocks.auth.role = 'USER';
  mocks.auth.currentUser = {
    id: 17,
    username: 'reader',
    email: 'reader@example.com',
    role: 'USER',
    permissions: ['account:change-password'],
  };
});

describe('ProfilePage Component', () => {
  it('renders personal profile information in view mode for USER', async () => {
    vi.spyOn(profileApi, 'getProfile').mockResolvedValue(mockProfileData);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const personalSection = await screen.findByLabelText('Thông tin cá nhân');
    expect(within(personalSection).getByText('Nguyễn Văn A')).toBeTruthy();
    expect(within(personalSection).getByText('15/05/1995')).toBeTruthy();
    expect(within(personalSection).getByText('0912345678')).toBeTruthy();
    expect(within(personalSection).getByText('123 Đường Sách, Hà Nội')).toBeTruthy();
    expect(screen.getByText('M000005')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa thông tin cá nhân' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Xem sách của tôi' })).toBeTruthy();
  });

  it('allows user to edit personal profile and save successfully', async () => {
    vi.spyOn(profileApi, 'getProfile').mockResolvedValue(mockProfileData);
    const updateSpy = vi.spyOn(profileApi, 'updateProfile').mockResolvedValue({
      ...mockProfileData,
      fullName: 'Nguyễn Văn B',
      phone: '0987654321',
      version: 1,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const personalSection = await screen.findByLabelText('Thông tin cá nhân');
    expect(within(personalSection).getByText('Nguyễn Văn A')).toBeTruthy();

    // Click edit
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa thông tin cá nhân' }));

    // Input fields should appear
    const nameInput = screen.getByRole('textbox', { name: 'Họ và tên' });
    const phoneInput = screen.getByRole('textbox', { name: 'Số điện thoại' });

    fireEvent.change(nameInput, { target: { value: 'Nguyễn Văn B' } });
    fireEvent.change(phoneInput, { target: { value: '0987654321' } });

    // Save
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        version: 0,
        fullName: 'Nguyễn Văn B',
        dateOfBirth: '1995-05-15',
        phone: '0987654321',
        address: '123 Đường Sách, Hà Nội',
      });
    });

    expect(await screen.findByText('Cập nhật thông tin cá nhân thành công!')).toBeTruthy();
    const updatedSection = screen.getByLabelText('Thông tin cá nhân');
    expect(within(updatedSection).getByText('Nguyễn Văn B')).toBeTruthy();
  });

  it('validates client-side constraints on phone format and age', async () => {
    vi.spyOn(profileApi, 'getProfile').mockResolvedValue(mockProfileData);
    const updateSpy = vi.spyOn(profileApi, 'updateProfile');

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const personalSection = await screen.findByLabelText('Thông tin cá nhân');
    expect(within(personalSection).getByText('Nguyễn Văn A')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa thông tin cá nhân' }));

    const dobInput = screen.getByLabelText('Ngày sinh');
    const phoneInput = screen.getByRole('textbox', { name: 'Số điện thoại' });

    // Set invalid phone and future/underage dob
    fireEvent.change(phoneInput, { target: { value: '123' } });
    fireEvent.change(dobInput, { target: { value: '2020-01-01' } });

    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText('Ngày sinh phải hợp lệ và thành viên đủ 16 tuổi')).toBeTruthy();
    expect(screen.getByText('Số điện thoại phải có đúng 10 chữ số và thuộc đầu số di động Việt Nam (03, 05, 07, 08, 09)')).toBeTruthy();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('allows canceling edit mode without saving changes', async () => {
    vi.spyOn(profileApi, 'getProfile').mockResolvedValue(mockProfileData);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const personalSection = await screen.findByLabelText('Thông tin cá nhân');
    expect(within(personalSection).getByText('Nguyễn Văn A')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa thông tin cá nhân' }));

    const nameInput = screen.getByRole('textbox', { name: 'Họ và tên' });
    fireEvent.change(nameInput, { target: { value: 'Thay đổi chưa lưu' } });

    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));

    expect(screen.queryByRole('textbox', { name: 'Họ và tên' })).toBeNull();
    const resetSection = screen.getByLabelText('Thông tin cá nhân');
    expect(within(resetSection).getByText('Nguyễn Văn A')).toBeTruthy();
  });

  it('renders admin profile with personal info and security cards for ADMIN', async () => {
    mocks.auth.role = 'ADMIN';
    mocks.auth.currentUser = {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      role: 'ADMIN',
      permissions: [],
    };
    vi.spyOn(profileApi, 'getProfile').mockResolvedValue({
      accountId: 1,
      username: 'admin',
      email: 'admin@example.com',
      role: 'ADMIN',
      memberId: 1,
      memberCode: 'A000001',
      fullName: 'Quản trị viên Hệ thống',
      dateOfBirth: '1990-01-01',
      phone: '0912999888',
      address: 'Văn phòng Thư viện',
      version: 0,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Hồ sơ tài khoản' })).toBeTruthy();
    expect(screen.getByText('HỒ SƠ TÀI KHOẢN')).toBeTruthy();
    const personalSection = screen.getByLabelText('Thông tin cá nhân');
    expect(within(personalSection).getByText('Quản trị viên Hệ thống')).toBeTruthy();
    expect(within(personalSection).getByText('01/01/1990')).toBeTruthy();
    expect(within(personalSection).getByText('0912999888')).toBeTruthy();
    expect(within(personalSection).getByText('Văn phòng Thư viện')).toBeTruthy();
    expect(within(personalSection).getByText('Quản trị viên')).toBeTruthy();
    expect(within(personalSection).getByRole('button', { name: 'Chỉnh sửa thông tin' })).toBeTruthy();

    // Security section
    const securitySection = screen.getByLabelText('Thông tin đăng nhập & Bảo mật');
    expect(within(securitySection).getByText('admin@example.com')).toBeTruthy();
    expect(within(securitySection).getByRole('link', { name: 'Đổi email' })).toBeTruthy();
    expect(within(securitySection).getByRole('link', { name: 'Đổi mật khẩu' })).toBeTruthy();

    // Admin should not have reader specific links
    expect(screen.queryByRole('link', { name: 'Xem sách của tôi' })).toBeNull();
    expect(screen.queryByText('Khám phá')).toBeNull();
  });

  it('allows admin to edit and save personal profile successfully', async () => {
    mocks.auth.role = 'ADMIN';
    mocks.auth.currentUser = {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      role: 'ADMIN',
      permissions: [],
    };
    vi.spyOn(profileApi, 'getProfile').mockResolvedValue({
      accountId: 1,
      username: 'admin',
      email: 'admin@example.com',
      role: 'ADMIN',
      memberId: 1,
      memberCode: 'A000001',
      fullName: 'Quản trị viên',
      dateOfBirth: '1990-01-01',
      phone: '0912999888',
      address: 'Hà Nội',
      version: 0,
    });
    const updateSpy = vi.spyOn(profileApi, 'updateProfile').mockResolvedValue({
      accountId: 1,
      username: 'admin',
      email: 'admin@example.com',
      role: 'ADMIN',
      memberId: 1,
      memberCode: 'A000001',
      fullName: 'Quản trị viên Mới',
      dateOfBirth: '1990-01-01',
      phone: '0987111222',
      address: 'TP HCM',
      version: 1,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Hồ sơ tài khoản' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa thông tin' }));

    const nameInput = screen.getByRole('textbox', { name: 'Họ và tên' });
    const phoneInput = screen.getByRole('textbox', { name: 'Số điện thoại (10 chữ số)' });
    const addressInput = screen.getByRole('textbox', { name: 'Địa chỉ cư trú' });

    fireEvent.change(nameInput, { target: { value: 'Quản trị viên Mới' } });
    fireEvent.change(phoneInput, { target: { value: '0987111222' } });
    fireEvent.change(addressInput, { target: { value: 'TP HCM' } });

    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        version: 0,
        fullName: 'Quản trị viên Mới',
        dateOfBirth: '1990-01-01',
        phone: '0987111222',
        address: 'TP HCM',
      });
    });

    expect(await screen.findByText('Cập nhật thông tin cá nhân thành công!')).toBeTruthy();
    const updatedSection = screen.getByLabelText('Thông tin cá nhân');
    expect(within(updatedSection).getByText('Quản trị viên Mới')).toBeTruthy();
  });
});
