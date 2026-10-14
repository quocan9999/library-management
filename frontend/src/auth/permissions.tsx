import { Alert, Button } from 'antd';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function usePermission(permission: string): boolean {
  const { permissions, capabilityStatus } = useAuth();
  return capabilityStatus === 'ready' && permissions.includes(permission);
}

export function DefaultAccountRoute() {
  const { role, permissions, capabilityStatus, refreshCapabilities } = useAuth();
  if (capabilityStatus === 'loading') return <CapabilityLoading />;
  if (capabilityStatus === 'error') {
    return <CapabilityRetry onRetry={() => { void refreshCapabilities().catch(() => undefined); }} />;
  }
  if (role === 'USER') return <Navigate to="/profile" replace />;
  if (role && role !== 'USER' && permissions.includes('member:read')) return <Navigate to="/admin/members" replace />;
  if (permissions.includes('role:read') && role === 'ADMIN') {
    return <Navigate to="/admin/roles" replace />;
  }
  if (role && role !== 'USER') return null;
  return <Navigate to="/403" replace />;
}

function CapabilityLoading() {
  return <main className="session-bootstrap" role="status" aria-live="polite">
    <span className="session-bootstrap__mark" aria-hidden="true" />
    <span>Đang đồng bộ quyền truy cập…</span>
  </main>;
}

function CapabilityRetry({ onRetry }: { onRetry: () => void }) {
  return <main className="permission-error-page">
    <Alert
      type="error"
      showIcon
      role="alert"
      title="Chưa thể kiểm tra quyền truy cập"
      description="Thông tin phiên đăng nhập chưa đồng bộ được. Hãy thử tải lại quyền."
      action={<Button onClick={onRetry}>Thử lại</Button>}
    />
  </main>;
}

export function PermissionGate({
  permission,
  children,
  fallback = null,
  allowedRoles,
  deniedRoles,
}: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  allowedRoles?: string[];
  deniedRoles?: string[];
}) {
  const { capabilityStatus, role } = useAuth();
  const allowed = usePermission(permission);
  if (capabilityStatus === 'loading') return fallback ?? <CapabilityLoading />;
  if (!allowed || (allowedRoles && !allowedRoles.includes(role ?? '')) || deniedRoles?.includes(role ?? '')) {
    return fallback;
  }
  return children;
}

export function RequirePermission({
  permission,
  allowedRoles,
  deniedRoles,
  children,
}: {
  permission: string;
  allowedRoles?: string[];
  deniedRoles?: string[];
  children: React.ReactNode;
}) {
  const { accessToken, isBootstrapping, capabilityStatus, role, refreshCapabilities } = useAuth();
  const allowed = usePermission(permission);

  if (isBootstrapping) return <CapabilityLoading />;
  if (!accessToken) return <Navigate to="/login" replace />;
  if (capabilityStatus === 'loading') return <CapabilityLoading />;
  if (capabilityStatus === 'error') {
    return <CapabilityRetry onRetry={() => { void refreshCapabilities().catch(() => undefined); }} />;
  }
  if (!allowed || (allowedRoles && !allowedRoles.includes(role ?? '')) || deniedRoles?.includes(role ?? '')) {
    return <Navigate to="/403" replace />;
  }
  return children;
}

export function RequireRole({
  role: requiredRole,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) {
  const { accessToken, isBootstrapping, capabilityStatus, role, refreshCapabilities } = useAuth();

  if (isBootstrapping) return <CapabilityLoading />;
  if (!accessToken) return <Navigate to="/login" replace />;
  if (capabilityStatus === 'loading') return <CapabilityLoading />;
  if (capabilityStatus === 'error') {
    return <CapabilityRetry onRetry={() => { void refreshCapabilities().catch(() => undefined); }} />;
  }
  if (role !== requiredRole) return <Navigate to="/403" replace />;
  return children;
}
