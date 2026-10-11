import { Alert, Button, Checkbox, Modal, Select, Spin, Tooltip } from 'antd';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { roleApi } from './api';
import type {
  PermissionCatalogEntry,
  RolePermissions,
  RoleSummary,
} from './types';

const GROUP_LABELS: Record<string, string> = {
  account: 'Tài khoản',
  book: 'Sách',
  borrow: 'Mượn trả',
  member: 'Thành viên',
  role: 'Vai trò',
};

function getErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError<{ code?: string }>(error)) return undefined;
  return error.response?.data?.code;
}

function getStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

function groupPermissions(catalog: PermissionCatalogEntry[]) {
  const groups = new Map<string, PermissionCatalogEntry[]>();
  for (const permission of catalog) {
    const separator = permission.code.indexOf(':');
    const prefix = separator > 0 ? permission.code.slice(0, separator) : 'other';
    groups.set(prefix, [...(groups.get(prefix) ?? []), permission]);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function groupLabel(prefix: string): string {
  return GROUP_LABELS[prefix] ?? `Nhóm ${prefix}`;
}

export function RoleManagementPage() {
  const { refreshCapabilities } = useAuth();
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([]);
  const [roleCode, setRoleCode] = useState<string>();
  const [rolePermissions, setRolePermissions] = useState<RolePermissions | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const detailsGeneration = useRef(0);

  useEffect(() => {
    let mounted = true;
    const generation = ++detailsGeneration.current;
    void Promise.all([roleApi.getRoles(), roleApi.getPermissionCatalog()])
      .then(async ([roleList, permissionCatalog]) => {
        if (!mounted) return;
        setRoles(roleList);
        setCatalog(permissionCatalog);
        const initialRole = roleList.find(({ code }) => code === 'ROLE_USER')
          ?? roleList.find(({ canEdit }) => canEdit)
          ?? roleList[0];
        setRoleCode(initialRole?.code);
        if (!initialRole) return;
        setIsLoadingDetails(true);
        const details = await roleApi.getRolePermissions(initialRole.code);
        if (!mounted || detailsGeneration.current !== generation) return;
        setRolePermissions(details);
        setDraft(new Set(details.assignedPermissions));
      })
      .catch(() => {
        if (mounted && detailsGeneration.current === generation) {
          setRolePermissions(null);
          setErrorMessage('Không thể tải danh sách vai trò và quyền. Vui lòng thử lại.');
        }
      })
      .finally(() => {
        if (mounted && detailsGeneration.current === generation) {
          setIsLoading(false);
          setIsLoadingDetails(false);
        }
      });
    return () => {
      mounted = false;
      detailsGeneration.current += 1;
    };
  }, []);

  const loadRolePermissions = useCallback(async (targetRoleCode: string) => {
    const generation = ++detailsGeneration.current;
    setIsLoadingDetails(true);
    setRolePermissions(null);
    setDraft(new Set());
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await roleApi.getRolePermissions(targetRoleCode);
      if (detailsGeneration.current !== generation) return;
      setRolePermissions(result);
      setDraft(new Set(result.assignedPermissions));
      setHasConflict(false);
    } catch {
      if (detailsGeneration.current === generation) {
        setRolePermissions(null);
        setErrorMessage('Không thể tải quyền của vai trò này. Vui lòng thử lại.');
      }
    } finally {
      if (detailsGeneration.current === generation) setIsLoadingDetails(false);
    }
  }, []);

  const selectedRole = roles.find(({ code }) => code === roleCode);
  const editablePermissions = useMemo(() => new Set(
    rolePermissions?.editablePermissions.filter((code) =>
      catalog.find((entry) => entry.code === code)?.manageableByActor === true,
    ) ?? [],
  ), [catalog, rolePermissions]);
  const assignedPermissions = useMemo(
    () => new Set(rolePermissions?.assignedPermissions ?? []),
    [rolePermissions],
  );
  const canEdit = Boolean(selectedRole?.canEdit && rolePermissions?.editable && editablePermissions.size > 0);
  const additions = useMemo(() => [...draft]
    .filter((permission) => editablePermissions.has(permission) && !assignedPermissions.has(permission))
    .sort(), [draft, editablePermissions, assignedPermissions]);
  const removals = useMemo(() => [...assignedPermissions]
    .filter((permission) => editablePermissions.has(permission) && !draft.has(permission))
    .sort(), [draft, editablePermissions, assignedPermissions]);
  const hasChanges = additions.length > 0 || removals.length > 0;
  const groups = useMemo(() => groupPermissions(catalog), [catalog]);

  const togglePermission = (code: string, checked: boolean) => {
    if (!canEdit || !editablePermissions.has(code)) return;
    setDraft((previous) => {
      const next = new Set(previous);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
    setSuccessMessage(null);
  };

  const toggleGroup = (codes: string[], checked: boolean) => {
    if (!canEdit) return;
    setDraft((previous) => {
      const next = new Set(previous);
      for (const code of codes) {
        if (!editablePermissions.has(code)) continue;
        if (checked) next.add(code);
        else next.delete(code);
      }
      return next;
    });
    setSuccessMessage(null);
  };

  const saveChanges = async () => {
    if (!roleCode || !rolePermissions || !canEdit || !hasChanges || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await roleApi.updatePermissions(roleCode, {
        expectedVersion: rolePermissions.version,
        addPermissions: additions,
        removePermissions: removals,
      });
      setRolePermissions(result);
      setDraft(new Set(result.assignedPermissions));
      setPreviewOpen(false);
      setHasConflict(false);
      setSuccessMessage('Đã cập nhật quyền cho vai trò.');
    } catch (error) {
      if (getStatus(error) === 403 && getErrorCode(error) === 'PERMISSION_DENIED') {
        setErrorMessage('Quyền quản trị đã thay đổi. Đang đồng bộ phiên; thay đổi chưa được gửi lại.');
        void refreshCapabilities().catch(() => undefined);
      } else if (getStatus(error) === 409 && getErrorCode(error) === 'ROLE_VERSION_CONFLICT') {
        setHasConflict(true);
        setErrorMessage('Vai trò đã được thay đổi ở nơi khác. Các chỉnh sửa của bạn vẫn còn và chưa được lưu.');
      } else {
        setErrorMessage('Không thể lưu thay đổi. Vui lòng kiểm tra và thử lại.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const confirmRefresh = async () => {
    if (!roleCode) return;
    setRefreshConfirmOpen(false);
    await loadRolePermissions(roleCode);
  };

  const selectRole = (nextRoleCode: string) => {
    setRolePermissions(null);
    setDraft(new Set());
    setIsLoadingDetails(true);
    setRoleCode(nextRoleCode);
    void loadRolePermissions(nextRoleCode);
  };

  const handleRoleChange = (nextRoleCode: string) => {
    if (hasChanges) {
      Modal.confirm({
        title: 'Bỏ các chỉnh sửa chưa lưu?',
        content: 'Khi chuyển vai trò, các thay đổi hiện tại sẽ bị hủy.',
        okText: 'Bỏ chỉnh sửa',
        cancelText: 'Ở lại',
        onOk: () => selectRole(nextRoleCode),
      });
      return;
    }
    selectRole(nextRoleCode);
  };

  return (
    <main className="role-stage">
      <section className="role-workspace" aria-labelledby="role-title">
        <div className="role-heading">
          <div>
            <p className="role-eyebrow">QUẢN TRỊ HỆ THỐNG</p>
            <h1 id="role-title">Quản lý vai trò</h1>
            <p className="role-intro">Xem và cập nhật quyền hiệu lực theo từng vai trò.</p>
          </div>
        </div>

        {errorMessage && <Alert type="error" showIcon role="alert" title={errorMessage} />}
        {successMessage && <Alert type="success" showIcon role="status" title={successMessage} />}

        {isLoading ? <div className="role-loading" role="status"><Spin /> Đang tải dữ liệu vai trò…</div> : (
          <>
            <div className="role-selector-row">
              <label htmlFor="role-target-select">Vai trò cần xem</label>
              <Select
                id="role-target-select"
                aria-label="Vai trò"
                virtual={false}
                value={roleCode}
                onChange={handleRoleChange}
                options={roles.map((role) => ({
                  value: role.code,
                  label: role.code === 'ROLE_SUPER_ADMIN' ? 'Siêu quản trị viên'
                    : role.code === 'ROLE_ADMIN' ? 'Quản trị viên' : 'Người dùng',
                }))}
              />
              {selectedRole && <span className="role-version">Phiên bản {rolePermissions?.version ?? selectedRole.version}</span>}
            </div>

            {selectedRole && <div className="role-readonly-note">
              <strong>{selectedRole.code === 'ROLE_SUPER_ADMIN' ? 'Siêu quản trị viên'
                : selectedRole.code === 'ROLE_ADMIN' ? 'Quản trị viên' : 'Người dùng'}</strong>
              <span>{canEdit ? 'Các quyền có thể thay đổi được đánh dấu bên dưới.' : 'Vai trò này chỉ được xem trong phiên quản trị hiện tại.'}</span>
            </div>}

            {isLoadingDetails ? <div className="role-loading" role="status"><Spin /> Đang tải quyền…</div> : rolePermissions && (
              <div className="permission-groups">
                {groups.map(([prefix, permissions]) => {
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
                          disabled={!canEdit || editableCodes.length === 0}
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
                                  disabled={!editable}
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
            )}

            {hasConflict && <Button className="role-conflict-refresh" onClick={() => setRefreshConfirmOpen(true)}>
              Tải lại quyền
            </Button>}
            <div className="role-save-bar">
              <div className="role-change-count" aria-live="polite">
                {hasChanges ? `${additions.length} thêm · ${removals.length} gỡ` : 'Chưa có thay đổi'}
              </div>
              <Button
                type="primary"
                disabled={!canEdit || !hasChanges || isSaving || isLoadingDetails}
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
        onCancel={() => setPreviewOpen(false)}
        onOk={() => void saveChanges()}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        confirmLoading={isSaving}
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
          {roleCode === 'ROLE_ADMIN' && removals.some((code) => code === 'role:read' || code === 'role:update') && (
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
