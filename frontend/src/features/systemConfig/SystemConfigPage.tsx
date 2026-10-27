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

export function SystemConfigPage() {
  const { notify } = useAppNotification();
  const [config, setConfig] = useState<SystemConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Modal confirmation state
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState(false);
  const [reason, setReason] = useState('');
  const [bannerMessage, setBannerMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [expectedEndTime, setExpectedEndTime] = useState('');

  const fetchConfig = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const data = await systemConfigApi.getSystemConfig(signal);
      setConfig(data);
      setBannerMessage(data.bannerMessage ?? '');
      setContactEmail(data.contactEmail ?? '');
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
    setModalOpen(true);
  };

  const handleConfirmUpdate = async () => {
    setUpdating(true);
    try {
      const updated = await systemConfigApi.updateMaintenanceMode({
        maintenanceMode: pendingMode,
        reason: reason.trim() || (pendingMode ? 'Bật chế độ bảo trì hệ thống' : 'Tắt chế độ bảo trì hệ thống'),
        bannerMessage: bannerMessage.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        expectedEndTime: expectedEndTime ? new Date(expectedEndTime).toISOString() : null,
      });
      setConfig(updated);
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

      {loading ? (
        <div className="system-config-loading">
          <Spin size="large" />
          <span>Đang đồng bộ cấu hình hệ thống…</span>
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
                  Khi kích hoạt, hệ thống sẽ chặn tất cả các yêu cầu gọi API từ độc giả để đảm bảo an toàn dữ liệu khi nâng cấp.
                </p>
              </div>
              <div className="config-panel__action">
                <Switch
                  id="maintenance-toggle-switch"
                  checked={config?.maintenanceMode}
                  onChange={handleToggleSwitch}
                  loading={updating}
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
              <div className="config-meta-item">
                <span className="config-meta-item__label">Email liên hệ hỗ trợ</span>
                <span className="config-meta-item__value">
                  {config?.contactEmail || 'Chưa thiết lập'}
                </span>
              </div>
            </div>
          </section>

          {/* Card 2: Thông báo và Vai trò miễn trừ */}
          <div className="config-two-columns">
            <section className="config-panel" aria-labelledby="banner-panel-title">
              <h2 id="banner-panel-title" className="config-panel__title">
                Thông điệp thông báo bảo trì
              </h2>
              <p className="config-panel__desc">
                Nội dung hiển thị cho độc giả khi hệ thống đang trong thời gian bảo trì.
              </p>
              <div className="config-banner-preview">
                {config?.bannerMessage ? (
                  <p>{config.bannerMessage}</p>
                ) : (
                  <p className="text-muted italic">Chưa có thông điệp cụ thể (hiển thị thông báo mặc định)</p>
                )}
              </div>
            </section>

            <section className="config-panel" aria-labelledby="bypass-panel-title">
              <h2 id="bypass-panel-title" className="config-panel__title">
                Vai trò được miễn trừ (Bypass Roles)
              </h2>
              <p className="config-panel__desc">
                Các tài khoản thuộc nhóm vai trò này vẫn được phép truy cập và quản trị hệ thống khi đang bảo trì.
              </p>
              <div className="config-roles-list">
                {config?.bypassRoles && config.bypassRoles.length > 0 ? (
                  config.bypassRoles.map((role) => (
                    <Tag key={role} color="blue" className="config-pill-tag">
                      {role}
                    </Tag>
                  ))
                ) : (
                  <Tag color="blue" className="config-pill-tag">ROLE_ADMIN</Tag>
                )}
              </div>
            </section>
          </div>

          {/* Card 3: Lịch sử thao tác cấu hình */}
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
              <strong>Lưu ý quan trọng:</strong> Khi bật chế độ bảo trì, toàn bộ API của độc giả và luồng nghiệp vụ công khai sẽ bị chặn (HTTP 503). Chỉ tài khoản có vai trò Quản trị viên mới có thể truy cập hệ thống.
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
              placeholder="Ví dụ: Nâng cấp máy chủ cơ sở dữ liệu định kỳ"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="config-form-item">
            <label htmlFor="config-banner" className="config-form-label">
              Thông điệp gửi độc giả
            </label>
            <Input.TextArea
              id="config-banner"
              placeholder="Thông báo hiển thị khi độc giả truy cập"
              value={bannerMessage}
              onChange={(e) => setBannerMessage(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="config-form-item">
            <label htmlFor="config-contact" className="config-form-label">
              Email hỗ trợ kỹ thuật
            </label>
            <Input
              id="config-contact"
              type="email"
              placeholder="admin@library.sparkminds.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="config-form-item">
            <label htmlFor="config-expected-end" className="config-form-label">
              Thời gian dự kiến hoàn thành
            </label>
            <Input
              id="config-expected-end"
              type="datetime-local"
              value={expectedEndTime}
              onChange={(e) => setExpectedEndTime(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
