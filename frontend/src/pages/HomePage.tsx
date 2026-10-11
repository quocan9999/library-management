import { Alert, Button } from 'antd';
import { useState } from 'react';
import { getLogoutErrorMessage } from '../auth/messages';
import { useAuth } from '../auth/AuthContext';
import { PermissionGate } from '../auth/permissions';
import { BrandMark } from '../components/BrandMark';
import { Link } from 'react-router-dom';

export function HomePage() {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      await logout();
    } catch (error) {
      setLogoutError(getLogoutErrorMessage(error));
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <main className="home-stage">
      <header className="home-header">
        <BrandMark compact />
        <Button
          type="default"
          onClick={() => void handleLogout()}
          loading={isLoggingOut}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
        </Button>
      </header>
      {logoutError && (
        <Alert
          type="error"
          showIcon
          role="alert"
          title={logoutError}
        />
      )}
      <h1 className="home-greeting">Chào mừng đến với hệ thống quản lý thư viện</h1>
      <PermissionGate permission="role:read">
        <Link className="home-role-link" to="/admin/roles">Quản lý vai trò</Link>
      </PermissionGate>
    </main>
  );
}
