import { Alert, Button, Input, Modal, Pagination, Select, Spin, Table, Tag, Tooltip } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { roleApi } from '../../role/api';
import type { RoleSummary } from '../../role/types';
import { adminAccountApi } from './api';
import type { AdminAccount, AdminAccountPage, AdminAccountSearchQuery } from './types';

const PAGE_SIZE = 10;
const PASSWORD_POLICY = /^(?=.{8,20}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\p{P}\p{S}])\S+$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type DirectoryMode = 'management' | 'assignments';
type CreateField = 'username' | 'email' | 'password' | 'password-confirm' | 'role';
type SortState = { field: string; direction: 'asc' | 'desc' };
type FilterState = {
  username: string;
  email: string;
  roleCode: string;
  enabled: 'all' | 'true' | 'false';
  emailVerified: 'all' | 'true' | 'false';
};

function statusOf(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

function codeOf(error: unknown): string | undefined {
  if (!axios.isAxiosError<{ code?: string }>(error)) return undefined;
  return error.response?.data?.code;
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getMessageForWriteError(error: unknown, operation: 'create' | 'role' | 'status'): string {
  const status = statusOf(error);
  const code = codeOf(error);
  if (status === 403) {
    if (code === 'ACCOUNT_SYSTEM_PROTECTED') return 'Tài khoản hệ thống được bảo vệ và không thể thay đổi.';
    if (code === 'ACCOUNT_SELF_ROLE_CHANGE_FORBIDDEN' || code === 'ACCOUNT_SELF_DISABLE_FORBIDDEN') {
      return 'Bạn không thể thay đổi vai trò hoặc trạng thái tài khoản của chính mình.';
    }
    if (operation === 'role' && code === 'ROLE_ASSIGNMENT_FORBIDDEN') {
      return 'Nhóm nguồn hoặc nhóm đích không còn hoạt động. Hãy kích hoạt nhóm trước khi chuyển tài khoản.';
    }
    return 'Phiên quản trị không còn quyền thực hiện thao tác này. Quyền đang được đồng bộ lại.';
  }
  if (status === 404) return 'Tài khoản hoặc nhóm quyền không còn tồn tại. Danh sách đang được tải lại.';
  if (status === 409) {
    if (code === 'ACCOUNT_USERNAME_DUPLICATED') return 'Tên đăng nhập đã được sử dụng.';
    if (code === 'ACCOUNT_EMAIL_DUPLICATED') return 'Email đã được sử dụng.';
    if (code === 'ACCOUNT_SESSION_CONFLICT') return 'Thông tin tài khoản vừa được thay đổi. Danh sách đã được tải lại; hãy xác nhận lại trước khi thử.';
    if (code === 'ACCOUNT_ROLE_UNCHANGED') return 'Tài khoản đã thuộc nhóm quyền được chọn. Danh sách đã được tải lại.';
    if (code === 'ACCOUNT_STATUS_UNCHANGED') return 'Trạng thái tài khoản đã được cập nhật. Danh sách đã được tải lại.';
    return 'Tài khoản vừa được thay đổi ở nơi khác. Danh sách đã được tải lại.';
  }
  if (status === 400 || status === 422) return 'Thông tin chưa hợp lệ. Hãy kiểm tra lại các trường đã nhập.';
  return operation === 'create'
    ? 'Không thể tạo tài khoản quản trị lúc này. Vui lòng thử lại.'
    : 'Không thể cập nhật tài khoản lúc này. Vui lòng thử lại.';
}

function isProtectedAccount(account: AdminAccount, currentUserId: number | undefined): boolean {
  return account.systemAccount || account.id === currentUserId;
}

function safePage(page: AdminAccountPage): AdminAccountPage {
  const content = page.content.filter((account) => account.roleCode !== 'USER');
  return content.length === page.content.length ? page : { ...page, content };
}

export function AdminAccountManagementPage() {
  return <AdminAccountDirectory mode="management" />;
}

export function AdminAccountAssignmentPage() {
  return <AdminAccountDirectory mode="assignments" />;
}

function AdminAccountDirectory({ mode }: { mode: DirectoryMode }) {
  const { currentUser, role, refreshCapabilities } = useAuth();
  const { notify } = useAppNotification();
  const canManage = role === 'ADMIN' && currentUser?.permissions.includes('role:update');
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState(false);
  const [rolesReloadKey, setRolesReloadKey] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    username: '', email: '', roleCode: '', enabled: 'all', emailVerified: 'all',
  });
  const [appliedText, setAppliedText] = useState({ username: '', email: '' });
  const [pageNumber, setPageNumber] = useState(0);
  const [sort, setSort] = useState<SortState>({ field: 'createdAt', direction: 'desc' });
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{ key: string; page: AdminAccountPage } | null>(null);
  const [request, setRequest] = useState<{ key: string; state: 'success' | 'error' } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState('');
  const [createRoleCode, setCreateRoleCode] = useState<string>();
  const [createError, setCreateError] = useState<string | null>(null);
  const [createTouched, setCreateTouched] = useState<Partial<Record<CreateField, boolean>>>({});
  const [confirmAdminCreate, setConfirmAdminCreate] = useState(false);

  const [detailTarget, setDetailTarget] = useState<AdminAccount | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<AdminAccount | null>(null);
  const [assignmentRoleCode, setAssignmentRoleCode] = useState<string>();
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [confirmRoleChange, setConfirmRoleChange] = useState(false);
  const [statusTarget, setStatusTarget] = useState<AdminAccount | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const query = useMemo<AdminAccountSearchQuery>(() => ({
    username: appliedText.username.trim() || undefined,
    email: appliedText.email.trim() || undefined,
    roleCode: filters.roleCode || undefined,
    enabled: filters.enabled === 'all' ? undefined : filters.enabled === 'true',
    emailVerified: filters.emailVerified === 'all' ? undefined : filters.emailVerified === 'true',
    page: pageNumber,
    size: PAGE_SIZE,
    sort: `${sort.field},${sort.direction}`,
  }), [appliedText, filters.emailVerified, filters.enabled, filters.roleCode, pageNumber, sort]);
  const requestKey = `${JSON.stringify(query)}:${reloadKey}`;
  const loading = request?.key !== requestKey;
  const error = request?.key === requestKey && request.state === 'error';
  const pageData = result?.key === requestKey ? result.page : null;
  const filterableRoles = useMemo(() => roles.filter((item) => item.code !== 'USER'), [roles]);
  const activeAssignableRoles = useMemo(() => roles.filter((item) =>
    item.enabled && item.code !== 'USER' && item.code !== 'SUPER_ADMIN'), [roles]);
  const roleByCode = useMemo(() => new Map(roles.map((item) => [item.code, item])), [roles]);
  const createRoleOptions = activeAssignableRoles.map((item) => ({
    value: item.code,
    label: `${item.displayName ?? item.code} (${item.code})`,
  }));
  const assignmentRoleOptions = activeAssignableRoles
    .filter((item) => item.code !== assignmentTarget?.roleCode)
    .map((item) => ({ value: item.code, label: `${item.displayName ?? item.code} (${item.code})` }));
  const selectedAssignmentRole = assignmentRoleOptions.find((item) => item.value === assignmentRoleCode);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedText({ username: filters.username, email: filters.email });
      setPageNumber(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [filters.username, filters.email]);

  useEffect(() => {
    let current = true;
    void roleApi.getRoles()
      .then((items) => { if (current) setRoles(items); })
      .catch(() => { if (current) setRolesError(true); })
      .finally(() => { if (current) setRolesLoading(false); });
    return () => { current = false; };
  }, [rolesReloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void adminAccountApi.search(query, controller.signal)
      .then((pageResult) => {
        if (!current) return;
        const filteredPage = safePage(pageResult);
        setResult({ key: requestKey, page: filteredPage });
        setRequest({ key: requestKey, state: 'success' });
        if (filteredPage.totalPages > 0 && pageNumber >= filteredPage.totalPages) {
          setPageNumber(filteredPage.totalPages - 1);
        }
      })
      .catch(() => { if (current) setRequest({ key: requestKey, state: 'error' }); })
      .finally(() => undefined);
    return () => {
      current = false;
      controller.abort();
    };
  }, [pageNumber, query, reloadKey, requestKey]);

  const refresh = useCallback(() => setReloadKey((value) => value + 1), []);
  const refreshRoles = useCallback(() => {
    setRolesError(false);
    setRolesLoading(true);
    setRolesReloadKey((value) => value + 1);
  }, []);
  const closeCreate = () => {
    if (createSaving) return;
    setCreateOpen(false);
    setCreateTouched({});
    setCreateError(null);
    setCreateUsername('');
    setCreateEmail('');
    setCreatePassword('');
    setCreatePasswordConfirm('');
    setCreateRoleCode(undefined);
    setConfirmAdminCreate(false);
  };

  const createValues: Record<CreateField, string> = {
    username: createUsername, email: createEmail, password: createPassword,
    'password-confirm': createPasswordConfirm, role: createRoleCode ?? '',
  };
  const createErrors: Record<CreateField, string | null> = {
    username: !createUsername.trim() ? 'Vui lòng nhập tên đăng nhập.'
      : createUsername.trim().length > 20 ? 'Tên đăng nhập tối đa 20 ký tự.' : null,
    email: !createEmail.trim() ? 'Vui lòng nhập email.'
      : !EMAIL_PATTERN.test(createEmail.trim()) || createEmail.trim().length > 255
        ? 'Nhập email hợp lệ, tối đa 255 ký tự.' : null,
    password: !createPassword ? 'Vui lòng nhập mật khẩu.'
      : !PASSWORD_POLICY.test(createPassword)
        ? 'Mật khẩu cần 8–20 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt; không có khoảng trắng.' : null,
    'password-confirm': !createPasswordConfirm ? 'Vui lòng xác nhận mật khẩu.'
      : createPassword !== createPasswordConfirm ? 'Mật khẩu xác nhận không khớp.' : null,
    role: !createRoleCode ? 'Vui lòng chọn nhóm quyền.'
      : !activeAssignableRoles.some(({ code }) => code === createRoleCode)
        ? 'Chọn một nhóm đang hoạt động và khác USER.' : null,
  };
  const createFormValid = Object.values(createErrors).every((message) => message === null);
  const visibleCreateError = (field: CreateField) =>
    createTouched[field] || createValues[field] ? createErrors[field] : null;
  const createFieldProps = (field: CreateField) => ({
    'aria-invalid': Boolean(visibleCreateError(field)),
    'aria-describedby': visibleCreateError(field) ? `admin-account-${field}-error` : undefined,
    status: visibleCreateError(field) ? 'error' as const : undefined,
    onBlur: () => setCreateTouched((current) => ({ ...current, [field]: true })),
  });
  const createFieldError = (field: CreateField) => visibleCreateError(field)
    ? <p id={`admin-account-${field}-error`} className="admin-account-field-error" role="alert">{visibleCreateError(field)}</p>
    : null;

  const submitCreate = async () => {
    if (!createFormValid || !createRoleCode || createSaving) {
      if (!createUsername.trim() || createUsername.trim().length > 20) {
        setCreateError('Tên đăng nhập là bắt buộc và tối đa 20 ký tự.');
      } else if (!EMAIL_PATTERN.test(createEmail.trim()) || createEmail.trim().length > 255) {
        setCreateError('Nhập email hợp lệ, tối đa 255 ký tự.');
      } else if (!PASSWORD_POLICY.test(createPassword)) {
        setCreateError('Mật khẩu cần 8–20 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt; không có khoảng trắng.');
      } else if (createPassword !== createPasswordConfirm) {
        setCreateError('Mật khẩu xác nhận không khớp.');
      } else if (!createRoleCode || !activeAssignableRoles.some(({ code }) => code === createRoleCode)) {
        setCreateError('Chọn một nhóm đang hoạt động và khác USER.');
      }
      return;
    }
    if (createRoleCode === 'ADMIN' && !confirmAdminCreate) {
      setConfirmAdminCreate(true);
      return;
    }
    setCreateSaving(true);
    setCreateError(null);
    try {
      const created = await adminAccountApi.create({
        username: createUsername.trim(),
        email: createEmail.trim(),
        password: createPassword,
        roleCode: createRoleCode,
      });
      setCreateOpen(false);
      setCreateTouched({});
      setCreateUsername('');
      setCreateEmail('');
      setCreatePassword('');
      setCreatePasswordConfirm('');
      setCreateRoleCode(undefined);
      setCreateError(null);
      setConfirmAdminCreate(false);
      notify('success', {
        title: 'Đã tạo tài khoản quản trị',
        description: `${created.username} chưa xác minh email; tài khoản cần xác minh email trước khi đăng nhập.`,
      });
      refresh();
    } catch (writeError) {
      const message = getMessageForWriteError(writeError, 'create');
      if (statusOf(writeError) === 403) void refreshCapabilities().catch(() => undefined);
      if (statusOf(writeError) === 409 || statusOf(writeError) === 400 || statusOf(writeError) === 422) {
        setCreateError(message);
      } else {
        notify('error', { title: 'Không thể tạo tài khoản', description: message });
      }
    } finally {
      setCreateSaving(false);
    }
  };

  const openDetails = async (account: AdminAccount) => {
    setDetailTarget(account);
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetailTarget(await adminAccountApi.get(account.id));
    } catch (detailFailure) {
      const message = statusOf(detailFailure) === 404
        ? 'Tài khoản không còn tồn tại. Danh sách đang được tải lại.'
        : statusOf(detailFailure) === 403
          ? 'Phiên quản trị không còn quyền xem tài khoản này.'
          : 'Không thể tải chi tiết tài khoản. Vui lòng thử lại.';
      setDetailError(message);
      if (statusOf(detailFailure) === 404 || statusOf(detailFailure) === 403) refresh();
    } finally {
      setDetailLoading(false);
    }
  };

  const openAssignment = (account: AdminAccount) => {
    if (isProtectedAccount(account, currentUser?.id)) {
      notify('warning', {
        title: 'Tài khoản được bảo vệ',
        description: account.systemAccount ? 'Không thể đổi nhóm của tài khoản hệ thống.' : 'Không thể tự đổi nhóm của tài khoản đang đăng nhập.',
      });
      return;
    }
    if (account.roleCode === 'USER') return;
    const sourceRole = roleByCode.get(account.roleCode);
    if (!sourceRole?.enabled) {
      notify('warning', {
        title: 'Nhóm hiện tại đang ngừng hoạt động',
        description: 'Kích hoạt nhóm trước khi chuyển tài khoản.',
      });
      return;
    }
    setAssignmentTarget(account);
    setAssignmentRoleCode(undefined);
    setAssignmentError(null);
  };

  const confirmAssignment = async () => {
    if (!assignmentTarget || !assignmentRoleCode || assignmentSaving || !canManage) return;
    setAssignmentSaving(true);
    setAssignmentError(null);
    try {
      const updated = await adminAccountApi.updateRole(assignmentTarget.id, {
        roleCode: assignmentRoleCode,
        expectedSessionVersion: assignmentTarget.sessionVersion,
      });
      setAssignmentTarget(null);
      setConfirmRoleChange(false);
      notify('success', {
        title: 'Đã đổi nhóm quyền',
        description: `${updated.username} hiện thuộc nhóm ${updated.roleDisplayName}. Tài khoản sẽ phải đăng nhập lại.`,
      });
      refresh();
      refreshRoles();
    } catch (writeError) {
      const message = getMessageForWriteError(writeError, 'role');
      if (statusOf(writeError) === 403) {
        void refreshCapabilities().catch(() => undefined);
        refreshRoles();
      }
      if (statusOf(writeError) === 409 || statusOf(writeError) === 404) refresh();
      if (statusOf(writeError) === 409 || statusOf(writeError) === 403 || statusOf(writeError) === 404) {
        setAssignmentTarget(null);
        setConfirmRoleChange(false);
      }
      notify(statusOf(writeError) === 403 ? 'warning' : 'error', {
        title: 'Không thể đổi nhóm quyền',
        description: message,
      });
    } finally {
      setAssignmentSaving(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!statusTarget || statusSaving || !canManage) return;
    setStatusSaving(true);
    setStatusError(null);
    try {
      const updated = await adminAccountApi.updateStatus(statusTarget.id, {
        enabled: !statusTarget.enabled,
        expectedSessionVersion: statusTarget.sessionVersion,
      });
      setStatusTarget(null);
      notify('success', {
        title: updated.enabled ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản',
        description: updated.enabled
          ? `${updated.username} cần đăng nhập lại để bắt đầu phiên mới.`
          : `Các phiên của ${updated.username} đã bị kết thúc.`,
      });
      refresh();
    } catch (writeError) {
      const message = getMessageForWriteError(writeError, 'status');
      if (statusOf(writeError) === 403) void refreshCapabilities().catch(() => undefined);
      if (statusOf(writeError) === 409 || statusOf(writeError) === 404) refresh();
      if (statusOf(writeError) === 409 || statusOf(writeError) === 403 || statusOf(writeError) === 404) {
        setStatusTarget(null);
      } else {
        setStatusError(message);
      }
      notify(statusOf(writeError) === 403 ? 'warning' : 'error', {
        title: 'Không thể cập nhật trạng thái',
        description: message,
      });
    } finally {
      setStatusSaving(false);
    }
  };

  const changeTextFilter = (field: 'username' | 'email', value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPageNumber(0);
  };

  const onTableChange: TableProps<AdminAccount>['onChange'] = (pagination, _filters, sorter, extra) => {
    if (extra.action === 'paginate') {
      setPageNumber(Math.max(0, (pagination.current ?? 1) - 1));
      return;
    }
    const selected = Array.isArray(sorter) ? sorter[0] : sorter;
    const field = typeof selected.columnKey === 'string' ? selected.columnKey : 'createdAt';
    const direction = selected.order === 'ascend' ? 'asc' : selected.order === 'descend' ? 'desc' : 'desc';
    setSort({ field, direction });
    setPageNumber(0);
  };

  const columns: TableColumnsType<AdminAccount> = [
    {
      title: 'Tên đăng nhập',
      dataIndex: 'username',
      key: 'username',
      sorter: true,
      sortOrder: sort.field === 'username' ? (sort.direction === 'asc' ? 'ascend' : 'descend') : null,
      width: 150,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      sorter: true,
      sortOrder: sort.field === 'email' ? (sort.direction === 'asc' ? 'ascend' : 'descend') : null,
      width: 220,
    },
    {
      title: 'Nhóm quyền',
      dataIndex: 'roleCode',
      key: 'roleCode',
      sorter: true,
      sortOrder: sort.field === 'roleCode' ? (sort.direction === 'asc' ? 'ascend' : 'descend') : null,
      render: (_value: string, account) => {
        const roleState = roleByCode.get(account.roleCode);
        return <div className="admin-account-role-cell">
          <span>{account.roleDisplayName || roleState?.displayName || account.roleCode}</span>
          <code>{account.roleCode}</code>
          {roleState && !roleState.enabled && <Tag color="orange">Nhóm ngừng hoạt động</Tag>}
        </div>;
      },
      width: 220,
    },
    {
      title: 'Xác minh email',
      dataIndex: 'emailVerified',
      key: 'emailVerified',
      sorter: true,
      sortOrder: sort.field === 'emailVerified' ? (sort.direction === 'asc' ? 'ascend' : 'descend') : null,
      render: (verified: boolean) => <Tag color={verified ? 'green' : 'default'}>{verified ? 'Đã xác minh' : 'Chưa xác minh'}</Tag>,
      width: 150,
    },
    {
      title: 'Tài khoản',
      dataIndex: 'enabled',
      key: 'enabled',
      sorter: true,
      sortOrder: sort.field === 'enabled' ? (sort.direction === 'asc' ? 'ascend' : 'descend') : null,
      render: (enabled: boolean) => <Tag color={enabled ? 'green' : 'red'}>{enabled ? 'Đang hoạt động' : 'Đã khóa'}</Tag>,
      width: 130,
    },
    {
      title: 'Tài khoản hệ thống',
      dataIndex: 'systemAccount',
      key: 'systemAccount',
      render: (systemAccount: boolean) => systemAccount
        ? <Tag color="gold">Tài khoản hệ thống</Tag>
        : <span aria-label="Tài khoản thông thường">—</span>,
      width: 160,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: true,
      sortOrder: sort.field === 'createdAt' ? (sort.direction === 'asc' ? 'ascend' : 'descend') : null,
      render: formatCreatedAt,
      width: 165,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: mode === 'management' ? 300 : 145,
      render: (_value, account) => {
        const protectedAccount = isProtectedAccount(account, currentUser?.id);
        const protectionLabel = account.systemAccount ? 'Tài khoản hệ thống được bảo vệ' : 'Không thể thay đổi chính tài khoản đang đăng nhập';
        return <div className="admin-account-actions">
          {mode === 'management' && <Button type="link" onClick={() => void openDetails(account)}>Xem</Button>}
          <Tooltip title={protectedAccount ? protectionLabel : ''}>
            <Button
              type="link"
              disabled={protectedAccount || !canManage || rolesLoading}
              onClick={() => openAssignment(account)}
            >Đổi nhóm</Button>
          </Tooltip>
          {mode === 'management' && <Tooltip title={protectedAccount ? protectionLabel : ''}>
            <Button
              type="link"
              danger={account.enabled}
              disabled={protectedAccount || !canManage}
              onClick={() => { setStatusTarget(account); setStatusError(null); }}
            >{account.enabled ? 'Khóa tài khoản' : 'Mở khóa'}</Button>
          </Tooltip>}
        </div>;
      },
    },
  ];

  const updateSelectFilter = (field: 'roleCode' | 'enabled' | 'emailVerified', value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPageNumber(0);
  };

  const heading = mode === 'management' ? 'Quản lý tài khoản quản trị' : 'Gán nhóm quyền cho tài khoản';

  return (
    <main className="role-stage admin-account-stage">
      <section className="role-workspace admin-account-workspace" aria-labelledby="admin-account-title">
        <div className="role-heading">
          <div>
            <p className="role-eyebrow">QUẢN TRỊ HỆ THỐNG</p>
            <h1 id="admin-account-title">{heading}</h1>
            <p className="role-intro">{mode === 'management'
              ? 'Tìm và quản lý tài khoản có quyền quản trị thư viện.'
              : 'Chọn tài khoản quản trị và chuyển sang nhóm đang hoạt động.'}</p>
          </div>
          {mode === 'management' && canManage && <Button type="primary" onClick={() => setCreateOpen(true)} disabled={rolesLoading || rolesError}>
            Tạo tài khoản quản trị
          </Button>}
        </div>

        {rolesError && <Alert
          className="admin-account-alert"
          type="error"
          showIcon
          role="alert"
          title="Không thể tải danh sách nhóm quyền"
          description="Danh sách tài khoản vẫn được tải; các thao tác cần chọn nhóm quyền sẽ tạm thời bị khóa."
          action={<Button onClick={refreshRoles}>Thử lại</Button>}
        />}

        <section className="admin-account-filters" aria-label="Bộ lọc tài khoản quản trị">
          <div className="admin-account-filter-grid">
            <Input
              aria-label="Tên đăng nhập"
              placeholder="Tìm tên đăng nhập"
              value={filters.username}
              onChange={(event) => changeTextFilter('username', event.target.value)}
              allowClear
            />
            <Input
              aria-label="Email tài khoản"
              placeholder="Tìm email"
              value={filters.email}
              onChange={(event) => changeTextFilter('email', event.target.value)}
              allowClear
            />
            <Select
              aria-label="Lọc theo nhóm quyền"
              value={filters.roleCode || 'ALL'}
              onChange={(value: string) => updateSelectFilter('roleCode', value === 'ALL' ? '' : value)}
              options={[{ value: 'ALL', label: 'Mọi nhóm quản trị' }, ...filterableRoles.map((item) => ({
                value: item.code,
                label: `${item.displayName ?? item.code} (${item.code})${item.enabled ? '' : ' · Ngừng hoạt động'}`,
              }))]}
            />
            <Select
              aria-label="Trạng thái tài khoản"
              value={filters.enabled}
              onChange={(value: FilterState['enabled']) => updateSelectFilter('enabled', value)}
              options={[
                { value: 'all', label: 'Mọi trạng thái tài khoản' },
                { value: 'true', label: 'Đang hoạt động' },
                { value: 'false', label: 'Đã khóa' },
              ]}
            />
            <Select
              aria-label="Trạng thái xác minh email"
              value={filters.emailVerified}
              onChange={(value: FilterState['emailVerified']) => updateSelectFilter('emailVerified', value)}
              options={[
                { value: 'all', label: 'Mọi trạng thái xác minh' },
                { value: 'true', label: 'Đã xác minh email' },
                { value: 'false', label: 'Chưa xác minh email' },
              ]}
            />
          </div>
          <div className="admin-account-filter-actions">
            <Button onClick={() => {
              setFilters({ username: '', email: '', roleCode: '', enabled: 'all', emailVerified: 'all' });
              setAppliedText({ username: '', email: '' });
              setPageNumber(0);
              setSort({ field: 'createdAt', direction: 'desc' });
            }}>Xóa bộ lọc</Button>
            <Link to={mode === 'management' ? '/admin/authorization/assignments' : '/admin/accounts'}>
              {mode === 'management' ? 'Gán nhóm quyền' : 'Quản lý tài khoản'}
            </Link>
          </div>
        </section>

        {error && <Alert
          className="admin-account-alert"
          type="error"
          showIcon
          role="alert"
          title="Không thể tải danh sách tài khoản quản trị"
          description="Hãy kiểm tra kết nối rồi thử tải lại."
          action={<Button onClick={refresh}>Thử lại</Button>}
        />}

        <div className="admin-account-table-wrap" aria-busy={loading}>
          <Table<AdminAccount>
            rowKey="id"
            columns={columns}
            dataSource={pageData?.content ?? []}
            pagination={false}
            loading={loading ? { indicator: <Spin aria-label="Đang tải tài khoản quản trị" /> } : false}
            onChange={onTableChange}
            locale={{ emptyText: error ? 'Không thể tải dữ liệu. Hãy thử lại.' : 'Không có tài khoản quản trị phù hợp.' }}
            sortDirections={['ascend', 'descend', 'ascend']}
            showSorterTooltip={false}
            scroll={{ x: 1200 }}
          />
        </div>
        {pageData && pageData.totalElements > 0 && <div className="admin-account-pagination-row">
          <span role="status">Tổng số {pageData.totalElements} tài khoản</span>
          <Pagination
            aria-label="Phân trang tài khoản quản trị"
            current={pageNumber + 1}
            pageSize={PAGE_SIZE}
            total={pageData.totalElements}
            showSizeChanger={false}
            onChange={(nextPage) => setPageNumber(nextPage - 1)}
          />
        </div>}
      </section>

      <Modal
        title="Tạo tài khoản quản trị"
        open={createOpen}
        centered
        onCancel={closeCreate}
        onOk={() => void submitCreate()}
        okText="Tạo tài khoản"
        cancelText="Hủy"
        confirmLoading={createSaving}
        closable={!createSaving}
        keyboard={!createSaving}
        mask={{ closable: !createSaving }}
        okButtonProps={{ disabled: !createFormValid || createSaving || !canManage }}
      >
        <div className="admin-account-form-grid">
          <label htmlFor="admin-account-username">Tên đăng nhập</label>
          <div className="admin-account-form-field">
            <Input id="admin-account-username" {...createFieldProps('username')} aria-label="Tên đăng nhập" maxLength={20} value={createUsername} onChange={(event) => { setCreateUsername(event.target.value); setCreateError(null); }} autoComplete="off" />
            {createFieldError('username')}
          </div>
          <label htmlFor="admin-account-email">Email</label>
          <div className="admin-account-form-field">
            <Input id="admin-account-email" {...createFieldProps('email')} aria-label="Email" type="email" maxLength={255} value={createEmail} onChange={(event) => { setCreateEmail(event.target.value); setCreateError(null); }} autoComplete="email" />
            {createFieldError('email')}
          </div>
          <label htmlFor="admin-account-password">Mật khẩu</label>
          <div className="admin-account-form-field">
            <Input.Password id="admin-account-password" {...createFieldProps('password')} aria-label="Mật khẩu" value={createPassword} onChange={(event) => { setCreatePassword(event.target.value); setCreateError(null); }} autoComplete="new-password" />
            {createFieldError('password')}
          </div>
          <label htmlFor="admin-account-password-confirm">Xác nhận mật khẩu</label>
          <div className="admin-account-form-field">
            <Input.Password id="admin-account-password-confirm" {...createFieldProps('password-confirm')} aria-label="Xác nhận mật khẩu" value={createPasswordConfirm} onChange={(event) => { setCreatePasswordConfirm(event.target.value); setCreateError(null); }} autoComplete="new-password" />
            {createFieldError('password-confirm')}
          </div>
          <label htmlFor="admin-account-role">Nhóm quyền</label>
          <div className="admin-account-form-field">
            <Select
              {...createFieldProps('role')}
              id="admin-account-role"
              aria-label="Nhóm quyền"
              showSearch={{ filterOption: (input, option) => String(option?.label ?? '').toLocaleLowerCase().includes(input.toLocaleLowerCase()) }}
              placeholder="Chọn nhóm đang hoạt động"
              value={createRoleCode}
              onChange={(value: string) => { setCreateRoleCode(value); setCreateError(null); setConfirmAdminCreate(false); }}
              options={createRoleOptions}
              notFoundContent="Không có nhóm đang hoạt động phù hợp"
            />
            {createFieldError('role')}
          </div>
          <p className="admin-account-form-hint">Tài khoản mới cần xác minh email trước khi đăng nhập. Mật khẩu gồm 8–20 ký tự, chữ hoa, chữ thường, số và ký tự đặc biệt; không có khoảng trắng.</p>
        </div>
        {createError && <Alert className="admin-account-inline-alert" type="error" showIcon role="alert" title={createError} />}
      </Modal>

      <Modal
        title="Xác nhận cấp nhóm ADMIN"
        open={confirmAdminCreate}
        centered
        onCancel={() => { if (!createSaving) setConfirmAdminCreate(false); }}
        onOk={() => void submitCreate()}
        okText="Xác nhận cấp ADMIN"
        cancelText="Quay lại"
        confirmLoading={createSaving}
        closable={!createSaving}
        keyboard={!createSaving}
        mask={{ closable: !createSaving }}
      >
        <Alert type="warning" showIcon title="Nhóm ADMIN có toàn quyền; bạn có chắc muốn cấp?" description="Tài khoản này có thể quản lý mọi nhóm quyền và tài khoản quản trị." />
      </Modal>

      <Modal
        title="Chi tiết tài khoản quản trị"
        open={Boolean(detailTarget)}
        centered
        footer={<Button onClick={() => { setDetailTarget(null); setDetailError(null); }}>Đóng</Button>}
        onCancel={() => { setDetailTarget(null); setDetailError(null); }}
      >
        {detailLoading ? <div className="admin-account-loading" role="status"><Spin /> Đang tải chi tiết…</div> : detailTarget && <dl className="admin-account-detail-grid">
          <dt>Tên đăng nhập</dt><dd>{detailTarget.username}</dd>
          <dt>Email</dt><dd>{detailTarget.email}</dd>
          <dt>Nhóm quyền</dt><dd>{detailTarget.roleDisplayName} ({detailTarget.roleCode})</dd>
          <dt>Xác minh email</dt><dd>{detailTarget.emailVerified ? 'Đã xác minh' : 'Chưa xác minh email'}</dd>
          <dt>Trạng thái tài khoản</dt><dd>{detailTarget.enabled ? 'Đang hoạt động' : 'Đã khóa'}</dd>
          <dt>Tài khoản hệ thống</dt><dd>{detailTarget.systemAccount ? 'Có' : 'Không'}</dd>
          <dt>Ngày tạo</dt><dd>{formatCreatedAt(detailTarget.createdAt)}</dd>
        </dl>}
        {detailError && <Alert className="admin-account-inline-alert" type="error" showIcon role="alert" title={detailError} action={<Button onClick={() => detailTarget && void openDetails(detailTarget)}>Thử lại</Button>} />}
      </Modal>

      <Modal
        title={`Đổi nhóm quyền${assignmentTarget ? ` · ${assignmentTarget.username}` : ''}`}
        open={Boolean(assignmentTarget)}
        centered
        onCancel={() => { if (!assignmentSaving) { setAssignmentTarget(null); setAssignmentError(null); } }}
        onOk={() => {
          if (!assignmentRoleCode) {
            setAssignmentError('Chọn nhóm quyền mới trước khi tiếp tục.');
            return;
          }
          setConfirmRoleChange(true);
        }}
        okText="Tiếp tục"
        cancelText="Hủy"
        confirmLoading={assignmentSaving}
        closable={!assignmentSaving}
        keyboard={!assignmentSaving}
        mask={{ closable: !assignmentSaving }}
        okButtonProps={{ disabled: !canManage || rolesLoading || assignmentRoleOptions.length === 0 }}
      >
        {assignmentTarget && <div className="admin-account-assignment-form">
          <p>Nhóm hiện tại: <strong>{assignmentTarget.roleDisplayName} ({assignmentTarget.roleCode})</strong></p>
          <label htmlFor="admin-account-assignment-role">Nhóm quyền mới</label>
          <Select
            id="admin-account-assignment-role"
            aria-label="Nhóm quyền mới"
            showSearch={{ filterOption: (input, option) => String(option?.label ?? '').toLocaleLowerCase().includes(input.toLocaleLowerCase()) }}
            placeholder="Chọn nhóm đang hoạt động"
            value={assignmentRoleCode}
            onChange={(value: string) => { setAssignmentRoleCode(value); setAssignmentError(null); }}
            options={assignmentRoleOptions}
            notFoundContent="Không có nhóm đang hoạt động khác phù hợp"
          />
          {assignmentError && <Alert type="error" showIcon role="alert" title={assignmentError} />}
        </div>}
      </Modal>

      <Modal
        title="Xác nhận đổi nhóm quyền"
        open={confirmRoleChange}
        centered
        onCancel={() => { if (!assignmentSaving) setConfirmRoleChange(false); }}
        onOk={() => void confirmAssignment()}
        okText="Xác nhận đổi nhóm"
        cancelText="Quay lại"
        confirmLoading={assignmentSaving}
        closable={!assignmentSaving}
        keyboard={!assignmentSaving}
        mask={{ closable: !assignmentSaving }}
      >
        {assignmentTarget && selectedAssignmentRole && <>
          <p><strong>{assignmentTarget.username}</strong>: {assignmentTarget.roleDisplayName} ({assignmentTarget.roleCode}) → {selectedAssignmentRole.label}</p>
          <Alert type="warning" showIcon title="Tất cả phiên đăng nhập của tài khoản mục tiêu sẽ kết thúc và người dùng phải đăng nhập lại." />
        </>}
      </Modal>

      <Modal
        title={statusTarget?.enabled ? 'Khóa tài khoản quản trị?' : 'Mở khóa tài khoản quản trị?'}
        open={Boolean(statusTarget)}
        centered
        onCancel={() => { if (!statusSaving) { setStatusTarget(null); setStatusError(null); } }}
        onOk={() => void confirmStatusChange()}
        okText={statusTarget?.enabled ? 'Xác nhận khóa tài khoản' : 'Xác nhận mở khóa'}
        cancelText="Hủy"
        confirmLoading={statusSaving}
        closable={!statusSaving}
        keyboard={!statusSaving}
        mask={{ closable: !statusSaving }}
      >
        {statusTarget?.enabled
          ? <Alert type="warning" showIcon title={`Khóa ${statusTarget.username}?`} description="Tất cả phiên của tài khoản sẽ kết thúc. Khi mở khóa, tài khoản phải đăng nhập lại." />
          : <Alert type="info" showIcon title={`Mở khóa ${statusTarget?.username}?`} description="Tài khoản sẽ có thể đăng nhập bằng phiên mới." />}
        {statusError && <Alert className="admin-account-inline-alert" type="error" showIcon role="alert" title={statusError} />}
      </Modal>
    </main>
  );
}
