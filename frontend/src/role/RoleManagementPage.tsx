import { RoleGroupDirectory } from './RoleGroupDirectory';
export { RolePermissionDetailPage } from './RolePermissionDetailPage';

export function RoleManagementPage() {
  return (
    <main className="role-stage">
      <RoleGroupDirectory />
    </main>
  );
}
