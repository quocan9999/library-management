import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, useOptionalAuth } from '../auth/AuthContext';
import { RequirePermission } from '../auth/permissions';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { CheckEmailPage } from '../pages/CheckEmailPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { RoleManagementPage } from '../role/RoleManagementPage';

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
        <Route path="/check-email" element={<CheckEmailPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route
          path="/admin/roles"
          element={
            <RequireAuthentication>
              <RequirePermission permission="role:read" allowedRoles={['ROLE_SUPER_ADMIN', 'ROLE_ADMIN']}>
                <RoleManagementPage />
              </RequirePermission>
            </RequireAuthentication>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuthentication>
              <HomePage />
            </RequireAuthentication>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
