import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useOptionalAuth } from '../auth/AuthContext';
import { ACCOUNT_DISABLED_EVENT } from '../auth/api';
import { SessionTabSync } from '../auth/SessionTabSync';
import { readRegistrationEmail } from '../auth/registrationStorage';
import { DefaultAccountRoute, RequirePermission } from '../auth/permissions';
import { AdminLayout } from '../components/AdminLayout';
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
import { ChangeEmailPage } from '../profile/ChangeEmailPage';

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

function RequireAuthFlow({ children, registration = false }: { children: React.ReactNode; registration?: boolean }) {
  const { accessToken, isBootstrapping } = useAuth();
  const location = useLocation();
  const state = location.state as { verificationRequestKey?: string; registrationCooldownUntil?: number } | null;
  const hasFlow = registration
    ? (Boolean(readRegistrationEmail()) || (typeof state?.registrationCooldownUntil === 'number'
      && Number.isFinite(state.registrationCooldownUntil))) && !accessToken
    : Boolean(new URLSearchParams(location.search).get('token'))
      || (location.pathname === '/verify-email' && typeof state?.verificationRequestKey === 'string');
  if (isBootstrapping) return <SessionBootstrap />;
  return hasFlow ? children : <Navigate to={accessToken ? '/' : '/login'} replace />;
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
      <SessionTabSync />
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
        <Route
          path="/register"
          element={
            <RedirectSignedInUser>
              <RegisterPage />
            </RedirectSignedInUser>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <RedirectSignedInUser>
              <ForgotPasswordPage />
            </RedirectSignedInUser>
          }
        />
        <Route path="/reset-password" element={<RequireAuthFlow><ResetPasswordPage /></RequireAuthFlow>} />
        <Route path="/check-email" element={<RequireAuthFlow registration><CheckEmailPage /></RequireAuthFlow>} />
        <Route path="/verify-email" element={<RequireAuthFlow><VerifyEmailPage /></RequireAuthFlow>} />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route
          path="/"
          element={<RequireAuthentication><AdminLayout /></RequireAuthentication>}
        >
          <Route index element={<DefaultAccountRoute />} />
          <Route
            path="admin/roles"
            element={
              <RequirePermission permission="role:read" allowedRoles={['ADMIN']}>
                <RoleManagementPage />
              </RequirePermission>
            }
          />
          <Route
            path="admin/members"
            element={
              <RequirePermission permission="member:read" deniedRoles={['USER']}>
                <MemberListPage />
              </RequirePermission>
            }
          />
          <Route
            path="admin/members/:id"
            element={
              <RequirePermission permission="member:read" deniedRoles={['USER']}>
                <MemberDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="profile"
            element={<ProfilePage />}
          />
          <Route
            path="profile/change-password"
            element={<ChangePasswordPage />}
          />
          <Route
            path="profile/change-email"
            element={<ChangeEmailPage />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
