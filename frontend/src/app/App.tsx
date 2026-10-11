import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { CheckEmailPage } from '../pages/CheckEmailPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';

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

export function App() {
  return (
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
  );
}
