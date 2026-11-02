import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Input, Spin, Tag } from 'antd';
import { useAuth } from '../auth/AuthContext';
import { profileApi, type UserProfile } from './api';
import { getProfileUpdateError, mapProfileValidationErrors, type ProfileFieldErrors } from './messages';
import { useAppNotification } from '../components/AppNotificationProvider';

function formatDateOfBirth(isoDate: string | null | undefined): string {
  if (!isoDate) return 'Chưa cập nhật';
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

function getMaxBirthDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 16);
  return d.toISOString().split('T')[0];
}

export function AdminProfilePage() {
  const { currentUser, role, refreshCapabilities } = useAuth();
  const { notify } = useAppNotification();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit personal profile state
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    phone: '',
    address: '',
  });
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchProfile = async () => {
      try {
        const data = await profileApi.getProfile();
        if (active) {
          setProfile(data);
          setFormData({
            fullName: data.fullName ?? '',
            dateOfBirth: data.dateOfBirth ?? '',
            phone: data.phone ?? '',
            address: data.address ?? '',
          });
        }
      } catch {
        // Fallback gracefully to currentUser if profile endpoint fails
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchProfile();
    return () => {
      active = false;
    };
  }, []);

  const roleBadgeText = role === 'ADMIN'
    ? 'Quản trị viên'
    : role === 'LIBRARIAN'
      ? 'Thủ thư'
      : role ? role.replaceAll('_', ' ') : 'Quản trị viên';

  const handleStartEdit = () => {
    setFormData({
      fullName: profile?.fullName ?? '',
      dateOfBirth: profile?.dateOfBirth ?? '',
      phone: profile?.phone ?? '',
      address: profile?.address ?? '',
    });
    setFieldErrors({});
    setServerError(null);
    setSuccessMessage(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFieldErrors({});
    setServerError(null);
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    let sanitizedValue = value;
    if (field === 'phone') {
      sanitizedValue = value.replace(/[^0-9]/g, '').slice(0, 10);
    }
    setFormData((prev) => ({ ...prev, [field]: sanitizedValue }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (serverError) setServerError(null);
    if (successMessage) setSuccessMessage(null);
  };

  const validateForm = (): boolean => {
    const errors: ProfileFieldErrors = {};

    if (formData.fullName && formData.fullName.length > 150) {
      errors.fullName = 'Họ và tên không được vượt quá 150 ký tự';
    }

    if (formData.dateOfBirth) {
      const maxAllowed = getMaxBirthDate();
      if (formData.dateOfBirth > maxAllowed) {
        errors.dateOfBirth = 'Ngày sinh phải hợp lệ và thành viên đủ 16 tuổi';
      }
    }

    if (formData.phone) {
      const cleanPhone = formData.phone.trim();
      const vnMobile = /^0[35789][0-9]{8}$/;
      if (!vnMobile.test(cleanPhone)) {
        errors.phone = 'Số điện thoại phải có đúng 10 chữ số và thuộc đầu số di động Việt Nam (03, 05, 07, 08, 09)';
      }
    }

    if (formData.address && formData.address.length > 255) {
      errors.address = 'Địa chỉ không được vượt quá 255 ký tự';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!validateForm()) return;

    setSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const updated = await profileApi.updateProfile({
        version: profile.version ?? 0,
        fullName: formData.fullName.trim() || null,
        dateOfBirth: formData.dateOfBirth || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
      });

      setProfile(updated);
      setFormData({
        fullName: updated.fullName ?? '',
        dateOfBirth: updated.dateOfBirth ?? '',
        phone: updated.phone ?? '',
        address: updated.address ?? '',
      });
      setIsEditing(false);
      setSuccessMessage('Cập nhật thông tin cá nhân thành công!');
      notify('success', {
        title: 'Cập nhật thành công',
        description: 'Thông tin cá nhân đã được lưu thành công.',
      });
      void refreshCapabilities?.({ force: true });
    } catch (err) {
      const fieldValidationErrors = mapProfileValidationErrors(err);
      if (fieldValidationErrors) {
        setFieldErrors(fieldValidationErrors);
      } else {
        setServerError(getProfileUpdateError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="role-stage admin-profile-stage">
      <section className="role-workspace admin-profile-workspace" aria-labelledby="admin-profile-title">
        {/* Page Heading */}
        <div className="role-heading">
          <div>
            <p className="role-eyebrow">HỒ SƠ TÀI KHOẢN</p>
            <h1 id="admin-profile-title">Hồ sơ tài khoản</h1>
            <p className="role-intro">Quản lý thông tin cá nhân và bảo mật tài khoản quản trị.</p>
          </div>
        </div>

        {/* Feedback Notifications */}
        {successMessage && (
          <Alert
            className="admin-profile-alert"
            type="success"
            showIcon
            description={successMessage}
            closable
            onClose={() => setSuccessMessage(null)}
            style={{ marginBottom: 20 }}
          />
        )}

        {serverError && (
          <Alert
            className="admin-profile-alert"
            type="error"
            showIcon
            description={serverError}
            closable
            onClose={() => setServerError(null)}
            style={{ marginBottom: 20 }}
          />
        )}

        {/* Section 1: Personal Information Card */}
        <section className="admin-profile-card" aria-label="Thông tin cá nhân">
          <div className="admin-profile-card__header">
            <div>
              <h2>Thông tin cá nhân</h2>
              <p>Họ tên, ngày sinh, số điện thoại và địa chỉ liên lạc của bạn trong hệ thống quản trị.</p>
            </div>
            {!isEditing && (
              <Button
                type="primary"
                onClick={handleStartEdit}
                disabled={loading}
              >
                Chỉnh sửa thông tin
              </Button>
            )}
          </div>

          {loading ? (
            <div className="admin-profile-loading" role="status" style={{ padding: '24px 0', textAlign: 'center' }}>
              <Spin /> Đang tải thông tin hồ sơ…
            </div>
          ) : !isEditing ? (
            <div className="admin-profile-details">
              <div className="admin-profile-detail-item">
                <span className="admin-profile-detail-label">Họ và tên</span>
                <span className="admin-profile-detail-value">
                  <strong>{profile?.fullName?.trim() || 'Chưa cập nhật'}</strong>
                </span>
              </div>
              <div className="admin-profile-detail-item">
                <span className="admin-profile-detail-label">Tên đăng nhập</span>
                <span className="admin-profile-detail-value">
                  <code>{profile?.username || currentUser?.username || '—'}</code>
                </span>
              </div>
              <div className="admin-profile-detail-item">
                <span className="admin-profile-detail-label">Vai trò</span>
                <span className="admin-profile-detail-value">
                  <Tag color="gold">{roleBadgeText}</Tag>
                </span>
              </div>
              <div className="admin-profile-detail-item">
                <span className="admin-profile-detail-label">Trạng thái</span>
                <span className="admin-profile-detail-value">
                  <Tag color="green">Đang hoạt động</Tag>
                </span>
              </div>
              <div className="admin-profile-detail-item">
                <span className="admin-profile-detail-label">Ngày sinh</span>
                <span className="admin-profile-detail-value">
                  {formatDateOfBirth(profile?.dateOfBirth)}
                </span>
              </div>
              <div className="admin-profile-detail-item">
                <span className="admin-profile-detail-label">Số điện thoại</span>
                <span className="admin-profile-detail-value">
                  {profile?.phone || 'Chưa cập nhật'}
                </span>
              </div>
              <div className="admin-profile-detail-item admin-profile-detail-item--full">
                <span className="admin-profile-detail-label">Địa chỉ cư trú</span>
                <span className="admin-profile-detail-value">
                  {profile?.address || 'Chưa cập nhật'}
                </span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="admin-profile-edit-form" aria-label="Biểu mẫu chỉnh sửa thông tin cá nhân">
              <div className="admin-profile-form-grid">
                {/* Full Name */}
                <div className="form-field">
                  <label htmlFor="admin-profile-name">
                    Họ và tên
                  </label>
                  <Input
                    id="admin-profile-name"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    placeholder="Nhập họ và tên đầy đủ"
                    maxLength={150}
                    status={fieldErrors.fullName ? 'error' : undefined}
                  />
                  {fieldErrors.fullName && (
                    <p className="field-error" role="alert">{fieldErrors.fullName}</p>
                  )}
                </div>

                {/* Date of Birth */}
                <div className="form-field">
                  <label htmlFor="admin-profile-dob">
                    Ngày sinh (từ 16 tuổi trở lên)
                  </label>
                  <Input
                    id="admin-profile-dob"
                    type="date"
                    max={getMaxBirthDate()}
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    status={fieldErrors.dateOfBirth ? 'error' : undefined}
                  />
                  {fieldErrors.dateOfBirth && (
                    <p className="field-error" role="alert">{fieldErrors.dateOfBirth}</p>
                  )}
                </div>

                {/* Phone */}
                <div className="form-field">
                  <label htmlFor="admin-profile-phone">
                    Số điện thoại (10 chữ số)
                  </label>
                  <Input
                    id="admin-profile-phone"
                    inputMode="numeric"
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Ví dụ: 0912345678"
                    status={fieldErrors.phone ? 'error' : undefined}
                  />
                  {fieldErrors.phone && (
                    <p className="field-error" role="alert">{fieldErrors.phone}</p>
                  )}
                </div>

                {/* Address */}
                <div className="form-field admin-profile-form-grid--full">
                  <label htmlFor="admin-profile-address">
                    Địa chỉ cư trú
                  </label>
                  <textarea
                    id="admin-profile-address"
                    rows={2}
                    maxLength={255}
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Nhập địa chỉ cư trú"
                    className={`admin-profile-textarea ${fieldErrors.address ? 'admin-profile-textarea--error' : ''}`}
                  />
                  {fieldErrors.address && (
                    <p className="field-error" role="alert">{fieldErrors.address}</p>
                  )}
                </div>
              </div>

              <div className="admin-profile-form-actions">
                <Button
                  onClick={handleCancelEdit}
                  disabled={submitting}
                >
                  Hủy
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  disabled={submitting}
                >
                  {submitting ? 'Đang lưu…' : 'Lưu thay đổi'}
                </Button>
              </div>
            </form>
          )}
        </section>

        {/* Section 2: Security & Credentials Card */}
        <section className="admin-profile-card admin-profile-security-card" aria-label="Thông tin đăng nhập & Bảo mật">
          <div className="admin-profile-card__header">
            <div>
              <h2>Thông tin đăng nhập & Bảo mật</h2>
              <p>Địa chỉ email và mật khẩu dùng để xác thực và bảo vệ quyền quản trị.</p>
            </div>
          </div>

          <div className="admin-profile-security-rows">
            {/* Email Row */}
            <section className="profile-summary__row" aria-label="Email hiện tại">
              <h2>Email</h2>
              <p>{profile?.email ?? currentUser?.email ?? '—'}</p>
              <Link to="/profile/change-email" className="profile-action__link">
                Đổi email
              </Link>
            </section>

            {/* Password Row */}
            <section className="profile-summary__row" aria-label="Mật khẩu">
              <h2>Mật khẩu</h2>
              <p aria-label="Mật khẩu được ẩn">••••••••</p>
              <Link to="/profile/change-password" className="profile-action__link">
                Đổi mật khẩu
              </Link>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
