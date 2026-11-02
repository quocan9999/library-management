import { Alert, Button, Input, Modal, Select, Spin, Tag, Tooltip } from 'antd';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { isMaintenanceError, MAINTENANCE_MESSAGE, MAINTENANCE_TITLE } from '../../auth/messages';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { roleApi } from '../../role/api';
import type { RoleSummary } from '../../role/types';
import { adminAccountApi } from './api';
import type { AdminAccount, StaffProfileUpdateRequest } from './types';

const VIETNAM_PHONE_REGEX = /^0[35789][0-9]{8}$/;

function statusOf(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

function codeOf(error: unknown): string | undefined {
  if (!axios.isAxiosError<{ code?: string }>(error)) return undefined;
  return error.response?.data?.code;
}

function formatDateOfBirth(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  try {
    const [year, month, day] = isoDate.split('-');
    if (year && month && day) {
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    return isoDate;
  } catch {
    return isoDate;
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
}

function isEligibleBirthDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);
  const birth = new Date(birthYear, birthMonth, birthDay);
  if (isNaN(birth.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (birth > today) return false;
  const eighteenth = new Date(birthYear + 18, birthMonth, birthDay);
  return eighteenth <= today;
}

function getMaxBirthDateForStaff(): string {
  const today = new Date();
  const maxYear = today.getFullYear() - 18;
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${maxYear}-${month}-${day}`;
}

function isProtectedAccount(account: AdminAccount, currentUserId: number | undefined): boolean {
  return account.systemAccount || account.id === currentUserId;
}

export function StaffDetailPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const accountId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : Number.NaN;
  const navigate = useNavigate();
  const { currentUser, role, refreshCapabilities } = useAuth();
  const { notify } = useAppNotification();
  const canManage = role === 'ADMIN' && currentUser?.permissions.includes('role:update');

  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; isMaintenance?: boolean } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  // Edit Staff Profile state
  const [isEditing, setIsEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    phone: '',
    address: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'fullName' | 'dateOfBirth' | 'phone' | 'address', string>>>({});
  const [profileError, setProfileError] = useState<string | null>(null);

  // Quick Action: Role change state
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>();
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [confirmAdminRole, setConfirmAdminRole] = useState(false);

  // Quick Action: Status change state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const fetchAccount = useCallback(async () => {
    if (!Number.isSafeInteger(accountId) || accountId <= 0) {
      setError({ message: 'Mã tài khoản không hợp lệ.' });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await adminAccountApi.get(accountId);
      setAccount(data);
      if (data.staff) {
        setFormData({
          fullName: data.staff.fullName || '',
          dateOfBirth: data.staff.dateOfBirth || '',
          phone: data.staff.phone || '',
          address: data.staff.address || '',
        });
      }
    } catch (err) {
      if (statusOf(err) === 404) {
        setError({ message: 'Tài khoản nhân sự không tồn tại hoặc đã bị xóa.' });
      } else {
        setError({
          message: isMaintenanceError(err) ? MAINTENANCE_MESSAGE : 'Không thể tải thông tin nhân sự lúc này.',
          isMaintenance: isMaintenanceError(err),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void fetchAccount();
  }, [fetchAccount, reloadKey]);

  useEffect(() => {
    let active = true;
    void roleApi.getRoles()
      .then((items) => {
        if (active) setRoles(items);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setRolesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeAssignableRoles = useMemo(
    () => roles.filter((item) => item.enabled && item.code !== 'USER' && item.code !== 'SUPER_ADMIN'),
    [roles],
  );

  const roleOptions = useMemo(
    () => activeAssignableRoles.map((r) => ({ label: `${r.displayName} (${r.code})`, value: r.code })),
    [activeAssignableRoles],
  );

  const handleStartEdit = () => {
    if (!account?.staff) return;
    setFormData({
      fullName: account.staff.fullName || '',
      dateOfBirth: account.staff.dateOfBirth || '',
      phone: account.staff.phone || '',
      address: account.staff.address || '',
    });
    setFieldErrors({});
    setProfileError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFieldErrors({});
    setProfileError(null);
  };

  const validateEditForm = (): boolean => {
    const errors: Partial<Record<'fullName' | 'dateOfBirth' | 'phone' | 'address', string>> = {};

    if (!formData.fullName.trim()) {
      errors.fullName = 'Vui lòng nhập họ và tên.';
    } else if (formData.fullName.trim().length > 100) {
      errors.fullName = 'Họ và tên tối đa 100 ký tự.';
    }

    if (!formData.dateOfBirth) {
      errors.dateOfBirth = 'Vui lòng chọn ngày sinh.';
    } else if (!isEligibleBirthDate(formData.dateOfBirth)) {
      errors.dateOfBirth = 'Nhân viên phải từ 18 tuổi trở lên và ngày sinh không thuộc tương lai.';
    }

    const cleanPhone = formData.phone.trim().replace(/[.\s-]/g, '');
    if (!cleanPhone) {
      errors.phone = 'Vui lòng nhập số điện thoại.';
    } else if (!VIETNAM_PHONE_REGEX.test(cleanPhone)) {
      errors.phone = 'Số điện thoại phải có 10 chữ số và thuộc đầu số di động Việt Nam (03, 05, 07, 08, 09).';
    }

    if (formData.address.trim().length > 255) {
      errors.address = 'Địa chỉ tối đa 255 ký tự.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.staff) return;
    if (!validateEditForm()) return;

    setSavingProfile(true);
    setProfileError(null);

    const payload: StaffProfileUpdateRequest = {
      version: account.staff.version,
      fullName: formData.fullName.trim(),
      dateOfBirth: formData.dateOfBirth,
      phone: formData.phone.trim().replace(/[.\s-]/g, ''),
      address: formData.address.trim() || null,
    };

    try {
      const updatedStaff = await adminAccountApi.updateStaffProfile(account.id, payload);
      setAccount((prev) => (prev ? { ...prev, staff: updatedStaff } : null));
      setIsEditing(false);
      notify('success', {
        title: 'Cập nhật thành công',
        description: 'Hồ sơ nhân viên đã được cập nhật thành công.',
      });
    } catch (err) {
      const status = statusOf(err);
      const code = codeOf(err);
      if (status === 409) {
        if (code === 'STAFF_VERSION_CONFLICT') {
          setProfileError('Hồ sơ vừa được thay đổi bởi người khác. Vui lòng tải lại trang.');
        } else if (code === 'STAFF_PHONE_ALREADY_EXISTS') {
          setFieldErrors((prev) => ({ ...prev, phone: 'Số điện thoại này đã được sử dụng bởi nhân viên khác.' }));
        } else {
          setProfileError('Xung đột dữ liệu. Vui lòng tải lại trang.');
        }
      } else if (status === 400) {
        if (code === 'STAFF_UNDERAGE') {
          setFieldErrors((prev) => ({ ...prev, dateOfBirth: 'Nhân viên phải từ 18 tuổi trở lên.' }));
        } else {
          setProfileError('Thông tin cập nhật không hợp lệ. Vui lòng kiểm tra lại.');
        }
      } else {
        setProfileError('Không thể cập nhật hồ sơ lúc này. Vui lòng thử lại sau.');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenRoleModal = () => {
    if (!account) return;
    setSelectedRoleCode(account.roleCode);
    setRoleError(null);
    setConfirmAdminRole(false);
    setRoleModalOpen(true);
  };

  const handleSaveRole = async () => {
    if (!account || !selectedRoleCode) return;
    if (selectedRoleCode === 'ADMIN' && !confirmAdminRole) {
      setConfirmAdminRole(true);
      return;
    }
    setSavingRole(true);
    setRoleError(null);
    try {
      const updated = await adminAccountApi.updateRole(account.id, {
        roleCode: selectedRoleCode,
        expectedSessionVersion: account.sessionVersion,
      });
      setAccount(updated);
      setRoleModalOpen(false);
      setConfirmAdminRole(false);
      notify('success', {
        title: 'Đã đổi nhóm quyền',
        description: `Tài khoản ${updated.username} đã được chuyển sang nhóm ${updated.roleDisplayName || updated.roleCode}.`,
      });
      void refreshCapabilities?.();
    } catch (err) {
      const status = statusOf(err);
      const code = codeOf(err);
      if (status === 409) {
        setRoleError('Phiên tài khoản đã thay đổi ở nơi khác. Đang tải lại thông tin.');
        setReloadKey((k) => k + 1);
      } else if (status === 403 && code === 'ROLE_ASSIGNMENT_FORBIDDEN') {
        setRoleError('Nhóm nguồn hoặc nhóm đích không còn hoạt động.');
      } else {
        setRoleError('Không thể cập nhật nhóm quyền. Vui lòng thử lại.');
      }
    } finally {
      setSavingRole(false);
    }
  };

  const handleOpenStatusModal = () => {
    if (!account) return;
    setStatusError(null);
    setStatusModalOpen(true);
  };

  const handleSaveStatus = async () => {
    if (!account) return;
    setSavingStatus(true);
    setStatusError(null);
    try {
      const updated = await adminAccountApi.updateStatus(account.id, {
        enabled: !account.enabled,
        expectedSessionVersion: account.sessionVersion,
      });
      setAccount(updated);
      setStatusModalOpen(false);
      notify('success', {
        title: updated.enabled ? 'Đã kích hoạt tài khoản' : 'Đã khóa tài khoản',
        description: `Tài khoản ${updated.username} hiện ${updated.enabled ? 'đang hoạt động' : 'đã bị khóa'}.`,
      });
    } catch (err) {
      const status = statusOf(err);
      if (status === 409) {
        setStatusError('Trạng thái tài khoản đã thay đổi ở nơi khác. Đang tải lại thông tin.');
        setReloadKey((k) => k + 1);
      } else {
        setStatusError('Không thể thay đổi trạng thái tài khoản. Vui lòng thử lại.');
      }
    } finally {
      setSavingStatus(false);
    }
  };

  const protectedAccount = account ? isProtectedAccount(account, currentUser?.id) : true;
  const protectionLabel = account?.systemAccount
    ? 'Tài khoản hệ thống được bảo vệ'
    : 'Không thể thay đổi chính tài khoản đang đăng nhập';

  return (
    <main className="staff-detail-stage">
      <section className="staff-detail-workspace" aria-labelledby="staff-detail-heading">
        {/* Breadcrumb Navigation */}
        <nav className="staff-detail-breadcrumb" aria-label="Điều hướng phân cấp">
          <Link to="/">Trang chủ</Link>
          <span className="staff-detail-breadcrumb-sep">/</span>
          <Link to="/admin/accounts">Quản lý tài khoản quản trị</Link>
          <span className="staff-detail-breadcrumb-sep">/</span>
          <span className="staff-detail-breadcrumb-current">Chi tiết nhân viên</span>
        </nav>

        {loading && (
          <div className="admin-account-loading" role="status" style={{ padding: '40px 0', justifyContent: 'center' }}>
            <Spin size="large" /> Đang tải thông tin nhân viên…
          </div>
        )}

        {error && (
          <Alert
            type="error"
            showIcon
            role="alert"
            title={error.isMaintenance ? MAINTENANCE_TITLE : 'Lỗi tải dữ liệu'}
            description={error.message}
            action={
              <Button type="primary" onClick={() => setReloadKey((k) => k + 1)}>
                Thử lại
              </Button>
            }
            style={{ marginBottom: 20 }}
          />
        )}

        {account && (
          <>
            {/* Header Card */}
            <div className="staff-detail-header-card">
              <div className="staff-detail-header-left">
                <div className="staff-detail-avatar" aria-hidden="true">
                  {(account.staff?.fullName || account.username).slice(0, 2).toUpperCase()}
                </div>
                <div className="staff-detail-title-group">
                  <h1 id="staff-detail-heading">{account.staff?.fullName || account.username}</h1>
                  <div className="staff-detail-badges">
                    <Tag color="blue">{account.staff?.staffCode || 'Chưa cấp mã'}</Tag>
                    <Tag color="gold">{account.roleDisplayName || account.roleCode}</Tag>
                    <Tag color={account.enabled ? 'green' : 'red'}>
                      {account.enabled ? 'Đang hoạt động' : 'Đã khóa'}
                    </Tag>
                    {account.systemAccount && <Tag color="gold">Tài khoản hệ thống</Tag>}
                  </div>
                </div>
              </div>

              <div className="staff-detail-header-actions">
                <Tooltip title={protectedAccount ? protectionLabel : ''}>
                  <Button
                    disabled={protectedAccount || !canManage || rolesLoading}
                    onClick={handleOpenRoleModal}
                  >
                    Đổi nhóm
                  </Button>
                </Tooltip>
                <Tooltip title={protectedAccount ? protectionLabel : ''}>
                  <Button
                    danger={account.enabled}
                    disabled={protectedAccount || !canManage}
                    onClick={handleOpenStatusModal}
                  >
                    {account.enabled ? 'Khóa tài khoản' : 'Mở khóa'}
                  </Button>
                </Tooltip>
                <Button onClick={() => navigate('/admin/accounts')}>Quay lại danh sách</Button>
              </div>
            </div>

            {/* Account Credentials Card */}
            <section className="staff-detail-card" aria-label="Thông tin tài khoản & Đăng nhập">
              <div className="staff-detail-card__header">
                <div>
                  <h2>Thông tin tài khoản & Đăng nhập</h2>
                  <p>Thông tin dùng để xác thực và định danh trong hệ thống quản trị.</p>
                </div>
              </div>
              <div className="staff-detail-grid">
                <div className="staff-detail-item">
                  <span className="staff-detail-label">Tên đăng nhập</span>
                  <span className="staff-detail-value">
                    <code>{account.username}</code>
                  </span>
                </div>
                <div className="staff-detail-item">
                  <span className="staff-detail-label">Email</span>
                  <span className="staff-detail-value">{account.email}</span>
                </div>
                <div className="staff-detail-item">
                  <span className="staff-detail-label">Xác minh email</span>
                  <span className="staff-detail-value">
                    <Tag color={account.emailVerified ? 'green' : 'default'}>
                      {account.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}
                    </Tag>
                  </span>
                </div>
                <div className="staff-detail-item">
                  <span className="staff-detail-label">Loại tài khoản</span>
                  <span className="staff-detail-value">
                    {account.systemAccount ? 'Tài khoản hệ thống' : 'Tài khoản thông thường'}
                  </span>
                </div>
                <div className="staff-detail-item">
                  <span className="staff-detail-label">Ngày tạo tài khoản</span>
                  <span className="staff-detail-value">{formatDateTime(account.createdAt)}</span>
                </div>
              </div>
            </section>

            {/* Staff Profile Card */}
            <section className="staff-detail-card" aria-label="Hồ sơ nhân sự">
              <div className="staff-detail-card__header">
                <div>
                  <h2>Hồ sơ nhân sự</h2>
                  <p>Họ tên, ngày sinh, số điện thoại và địa chỉ công tác của nhân sự.</p>
                </div>
                {!isEditing && canManage && (
                  <Button type="primary" onClick={handleStartEdit}>
                    Chỉnh sửa hồ sơ
                  </Button>
                )}
              </div>

              {profileError && (
                <Alert
                  type="error"
                  showIcon
                  role="alert"
                  description={profileError}
                  closable
                  onClose={() => setProfileError(null)}
                  style={{ marginBottom: 16 }}
                />
              )}

              {!isEditing ? (
                <div className="staff-detail-grid">
                  <div className="staff-detail-item">
                    <span className="staff-detail-label">Mã nhân viên</span>
                    <span className="staff-detail-value">
                      <code>{account.staff?.staffCode || '—'}</code>
                    </span>
                  </div>
                  <div className="staff-detail-item">
                    <span className="staff-detail-label">Họ và tên</span>
                    <span className="staff-detail-value">
                      <strong>{account.staff?.fullName || 'Chưa cập nhật'}</strong>
                    </span>
                  </div>
                  <div className="staff-detail-item">
                    <span className="staff-detail-label">Ngày sinh</span>
                    <span className="staff-detail-value">{formatDateOfBirth(account.staff?.dateOfBirth)}</span>
                  </div>
                  <div className="staff-detail-item">
                    <span className="staff-detail-label">Số điện thoại</span>
                    <span className="staff-detail-value">{account.staff?.phone || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="staff-detail-item staff-detail-item--full">
                    <span className="staff-detail-label">Địa chỉ cư trú</span>
                    <span className="staff-detail-value">{account.staff?.address || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="staff-detail-item staff-detail-item--full">
                    <span className="staff-detail-label">Lần cập nhật gần nhất</span>
                    <span className="staff-detail-value">{formatDateTime(account.staff?.updatedAt)}</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="staff-detail-edit-form" aria-label="Biểu mẫu chỉnh sửa hồ sơ nhân viên">
                  <div className="staff-detail-form-grid">
                    <div className="form-field">
                      <label htmlFor="staff-edit-fullname">Họ và tên *</label>
                      <Input
                        id="staff-edit-fullname"
                        maxLength={100}
                        value={formData.fullName}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, fullName: e.target.value }));
                          if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                        }}
                        status={fieldErrors.fullName ? 'error' : undefined}
                        placeholder="Nguyễn Văn A"
                      />
                      {fieldErrors.fullName && <p className="field-error" role="alert">{fieldErrors.fullName}</p>}
                    </div>

                    <div className="form-field">
                      <label htmlFor="staff-edit-dob">Ngày sinh (từ 18 tuổi trở lên) *</label>
                      <Input
                        id="staff-edit-dob"
                        type="date"
                        max={getMaxBirthDateForStaff()}
                        value={formData.dateOfBirth}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }));
                          if (fieldErrors.dateOfBirth) setFieldErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
                        }}
                        status={fieldErrors.dateOfBirth ? 'error' : undefined}
                      />
                      {fieldErrors.dateOfBirth && <p className="field-error" role="alert">{fieldErrors.dateOfBirth}</p>}
                    </div>

                    <div className="form-field">
                      <label htmlFor="staff-edit-phone">Số điện thoại (10 chữ số) *</label>
                      <Input
                        id="staff-edit-phone"
                        maxLength={10}
                        value={formData.phone}
                        onChange={(e) => {
                          const sanitized = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                          setFormData((prev) => ({ ...prev, phone: sanitized }));
                          if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                        }}
                        status={fieldErrors.phone ? 'error' : undefined}
                        placeholder="0912345678"
                      />
                      {fieldErrors.phone && <p className="field-error" role="alert">{fieldErrors.phone}</p>}
                    </div>

                    <div className="form-field staff-detail-form-grid--full">
                      <label htmlFor="staff-edit-address">Địa chỉ cư trú</label>
                      <Input.TextArea
                        id="staff-edit-address"
                        maxLength={255}
                        rows={2}
                        value={formData.address}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, address: e.target.value }));
                          if (fieldErrors.address) setFieldErrors((prev) => ({ ...prev, address: undefined }));
                        }}
                        status={fieldErrors.address ? 'error' : undefined}
                        placeholder="Nhập địa chỉ cư trú (tùy chọn)"
                      />
                      {fieldErrors.address && <p className="field-error" role="alert">{fieldErrors.address}</p>}
                    </div>
                  </div>

                  <div className="staff-detail-form-actions">
                    <Button onClick={handleCancelEdit} disabled={savingProfile}>
                      Hủy
                    </Button>
                    <Button type="primary" htmlType="submit" loading={savingProfile} disabled={savingProfile}>
                      {savingProfile ? 'Đang lưu…' : 'Lưu thay đổi'}
                    </Button>
                  </div>
                </form>
              )}
            </section>
          </>
        )}

        {/* Change Role Modal */}
        <Modal
          title={`Đổi nhóm quyền · ${account?.username || ''}`}
          open={roleModalOpen}
          centered
          onCancel={() => {
            if (!savingRole) setRoleModalOpen(false);
          }}
          onOk={() => void handleSaveRole()}
          okText={confirmAdminRole ? 'Xác nhận cấp ADMIN' : 'Lưu thay đổi'}
          cancelText="Hủy"
          confirmLoading={savingRole}
        >
          <div className="admin-account-assignment-form">
            <p>
              Chọn nhóm quyền mới cho tài khoản <strong>{account?.username}</strong>:
            </p>
            <label htmlFor="staff-detail-role-select">Nhóm quyền mới</label>
            <Select
              id="staff-detail-role-select"
              style={{ width: '100%' }}
              value={selectedRoleCode}
              onChange={(value: string) => {
                setSelectedRoleCode(value);
                setConfirmAdminRole(false);
                setRoleError(null);
              }}
              options={roleOptions}
              placeholder="Chọn nhóm đang hoạt động"
            />
            {confirmAdminRole && (
              <Alert
                type="warning"
                showIcon
                title="Nhóm ADMIN có toàn quyền quản trị"
                description="Tài khoản này sẽ có quyền quản trị tối cao trong hệ thống."
                style={{ marginTop: 12 }}
              />
            )}
            {roleError && (
              <Alert
                type="error"
                showIcon
                role="alert"
                title={roleError}
                style={{ marginTop: 12 }}
              />
            )}
          </div>
        </Modal>

        {/* Status Confirm Modal */}
        <Modal
          title={account?.enabled ? 'Xác nhận khóa tài khoản' : 'Xác nhận mở khóa tài khoản'}
          open={statusModalOpen}
          centered
          onCancel={() => {
            if (!savingStatus) setStatusModalOpen(false);
          }}
          onOk={() => void handleSaveStatus()}
          okText={account?.enabled ? 'Khóa tài khoản' : 'Mở khóa'}
          okButtonProps={{ danger: account?.enabled }}
          cancelText="Hủy"
          confirmLoading={savingStatus}
        >
          <p>
            {account?.enabled
              ? `Bạn có chắc muốn khóa tài khoản "${account.username}"? Mọi phiên đăng nhập hiện tại sẽ bị thu hồi ngay lập tức.`
              : `Bạn có chắc muốn mở khóa cho tài khoản "${account?.username}"?`}
          </p>
          {statusError && (
            <Alert
              type="error"
              showIcon
              role="alert"
              title={statusError}
              style={{ marginTop: 12 }}
            />
          )}
        </Modal>
      </section>
    </main>
  );
}
