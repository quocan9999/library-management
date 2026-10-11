import { Alert, Button } from 'antd';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { BrandMark } from '../components/BrandMark';

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
    } catch {
      setLogoutError('We could not sign you out. Please try again.');
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
          Sign out
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
      <h1 className="home-greeting">Hello Library Management</h1>
    </main>
  );
}
