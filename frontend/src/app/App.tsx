import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useOptionalAuth } from '../auth/AuthContext';
import { ACCOUNT_DISABLED_EVENT } from '../auth/api';
import { RequirePermission, RequireRole } from '../auth/permissions';
import { AdminLayout } from '../components/AdminLayout';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { CheckEmailPage } from '../pages/CheckEmailPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { RoleManagementPage } from '../role/RoleManagementPage';
import { MemberDetailPage } from '../features/members/MemberDetailPage';
import { MemberListPage } from '../features/members/MemberListPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { ProfilePage } from '../profile/ProfilePage';
import { ChangePasswordPage } from '../profile/ChangePasswordPage';

function SessionBootstrap() {
  return (
    <main className="session-bootstrap" role="status" aria-live="polite">
      <span className="session-bootstrap__mark" aria-hidden="true" />
      <span>Đang kiểm tra phiên đăng nhập…</span>
    </main>
  );
}

function RequireAuthentication({ children }: { children: React.ReactNode }) {
  const { accessToken, isBootstrapping } = useAuth();
  if (isBootstrapping) return <SessionBootstrap />;
  return accessToken ? children : <Navigate to="/login" replace />;
}

function RedirectSignedInUser({ children }: { children: React.ReactNode }) {
  const { accessToken, isBootstrapping } = useAuth();
  if (isBootstrapping) return <SessionBootstrap />;
  return accessToken ? <Navigate to="/" replace /> : children;
}

function CapabilityRouteSync() {
  const location = useLocation();
  const auth = useOptionalAuth();
  const accessToken = auth?.accessToken;
  const refreshCapabilities = auth?.refreshCapabilities;
  useEffect(() => {
    if (accessToken && refreshCapabilities) void refreshCapabilities().catch(() => undefined);
  }, [accessToken, refreshCapabilities, location.pathname]);
  return null;
}

function DisabledAccountRouteSync() {
  const navigate = useNavigate();
  useEffect(() => {
    // Chuyển state vào trang đăng nhập để thông báo lý do phiên bị thu hồi ngay trong lần điều hướng này.
    const redirect = () => navigate('/login', { replace: true, state: { accountDisabled: true } });
    window.addEventListener(ACCOUNT_DISABLED_EVENT, redirect);
    return () => window.removeEventListener(ACCOUNT_DISABLED_EVENT, redirect);
  }, [navigate]);
  return null;
}

function ForbiddenPage() {
  return (
    <main className="permission-error-page">
      <section className="permission-denied-card">
        <p className="role-eyebrow">403 · KHÔNG ĐỦ QUYỀN</p>
        <h1>Không thể truy cập trang này</h1>
        <p>Quyền của tài khoản hiện tại không cho phép mở nội dung này.</p>
        <Link className="permission-home-button" to="/">Về trang chủ</Link>
      </section>
    </main>
  );
}

export function App() {
  return (
    <>
      <CapabilityRouteSync />
      <DisabledAccountRouteSync />
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectSignedInUser>
              <LoginPage />
            </RedirectSignedInUser>
          }
        />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/check-email" element={<CheckEmailPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route
          path="/"
          element={<RequireAuthentication><AdminLayout /></RequireAuthentication>}
        >
          <Route index element={<HomePage />} />
          <Route
            path="admin/roles"
            element={
              <RequirePermission permission="role:read" allowedRoles={['ROLE_SUPER_ADMIN', 'ROLE_ADMIN']}>
                <RoleManagementPage />
              </RequirePermission>
            }
          />
          <Route
            path="admin/members"
            element={
              <RequirePermission permission="member:read">
                <MemberListPage />
              </RequirePermission>
            }
          />
          <Route
            path="admin/members/:id"
            element={
              <RequirePermission permission="member:read">
                <MemberDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="profile"
            element={<RequireRole role="ROLE_USER"><ProfilePage /></RequireRole>}
          />
          <Route
            path="profile/change-password"
            element={
              <RequirePermission permission="account:change-password" allowedRoles={['ROLE_USER']}>
                <ChangePasswordPage />
              </RequirePermission>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
