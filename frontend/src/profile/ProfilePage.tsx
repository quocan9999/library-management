import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function ProfilePage() {
  const { currentUser, permissions } = useAuth();

  return (
    <main className="profile-page" aria-labelledby="profile-title">
      <header className="profile-page__heading">
        <p className="profile-page__eyebrow">TÀI KHOẢN CỦA BẠN</p>
        <h1 id="profile-title">Hồ sơ tài khoản</h1>
        <p>Quản lý thông tin đăng nhập và bảo mật tài khoản thư viện.</p>
      </header>

      <section className="profile-card" aria-labelledby="profile-email-title">
        <div>
          <p className="profile-card__eyebrow">THÔNG TIN TÀI KHOẢN</p>
          <h2 id="profile-email-title">Email hiện tại</h2>
          <p className="profile-card__email">{currentUser?.email ?? 'Đang tải email tài khoản'}</p>
        </div>
      </section>

      {permissions.includes('account:change-password') && (
        <section className="profile-action" aria-labelledby="profile-password-title">
          <div>
            <p className="profile-card__eyebrow">BẢO MẬT</p>
            <h2 id="profile-password-title">Mật khẩu</h2>
            <p>Cập nhật mật khẩu bằng cách xác nhận mật khẩu hiện tại.</p>
          </div>
          <Link className="profile-action__link" to="/profile/change-password">Đổi mật khẩu</Link>
        </section>
      )}

      {permissions.includes('account:change-email') && (
        <section className="profile-action" aria-labelledby="profile-email-change-title">
          <div>
            <p className="profile-card__eyebrow">THÔNG TIN ĐĂNG NHẬP</p>
            <h2 id="profile-email-change-title">Email</h2>
            <p>Xác nhận email mới bằng mã gửi đến hộp thư đó.</p>
          </div>
          <Link className="profile-action__link" to="/profile/change-email">Đổi email</Link>
        </section>
      )}
    </main>
  );
}
