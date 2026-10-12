import { Alert, Button, Collapse, DatePicker, Input, Pagination, Select, Spin, Table, Tag } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePermission } from '../../auth/permissions';
import { memberApi } from './api';
import { MemberCreateModal } from './MemberCreateModal';
import {
  buildMemberListQuery,
  clearMemberListState,
  DEFAULT_MEMBER_LIST_STATE,
  isValidBirthRange,
  readMemberListState,
  saveMemberListState,
  type MemberListFilters,
  type MemberListViewState,
} from './listState';
import type { MemberListItem, PageResponse } from './types';

const PAGE_SIZE = 10;
const { RangePicker } = DatePicker;

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY') : '—';
}

function formatPhone(value: string | null): string {
  if (!value) return '—';
  const digits = value.replace(/\D/g, '');
  return digits.length === 10
    ? `${digits.slice(0, 4)}.${digits.slice(4, 7)}.${digits.slice(7)}`
    : value;
}

function asDayjs(value: string): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

function sameFilters(left: MemberListFilters, right: MemberListFilters): boolean {
  return Object.keys(left).every((key) =>
    left[key as keyof MemberListFilters] === right[key as keyof MemberListFilters]);
}

export function MemberListPage() {
  const canCreateMember = usePermission('member:create');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewState, setViewState] = useState<MemberListViewState>(() => readMemberListState());
  const [appliedState, setAppliedState] = useState<MemberListViewState>(() => readMemberListState());
  const [draftFilters, setDraftFilters] = useState<MemberListFilters>(() => readMemberListState().filters);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);
  const [resultState, setResultState] = useState<{
    key: string;
    data: PageResponse<MemberListItem>;
  } | null>(null);
  const [requestState, setRequestState] = useState<{
    key: string;
    status: 'success' | 'error';
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const debounceTimers = useRef<Partial<Record<'fullName' | 'memberCode' | 'email' | 'phone' | 'book', number>>>({});

  useEffect(() => () => {
    Object.values(debounceTimers.current).forEach((timer) => {
      if (timer !== undefined) window.clearTimeout(timer);
    });
  }, []);

  useEffect(() => {
    // Lưu bộ lọc đang nhập để quay lại từ trang chi tiết không mất thao tác.
    saveMemberListState({ ...viewState, filters: draftFilters });
  }, [draftFilters, viewState]);

  const query = useMemo(
    () => buildMemberListQuery(appliedState.filters, appliedState.page, appliedState.sort),
    [appliedState],
  );
  const requestKey = `${JSON.stringify(query)}:${reloadKey}`;
  const loading = requestState?.key !== requestKey;
  const error = requestState?.key === requestKey && requestState.status === 'error';
  const result = resultState?.key === requestKey ? resultState.data : null;

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void memberApi.getMembers(query, controller.signal)
      .then((page) => {
        if (current) {
          setResultState({ key: requestKey, data: page });
          setRequestState({ key: requestKey, status: 'success' });
        }
      })
      .catch(() => {
        if (current) setRequestState({ key: requestKey, status: 'error' });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [query, reloadKey, requestKey]);

  const applyTextFilter = useCallback((field: 'fullName' | 'memberCode' | 'email' | 'phone' | 'book', value: string) => {
    setDraftFilters((previous) => ({ ...previous, [field]: value }));
    const previousTimer = debounceTimers.current[field];
    if (previousTimer !== undefined) window.clearTimeout(previousTimer);
    setViewState((previous) => ({
      ...previous,
      filters: { ...previous.filters, [field]: value },
      page: 1,
    }));
    debounceTimers.current[field] = window.setTimeout(() => {
      setAppliedState((previous) => {
        const nextFilters = { ...previous.filters, [field]: value };
        return sameFilters(previous.filters, nextFilters)
          ? previous
          : { ...previous, filters: nextFilters, page: 1 };
      });
      delete debounceTimers.current[field];
    }, 450);
  }, []);

  const updateFilter = (patch: Partial<MemberListFilters>) => {
    setDraftFilters((previous) => ({ ...previous, ...patch }));
    setViewState((previous) => {
      const nextFilters = { ...previous.filters, ...patch };
      return sameFilters(previous.filters, nextFilters)
        ? previous
        : { ...previous, filters: nextFilters, page: 1 };
    });
    setAppliedState((previous) => {
      const nextFilters = { ...previous.filters, ...patch };
      return sameFilters(previous.filters, nextFilters)
        ? previous
        : { ...previous, filters: nextFilters, page: 1 };
    });
  };

  const clearAll = () => {
    Object.values(debounceTimers.current).forEach((timer) => {
      if (timer !== undefined) window.clearTimeout(timer);
    });
    debounceTimers.current = {};
    clearMemberListState();
    setDraftFilters(DEFAULT_MEMBER_LIST_STATE.filters);
    setViewState(DEFAULT_MEMBER_LIST_STATE);
    setAppliedState(DEFAULT_MEMBER_LIST_STATE);
    setDateRangeError(null);
  };

  const onTableChange: TableProps<MemberListItem>['onChange'] = (_pagination, _filters, sorter) => {
    const selected = Array.isArray(sorter) ? sorter[0] : sorter;
    const key = typeof selected.field === 'string' ? selected.field : '';
    const direction = selected.order === 'ascend' ? 'asc' : selected.order === 'descend' ? 'desc' : '';
    const supported = ['createdAt', 'memberCode', 'fullName', 'dateOfBirth'];
    const sort = supported.includes(key) && direction ? `${key},${direction}` : DEFAULT_MEMBER_LIST_STATE.sort;
    setViewState((previous) => ({ ...previous, sort, page: 1 }));
    setAppliedState((previous) => ({ ...previous, sort, page: 1 }));
  };

  const columns: TableColumnsType<MemberListItem> = [
    { title: 'Mã thành viên', dataIndex: 'memberCode', key: 'memberCode', sorter: true, width: 140 },
    { title: 'Họ và tên', dataIndex: 'fullName', key: 'fullName', sorter: true, render: (value: string | null) => value || '—' },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (value: string | null) => value || '—' },
    { title: 'Số điện thoại', dataIndex: 'phone', key: 'phone', render: formatPhone },
    { title: 'Ngày sinh', dataIndex: 'dateOfBirth', key: 'dateOfBirth', sorter: true, render: formatDate },
    { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'createdAt', sorter: true, render: formatDate },
    { title: 'Xác minh email', dataIndex: 'emailVerified', key: 'emailVerified', render: (verified: boolean) => <Tag color={verified ? 'green' : 'default'}>{verified ? 'Đã xác minh' : 'Chưa xác minh'}</Tag> },
    { title: 'Tài khoản', dataIndex: 'enabled', key: 'enabled', render: (enabled: boolean) => <Tag color={enabled ? 'green' : 'red'}>{enabled ? 'Đang hoạt động' : 'Đã khóa'}</Tag> },
    { title: 'Thao tác', key: 'action', render: (_value, member) => <Link to={`/admin/members/${member.id}`} aria-label="Xem chi tiết">Xem chi tiết</Link> },
  ];

  const dateRange: [Dayjs | null, Dayjs | null] = [
    asDayjs(draftFilters.birthFrom),
    asDayjs(draftFilters.birthTo),
  ];

  return (
    <main className="role-stage member-stage">
      <section className="role-workspace member-workspace" aria-labelledby="member-list-title">
        <div className="role-heading">
          <div>
            <p className="role-eyebrow">QUẢN TRỊ HỘI VIÊN</p>
            <h1 id="member-list-title">Quản lý thành viên</h1>
            <p className="role-intro">Tra cứu hồ sơ và lược sử mượn/trả sách.</p>
          </div>
          {canCreateMember && <Button type="primary" onClick={() => setCreateModalOpen(true)}>
            Tạo thành viên
          </Button>}
        </div>

        <section className="member-filter-panel" aria-label="Bộ lọc thành viên">
          <div className="member-filter-grid">
            <Input aria-label="Tìm theo họ và tên" placeholder="Họ và tên" value={draftFilters.fullName} onChange={(event) => applyTextFilter('fullName', event.target.value)} />
            <Input aria-label="Tìm theo mã thành viên" placeholder="Mã thành viên" value={draftFilters.memberCode} onChange={(event) => applyTextFilter('memberCode', event.target.value)} />
            <Input aria-label="Tìm theo email" placeholder="Email" value={draftFilters.email} onChange={(event) => applyTextFilter('email', event.target.value)} />
            <Input aria-label="Tìm theo số điện thoại" placeholder="Số điện thoại" value={draftFilters.phone} onChange={(event) => applyTextFilter('phone', event.target.value)} />
          </div>
          <Collapse
            ghost
            activeKey={advancedOpen ? ['advanced'] : []}
            onChange={(keys) => setAdvancedOpen(Array.isArray(keys) ? keys.length > 0 : Boolean(keys))}
            items={[{
              key: 'advanced',
              label: 'Bộ lọc nâng cao',
              children: <div className="member-filter-grid member-filter-grid--advanced">
                <div className="member-filter-field">
                  <label htmlFor="member-birth-range">Khoảng ngày sinh</label>
                  <RangePicker
                    id="member-birth-range"
                    aria-label="Khoảng ngày sinh"
                    format="YYYY/MM/DD"
                    value={dateRange}
                    onChange={(dates) => {
                      const from = dates?.[0]?.format('YYYY-MM-DD') ?? '';
                      const to = dates?.[1]?.format('YYYY-MM-DD') ?? '';
                      if (!isValidBirthRange(from, to)) {
                        setDateRangeError('Ngày sinh bắt đầu phải trước hoặc bằng ngày kết thúc.');
                        return;
                      }
                      setDateRangeError(null);
                      updateFilter({ birthFrom: from, birthTo: to });
                    }}
                  />
                  {dateRangeError && <span className="member-field-error" role="alert">{dateRangeError}</span>}
                </div>
                <Input aria-label="Tìm theo sách đã mượn" placeholder="Tên, mã hoặc ISBN sách" value={draftFilters.book} onChange={(event) => applyTextFilter('book', event.target.value)} />
                <Select aria-label="Trạng thái sách đã mượn" value={draftFilters.borrowStatus} options={[
                  { value: 'ALL', label: 'Tất cả trạng thái mượn' },
                  { value: 'BORROWED', label: 'Đang mượn' },
                  { value: 'RETURNED', label: 'Đã trả' },
                ]} onChange={(borrowStatus) => updateFilter({ borrowStatus })} />
                <Select aria-label="Trạng thái xác minh email" value={draftFilters.emailVerified} options={[
                  { value: 'all', label: 'Mọi trạng thái xác minh' },
                  { value: 'true', label: 'Đã xác minh email' },
                  { value: 'false', label: 'Chưa xác minh email' },
                ]} onChange={(emailVerified) => updateFilter({ emailVerified })} />
                <Select aria-label="Trạng thái tài khoản" value={draftFilters.enabled} options={[
                  { value: 'all', label: 'Mọi trạng thái tài khoản' },
                  { value: 'true', label: 'Đang hoạt động' },
                  { value: 'false', label: 'Đã khóa' },
                ]} onChange={(enabled) => updateFilter({ enabled })} />
              </div>,
            }]}
          />
          <div className="member-filter-actions"><Button onClick={clearAll}>Xóa tất cả bộ lọc</Button></div>
        </section>

        {error && <Alert
          className="member-alert"
          type="error"
          showIcon
          role="alert"
          title="Không thể tải danh sách thành viên."
          action={<Button onClick={() => setReloadKey((previous) => previous + 1)}>Thử lại</Button>}
        />}

        <div className="member-table-wrap" aria-busy={loading}>
          <Table<MemberListItem>
            rowKey="id"
            columns={columns}
            dataSource={result?.content ?? []}
            pagination={false}
            loading={loading ? { indicator: <Spin aria-label="Đang tải danh sách thành viên" /> } : false}
            onChange={onTableChange}
            locale={{ emptyText: error ? 'Không thể tải dữ liệu. Hãy thử lại.' : 'Không có thành viên phù hợp.' }}
            sortDirections={['ascend', 'descend', 'ascend']}
            showSorterTooltip={false}
          />
        </div>
        {result && result.totalElements > 0 && <div className="member-pagination-row">
          <span role="status">Tổng số {result.totalElements} thành viên</span>
          <Pagination
            aria-label="Phân trang danh sách thành viên"
            current={viewState.page}
            pageSize={PAGE_SIZE}
            total={result.totalElements}
            showSizeChanger={false}
            onChange={(page) => {
              setViewState((previous) => ({ ...previous, page }));
              setAppliedState((previous) => ({ ...previous, page }));
            }}
          />
        </div>}
      </section>
      {createModalOpen && <MemberCreateModal
        onCancel={() => setCreateModalOpen(false)}
        onCreated={() => setReloadKey((previous) => previous + 1)}
      />}
    </main>
  );
}
