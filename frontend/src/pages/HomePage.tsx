import { Button } from 'antd';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { BrandMark } from '../components/BrandMark';

export function HomePage() {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  };

  return (
    <main className="home-stage">
      <header className="home-header">
        <BrandMark compact />
        <Button type="default" onClick={() => void handleLogout()} loading={isLoggingOut}>
          Sign out
        </Button>
      </header>
      <h1 className="home-greeting">Hello Library Management</h1>
    </main>
  );
}
