import { Alert } from 'antd';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getLogoutErrorMessage } from '../auth/messages';
import { PermissionGate } from '../auth/permissions';
import { BrandMark } from './BrandMark';
import { clearMemberListState } from '../features/members/listState';

function RolesIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M12 3.5 19 6v5.2c0 4.1-2.8 7.5-7 9.3-4.2-1.8-7-5.2-7-9.3V6l7-2.5Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>;
}

function MembersIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19c.3-3.2 2.1-5 5.5-5s5.2 1.8 5.5 5M16 5.5a3 3 0 0 1 0 5.8M17 14c2.1.6 3.3 2.2 3.5 5" />
  </svg>;
}

function BooksIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M4.5 5.5c3.7-.8 6.2 0 7.5 1.6v12c-1.3-1.6-3.8-2.4-7.5-1.6v-12ZM19.5 5.5c-3.7-.8-6.2 0-7.5 1.6v12c1.3-1.6 3.8-2.4 7.5-1.6v-12Z" />
    <path d="M7 9c1.2-.2 2.2-.1 3 .4M7 12c1.2-.2 2.2-.1 3 .4m7-3.4c-1.2-.2-2.2-.1-3 .4m3 2.6c-1.2-.2-2.2-.1-3 .4" />
  </svg>;
}

function AdminAccountsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <circle cx="8" cy="8" r="3" />
    <circle cx="17" cy="9" r="2.25" />
    <path d="M2.75 19c.25-3.1 2-4.75 5.25-4.75s5 1.65 5.25 4.75M14.25 14.75c2.95-.35 5.15 1.08 5.75 4.25" />
  </svg>;
}

function ProfileIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <circle cx="12" cy="8" r="3.25" />
    <path d="M5.5 20c.4-3.5 2.8-5.5 6.5-5.5s6.1 2 6.5 5.5" />
  </svg>;
}

function LogoutIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M10 4.5H5.5v15H10M14 8l4 4-4 4M18 12H9" />
  </svg>;
}

function MenuIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>;
}

function roleLabel(role: string | null): string {
  if (!role) return 'Đang tải vai trò';
  const labels: Record<string, string> = {
    ADMIN: 'Quản trị viên',
    USER: 'Người dùng',
  };
  return labels[role] ?? role.replaceAll('_', ' ');
}

export function AdminLayout() {
  const { currentUser, role, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMobileMenu = useCallback(() => {
    if (!mobileMenuOpen) return;
    setMobileMenuOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    sidebarRef.current?.querySelector<HTMLElement>('.admin-shell__nav a')?.focus();
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileMenu();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen, closeMobileMenu]);

  const handleSidebarKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!mobileMenuOpen || event.key !== 'Tab') return;
    const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
    } catch (error) {
      setLogoutError(getLogoutErrorMessage(error));
    } finally {
      clearMemberListState();
      setIsLoggingOut(false);
    }
  };

  const displayName = currentUser?.username?.trim()
    || currentUser?.email?.trim()
    || (currentUser ? `Tài khoản ${currentUser.id}` : 'Đang đồng bộ hồ sơ');
  const email = currentUser?.email ?? 'Thông tin phiên đăng nhập';

  return (
    <div className="admin-shell">
      {mobileMenuOpen && (
        <button
          className="admin-shell__backdrop"
          type="button"
          aria-label="Đóng menu điều hướng"
          onClick={closeMobileMenu}
        />
      )}

      <aside
        ref={sidebarRef}
        id="admin-sidebar"
        className={`admin-shell__sidebar${mobileMenuOpen ? ' admin-shell__sidebar--open' : ''}`}
        aria-label={role === 'USER' ? 'Điều hướng tài khoản' : 'Điều hướng quản trị'}
        role={mobileMenuOpen ? 'dialog' : undefined}
        aria-modal={mobileMenuOpen || undefined}
        onKeyDown={handleSidebarKeyDown}
      >
        <header className="admin-shell__brand">
          <BrandMark compact />
          <button
            className="admin-shell__close-button"
            type="button"
            aria-label="Đóng menu"
            onClick={closeMobileMenu}
          ><CloseIcon /></button>
        </header>

        <p className="admin-shell__section-label">
          {role === 'USER' ? 'KHÔNG GIAN CÁ NHÂN' : 'KHÔNG GIAN QUẢN TRỊ'}
        </p>
        <nav className="admin-shell__nav" aria-label="Chính">
          <PermissionGate permission="book:read" deniedRoles={['USER']} fallback={null}>
            <NavLink
              to="/admin/books"
              className={({ isActive }) => `admin-shell__nav-link${isActive ? ' is-active' : ''}`}
              onClick={closeMobileMenu}
            >
              <BooksIcon />
              <span>Quản lý sách</span>
            </NavLink>
          </PermissionGate>
          <PermissionGate permission="member:read" deniedRoles={['USER']} fallback={null}>
            <NavLink
              to="/admin/members"
              className={({ isActive }) => `admin-shell__nav-link${isActive ? ' is-active' : ''}`}
              onClick={closeMobileMenu}
            >
              <MembersIcon />
              <span>Quản lý thành viên</span>
            </NavLink>
          </PermissionGate>
          {role === 'ADMIN' && <NavLink
            to="/admin/accounts"
            className={({ isActive }) => `admin-shell__nav-link${isActive ? ' is-active' : ''}`}
            onClick={closeMobileMenu}
          >
            <AdminAccountsIcon />
            <span>Quản lý tài khoản quản trị</span>
          </NavLink>}
          {role === 'ADMIN' && <NavLink
            to="/admin/authorization"
            className={({ isActive }) => `admin-shell__nav-link${isActive ? ' is-active' : ''}`}
            onClick={closeMobileMenu}
          >
            <RolesIcon />
            <span>Quản lý phân quyền</span>
          </NavLink>}
        </nav>

        <footer className="admin-shell__footer">
          {logoutError && <Alert type="error" showIcon role="alert" title={logoutError} />}
          <NavLink
            to="/profile"
            className={({ isActive }) => `admin-shell__profile-link${isActive ? ' is-active' : ''}`}
            onClick={closeMobileMenu}
          >
            <ProfileIcon />
            <span>Hồ sơ tài khoản</span>
          </NavLink>
          <section className="admin-shell__profile" aria-label="Tài khoản đang đăng nhập">
            <span className="admin-shell__profile-icon"><ProfileIcon /></span>
            <span className="admin-shell__profile-copy">
              <strong title={displayName}>{displayName}</strong>
              <span title={email}>{email}</span>
              <span className="admin-shell__profile-role">{roleLabel(role)}</span>
            </span>
          </section>
          <button
            className="admin-shell__logout"
            type="button"
            onClick={() => { void handleLogout(); }}
            disabled={isLoggingOut}
          >
            <LogoutIcon />
            <span>{isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}</span>
          </button>
        </footer>
      </aside>

      <div className="admin-shell__main">
        <header className="admin-shell__mobile-header">
          <button
            ref={menuButtonRef}
            className="admin-shell__menu-button"
            type="button"
            aria-label="Mở menu điều hướng"
            aria-expanded={mobileMenuOpen}
            aria-controls="admin-sidebar"
            onClick={() => setMobileMenuOpen(true)}
          ><MenuIcon /></button>
          <span>Quản lý Thư viện</span>
        </header>
        <div className="admin-shell__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
