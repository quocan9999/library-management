// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { systemConfigApi } from '../../features/systemConfig/api';
import { SystemConfigPage } from '../../features/systemConfig/SystemConfigPage';
import { AppNotificationProvider } from '../../components/AppNotificationProvider';
import type { SystemConfigData } from '../../features/systemConfig/types';

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverStub;

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
});

const mockConfigData: SystemConfigData = {
  id: 1,
  maintenanceMode: false,
  bannerMessage: 'Hệ thống đang bảo trì để nâng cấp',
  contactEmail: 'admin@library.sparkminds.com',
  expectedEndTime: '2026-11-01T12:00:00Z',
  updatedAt: '2026-10-27T10:00:00Z',
  bypassRoles: ['ROLE_ADMIN'],
  recentHistories: [
    {
      id: 1,
      action: 'SYSTEM_INIT',
      actorUsername: 'superadmin',
      reason: 'Khởi tạo cấu hình',
      detail: 'Chế độ bảo trì khởi tạo mặc định: TẮT',
      createdAt: '2026-10-27T08:00:00Z',
    },
  ],
};

describe('SystemConfigPage', () => {
  beforeEach(() => {
    vi.spyOn(systemConfigApi, 'getSystemConfig').mockResolvedValue(mockConfigData);
    vi.spyOn(systemConfigApi, 'updateMaintenanceMode').mockResolvedValue({
      ...mockConfigData,
      maintenanceMode: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('tải và hiển thị thông tin cấu hình hệ thống ban đầu', async () => {
    render(
      <AppNotificationProvider>
        <SystemConfigPage />
      </AppNotificationProvider>
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Cấu hình hệ thống' })).toBeDefined();
    expect(screen.getByText('Hệ thống hoạt động bình thường')).toBeDefined();
    expect(screen.getByText('Chế độ bảo trì (Maintenance Mode)')).toBeDefined();
    expect(screen.getByText('ROLE_ADMIN')).toBeDefined();
    expect(screen.getByText('Khởi tạo cấu hình')).toBeDefined();
  });

  it('mở modal xác nhận khi bấm switch chuyển đổi trạng thái', async () => {
    const user = userEvent.setup();
    render(
      <AppNotificationProvider>
        <SystemConfigPage />
      </AppNotificationProvider>
    );

    await screen.findByRole('heading', { level: 1, name: 'Cấu hình hệ thống' });

    const switchBtn = screen.getByRole('switch', { name: 'Bật hoặc tắt chế độ bảo trì' });
    await user.click(switchBtn);

    expect(await screen.findByText('Xác nhận bật chế độ bảo trì')).toBeDefined();
    expect(screen.getByText(/Khi bật chế độ bảo trì, toàn bộ API của độc giả/)).toBeDefined();
    expect(screen.getByLabelText(/Lý do thực hiện/)).toBeDefined();
  });

  it('gọi API updateMaintenanceMode khi nhấn nút xác nhận trong modal', async () => {
    const user = userEvent.setup();
    render(
      <AppNotificationProvider>
        <SystemConfigPage />
      </AppNotificationProvider>
    );

    await screen.findByRole('heading', { level: 1, name: 'Cấu hình hệ thống' });

    const switchBtn = screen.getByRole('switch', { name: 'Bật hoặc tắt chế độ bảo trì' });
    await user.click(switchBtn);

    const reasonInput = await screen.findByPlaceholderText(/Nâng cấp máy chủ/);
    fireEvent.change(reasonInput, { target: { value: 'Bảo trì khẩn cấp' } });

    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận BẬT bảo trì' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(systemConfigApi.updateMaintenanceMode).toHaveBeenCalledWith(
        expect.objectContaining({
          maintenanceMode: true,
          reason: 'Bảo trì khẩn cấp',
        })
      );
    });
  });
});
