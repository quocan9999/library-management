import { Button, Input, Modal, Spin, Switch, Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { systemConfigApi } from './api';
import type { SystemConfigData, SystemConfigHistoryItem } from './types';

function formatTimestamp(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getMinLocalDateTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function SystemConfigPage() {
  const { notify } = useAppNotification();
  const [config, setConfig] = useState<SystemConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Modal confirmation state
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState(false);
  const [reason, setReason] = useState('');
  const [expectedEndTime, setExpectedEndTime] = useState('');

  const fetchConfig = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const data = await systemConfigApi.getSystemConfig(signal);
      setConfig(data);
      setExpectedEndTime(data.expectedEndTime ? data.expectedEndTime.slice(0, 16) : '');
    } catch (error) {
      if (!signal?.aborted) {
        notify('error', {
          key: 'config-fetch-error',
          title: 'Lỗi tải cấu hình',
          description: error instanceof Error ? error.message : 'Không thể tải cấu hình hệ thống.',
        });
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [notify]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchConfig(controller.signal);
    return () => controller.abort();
  }, [fetchConfig]);

  const handleToggleSwitch = (checked: boolean) => {
    setPendingMode(checked);
    setReason('');
    if (!checked) {
      setExpectedEndTime('');
    } else {
      if (config?.expectedEndTime && new Date(config.expectedEndTime).getTime() > Date.now()) {
        setExpectedEndTime(config.expectedEndTime.slice(0, 16));
      } else {
        setExpectedEndTime('');
      }
    }
    setModalOpen(true);
  };

  const handleConfirmUpdate = async () => {
    if (pendingMode && expectedEndTime) {
      const selectedTime = new Date(expectedEndTime).getTime();
      if (Number.isNaN(selectedTime) || selectedTime <= Date.now()) {
        notify('error', {
          key: 'config-invalid-end-time',
          title: 'Thời gian không hợp lệ',
          description: 'Thời gian dự kiến hoàn thành phải ở tương lai.',
        });
        return;
      }
    }

    setUpdating(true);
    try {
      const payloadExpectedEndTime = pendingMode && expectedEndTime
        ? (expectedEndTime.length === 16 ? `${expectedEndTime}:00` : expectedEndTime)
        : null;

      const updated = await systemConfigApi.updateMaintenanceMode({
        maintenanceMode: pendingMode,
        reason: reason.trim() || (pendingMode ? 'Bật chế độ bảo trì hệ thống' : 'Tắt chế độ bảo trì hệ thống'),
        expectedEndTime: payloadExpectedEndTime,
      });
      setConfig(updated);
      setExpectedEndTime(updated.expectedEndTime ? updated.expectedEndTime.slice(0, 16) : '');
      setModalOpen(false);
      notify('success', {
        key: 'config-update-success',
        title: 'Cập nhật thành công',
        description: pendingMode
          ? 'Đã bật chế độ bảo trì hệ thống. Các yêu cầu từ độc giả sẽ bị tạm chặn.'
          : 'Đã tắt chế độ bảo trì. Hệ thống hoạt động bình thường.',
      });
    } catch (error) {
      notify('error', {
        key: 'config-update-error',
        title: 'Cập nhật thất bại',
        description: error instanceof Error ? error.message : 'Không thể cập nhật cấu hình hệ thống.',
      });
    } finally {
      setUpdating(false);
    }
  };

  const columns: TableColumnsType<SystemConfigHistoryItem> = [
    {
      title: 'THỜI GIAN',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (val: string) => <span className="tabular-num text-sm">{formatTimestamp(val)}</span>,
    },
    {
      title: 'NGƯỜI THỰC HIỆN',
      dataIndex: 'actorUsername',
      key: 'actorUsername',
      width: 150,
      render: (val: string) => <strong className="text-navy">{val}</strong>,
    },
    {
      title: 'HÀNH ĐỘNG',
      dataIndex: 'action',
      key: 'action',
      width: 170,
      render: (val: string) => {
        if (val === 'MAINTENANCE_ENABLED') {
          return <Tag color="error" className="config-pill-tag">Bật bảo trì</Tag>;
        }
        if (val === 'MAINTENANCE_DISABLED') {
          return <Tag color="success" className="config-pill-tag">Tắt bảo trì</Tag>;
        }
        return <Tag color="default" className="config-pill-tag">{val}</Tag>;
      },
    },
    {
      title: 'LÝ DO / GHI CHÚ',
      dataIndex: 'reason',
      key: 'reason',
      render: (val: string) => <span>{val || '—'}</span>,
    },
    {
      title: 'CHI TIẾT',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (val: string) => <span className="text-secondary text-sm">{val || '—'}</span>,
    },
  ];

  return (
    <div className="system-config-container">
      {/* Header */}
      <header className="system-config-header">
        <div className="system-config-header__titles">
          <h1 className="system-config-title">Cấu hình hệ thống</h1>
          <p className="system-config-subtitle">
            Quản trị trạng thái bảo trì và thiết lập các thông số toàn cục
          </p>
        </div>
        <div className="system-config-header__status">
          {config?.maintenanceMode ? (
            <span className="status-badge status-badge--maintenance" role="status">
              <span className="status-badge__dot" />
              Chế độ bảo trì đang bật
            </span>
          ) : (
            <span className="status-badge status-badge--operational" role="status">
              <span className="status-badge__dot" />
              Hệ thống hoạt động bình thường
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      {loading ? (
        <div className="system-config-loading">
          <Spin size="large" description="Đang tải dữ liệu cấu hình..." />
        </div>
      ) : (
        <div className="system-config-content">
          {/* Card 1: Chế độ bảo trì */}
          <section className="config-panel" aria-labelledby="maintenance-panel-title">
            <div className="config-panel__header">
              <div>
                <h2 id="maintenance-panel-title" className="config-panel__title">
                  Chế độ bảo trì (Maintenance Mode)
                </h2>
                <p className="config-panel__desc">
                  Khi kích hoạt, hệ thống sẽ tạm khóa các luồng nghiệp vụ công khai để đảm bảo an toàn dữ liệu khi nâng cấp.
                </p>
              </div>
              <div className="config-panel__action">
                <Switch
                  id="maintenance-toggle-switch"
                  checked={config?.maintenanceMode ?? false}
                  loading={updating}
                  onChange={handleToggleSwitch}
                  aria-label="Bật hoặc tắt chế độ bảo trì"
                />
              </div>
            </div>

            <div className="config-meta-grid">
              <div className="config-meta-item">
                <span className="config-meta-item__label">Trạng thái hiện tại</span>
                <span className="config-meta-item__value">
                  {config?.maintenanceMode ? (
                    <strong className="text-danger">ĐANG BẬT BẢO TRÌ</strong>
                  ) : (
                    <strong className="text-success">ĐANG VẬN HÀNH BÌNH THƯỜNG</strong>
                  )}
                </span>
              </div>
              <div className="config-meta-item">
                <span className="config-meta-item__label">Cập nhật lần cuối</span>
                <span className="config-meta-item__value tabular-num">
                  {formatTimestamp(config?.updatedAt)}
                </span>
              </div>
              <div className="config-meta-item">
                <span className="config-meta-item__label">Thời gian dự kiến mở lại</span>
                <span className="config-meta-item__value tabular-num">
                  {formatTimestamp(config?.expectedEndTime)}
                </span>
              </div>
            </div>
          </section>

          {/* Card 2: Lịch sử thao tác cấu hình */}
          <section className="config-panel" aria-labelledby="history-panel-title">
            <div className="config-panel__header">
              <div>
                <h2 id="history-panel-title" className="config-panel__title">
                  Nhật ký thao tác cấu hình
                </h2>
                <p className="config-panel__desc">
                  Lịch sử các lần bật/tắt chế độ bảo trì kèm danh tính người thực hiện và lý do.
                </p>
              </div>
            </div>

            <Table<SystemConfigHistoryItem>
              rowKey="id"
              columns={columns}
              dataSource={config?.recentHistories ?? []}
              pagination={false}
              className="config-history-table"
              locale={{ emptyText: 'Chưa có nhật ký thay đổi nào' }}
            />
          </section>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        title={pendingMode ? 'Xác nhận bật chế độ bảo trì' : 'Xác nhận tắt chế độ bảo trì'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalOpen(false)}>
            Hủy
          </Button>,
          <Button
            key="confirm"
            type="primary"
            danger={pendingMode}
            loading={updating}
            onClick={handleConfirmUpdate}
            className="config-modal-confirm-btn"
          >
            {pendingMode ? 'Xác nhận BẬT bảo trì' : 'Xác nhận TẮT bảo trì'}
          </Button>,
        ]}
        destroyOnHidden
      >
        <div className="config-modal-form">
          {pendingMode ? (
            <div className="config-modal-alert config-modal-alert--danger">
              <strong>Lưu ý quan trọng:</strong> Khi bật chế độ bảo trì, toàn bộ API và luồng nghiệp vụ công khai sẽ bị chặn.
            </div>
          ) : (
            <div className="config-modal-alert config-modal-alert--info">
              Hệ thống sẽ được mở lại cho toàn bộ người dùng và độc giả tiếp tục sử dụng các dịch vụ mượn sách.
            </div>
          )}

          <div className="config-form-item">
            <label htmlFor="config-reason" className="config-form-label">
              Lý do thực hiện <span className="text-danger">*</span>
            </label>
            <Input
              id="config-reason"
              placeholder={pendingMode ? 'Ví dụ: Nâng cấp máy chủ cơ sở dữ liệu định kỳ' : 'Ví dụ: Hoàn tất bảo trì hệ thống'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={255}
            />
          </div>

          {pendingMode && (
            <div className="config-form-item">
              <label htmlFor="config-expected-end" className="config-form-label">
                Thời gian dự kiến hoàn thành
              </label>
              <Input
                id="config-expected-end"
                type="datetime-local"
                min={getMinLocalDateTime()}
                value={expectedEndTime}
                onChange={(e) => setExpectedEndTime(e.target.value)}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
