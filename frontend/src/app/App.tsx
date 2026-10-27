import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useOptionalAuth } from '../auth/AuthContext';
import {
  ACCOUNT_DISABLED_EVENT,
  ACCOUNT_ROLE_CHANGED_EVENT,
  ACCOUNT_SESSION_REVOKED_EVENT,
} from '../auth/api';
import { SessionTabSync } from '../auth/SessionTabSync';
import { readRegistrationEmail } from '../auth/registrationStorage';
import { DefaultAccountRoute, RequirePermission, RequireRole } from '../auth/permissions';
import { AdminLayout } from '../components/AdminLayout';
import { UserLayout } from '../components/user';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { CheckEmailPage } from '../pages/CheckEmailPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { RoleManagementPage } from '../role/RoleManagementPage';
import { AuthorizationLandingPage } from '../role/AuthorizationPages';
import { AdminAccountAssignmentPage, AdminAccountManagementPage } from '../features/adminAccounts/AdminAccountDirectory';
import { MemberDetailPage } from '../features/members/MemberDetailPage';
import { MemberListPage } from '../features/members/MemberListPage';
import { BookDetailPage } from '../features/books/BookDetailPage';
import { BookListPage } from '../features/books/BookListPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { ProfilePage } from '../profile/ProfilePage';
import { ChangePasswordPage } from '../profile/ChangePasswordPage';
import { ChangeEmailPage } from '../profile/ChangeEmailPage';
import { useAppNotification } from '../components/AppNotificationProvider';
import { CatalogDetailPage, CatalogPage } from '../features/borrow/CatalogPage';
import { LibrarianBorrowRequestsPage } from '../features/borrow/LibrarianBorrowRequestsPage';
import { MyLoansPage } from '../features/borrow/MyLoansPage';
import { BorrowPaymentPage } from '../features/borrow/BorrowPaymentPage';
import { SystemConfigPage } from '../features/systemConfig/SystemConfigPage';

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
  const state = location.state as { verificationRequestKey?: string; registrationCooldownSeconds?: number } | null;
  const hasFlow = registration
    ? (Boolean(readRegistrationEmail()) || (typeof state?.registrationCooldownSeconds === 'number'
      && Number.isFinite(state.registrationCooldownSeconds) && state.registrationCooldownSeconds > 0)) && !accessToken
    : Boolean(new URLSearchParams(location.search).get('token'))
      || (location.pathname === '/verify-email' && typeof state?.verificationRequestKey === 'string');
  if (isBootstrapping) return <SessionBootstrap />;
  return hasFlow ? children : <Navigate to={accessToken ? '/' : '/login'} replace />;
}

function ProfileShellLayout() {
  const { role } = useAuth();
  return role === 'USER' ? <UserLayout /> : <AdminLayout />;
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

function SessionRevokedRouteSync() {
  const navigate = useNavigate();
  const { notify } = useAppNotification();
  useEffect(() => {
    const handleDisabled = () => {
      navigate('/login', { replace: true, state: { accountDisabled: true } });
      notify('error', {
        key: 'auth-account-disabled',
        title: 'Tài khoản đã bị vô hiệu hóa',
        description: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.',
      });
    };
    const handleRoleChanged = () => {
      navigate('/login', { replace: true, state: { accountRoleChanged: true } });
      notify('warning', {
        key: 'auth-role-changed',
        title: 'Nhóm quyền đã thay đổi',
        description: 'Nhóm quyền của tài khoản đã thay đổi. Vui lòng đăng nhập lại để tiếp tục.',
      });
    };
    const handleSessionRevoked = () => {
      navigate('/login', { replace: true, state: { sessionRevoked: true } });
      notify('warning', {
        key: 'auth-session-revoked',
        title: 'Phiên đăng nhập đã kết thúc',
        description: 'Phiên đăng nhập này không còn hiệu lực. Vui lòng đăng nhập lại.',
      });
    };
    window.addEventListener(ACCOUNT_DISABLED_EVENT, handleDisabled);
    window.addEventListener(ACCOUNT_ROLE_CHANGED_EVENT, handleRoleChanged);
    window.addEventListener(ACCOUNT_SESSION_REVOKED_EVENT, handleSessionRevoked);
    return () => {
      window.removeEventListener(ACCOUNT_DISABLED_EVENT, handleDisabled);
      window.removeEventListener(ACCOUNT_ROLE_CHANGED_EVENT, handleRoleChanged);
      window.removeEventListener(ACCOUNT_SESSION_REVOKED_EVENT, handleSessionRevoked);
    };
  }, [navigate, notify]);
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
      <SessionRevokedRouteSync />
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
          element={
            <RequireAuthentication>
              <UserLayout />
            </RequireAuthentication>
          }
        >
          <Route
            path="books"
            element={
              <RequirePermission permission="book:read" allowedRoles={['USER']}>
                <CatalogPage />
              </RequirePermission>
            }
          />
          <Route
            path="books/:id"
            element={
              <RequirePermission permission="book:read" allowedRoles={['USER']}>
                <CatalogDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="my-loans"
            element={
              <RequirePermission permission="borrow:read-own" allowedRoles={['USER']}>
                <MyLoansPage />
              </RequirePermission>
            }
          />
          <Route
            path="borrow-payment/:loanCode"
            element={
              <RequirePermission permission="borrow:read-own" allowedRoles={['USER']}>
                <BorrowPaymentPage />
              </RequirePermission>
            }
          />
        </Route>
        <Route
          path="/"
          element={<RequireAuthentication><AdminLayout /></RequireAuthentication>}
        >
          <Route index element={<DefaultAccountRoute />} />
          <Route path="librarian/borrow-requests" element={<RequirePermission permission="borrow:read" deniedRoles={['USER']}><LibrarianBorrowRequestsPage /></RequirePermission>} />
          <Route path="admin/roles" element={<RequireRole role="ADMIN"><Navigate to="/admin/authorization/groups" replace /></RequireRole>} />
          <Route path="admin/authorization" element={<RequireRole role="ADMIN"><AuthorizationLandingPage /></RequireRole>} />
          <Route path="admin/authorization/groups" element={
            <RequireRole role="ADMIN">
              <RequirePermission permission="role:read" allowedRoles={['ADMIN']}>
                <RoleManagementPage />
              </RequirePermission>
            </RequireRole>
          } />
          <Route path="admin/accounts" element={
            <RequireRole role="ADMIN">
              <RequirePermission permission="role:read" allowedRoles={['ADMIN']}>
                <AdminAccountManagementPage />
              </RequirePermission>
            </RequireRole>
          } />
          <Route path="admin/authorization/assignments" element={
            <RequireRole role="ADMIN">
              <RequirePermission permission="role:read" allowedRoles={['ADMIN']}>
                <AdminAccountAssignmentPage />
              </RequirePermission>
            </RequireRole>
          } />
          <Route path="admin/system-config" element={
            <RequireRole role="ADMIN">
              <RequirePermission permission="config:read" allowedRoles={['ADMIN']}>
                <SystemConfigPage />
              </RequirePermission>
            </RequireRole>
          } />
          <Route
            path="admin/books"
            element={
              <RequirePermission permission="book:read" deniedRoles={['USER']}>
                <BookListPage />
              </RequirePermission>
            }
          />
          <Route
            path="admin/books/:id"
            element={
              <RequirePermission permission="book:read" deniedRoles={['USER']}>
                <BookDetailPage />
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
        </Route>
        <Route
          element={
            <RequireAuthentication>
              <ProfileShellLayout />
            </RequireAuthentication>
          }
        >
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
