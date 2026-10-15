import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function ProfilePage() {
  const { currentUser } = useAuth();

  return (
    <main className="profile-page profile-page--compact" aria-labelledby="profile-title">
      <section className="profile-summary" aria-labelledby="profile-title">
        <h1 id="profile-title">Hồ sơ tài khoản</h1>
        <section className="profile-summary__row" aria-label="Email hiện tại">
          <h2>Email</h2>
          <p>{currentUser?.email ?? 'Đang tải email tài khoản'}</p>
          <Link className="profile-action__link" to="/profile/change-email">Đổi email</Link>
        </section>
        <section className="profile-summary__row" aria-label="Mật khẩu">
          <h2>Mật khẩu</h2>
          <p aria-label="Mật khẩu được ẩn">••••••••</p>
          <Link className="profile-action__link" to="/profile/change-password">Đổi mật khẩu</Link>
        </section>
      </section>
    </main>
  );
}
