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
  expectedEndTime: '2026-11-01T12:00:00Z',
  updatedAt: '2026-10-27T10:00:00Z',
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
    expect(screen.getByText('Khởi tạo cấu hình')).toBeDefined();
    expect(screen.queryByText(/Email liên hệ hỗ trợ/)).toBeNull();
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
    expect(screen.getByText(/Khi bật chế độ bảo trì/)).toBeDefined();
    expect(screen.getByLabelText(/Lý do thực hiện/)).toBeDefined();
    expect(screen.getByLabelText(/Thời gian dự kiến hoàn thành/)).toBeDefined();
    expect(screen.queryByLabelText(/Thông điệp gửi độc giả/)).toBeNull();
    expect(screen.queryByLabelText(/Email hỗ trợ kỹ thuật/)).toBeNull();
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

  it('khi bật bảo trì với thời gian dự kiến hợp lệ, gửi đúng định dạng local và cập nhật thời gian mở lại', async () => {
    vi.spyOn(systemConfigApi, 'updateMaintenanceMode').mockResolvedValue({
      ...mockConfigData,
      maintenanceMode: true,
      expectedEndTime: '2026-11-05T14:30:00',
    });

    const user = userEvent.setup();
    render(
      <AppNotificationProvider>
        <SystemConfigPage />
      </AppNotificationProvider>
    );

    await screen.findByRole('heading', { level: 1, name: 'Cấu hình hệ thống' });

    const switchBtn = screen.getByRole('switch', { name: 'Bật hoặc tắt chế độ bảo trì' });
    await user.click(switchBtn);

    const timeInput = await screen.findByLabelText(/Thời gian dự kiến hoàn thành/);
    fireEvent.change(timeInput, { target: { value: '2026-11-05T14:30' } });

    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận BẬT bảo trì' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(systemConfigApi.updateMaintenanceMode).toHaveBeenCalledWith(
        expect.objectContaining({
          maintenanceMode: true,
          expectedEndTime: '2026-11-05T14:30:00',
        })
      );
    });
  });

  it('khi tắt bảo trì, modal không hiển thị trường thời gian dự kiến và gửi expectedEndTime là null', async () => {
    vi.spyOn(systemConfigApi, 'getSystemConfig').mockResolvedValue({
      ...mockConfigData,
      maintenanceMode: true,
      expectedEndTime: '2026-11-01T12:00:00Z',
    });
    vi.spyOn(systemConfigApi, 'updateMaintenanceMode').mockResolvedValue({
      ...mockConfigData,
      maintenanceMode: false,
      expectedEndTime: null,
    });

    const user = userEvent.setup();
    render(
      <AppNotificationProvider>
        <SystemConfigPage />
      </AppNotificationProvider>
    );

    await screen.findByRole('heading', { level: 1, name: 'Cấu hình hệ thống' });
    expect(screen.getByText('ĐANG BẬT BẢO TRÌ')).toBeDefined();

    const switchBtn = screen.getByRole('switch', { name: 'Bật hoặc tắt chế độ bảo trì' });
    await user.click(switchBtn);

    expect(await screen.findByText('Xác nhận tắt chế độ bảo trì')).toBeDefined();
    expect(screen.queryByLabelText(/Thời gian dự kiến hoàn thành/)).toBeNull();
    expect(screen.queryByLabelText(/Email hỗ trợ kỹ thuật/)).toBeNull();

    const reasonInput = await screen.findByPlaceholderText(/Hoàn tất bảo trì/);
    fireEvent.change(reasonInput, { target: { value: 'Hoàn tất bảo trì định kỳ' } });

    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận TẮT bảo trì' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(systemConfigApi.updateMaintenanceMode).toHaveBeenCalledWith(
        expect.objectContaining({
          maintenanceMode: false,
          reason: 'Hoàn tất bảo trì định kỳ',
          expectedEndTime: null,
        })
      );
    });
  });

  it('khi bật bảo trì với thời gian quá khứ, hiển thị cảnh báo lỗi và không gọi API', async () => {
    const user = userEvent.setup();
    render(
      <AppNotificationProvider>
        <SystemConfigPage />
      </AppNotificationProvider>
    );

    await screen.findByRole('heading', { level: 1, name: 'Cấu hình hệ thống' });

    const switchBtn = screen.getByRole('switch', { name: 'Bật hoặc tắt chế độ bảo trì' });
    await user.click(switchBtn);

    const endTimeInput = await screen.findByLabelText(/Thời gian dự kiến hoàn thành/);
    fireEvent.change(endTimeInput, { target: { value: '2020-01-01T10:00' } });

    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận BẬT bảo trì' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('Thời gian không hợp lệ')).toBeDefined();
    });
    expect(systemConfigApi.updateMaintenanceMode).not.toHaveBeenCalled();
  });
});
