import { useAuth } from '../auth/AuthContext';
import { AdminProfilePage } from './AdminProfilePage';
import { UserProfilePage } from './UserProfilePage';

export function ProfilePage() {
  const { role } = useAuth();

  if (role !== 'USER') {
    return <AdminProfilePage />;
  }

  return <UserProfilePage />;
}
