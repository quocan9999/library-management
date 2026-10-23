import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function ProfilePage() {
  const { currentUser, role } = useAuth();

  const displayName = currentUser?.username?.trim()
    || currentUser?.email?.trim()
    || (currentUser ? `Độc giả ${currentUser.id}` : 'Đang tải thông tin');

  const userInitial = displayName.charAt(0).toUpperCase() || 'Đ';

  const roleBadgeText = role === 'USER'
    ? 'Độc giả thành viên'
    : role === 'ADMIN'
      ? 'Quản trị viên'
      : role ? role.replaceAll('_', ' ') : 'Người dùng';

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
            <p className="user-profile-card__email" title={currentUser?.email ?? ''}>
              {currentUser?.email ?? 'Chưa cập nhật email'}
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

        {/* Right Column: Security & Credentials summary card */}
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
                  {currentUser?.email ?? 'Đang tải email tài khoản'}
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
    </main>
  );
}
