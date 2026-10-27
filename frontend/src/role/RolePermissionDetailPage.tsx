import { Alert, Button, Checkbox, Modal, Spin, Tabs, Tag, Tooltip } from 'antd';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { isMaintenanceError, MAINTENANCE_MESSAGE, MAINTENANCE_TITLE } from '../auth/messages';
import { useAppNotification } from '../components/AppNotificationProvider';
import { roleApi } from './api';
import {
  findMissingPermissionDependencies,
  requiredPermissionsFor,
  validatePermissionDependencyCatalog,
} from './permissionDependencies';
import {
  filterCatalogForTab,
  groupLabel,
  type PermissionGroup,
} from './permissionTabs';
import type {
  PermissionCatalogEntry,
  RolePermissions,
  RoleSummary,
} from './types';

function getErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError<{ code?: string }>(error)) return undefined;
  return error.response?.data?.code;
}

function getApiMessage(error: unknown): string | undefined {
  if (!axios.isAxiosError<{ message?: string }>(error)) return undefined;
  return error.response?.data?.message;
}

function getStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

export function RolePermissionDetailPage() {
  const { roleCode: paramRoleCode } = useParams<{ roleCode: string }>();
  const roleCode = paramRoleCode ?? '';

  const { refreshCapabilities } = useAuth();
  const { dismiss, notify } = useAppNotification();

  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissions | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectionErrorMessage, setSelectionErrorMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const detailsGeneration = useRef(0);

  const loadData = useCallback(async (targetRoleCode: string) => {
    const generation = ++detailsGeneration.current;
    setIsLoading(true);
    setRolePermissions(null);
    setDraft(new Set());
    setErrorMessage(null);
    setSelectionErrorMessage(null);

    try {
      const [roleList, permissionCatalog, details] = await Promise.all([
        roleApi.getRoles(),
        roleApi.getPermissionCatalog(),
        roleApi.getRolePermissions(targetRoleCode),
      ]);

      if (detailsGeneration.current !== generation) return;

      setRoles(roleList);
      setCatalog(permissionCatalog);
      setRolePermissions(details);
      setDraft(new Set(targetRoleCode === 'ADMIN' ? details.effectivePermissions : details.assignedPermissions));
      setHasConflict(false);
    } catch (err: unknown) {
      if (detailsGeneration.current === generation) {
        setRolePermissions(null);
        setErrorMessage(
          isMaintenanceError(err)
            ? MAINTENANCE_MESSAGE
            : 'Không thể tải quyền của vai trò này. Vui lòng thử lại.',
        );
      }
    } finally {
      if (detailsGeneration.current === generation) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (roleCode) {
      void loadData(roleCode);
    }
  }, [roleCode, loadData]);

  const selectedRole = roles.find(({ code }) => code === roleCode);

  const editablePermissions = useMemo(() => new Set(
    rolePermissions?.editablePermissions.filter((code) =>
      catalog.find((entry) => entry.code === code)?.manageableByActor === true,
    ) ?? [],
  ), [catalog, rolePermissions]);

  const assignedPermissions = useMemo(
    () => new Set(selectedRole?.code === 'ADMIN'
      ? rolePermissions?.effectivePermissions ?? []
      : rolePermissions?.assignedPermissions ?? []),
    [rolePermissions, selectedRole?.code],
  );

  const canEdit = Boolean(selectedRole?.canEdit && rolePermissions?.editable && editablePermissions.size > 0);

  const additions = useMemo(() => [...draft]
    .filter((permission) => editablePermissions.has(permission) && !assignedPermissions.has(permission))
    .sort(), [draft, editablePermissions, assignedPermissions]);

  const removals = useMemo(() => [...assignedPermissions]
    .filter((permission) => editablePermissions.has(permission) && !draft.has(permission))
    .sort(), [draft, editablePermissions, assignedPermissions]);

  const hasChanges = additions.length > 0 || removals.length > 0;

  const adminGroups = useMemo(() => filterCatalogForTab(catalog, 'admin'), [catalog]);
  const userGroups = useMemo(() => filterCatalogForTab(catalog, 'user'), [catalog]);

  const dependencyConfigurationError = useMemo(
    () => validatePermissionDependencyCatalog(catalog),
    [catalog],
  );

  const dependencyIssues = useMemo(
    () => findMissingPermissionDependencies(draft, catalog),
    [draft, catalog],
  );

  const dependencyIssueMessage = dependencyIssues.length > 0
    ? `Không thể gỡ quyền cơ sở ${dependencyIssues[0].dependency} khi vai trò còn quyền phụ thuộc ${dependencyIssues[0].permission}. Hãy gỡ các quyền phụ thuộc trong cùng lần lưu.`
    : null;

  const dependencyErrorMessage = dependencyConfigurationError ?? dependencyIssueMessage;
  const canPreviewChanges = canEdit && hasChanges && !isSaving && !isLoading && !dependencyErrorMessage;

  useEffect(() => {
    const notificationKey = 'role-permission-dependency';
    if (dependencyConfigurationError || !dependencyIssueMessage) {
      dismiss(notificationKey);
    } else {
      notify('warning', {
        title: 'Không thể gỡ quyền cơ sở',
        description: dependencyIssueMessage,
        key: notificationKey,
      });
    }
  }, [dependencyConfigurationError, dependencyIssueMessage, dismiss, notify]);

  const togglePermission = (code: string, checked: boolean) => {
    if (!canEdit || dependencyConfigurationError || !editablePermissions.has(code)) return;
    const next = new Set(draft);
    if (checked) {
      const required = requiredPermissionsFor(code, catalog);
      const ungrantable = required.find((dependency) =>
        !assignedPermissions.has(dependency) && !editablePermissions.has(dependency));
      if (ungrantable) {
        setSelectionErrorMessage(
          `Không thể cấp ${code} vì cần quyền ${ungrantable}, nhưng phiên hiện tại không được phép cấp quyền đó.`,
        );
        return;
      }
      next.add(code);
      required.forEach((dependency) => next.add(dependency));
    } else {
      next.delete(code);
    }
    setDraft(next);
    setSelectionErrorMessage(null);
    setErrorMessage(null);
  };

  const toggleGroup = (codes: string[], checked: boolean) => {
    if (!canEdit || dependencyConfigurationError) return;
    const next = new Set(draft);
    let selectionError: string | null = null;
    for (const code of codes) {
      if (!editablePermissions.has(code)) continue;
      if (!checked) {
        next.delete(code);
        continue;
      }
      const required = requiredPermissionsFor(code, catalog);
      const ungrantable = required.find((dependency) =>
        !assignedPermissions.has(dependency) && !editablePermissions.has(dependency));
      if (ungrantable) {
        selectionError ??= `Không thể cấp ${code} vì cần quyền ${ungrantable}, nhưng phiên hiện tại không được phép cấp quyền đó.`;
        continue;
      }
      next.add(code);
      required.forEach((dependency) => next.add(dependency));
    }
    setDraft(next);
    setSelectionErrorMessage(selectionError);
    setErrorMessage(null);
  };

  const saveChanges = async () => {
    if (!roleCode || !rolePermissions || !canEdit || !hasChanges || isSaving || dependencyErrorMessage) return;
    const targetRoleCode = roleCode;
    const targetGeneration = detailsGeneration.current;
    const isCurrentTarget = () => detailsGeneration.current === targetGeneration;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const result = await roleApi.updatePermissions(targetRoleCode, {
        expectedVersion: rolePermissions.version,
        addPermissions: additions,
        removePermissions: removals,
      });

      if (!isCurrentTarget()) return;

      if (result.roleCode !== targetRoleCode) {
        setErrorMessage('Phản hồi không khớp vai trò đang lưu. Dữ liệu chưa được áp dụng.');
        return;
      }

      setRolePermissions(result);
      setDraft(new Set(result.assignedPermissions));
      setPreviewOpen(false);
      setHasConflict(false);
      notify('success', {
        title: 'Cập nhật quyền thành công',
        description: 'Đã cập nhật quyền cho vai trò.',
      });
    } catch (error) {
      if (getStatus(error) === 403 && getErrorCode(error) === 'PERMISSION_DENIED') {
        if (isCurrentTarget()) {
          setErrorMessage('Quyền quản trị đã thay đổi. Đang đồng bộ phiên; thay đổi chưa được gửi lại.');
        }
        void refreshCapabilities().catch(() => undefined);
      } else if (isCurrentTarget() && getStatus(error) === 409 && getErrorCode(error) === 'ROLE_VERSION_CONFLICT') {
        setHasConflict(true);
        setErrorMessage('Vai trò đã được thay đổi ở nơi khác. Các chỉnh sửa của bạn vẫn còn và chưa được lưu.');
      } else if (isCurrentTarget() && getErrorCode(error) === 'ROLE_PERMISSION_DEPENDENCY_CONFLICT') {
        setErrorMessage(getApiMessage(error)
          ?? 'Không thể lưu vì quyền cơ sở vẫn đang được quyền khác phụ thuộc.');
      } else if (isCurrentTarget()) {
        setErrorMessage('Không thể lưu thay đổi. Vui lòng kiểm tra và thử lại.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const confirmRefresh = async () => {
    if (!roleCode) return;
    setRefreshConfirmOpen(false);
    await loadData(roleCode);
  };

  const renderPermissionGroups = (groups: PermissionGroup[]) => (
    <div className="permission-groups">
      {groups.map(({ prefix, permissions }) => {
        const editableCodes = permissions.map(({ code }) => code)
          .filter((code) => canEdit && editablePermissions.has(code));
        const selectedCount = editableCodes.filter((code) => draft.has(code)).length;
        const checked = editableCodes.length > 0 && selectedCount === editableCodes.length;
        const indeterminate = selectedCount > 0 && selectedCount < editableCodes.length;
        return (
          <section className="permission-group" key={prefix} aria-labelledby={`permission-group-${prefix}`}>
            <div className="permission-group__heading">
              <div>
                <h2 id={`permission-group-${prefix}`}>{groupLabel(prefix)}</h2>
                <span>{selectedCount}/{editableCodes.length} quyền có thể chỉnh sửa đang bật</span>
              </div>
              <Checkbox
                aria-label={`Chọn tất cả quyền nhóm ${groupLabel(prefix)}`}
                checked={checked}
                indeterminate={indeterminate}
                disabled={!canEdit || Boolean(dependencyConfigurationError) || editableCodes.length === 0}
                onChange={(event) => toggleGroup(editableCodes, event.target.checked)}
              >Chọn tất cả</Checkbox>
            </div>
            <div className="permission-list">
              {permissions.map((permission) => {
                const editable = canEdit && editablePermissions.has(permission.code);
                return (
                  <Tooltip
                    key={permission.code}
                    title={editable ? permission.description : 'Quyền này đang khóa theo phạm vi quản trị hiện tại.'}
                  >
                    <div className={`permission-row${editable ? '' : ' permission-row--locked'}`}>
                      <Checkbox
                        aria-label={`${permission.code} — ${permission.description}`}
                        checked={draft.has(permission.code)}
                        disabled={!editable || Boolean(dependencyConfigurationError)}
                        onChange={(event) => togglePermission(permission.code, event.target.checked)}
                      />
                      <span className="permission-row__copy">
                        <code>{permission.code}</code>
                        <span>{permission.description}</span>
                      </span>
                      {!editable && <span className="permission-row__state">Chỉ xem</span>}
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );

  return (
    <main className="role-stage">
      <section id="role-permission-editor" className="role-workspace" aria-labelledby="role-title">
        <div className="role-detail-nav">
          <Link className="member-back-link" to="/admin/authorization/groups">
            ← Quay lại danh sách nhóm
          </Link>
        </div>

        <div className="role-heading">
          <div>
            <h1 id="role-title">Phân quyền: {selectedRole?.displayName ?? roleCode}</h1>
            <div className="role-detail-meta">
              <span className="role-detail-meta__code"><code>{roleCode}</code></span>
              {selectedRole && (
                <Tag color={selectedRole.enabled ? 'green' : 'default'}>
                  {selectedRole.enabled ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                </Tag>
              )}
              <span className="role-version">
                Phiên bản {rolePermissions?.version ?? selectedRole?.version ?? 0}
              </span>
            </div>
          </div>
        </div>


        {errorMessage && (
          <Alert
            type="error"
            showIcon
            role="alert"
            title={errorMessage === MAINTENANCE_MESSAGE ? MAINTENANCE_TITLE : errorMessage}
            description={errorMessage === MAINTENANCE_MESSAGE ? MAINTENANCE_MESSAGE : undefined}
          />
        )}
        {selectionErrorMessage && <Alert type="error" showIcon role="alert" title={selectionErrorMessage} />}
        {dependencyConfigurationError && <Alert type="error" showIcon role="alert" title={dependencyConfigurationError} />}

        {isLoading ? (
          <div className="role-loading" role="status"><Spin /> Đang tải dữ liệu quyền…</div>
        ) : rolePermissions && (
          <>
            <Tabs
              defaultActiveKey="admin"
              className="role-permission-tabs"
              items={[
                {
                  key: 'admin',
                  label: 'Quyền quản trị',
                  children: renderPermissionGroups(adminGroups),
                },
                {
                  key: 'user',
                  label: 'Quyền độc giả',
                  children: renderPermissionGroups(userGroups),
                },
              ]}
            />

            {hasConflict && (
              <Button className="role-conflict-refresh" onClick={() => setRefreshConfirmOpen(true)}>
                Tải lại quyền
              </Button>
            )}

            <div className="role-save-bar">
              <div className="role-change-count" aria-live="polite">
                {hasChanges ? `${additions.length} thêm · ${removals.length} gỡ` : 'Chưa có thay đổi'}
              </div>
              <Button
                type="primary"
                disabled={!canPreviewChanges}
                loading={isSaving}
                onClick={() => setPreviewOpen(true)}
              >Xem thay đổi và lưu</Button>
            </div>
          </>
        )}
      </section>

      <Modal
        title="Xác nhận thay đổi quyền"
        open={previewOpen}
        centered
        onCancel={() => { if (!isSaving) setPreviewOpen(false); }}
        onOk={() => void saveChanges()}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        confirmLoading={isSaving}
        closable={!isSaving}
        keyboard={!isSaving}
        okButtonProps={{ disabled: !hasChanges || isSaving }}
        cancelButtonProps={{ disabled: isSaving }}
        mask={{ closable: !isSaving }}
      >
        <div className="role-delta-preview">
          <section>
            <h3>Quyền được thêm ({additions.length})</h3>
            {additions.length ? <ul>{additions.map((code) => <li key={code}><code>{code}</code></li>)}</ul> : <p>Không có</p>}
          </section>
          <section>
            <h3>Quyền được gỡ ({removals.length})</h3>
            {removals.length ? <ul>{removals.map((code) => <li key={code}><code>{code}</code></li>)}</ul> : <p>Không có</p>}
          </section>
          {roleCode === 'ADMIN' && removals.some((code) => code === 'role:read' || code === 'role:update') && (
            <Alert type="warning" showIcon title="Gỡ quyền quản lý vai trò có thể làm mất khả năng truy cập màn hình này." />
          )}
        </div>
      </Modal>

      <Modal
        title="Tải lại dữ liệu mới nhất?"
        open={refreshConfirmOpen}
        onCancel={() => setRefreshConfirmOpen(false)}
        onOk={() => void confirmRefresh()}
        okText="Xác nhận tải lại"
        cancelText="Giữ chỉnh sửa"
      >
        <p>Các chỉnh sửa hiện tại sẽ bị bỏ và thay bằng quyền mới nhất từ máy chủ.</p>
      </Modal>
    </main>
  );
}
