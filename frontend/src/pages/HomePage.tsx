import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PermissionGate } from '../auth/permissions';

function DashboardRoleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M12 3.5 19 6v5.2c0 4.1-2.8 7.5-7 9.3-4.2-1.8-7-5.2-7-9.3V6l7-2.5Z" />
    <path d="M12 8v4l2.5 1.5" />
  </svg>;
}

function DashboardPermissionIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h9" />
    <circle cx="17.5" cy="17.5" r="2" />
  </svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" />
  </svg>;
}

export function HomePage() {
  const { currentUser, role, capabilityStatus } = useAuth();
  const roleName = role === 'ROLE_SUPER_ADMIN' ? 'Siêu quản trị viên'
    : role === 'ROLE_ADMIN' ? 'Quản trị viên'
      : role === 'ROLE_USER' ? 'Người dùng'
        : role?.replace(/^ROLE_/, '').replaceAll('_', ' ') ?? 'Đang đồng bộ';
  const permissionCount = currentUser?.permissions.length;

  return (
    <main className="dashboard-page" aria-labelledby="dashboard-title">
      <header className="dashboard-page__heading">
        <div>
          <p className="dashboard-page__eyebrow">KHÔNG GIAN QUẢN TRỊ</p>
          <h1 id="dashboard-title">Tổng quan</h1>
          <p className="dashboard-page__intro">Thông tin tài khoản và quyền truy cập hiện tại.</p>
        </div>
        <span className="dashboard-page__session">
          <i aria-hidden="true" />
          {currentUser ? 'Phiên đang hoạt động'
            : capabilityStatus === 'error' ? 'Không thể xác minh phiên' : 'Đang đồng bộ phiên'}
        </span>
      </header>

      <div className="dashboard-page__metrics">
        <article className="dashboard-metric">
          <span className="dashboard-metric__icon"><DashboardRoleIcon /></span>
          <div>
            <p>Vai trò hiện tại</p>
            <strong>{roleName}</strong>
          </div>
        </article>
        <article className="dashboard-metric">
          <span className="dashboard-metric__icon dashboard-metric__icon--gold"><DashboardPermissionIcon /></span>
          <div>
            <p>Quyền truy cập</p>
            <strong>{permissionCount ?? '—'}</strong>
            <span>Đồng bộ theo phiên đăng nhập</span>
          </div>
        </article>
      </div>

      <PermissionGate permission="role:read" fallback={null}>
        <section className="dashboard-shortcut" aria-labelledby="dashboard-shortcut-title">
          <div>
            <p className="dashboard-shortcut__eyebrow">QUẢN TRỊ TRUY CẬP</p>
            <h2 id="dashboard-shortcut-title">Vai trò và quyền hạn</h2>
            <p>Xem các quyền đang có hiệu lực và cập nhật phạm vi phù hợp.</p>
          </div>
          <Link to="/admin/roles" className="dashboard-shortcut__link">
            <span>Mở quản lý vai trò</span>
            <ArrowIcon />
          </Link>
        </section>
      </PermissionGate>
    </main>
  );
}
