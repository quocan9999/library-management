import { Alert, Button, Checkbox, Input, Modal, Select, Spin, Table, Tag, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { isMaintenanceError, MAINTENANCE_MESSAGE, MAINTENANCE_TITLE } from '../auth/messages';
import { useAppNotification } from '../components/AppNotificationProvider';
import { roleApi } from './api';
import {
  findMissingPermissionDependencies,
  requiredPermissionsFor,
  validatePermissionDependencyCatalog,
} from './permissionDependencies';
import type { PermissionCatalogEntry, RoleSearchItem } from './types';

const PAGE_SIZE = 10;

const GROUP_LABELS: Record<string, string> = {
  account: 'Tài khoản',
  book: 'Sách',
  borrow: 'Mượn trả',
  member: 'Thành viên',
  role: 'Vai trò',
};

function statusOf(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

function codeOf(error: unknown): string | undefined {
  if (!axios.isAxiosError<{ code?: string }>(error)) return undefined;
  return error.response?.data?.code;
}

function permissionGroups(catalog: PermissionCatalogEntry[]) {
  const groups = new Map<string, PermissionCatalogEntry[]>();
  for (const permission of catalog) {
    const separator = permission.code.indexOf(':');
    const prefix = separator > 0 ? permission.code.slice(0, separator) : 'other';
    groups.set(prefix, [...(groups.get(prefix) ?? []), permission]);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function permissionGroupLabel(prefix: string): string {
  return GROUP_LABELS[prefix] ?? `Nhóm ${prefix}`;
}

function formatCreatedAt(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function RoleGroupDirectory({
  onSelectPermissions,
  onRolesChanged,
}: {
  onSelectPermissions?: (roleCode: string) => void;
  onRolesChanged?: () => void;
} = {}) {
  const navigate = useNavigate();
  const handleOpenPermissions = (roleCode: string) => {
    onSelectPermissions?.(roleCode);
    navigate(`/admin/authorization/groups/${encodeURIComponent(roleCode)}`);
  };
  const { currentUser, refreshCapabilities } = useAuth();
  const { notify } = useAppNotification();
  const canManage = currentUser?.role === 'ADMIN' && currentUser.permissions.includes('role:update');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<RoleSearchItem[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<{ failed: boolean; isMaintenance?: boolean }>({ failed: false });
  const [reloadVersion, setReloadVersion] = useState(0);

  const [permissionCatalog, setPermissionCatalog] = useState<PermissionCatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<{ failed: boolean; isMaintenance?: boolean }>({ failed: false });
  const [catalogReloadVersion, setCatalogReloadVersion] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPermissions, setCreatePermissions] = useState<Set<string>>(new Set());
  const [createAutoAdded, setCreateAutoAdded] = useState<Set<string>>(new Set());
  const [createPermissionSearch, setCreatePermissionSearch] = useState('');
  const [showUnmanageable, setShowUnmanageable] = useState(false);
  const [createValidation, setCreateValidation] = useState<string | null>(null);

  const [metadataTarget, setMetadataTarget] = useState<RoleSearchItem | null>(null);
  const [metadataName, setMetadataName] = useState('');
  const [metadataDescription, setMetadataDescription] = useState('');
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const [statusTarget, setStatusTarget] = useState<RoleSearchItem | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const timer = window.setTimeout(() => {
      setListLoading(true);
      setListError({ failed: false });
      void roleApi.searchRoles({
        q: searchText.trim() || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page,
        size: PAGE_SIZE,
        sort: 'code',
        direction: 'ASC',
      }, controller.signal)
        .then((result) => {
          if (!current) return;
          setRows(result.content);
          setTotalElements(result.totalElements);
          if (result.totalPages > 0 && page >= result.totalPages) setPage(result.totalPages - 1);
        })
        .catch((err: unknown) => {
          if (current) setListError({ failed: true, isMaintenance: isMaintenanceError(err) });
        })
        .finally(() => {
          if (current) setListLoading(false);
        });
    }, 220);
    return () => {
      current = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchText, statusFilter, page, reloadVersion]);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void roleApi.getPermissionCatalog(controller.signal)
      .then((catalog) => {
        if (current) setPermissionCatalog(catalog);
      })
      .catch((err: unknown) => {
        if (current) setCatalogError({ failed: true, isMaintenance: isMaintenanceError(err) });
      })
      .finally(() => {
        if (current) setCatalogLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [catalogReloadVersion]);

  const catalogGroups = useMemo(() => permissionGroups(permissionCatalog), [permissionCatalog]);
  const dependencyCatalogError = useMemo(
    () => validatePermissionDependencyCatalog(permissionCatalog),
    [permissionCatalog],
  );
  const visibleCreateGroups = useMemo(() => catalogGroups.map(([prefix, entries]) => [
    prefix,
    entries.filter((entry) => (showUnmanageable || entry.manageableByActor)
      && (!createPermissionSearch.trim()
        || `${entry.code} ${entry.description}`.toLocaleLowerCase().includes(createPermissionSearch.trim().toLocaleLowerCase()))),
  ] as const).filter(([, entries]) => entries.length > 0), [
    catalogGroups,
    createPermissionSearch,
    showUnmanageable,
  ]);
  const grantableCreatePermissions = useMemo(() => new Set(
    [...createPermissions].filter((code) =>
      permissionCatalog.find((entry) => entry.code === code)?.manageableByActor === true,
    ),
  ), [createPermissions, permissionCatalog]);
  const createDependencyIssues = useMemo(
    () => findMissingPermissionDependencies(grantableCreatePermissions, permissionCatalog),
    [grantableCreatePermissions, permissionCatalog],
  );
  const createAutoAddedPermissions = useMemo(() => [...createAutoAdded]
    .filter((code) => createPermissions.has(code))
    .sort(), [createAutoAdded, createPermissions]);
  const validCreateCode = /^[A-Z][A-Z0-9_]*$/.test(createCode)
    && createCode.length <= 50
    && !['ADMIN', 'USER', 'SUPER_ADMIN'].includes(createCode);
  const validCreateName = createName.trim().length > 0 && createName.trim().length <= 100;
  const validCreateDescription = createDescription.length <= 255;
  const canSubmitCreate = canManage && !catalogLoading && !catalogError.failed && !dependencyCatalogError
    && validCreateCode && validCreateName && validCreateDescription
    && createPermissions.size > 0 && createDependencyIssues.length === 0 && !createSaving;

  const refreshList = () => setReloadVersion((value) => value + 1);
  const retryCatalog = () => {
    setCatalogLoading(true);
    setCatalogError({ failed: false });
    setCatalogReloadVersion((value) => value + 1);
  };
  const afterRolesChanged = () => {
    refreshList();
    onRolesChanged?.();
  };

  const resetCreateForm = () => {
    setCreateCode('');
    setCreateName('');
    setCreateDescription('');
    setCreatePermissions(new Set());
    setCreateAutoAdded(new Set());
    setCreatePermissionSearch('');
    setShowUnmanageable(false);
    setCreateValidation(null);
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const toggleCreatePermission = (code: string, checked: boolean) => {
    const entry = permissionCatalog.find((item) => item.code === code);
    if (!entry?.manageableByActor || dependencyCatalogError) return;
    const next = new Set(createPermissions);
    const autoAdded = new Set(createAutoAdded);
    if (checked) {
      const required = requiredPermissionsFor(code, permissionCatalog);
      const unmanageable = required.find((dependency) =>
        !createPermissions.has(dependency)
          && permissionCatalog.find((item) => item.code === dependency)?.manageableByActor !== true,
      );
      if (unmanageable) {
        setCreateValidation(`Không thể cấp ${code} vì cần quyền ${unmanageable}, nhưng phiên hiện tại không được phép cấp quyền đó.`);
        return;
      }
      for (const dependency of required) {
        if (!next.has(dependency)) autoAdded.add(dependency);
        next.add(dependency);
      }
      next.add(code);
      autoAdded.delete(code);
    } else {
      next.delete(code);
      autoAdded.delete(code);
      const issues = findMissingPermissionDependencies(next, permissionCatalog);
      if (issues.length > 0) {
        setCreateValidation(`Không thể gỡ quyền cơ sở ${issues[0].dependency} khi vẫn còn quyền ${issues[0].permission}. Hãy gỡ quyền phụ thuộc trước.`);
        return;
      }
    }
    setCreatePermissions(next);
    setCreateAutoAdded(autoAdded);
    setCreateValidation(null);
  };

  const toggleCreatePermissionGroup = (entries: PermissionCatalogEntry[], checked: boolean) => {
    if (dependencyCatalogError) return;
    const next = new Set(createPermissions);
    const autoAdded = new Set(createAutoAdded);
    const groupCodes = new Set(entries.filter((entry) => entry.manageableByActor).map((entry) => entry.code));
    let selectionError: string | null = null;
    if (checked) {
      for (const code of groupCodes) {
        const required = requiredPermissionsFor(code, permissionCatalog);
        const ungrantable = required.find((dependency) =>
          !createPermissions.has(dependency)
            && permissionCatalog.find((item) => item.code === dependency)?.manageableByActor !== true,
        );
        if (ungrantable) {
          selectionError ??= `Không thể cấp ${code} vì cần quyền ${ungrantable}, nhưng phiên hiện tại không được phép cấp quyền đó.`;
          continue;
        }
        for (const dependency of required) {
          if (!next.has(dependency) && !groupCodes.has(dependency)) autoAdded.add(dependency);
          next.add(dependency);
        }
        next.add(code);
        autoAdded.delete(code);
      }
    } else {
      groupCodes.forEach((code) => {
        next.delete(code);
        autoAdded.delete(code);
      });
      const issues = findMissingPermissionDependencies(next, permissionCatalog);
      if (issues.length > 0) {
        setCreateValidation(`Không thể gỡ quyền cơ sở ${issues[0].dependency} khi vẫn còn quyền ${issues[0].permission}. Hãy gỡ quyền phụ thuộc trước.`);
        return;
      }
    }
    setCreatePermissions(next);
    setCreateAutoAdded(autoAdded);
    setCreateValidation(selectionError);
  };

  const handleCreate = async () => {
    if (!canSubmitCreate) {
      setCreateValidation('Nhập mã và tên hợp lệ, chọn ít nhất một quyền có thể cấp.');
      return;
    }
    setCreateSaving(true);
    setCreateValidation(null);
    try {
      const result = await roleApi.createRole({
        code: createCode,
        displayName: createName.trim(),
        description: createDescription.trim(),
        permissions: [...createPermissions].filter((code) =>
          permissionCatalog.find((entry) => entry.code === code)?.manageableByActor === true,
        ).sort(),
      });
      if (result.code !== createCode) {
        setCreateValidation('Phản hồi tạo nhóm không khớp mã đã gửi. Hãy tải lại danh sách trước khi tiếp tục.');
        return;
      }
      setCreateOpen(false);
      notify('success', { title: 'Tạo nhóm thành công', description: `Đã tạo nhóm ${result.displayName}.` });
      afterRolesChanged();
      handleOpenPermissions(result.code);
    } catch (error) {
      if (statusOf(error) === 403) {
        setCreateValidation('Quyền quản trị đã thay đổi. Chưa tạo nhóm; phiên quyền đang được đồng bộ lại.');
        void refreshCapabilities().catch(() => undefined);
      } else if (statusOf(error) === 409) {
        setCreateValidation(codeOf(error) === 'ROLE_VERSION_CONFLICT'
          ? 'Danh sách nhóm vừa thay đổi. Hãy tải lại trước khi tạo.'
          : 'Mã nhóm này đã được sử dụng. Hãy chọn mã khác.');
      } else if (statusOf(error) === 400 || statusOf(error) === 422) {
        setCreateValidation('Thông tin chưa hợp lệ. Kiểm tra mã nhóm, tên và danh sách quyền đã chọn.');
      } else {
        setCreateValidation('Không thể tạo nhóm lúc này. Vui lòng thử lại.');
      }
    } finally {
      setCreateSaving(false);
    }
  };

  const openMetadata = (role: RoleSearchItem) => {
    setMetadataTarget(role);
    setMetadataName(role.displayName);
    setMetadataDescription(role.description ?? '');
    setMetadataError(null);
  };

  const handleMetadataSave = async () => {
    if (!metadataTarget || metadataSaving) return;
    if (!metadataName.trim() || metadataName.trim().length > 100 || metadataDescription.length > 255) {
      setMetadataError('Tên nhóm là bắt buộc (tối đa 100 ký tự), mô tả tối đa 255 ký tự.');
      return;
    }
    setMetadataSaving(true);
    setMetadataError(null);
    try {
      const result = await roleApi.updateMetadata(metadataTarget.code, {
        expectedVersion: metadataTarget.version,
        displayName: metadataName.trim(),
        description: metadataDescription.trim(),
      });
      setMetadataTarget(null);
      notify('success', { title: 'Đã cập nhật nhóm', description: `Đã cập nhật thông tin ${result.displayName}.` });
      afterRolesChanged();
    } catch (error) {
      if (statusOf(error) === 403) {
        setMetadataError('Quyền quản trị đã thay đổi. Thông tin chưa được lưu; phiên quyền đang được đồng bộ lại.');
        void refreshCapabilities().catch(() => undefined);
      } else if (statusOf(error) === 409) {
        setMetadataError('Nhóm đã được thay đổi ở nơi khác. Các nội dung bạn nhập vẫn được giữ; hãy tải lại danh sách để kiểm tra phiên bản mới.');
      } else if (statusOf(error) === 400 || statusOf(error) === 422) {
        setMetadataError('Thông tin nhóm chưa hợp lệ. Kiểm tra tên và mô tả rồi thử lại.');
      } else {
        setMetadataError('Không thể cập nhật nhóm lúc này. Vui lòng thử lại.');
      }
    } finally {
      setMetadataSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusTarget || statusSaving) return;
    setStatusSaving(true);
    setStatusError(null);
    try {
      const result = await roleApi.updateStatus(statusTarget.code, {
        expectedVersion: statusTarget.version,
        enabled: !statusTarget.enabled,
      });
      setStatusTarget(null);
      notify('success', {
        title: result.enabled ? 'Đã kích hoạt nhóm' : 'Đã ngừng hoạt động nhóm',
        description: `${result.displayName} đã được cập nhật.`,
      });
      afterRolesChanged();
    } catch (error) {
      if (statusOf(error) === 403) {
        setStatusError('Quyền quản trị đã thay đổi. Trạng thái chưa được cập nhật; phiên quyền đang được đồng bộ lại.');
        void refreshCapabilities().catch(() => undefined);
      } else if (statusOf(error) === 409) {
        setStatusError('Trạng thái nhóm đã được thay đổi ở nơi khác. Hãy tải lại danh sách trước khi thử lại.');
      } else {
        setStatusError('Không thể cập nhật trạng thái nhóm lúc này. Vui lòng thử lại.');
      }
    } finally {
      setStatusSaving(false);
    }
  };

  const columns: TableColumnsType<RoleSearchItem> = [
    { title: 'Mã nhóm', dataIndex: 'code', key: 'code', width: 150, render: (value: string) => <code>{value}</code> },
    { title: 'Tên hiển thị', dataIndex: 'displayName', key: 'displayName', render: (value: string) => value || '—' },
    {
      title: 'Trạng thái',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 160,
      render: (enabled: boolean) => <Tag color={enabled ? 'green' : 'default'}>{enabled ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Tag>,
    },
    { title: 'Tài khoản', dataIndex: 'accountCount', key: 'accountCount', width: 110, align: 'right' },
    { title: 'Quyền', dataIndex: 'permissionCount', key: 'permissionCount', width: 90, align: 'right' },
    { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: formatCreatedAt },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 260,
      render: (_value, role) => {
        if (role.code === 'ADMIN') return <Button type="link" onClick={() => handleOpenPermissions(role.code)}>Xem quyền</Button>;
        if (!role.enabled) {
          return role.code !== 'USER'
            ? <Button type="link" disabled={!canManage} onClick={() => { setStatusTarget(role); setStatusError(null); }}>Kích hoạt</Button>
            : <Button type="link" onClick={() => handleOpenPermissions(role.code)}>Xem quyền</Button>;
        }
        return <div className="role-directory-actions">
          <Button type="link" onClick={() => handleOpenPermissions(role.code)}>
            {canManage && role.canEdit ? 'Phân quyền' : 'Xem quyền'}
          </Button>
          {canManage && role.canEdit && <Button type="link" onClick={() => openMetadata(role)}>Sửa thông tin</Button>}
          {canManage && role.code !== 'USER' && role.canEdit && <Button type="link" danger onClick={() => { setStatusTarget(role); setStatusError(null); }}>Ngừng hoạt động</Button>}
        </div>;
      },
    },
  ];

  return (
    <section className="role-directory" aria-labelledby="role-directory-title">
      <div className="role-directory__heading">
        <div>
          <h2 id="role-directory-title">Nhóm quyền</h2>
          <p>Tra cứu nhóm, số tài khoản đang sử dụng và quyền được gán.</p>
        </div>
        {canManage && <Button type="primary" onClick={openCreate} disabled={catalogError.failed}>
          Tạo nhóm quyền
        </Button>}
      </div>
      <div className="role-directory__filters" aria-label="Bộ lọc nhóm quyền">
        <Input.Search
          aria-label="Tìm nhóm quyền"
          placeholder="Tìm theo mã, tên hoặc mô tả"
          value={searchText}
          onChange={(event) => { setSearchText(event.target.value); setPage(0); }}
          allowClear
        />
        <Select
          aria-label="Trạng thái nhóm quyền"
          value={statusFilter}
          onChange={(value: 'ALL' | 'ACTIVE' | 'INACTIVE') => { setStatusFilter(value); setPage(0); }}
          options={[
            { value: 'ALL', label: 'Mọi trạng thái' },
            { value: 'ACTIVE', label: 'Đang hoạt động' },
            { value: 'INACTIVE', label: 'Ngừng hoạt động' },
          ]}
        />
      </div>
      {catalogError.failed && <Alert
        className="role-directory__error"
        type="error"
        showIcon
        role="alert"
        title={catalogError.isMaintenance ? MAINTENANCE_TITLE : 'Không thể tải danh mục quyền'}
        description={catalogError.isMaintenance ? MAINTENANCE_MESSAGE : 'Chưa thể tạo nhóm quyền cho đến khi danh mục được tải.'}
        action={<Button onClick={retryCatalog}>Thử lại</Button>}
      />}
      {listError.failed && <Alert
        className="role-directory__error"
        type="error"
        showIcon
        role="alert"
        title={listError.isMaintenance ? MAINTENANCE_TITLE : 'Không thể tải danh sách nhóm quyền'}
        description={listError.isMaintenance ? MAINTENANCE_MESSAGE : 'Kiểm tra kết nối rồi thử lại.'}
        action={<Button onClick={refreshList}>Thử lại</Button>}
      />}
      <Table<RoleSearchItem>
        className="role-directory__table"
        rowKey="code"
        columns={columns}
        dataSource={rows}
        loading={listLoading}
        locale={{ emptyText: listError.isMaintenance ? MAINTENANCE_MESSAGE : (listError.failed ? 'Không có dữ liệu mới để hiển thị' : 'Chưa có nhóm quyền phù hợp') }}
        pagination={{
          current: page + 1,
          pageSize: PAGE_SIZE,
          total: totalElements,
          showSizeChanger: false,
          showTotal: (total) => `${total} nhóm quyền`,
        }}
        onChange={(pagination) => setPage(Math.max(0, (pagination.current ?? 1) - 1))}
        scroll={{ x: 950 }}
      />

      <Modal
        title="Tạo nhóm quyền"
        open={createOpen}
        centered
        width={760}
        onCancel={() => { if (!createSaving) setCreateOpen(false); }}
        onOk={() => void handleCreate()}
        okText="Tạo nhóm"
        cancelText="Hủy"
        confirmLoading={createSaving}
        closable={!createSaving}
        keyboard={!createSaving}
        mask={{ closable: !createSaving }}
        okButtonProps={{ disabled: !canSubmitCreate }}
      >
        <div className="role-form-grid">
          <label htmlFor="create-role-code">Mã nhóm</label>
          <Input
            id="create-role-code"
            aria-label="Mã nhóm"
            maxLength={50}
            value={createCode}
            onChange={(event) => { setCreateCode(event.target.value.toUpperCase()); setCreateValidation(null); }}
            placeholder="Ví dụ: LIBRARIAN"
            autoComplete="off"
          />
          <span className="role-form-help">Chữ hoa, số và dấu gạch dưới; mã bắt đầu bằng chữ cái.</span>

          <label htmlFor="create-role-name">Tên hiển thị</label>
          <Input
            id="create-role-name"
            aria-label="Tên hiển thị"
            maxLength={100}
            value={createName}
            onChange={(event) => { setCreateName(event.target.value); setCreateValidation(null); }}
            placeholder="Ví dụ: Thủ thư"
          />

          <label htmlFor="create-role-description">Mô tả</label>
          <Input.TextArea
            id="create-role-description"
            aria-label="Mô tả"
            maxLength={255}
            rows={2}
            value={createDescription}
            onChange={(event) => { setCreateDescription(event.target.value); setCreateValidation(null); }}
          />
        </div>
        {(!validCreateCode && createCode.length > 0) && <p className="role-field-error" role="alert">Mã nhóm không hợp lệ hoặc là mã hệ thống dành riêng.</p>}
        {(!validCreateName && createName.length > 0) && <p className="role-field-error" role="alert">Tên hiển thị là bắt buộc và tối đa 100 ký tự.</p>}
        {!validCreateDescription && <p className="role-field-error" role="alert">Mô tả tối đa 255 ký tự.</p>}
        <div className="role-permission-picker">
          <div className="role-permission-picker__heading">
            <div>
              <h3>Quyền ban đầu <span>({createPermissions.size})</span></h3>
              <p>Chọn ít nhất một quyền. Quyền phụ thuộc cần thiết sẽ được thêm tự động.</p>
            </div>
            <Button type="link" onClick={() => setShowUnmanageable((value) => !value)}>
              {showUnmanageable ? 'Ẩn quyền không thể cấp' : 'Hiện quyền không thể cấp'}
            </Button>
          </div>
          <Input.Search
            aria-label="Tìm quyền"
            placeholder="Tìm theo mã hoặc mô tả quyền"
            value={createPermissionSearch}
            onChange={(event) => setCreatePermissionSearch(event.target.value)}
            allowClear
          />
          {catalogLoading ? <div className="role-loading" role="status"><Spin /> Đang tải danh mục quyền…</div> : catalogError.failed ? (
            <Alert
              type="error"
              showIcon
              role="alert"
              title={catalogError.isMaintenance ? MAINTENANCE_TITLE : 'Không thể tải danh mục quyền'}
              description={catalogError.isMaintenance ? MAINTENANCE_MESSAGE : undefined}
              action={<Button onClick={retryCatalog}>Thử lại</Button>}
            />
          ) : dependencyCatalogError ? <Alert type="error" showIcon role="alert" title={dependencyCatalogError} /> : (
            <div className="permission-groups role-permission-picker__groups">
              {visibleCreateGroups.map(([prefix, entries]) => {
                const manageable = entries.filter((entry) => entry.manageableByActor);
                const selectedCount = manageable.filter(({ code }) => createPermissions.has(code)).length;
                return <section className="permission-group" key={prefix} aria-labelledby={`create-permission-group-${prefix}`}>
                  <div className="permission-group__heading">
                    <div>
                      <h2 id={`create-permission-group-${prefix}`}>{permissionGroupLabel(prefix)}</h2>
                      <span>{selectedCount}/{manageable.length} quyền có thể cấp đã chọn</span>
                    </div>
                    <Checkbox
                      aria-label={`Chọn tất cả quyền nhóm ${permissionGroupLabel(prefix)}`}
                      checked={manageable.length > 0 && selectedCount === manageable.length}
                      indeterminate={selectedCount > 0 && selectedCount < manageable.length}
                      disabled={manageable.length === 0 || createSaving}
                      onChange={(event) => toggleCreatePermissionGroup(entries, event.target.checked)}
                    >Chọn tất cả</Checkbox>
                  </div>
                  <div className="permission-list">
                    {entries.map((entry) => <Tooltip
                      key={entry.code}
                      title={entry.manageableByActor ? entry.description : 'Phiên quản trị hiện tại không được phép cấp quyền này.'}
                    >
                      <div className={`permission-row${entry.manageableByActor ? '' : ' permission-row--locked'}`}>
                        <Checkbox
                          aria-label={`${entry.code} — ${entry.description}`}
                          checked={createPermissions.has(entry.code)}
                          disabled={!entry.manageableByActor || createSaving}
                          onChange={(event) => toggleCreatePermission(entry.code, event.target.checked)}
                        />
                        <span className="permission-row__copy"><code>{entry.code}</code><span>{entry.description}</span></span>
                        {!entry.manageableByActor && <span className="permission-row__state">Không thể cấp</span>}
                      </div>
                    </Tooltip>)}
                  </div>
                </section>;
              })}
            </div>
          )}
          {createAutoAddedPermissions.length > 0 && <Alert
            className="role-dependency-preview"
            type="info"
            showIcon
            title="Quyền cơ sở sẽ được thêm tự động"
            description={createAutoAddedPermissions.map((code) => <code key={code}>{code}</code>)}
          />}
          {createPermissions.size === 0 && <p className="role-field-error">Chọn ít nhất một quyền để tạo nhóm.</p>}
          {createDependencyIssues.length > 0 && <p className="role-field-error">Còn quyền phụ thuộc chưa được chọn.</p>}
          {createValidation && <Alert className="role-form-error" type="error" showIcon role="alert" title={createValidation} />}
        </div>
      </Modal>

      <Modal
        title={`Sửa thông tin nhóm ${metadataTarget?.code ?? ''}`}
        open={Boolean(metadataTarget)}
        centered
        onCancel={() => { if (!metadataSaving) setMetadataTarget(null); }}
        onOk={() => void handleMetadataSave()}
        okText="Lưu thông tin"
        cancelText="Hủy"
        confirmLoading={metadataSaving}
        closable={!metadataSaving}
        keyboard={!metadataSaving}
        mask={{ closable: !metadataSaving }}
        okButtonProps={{ disabled: !metadataTarget || !metadataName.trim() || metadataName.trim().length > 100 || metadataDescription.length > 255 }}
      >
        <div className="role-form-grid">
          <label htmlFor="edit-role-code">Mã nhóm</label>
          <Input id="edit-role-code" aria-label="Mã nhóm" value={metadataTarget?.code ?? ''} readOnly />
          <label htmlFor="edit-role-name">Tên hiển thị</label>
          <Input id="edit-role-name" aria-label="Tên hiển thị" maxLength={100} value={metadataName} onChange={(event) => { setMetadataName(event.target.value); setMetadataError(null); }} />
          <label htmlFor="edit-role-description">Mô tả</label>
          <Input.TextArea id="edit-role-description" aria-label="Mô tả" maxLength={255} rows={3} value={metadataDescription} onChange={(event) => { setMetadataDescription(event.target.value); setMetadataError(null); }} />
        </div>
        {metadataError && <Alert className="role-form-error" type="error" showIcon role="alert" title={metadataError} action={<Button onClick={refreshList}>Tải lại danh sách</Button>} />}
      </Modal>

      <Modal
        title={statusTarget?.enabled ? 'Ngừng hoạt động nhóm quyền?' : 'Kích hoạt nhóm quyền?'}
        open={Boolean(statusTarget)}
        centered
        onCancel={() => { if (!statusSaving) setStatusTarget(null); }}
        onOk={() => void handleStatusChange()}
        okText={statusTarget?.enabled ? 'Ngừng hoạt động' : 'Kích hoạt nhóm'}
        cancelText="Hủy"
        confirmLoading={statusSaving}
        closable={!statusSaving}
        keyboard={!statusSaving}
        mask={{ closable: !statusSaving }}
      >
        {statusTarget?.enabled
          ? <Alert type="warning" showIcon title={`Quyền của ${statusTarget.displayName} sẽ tạm mất hiệu lực với mọi tài khoản trong nhóm.`} description="Có thể kích hoạt lại nhóm để khôi phục các quyền đã gán." />
          : <p>Nhóm {statusTarget?.displayName} được kích hoạt lại và các quyền đã gán sẽ có hiệu lực.</p>}
        {statusError && <Alert className="role-form-error" type="error" showIcon role="alert" title={statusError} action={<Button onClick={refreshList}>Tải lại danh sách</Button>} />}
      </Modal>
    </section>
  );
}
