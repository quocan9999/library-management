import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { profileApi, type UserProfile } from './api';
import { getProfileUpdateError, mapProfileValidationErrors, type ProfileFieldErrors } from './messages';

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

export function ProfilePage() {
  const { currentUser, role, refreshCapabilities } = useAuth();
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
        // Fallback gracefully to currentUser if profile endpoint fails or is in bootstrapping
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchProfile();
    return () => {
      active = false;
    };
  }, []);

  const displayName = profile?.fullName?.trim()
    || currentUser?.username?.trim()
    || currentUser?.email?.trim()
    || (currentUser ? `Độc giả ${currentUser.id}` : 'Đang tải thông tin');

  const userInitial = displayName.charAt(0).toUpperCase() || 'Đ';

  const roleBadgeText = role === 'USER'
    ? 'Độc giả thành viên'
    : role === 'ADMIN'
      ? 'Quản trị viên'
      : role ? role.replaceAll('_', ' ') : 'Người dùng';

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
    setFormData((prev) => ({ ...prev, [field]: value }));
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
      const trimmedPhone = formData.phone.trim();
      const phoneFormat = /^[0-9.\s-]+$/;
      const vnMobile = /^0[35789][0-9]{8}$/;
      if (!phoneFormat.test(trimmedPhone)) {
        errors.phone = 'Số điện thoại chỉ được chứa chữ số, dấu chấm, gạch ngang hoặc khoảng trắng';
      } else {
        const digits = trimmedPhone.replace(/[.\s-]/g, '');
        if (!vnMobile.test(digits)) {
          errors.phone = 'Số điện thoại phải có 10 chữ số và đầu số di động Việt Nam hợp lệ (03, 05, 07, 08, 09)';
        }
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
    if (!profile || profile.version === null) return;
    if (!validateForm()) return;

    setSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const updated = await profileApi.updateProfile({
        version: profile.version,
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
    <main className="user-profile-page" aria-labelledby="profile-title">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Điều hướng hồ sơ" className="user-profile-breadcrumb">
        <Link to="/books" className="user-profile-breadcrumb__link">
          Khám phá
        </Link>
        <span className="user-profile-breadcrumb__separator" aria-hidden="true">/</span>
        {role === 'USER' ? (
          <Link to="/profile" className="user-profile-breadcrumb__current" aria-current="page">
            Hồ sơ tài khoản
          </Link>
        ) : (
          <span className="user-profile-breadcrumb__current" aria-current="page">
            Hồ sơ tài khoản
          </span>
        )}
      </nav>

      {/* Header Banner */}
      <header className="user-profile-header">
        <h1 id="profile-title" className="user-title-display-64">
          Hồ sơ tài khoản
        </h1>
        <p className="user-subtitle">
          Quản lý thông tin đăng nhập, bảo mật và cài đặt tài khoản của bạn.
        </p>
      </header>

      {/* Profile Layout Grid */}
      <div className="user-profile-grid">
        {/* Left Column: Account Identity Card */}
        <aside className="user-card user-profile-card" aria-label="Thông tin tài khoản">
          <div className="user-profile-card__avatar" aria-hidden="true">
            {userInitial}
          </div>

          <div className="user-profile-card__info">
            <h2 className="user-profile-card__name" title={displayName}>
              {displayName}
            </h2>
            <p className="user-profile-card__email" title={profile?.email ?? currentUser?.email ?? ''}>
              {profile?.email ?? currentUser?.email ?? 'Chưa cập nhật email'}
            </p>
          </div>

          <div className="user-profile-card__badges">
            <span className="user-profile-badge user-profile-badge--role">
              {roleBadgeText}
            </span>
            <span className="user-profile-badge user-profile-badge--status">
              <span className="user-profile-badge__dot" aria-hidden="true" />
              Đang hoạt động
            </span>
            {profile?.memberCode && (
              <span className="user-profile-badge user-profile-badge--code" title="Mã độc giả">
                {profile.memberCode}
              </span>
            )}
          </div>

          <div className="user-profile-card__divider" />

          {role === 'USER' && (
            <Link
              to="/my-loans"
              className="user-button user-pressable user-profile-card__loans-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
              </svg>
              <span>Xem sách của tôi</span>
            </Link>
          )}
        </aside>

        {/* Right Column: Personal Information & Security Cards */}
        <div className="user-profile-content-col">
          {/* Card 1: Personal Information Card */}
          {role === 'USER' && (
            <section className="user-card user-profile-summary-card" aria-label="Thông tin cá nhân">
              <div className="user-profile-summary-card__header-row">
                <div className="user-profile-summary-card__header">
                  <h2 className="user-title-22">Thông tin cá nhân</h2>
                  <p className="user-profile-summary-card__desc">
                    Họ tên, ngày sinh, số điện thoại và địa chỉ liên lạc của bạn tại thư viện.
                  </p>
                </div>

                {!isEditing && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="user-profile-action-btn user-pressable"
                    aria-label="Chỉnh sửa thông tin cá nhân"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    <span>Chỉnh sửa</span>
                  </button>
                )}
              </div>

              {/* Feedback Notifications */}
              {successMessage && (
                <div className="user-profile-feedback-alert user-profile-feedback-alert--success" role="status">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{successMessage}</span>
                </div>
              )}

              {serverError && (
                <div className="user-profile-feedback-alert user-profile-feedback-alert--error" role="alert">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{serverError}</span>
                </div>
              )}

              {/* View Mode */}
              {!isEditing ? (
                <div className="user-profile-summary-card__rows">
                  {/* Full Name Row */}
                  <div className="profile-summary__row user-profile-row" aria-label="Họ và tên">
                    <div className="user-profile-row__icon-col" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div className="user-profile-row__content">
                      <h2>Họ và tên</h2>
                      <p className="user-profile-row__val">
                        {loading ? 'Đang tải...' : profile?.fullName || 'Chưa cập nhật'}
                      </p>
                    </div>
                  </div>

                  {/* Date of Birth Row */}
                  <div className="profile-summary__row user-profile-row" aria-label="Ngày sinh">
                    <div className="user-profile-row__icon-col" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                    <div className="user-profile-row__content">
                      <h2>Ngày sinh</h2>
                      <p className="user-profile-row__val">
                        {loading ? 'Đang tải...' : formatDateOfBirth(profile?.dateOfBirth)}
                      </p>
                    </div>
                  </div>

                  {/* Phone Row */}
                  <div className="profile-summary__row user-profile-row" aria-label="Số điện thoại">
                    <div className="user-profile-row__icon-col" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </div>
                    <div className="user-profile-row__content">
                      <h2>Số điện thoại</h2>
                      <p className="user-profile-row__val user-mono">
                        {loading ? 'Đang tải...' : profile?.phone || 'Chưa cập nhật'}
                      </p>
                    </div>
                  </div>

                  {/* Address Row */}
                  <div className="profile-summary__row user-profile-row" aria-label="Địa chỉ">
                    <div className="user-profile-row__icon-col" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <div className="user-profile-row__content">
                      <h2>Địa chỉ</h2>
                      <p className="user-profile-row__val">
                        {loading ? 'Đang tải...' : profile?.address || 'Chưa cập nhật'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Edit Mode Form */
                <form className="user-profile-edit-form" onSubmit={handleSaveProfile} noValidate>
                  <div className="user-profile-form-grid">
                    {/* Full Name Input */}
                    <div className="user-profile-form-group">
                      <label htmlFor="profile-full-name" className="user-profile-form-label">
                        Họ và tên
                      </label>
                      <input
                        id="profile-full-name"
                        type="text"
                        value={formData.fullName}
                        maxLength={150}
                        onChange={(e) => handleInputChange('fullName', e.target.value)}
                        placeholder="Nhập họ và tên đầy đủ"
                        className={`user-profile-form-input ${fieldErrors.fullName ? 'user-profile-form-input--error' : ''}`}
                      />
                      {fieldErrors.fullName && (
                        <p className="user-profile-form-error">{fieldErrors.fullName}</p>
                      )}
                    </div>

                    {/* Date of Birth Input */}
                    <div className="user-profile-form-group">
                      <label htmlFor="profile-date-of-birth" className="user-profile-form-label">
                        Ngày sinh
                      </label>
                      <input
                        id="profile-date-of-birth"
                        type="date"
                        max={getMaxBirthDate()}
                        value={formData.dateOfBirth}
                        onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                        className={`user-profile-form-input ${fieldErrors.dateOfBirth ? 'user-profile-form-input--error' : ''}`}
                      />
                      <p className="user-profile-form-hint">Yêu cầu độc giả từ 16 tuổi trở lên</p>
                      {fieldErrors.dateOfBirth && (
                        <p className="user-profile-form-error">{fieldErrors.dateOfBirth}</p>
                      )}
                    </div>

                    {/* Phone Input */}
                    <div className="user-profile-form-group">
                      <label htmlFor="profile-phone" className="user-profile-form-label">
                        Số điện thoại
                      </label>
                      <input
                        id="profile-phone"
                        type="tel"
                        maxLength={15}
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="Ví dụ: 0912345678"
                        className={`user-profile-form-input ${fieldErrors.phone ? 'user-profile-form-input--error' : ''}`}
                      />
                      {/* <p className="user-profile-form-hint">10 chữ số di động Việt Nam</p> */}
                      {fieldErrors.phone && (
                        <p className="user-profile-form-error">{fieldErrors.phone}</p>
                      )}
                    </div>

                    {/* Address Textarea */}
                    <div className="user-profile-form-group user-profile-form-group--full">
                      <label htmlFor="profile-address" className="user-profile-form-label">
                        Địa chỉ
                      </label>
                      <textarea
                        id="profile-address"
                        rows={2}
                        maxLength={255}
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        placeholder="Nhập địa chỉ cư trú của bạn"
                        className={`user-profile-form-textarea ${fieldErrors.address ? 'user-profile-form-textarea--error' : ''}`}
                      />
                      {fieldErrors.address && (
                        <p className="user-profile-form-error">{fieldErrors.address}</p>
                      )}
                    </div>
                  </div>

                  <div className="user-profile-form-actions">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={submitting}
                      className="user-profile-btn-cancel user-pressable"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="user-profile-btn-save user-pressable"
                    >
                      {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}

          {/* Card 2: Security & Credentials summary card */}
          <section className="profile-summary user-card user-profile-summary-card" aria-labelledby="profile-title">
            <div className="user-profile-summary-card__header">
              <h2 className="user-title-22">
                Thông tin đăng nhập & Bảo mật
              </h2>
              <p className="user-profile-summary-card__desc">
                Địa chỉ email và mật khẩu dùng để xác thực và bảo vệ quyền lợi tài khoản.
              </p>
            </div>

            <div className="user-profile-summary-card__rows">
              {/* Email Row */}
              <section className="profile-summary__row user-profile-row" aria-label="Email hiện tại">
                <div className="user-profile-row__icon-col" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>

                <div className="user-profile-row__content">
                  <h2>Email</h2>
                  <p className="user-mono user-profile-row__val">
                    {profile?.email ?? currentUser?.email ?? 'Đang tải email tài khoản'}
                  </p>
                </div>

                <Link
                  className="profile-action__link user-pressable user-profile-action-btn"
                  to="/profile/change-email"
                >
                  Đổi email
                </Link>
              </section>

              {/* Password Row */}
              <section className="profile-summary__row user-profile-row" aria-label="Mật khẩu">
                <div className="user-profile-row__icon-col" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>

                <div className="user-profile-row__content">
                  <h2>Mật khẩu</h2>
                  <p aria-label="Mật khẩu được ẩn" className="user-profile-row__masked-pwd">
                    ••••••••
                  </p>
                </div>

                <Link
                  className="profile-action__link user-pressable user-profile-action-btn"
                  to="/profile/change-password"
                >
                  Đổi mật khẩu
                </Link>
              </section>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
