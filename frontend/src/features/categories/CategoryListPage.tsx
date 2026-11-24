import { Alert, Button, Input, Pagination, Popconfirm, Spin, Table } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import dayjs from 'dayjs';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiEnvelope } from '../../auth/types';
import { isMaintenanceError, MAINTENANCE_MESSAGE, MAINTENANCE_TITLE } from '../../auth/messages';
import { usePermission } from '../../auth/permissions';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { categoryApi } from './api';
import { CategoryFormModal } from './CategoryFormModal';
import type { Category, CategoryListQuery, PageResponse } from './types';

const PAGE_SIZE = 10;
const DEFAULT_SORT = 'createdAt,desc';

function formatDate(value: string): string {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : '—';
}

function buildQuery(q: string, page: number, sort: string): CategoryListQuery {
  return {
    ...(q.trim() ? { q: q.trim() } : {}),
    page: page - 1,
    size: PAGE_SIZE,
    sort,
  };
}

const SORT_FIELDS = ['name', 'createdAt', 'updatedAt'];

/** Trang quản trị danh mục sách: bảng phân trang, tạo, sửa và xóa (chặn khi còn sách). */
export function CategoryListPage() {
  const canCreate = usePermission('category:create');
  const canUpdate = usePermission('category:update');
  const canDelete = usePermission('category:delete');
  const { notify } = useAppNotification();
  const [draftQ, setDraftQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [editing, setEditing] = useState<Category | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resultState, setResultState] = useState<{ key: string; data: PageResponse<Category> } | null>(null);
  const [requestState, setRequestState] = useState<{ key: string; failed: boolean; isMaintenance?: boolean } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const debounceTimer = useRef<number | undefined>(undefined);

  const query = useMemo(() => buildQuery(appliedQ, page, sort), [appliedQ, page, sort]);
  const requestKey = `${JSON.stringify(query)}:${reloadKey}`;
  const loading = requestState?.key !== requestKey;
  const failed = requestState?.key === requestKey && requestState.failed;
  const result = resultState?.key === requestKey ? resultState.data : null;

  useEffect(() => () => {
    if (debounceTimer.current !== undefined) window.clearTimeout(debounceTimer.current);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void categoryApi.getCategories(query, controller.signal)
      .then((data) => {
        if (current) {
          setResultState({ key: requestKey, data });
          setRequestState({ key: requestKey, failed: false });
        }
      })
      .catch((err: unknown) => {
        if (current) setRequestState({ key: requestKey, failed: true, isMaintenance: isMaintenanceError(err) });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [query, requestKey]);

  /** Search chờ người dùng dừng gõ; effect hủy request cũ đang bay và bỏ qua phản hồi đến muộn. */
  const changeQuickSearch = useCallback((value: string) => {
    setDraftQ(value);
    if (debounceTimer.current !== undefined) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      setAppliedQ(value);
      setPage(1);
      debounceTimer.current = undefined;
    }, 450);
  }, []);

  const onTableChange: TableProps<Category>['onChange'] = (_pagination, _filters, sorter) => {
    const selected = Array.isArray(sorter) ? sorter[0] : sorter;
    const field = typeof selected.field === 'string' ? selected.field : '';
    const direction = selected.order === 'ascend' ? 'asc' : selected.order === 'descend' ? 'desc' : '';
    setSort(SORT_FIELDS.includes(field) && direction ? `${field},${direction}` : DEFAULT_SORT);
    setPage(1);
  };

  const sortOrder = (field: string) => sort === `${field},asc` ? 'ascend' as const : sort === `${field},desc` ? 'descend' as const : null;

  const deleteCategory = async (category: Category) => {
    setDeleting(true);
    try {
      await categoryApi.deleteCategory(category.id);
      notify('success', { title: 'Đã xóa danh mục', description: category.name });
      setReloadKey((key) => key + 1);
    } catch (err: unknown) {
      const body = axios.isAxiosError<ApiEnvelope<unknown>>(err) ? err.response?.data : null;
      const message = body?.code === 'CATEGORY_HAS_BOOKS'
        ? 'Danh mục đang có sách tham chiếu, không thể xóa.'
        : 'Không thể xóa danh mục lúc này. Hãy thử lại.';
      notify('error', { title: 'Xóa danh mục thất bại', description: message });
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumnsType<Category> = [
    { title: 'Tên danh mục', dataIndex: 'name', key: 'name', sorter: true, sortOrder: sortOrder('name'), render: (value: string) => <strong>{value}</strong> },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', render: (value: string | null) => value || '—' },
    { title: 'Số sách', dataIndex: 'bookCount', key: 'bookCount', align: 'right', width: 110 },
    { title: 'Tạo lúc', dataIndex: 'createdAt', key: 'createdAt', sorter: true, sortOrder: sortOrder('createdAt'), render: formatDate, width: 165 },
    { title: 'Cập nhật', dataIndex: 'updatedAt', key: 'updatedAt', sorter: true, sortOrder: sortOrder('updatedAt'), render: formatDate, width: 165 },
    { title: 'Thao tác', key: 'action', width: 160, render: (_value, category) => (
      <div className="category-action-row">
        {canUpdate && <Button size="small" onClick={() => setEditing(category)}>Sửa</Button>}
        {canDelete && <Popconfirm
          title="Xóa danh mục này?"
          description="Chỉ xóa được danh mục chưa gán cho sách nào."
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true, loading: deleting }}
          onConfirm={() => void deleteCategory(category)}
        >
          <Button size="small" danger>Xóa</Button>
        </Popconfirm>}
      </div>
    ) },
  ];

  return (
    <main className="role-stage member-stage">
      <section className="role-workspace member-workspace book-workspace" aria-labelledby="category-list-title">
        <div className="role-heading">
          <div>
            <h1 id="category-list-title">Quản lý danh mục</h1>
            <p className="role-intro">Phân loại sách theo chủ đề, dùng để gán cho sách và lọc danh mục sách.</p>
          </div>
          <div className="book-toolbar-actions">
            {canCreate && <Button type="primary" onClick={() => setCreateOpen(true)}>Thêm danh mục</Button>}
          </div>
        </div>

        <section className="member-filter-panel" aria-label="Bộ lọc danh mục">
          <Input.Search
            aria-label="Tìm danh mục"
            placeholder="Tìm theo tên hoặc mô tả"
            value={draftQ}
            onChange={(event) => changeQuickSearch(event.target.value)}
            allowClear
          />
        </section>

        {failed && <Alert
          className="book-alert"
          type="error"
          showIcon
          role="alert"
          title={requestState?.isMaintenance ? MAINTENANCE_TITLE : 'Không thể tải danh sách danh mục.'}
          description={requestState?.isMaintenance ? MAINTENANCE_MESSAGE : undefined}
          action={<Button onClick={() => setReloadKey((key) => key + 1)}>Thử lại</Button>}
        />}
        <div className="member-table-wrap" aria-busy={loading}>
          <Table<Category>
            rowKey="id"
            columns={columns}
            dataSource={result?.content ?? []}
            pagination={false}
            loading={loading ? { indicator: <Spin aria-label="Đang tải danh sách danh mục" /> } : false}
            onChange={onTableChange}
            locale={{ emptyText: requestState?.isMaintenance ? MAINTENANCE_MESSAGE : (failed ? 'Không thể tải dữ liệu. Hãy thử lại.' : 'Không có danh mục phù hợp.') }}
            sortDirections={['ascend', 'descend', 'ascend']}
            showSorterTooltip={false}
          />
        </div>
        {result && result.totalElements > 0 && <div className="member-pagination-row">
          <span role="status">Tổng số {result.totalElements} danh mục</span>
          <Pagination
            aria-label="Phân trang danh sách danh mục"
            current={page}
            pageSize={PAGE_SIZE}
            total={result.totalElements}
            showSizeChanger={false}
            onChange={setPage}
          />
        </div>}
      </section>
      {createOpen && <CategoryFormModal onCancel={() => setCreateOpen(false)} onSaved={() => setReloadKey((key) => key + 1)} />}
      {editing && <CategoryFormModal category={editing} onCancel={() => setEditing(null)} onSaved={() => setReloadKey((key) => key + 1)} />}
    </main>
  );
}
