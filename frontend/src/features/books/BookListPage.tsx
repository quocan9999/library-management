import { Alert, Button, Collapse, DatePicker, Input, Pagination, Select, Spin, Table } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePermission } from '../../auth/permissions';
import { bookApi } from './api';
import { BookFormModal } from './BookFormModal';
import { BookImportModal } from './BookImportModal';
import { formatVnd } from './formatting';
import type { BookListItem, BookListQuery, PageResponse } from './types';

const PAGE_SIZE = 10;
const DEFAULT_SORT = 'createdAt,desc';
const { RangePicker } = DatePicker;

interface BookFilters {
  publisher: string;
  publishedFrom: string;
  publishedTo: string;
  availability: 'ALL' | 'AVAILABLE' | 'UNAVAILABLE';
}

const EMPTY_FILTERS: BookFilters = {
  publisher: '',
  publishedFrom: '',
  publishedTo: '',
  availability: 'ALL',
};

function asDayjs(value: string): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY') : '—';
}

function buildQuery(q: string, filters: BookFilters, page: number, sort: string): BookListQuery {
  return {
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(filters.publisher.trim() ? { publisher: filters.publisher.trim() } : {}),
    ...(filters.publishedFrom ? { publishedFrom: filters.publishedFrom } : {}),
    ...(filters.publishedTo ? { publishedTo: filters.publishedTo } : {}),
    ...(filters.availability !== 'ALL' ? { availability: filters.availability } : {}),
    page: page - 1,
    size: PAGE_SIZE,
    sort,
  };
}

export function BookListPage() {
  const canCreate = usePermission('book:create');
  const canImport = usePermission('book:import');
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [draftQ, setDraftQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [draftFilters, setDraftFilters] = useState<BookFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<BookFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [dateError, setDateError] = useState<string | null>(null);
  const [resultState, setResultState] = useState<{ key: string; data: PageResponse<BookListItem> } | null>(null);
  const [requestState, setRequestState] = useState<{ key: string; failed: boolean } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const debounceTimer = useRef<number | undefined>(undefined);
  const publisherTimer = useRef<number | undefined>(undefined);

  const query = useMemo(() => buildQuery(appliedQ, appliedFilters, page, sort), [appliedQ, appliedFilters, page, sort]);
  const requestKey = `${JSON.stringify(query)}:${reloadKey}`;
  const loading = requestState?.key !== requestKey;
  const failed = requestState?.key === requestKey && requestState.failed;
  const result = resultState?.key === requestKey ? resultState.data : null;

  useEffect(() => () => {
    if (debounceTimer.current !== undefined) window.clearTimeout(debounceTimer.current);
    if (publisherTimer.current !== undefined) window.clearTimeout(publisherTimer.current);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void bookApi.getBooks(query, controller.signal)
      .then((data) => {
        if (current) {
          setResultState({ key: requestKey, data });
          setRequestState({ key: requestKey, failed: false });
        }
      })
      .catch(() => {
        if (current) setRequestState({ key: requestKey, failed: true });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [query, requestKey]);

  /** Search waits for typing to settle; the effect aborts old in-flight requests and ignores late responses. */
  const changeQuickSearch = useCallback((value: string) => {
    setDraftQ(value);
    if (debounceTimer.current !== undefined) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      setAppliedQ(value);
      setPage(1);
      debounceTimer.current = undefined;
    }, 450);
  }, []);

  const changePublisher = (publisher: string) => {
    setDraftFilters((filters) => ({ ...filters, publisher }));
    if (publisherTimer.current !== undefined) window.clearTimeout(publisherTimer.current);
    publisherTimer.current = window.setTimeout(() => {
      setAppliedFilters((filters) => ({ ...filters, publisher }));
      setPage(1);
      publisherTimer.current = undefined;
    }, 450);
  };

  const changeFilters = (changes: Partial<Omit<BookFilters, 'publisher'>>) => {
    const nextFilters = { ...draftFilters, ...changes };
    setDraftFilters(nextFilters);
    if (nextFilters.publishedFrom && nextFilters.publishedTo
      && nextFilters.publishedFrom > nextFilters.publishedTo) {
      setDateError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
      return;
    }
    setDateError(null);
    setAppliedFilters((filters) => ({ ...filters, ...changes }));
    setPage(1);
  };

  const clearFilters = () => {
    if (debounceTimer.current !== undefined) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = undefined;
    if (publisherTimer.current !== undefined) window.clearTimeout(publisherTimer.current);
    publisherTimer.current = undefined;
    setDraftQ('');
    setAppliedQ('');
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
    setSort(DEFAULT_SORT);
    setDateError(null);
  };

  const onTableChange: TableProps<BookListItem>['onChange'] = (_pagination, _filters, sorter) => {
    const selected = Array.isArray(sorter) ? sorter[0] : sorter;
    const field = typeof selected.field === 'string' ? selected.field : '';
    const direction = selected.order === 'ascend' ? 'asc' : selected.order === 'descend' ? 'desc' : '';
    const supported = ['bookCode', 'isbn', 'title', 'author', 'publisher', 'publishedDate', 'totalQuantity', 'availableQuantity', 'borrowFee', 'lateFeePerDay', 'createdAt', 'updatedAt'];
    setSort(supported.includes(field) && direction ? `${field},${direction}` : DEFAULT_SORT);
    setPage(1);
  };

  const sortOrder = (field: string) => sort === `${field},asc` ? 'ascend' as const : sort === `${field},desc` ? 'descend' as const : null;

  const columns: TableColumnsType<BookListItem> = [
    { title: 'Mã sách', dataIndex: 'bookCode', key: 'bookCode', sorter: true, sortOrder: sortOrder('bookCode'), width: 120 },
    { title: 'Tên sách', dataIndex: 'title', key: 'title', sorter: true, sortOrder: sortOrder('title'), render: (value: string) => <strong>{value}</strong> },
    { title: 'Tác giả', dataIndex: 'author', key: 'author', sorter: true, sortOrder: sortOrder('author'), width: 180 },
    { title: 'Nhà xuất bản', dataIndex: 'publisher', key: 'publisher', sorter: true, sortOrder: sortOrder('publisher'), render: (value: string | null) => value || '—', width: 180 },
    { title: 'ISBN', dataIndex: 'isbn', key: 'isbn', sorter: true, sortOrder: sortOrder('isbn'), render: (value: string | null) => value || '—', width: 155 },
    { title: 'Sẵn có / Tổng', key: 'quantity', render: (_value, book) => `${book.availableQuantity} / ${book.totalQuantity}`, width: 130 },
    { title: 'Phí mượn', dataIndex: 'borrowFee', key: 'borrowFee', sorter: true, sortOrder: sortOrder('borrowFee'), align: 'right', render: formatVnd, width: 135 },
    { title: 'Phí trễ/ngày', dataIndex: 'lateFeePerDay', key: 'lateFeePerDay', sorter: true, sortOrder: sortOrder('lateFeePerDay'), align: 'right', render: formatVnd, width: 145 },
    { title: 'Cập nhật', dataIndex: 'updatedAt', key: 'updatedAt', sorter: true, sortOrder: sortOrder('updatedAt'), render: formatDate, width: 125 },
    { title: 'Thao tác', key: 'action', render: (_value, book) => <Link to={`/admin/books/${book.id}`} aria-label={`Xem chi tiết ${book.bookCode}`}>Chi tiết</Link>, width: 100 },
  ];

  const dateRange: [Dayjs | null, Dayjs | null] = [asDayjs(draftFilters.publishedFrom), asDayjs(draftFilters.publishedTo)];

  return (
    <main className="role-stage member-stage">
      <section className="role-workspace member-workspace book-workspace" aria-labelledby="book-list-title">
        <div className="role-heading">
          <div>
            <p className="role-eyebrow">QUẢN TRỊ KHO SÁCH</p>
            <h1 id="book-list-title">Quản lý sách</h1>
            <p className="role-intro">Tra cứu thông tin xuất bản, số lượng và mức phí mượn.</p>
          </div>
          <div className="book-toolbar-actions">
            {canImport && <Button onClick={() => setImportOpen(true)}>Nhập CSV</Button>}
            {canCreate && <Button type="primary" onClick={() => setCreateOpen(true)}>Thêm sách</Button>}
          </div>
        </div>

        <section className="member-filter-panel" aria-label="Bộ lọc sách">
          <Input.Search
            aria-label="Tìm sách"
            placeholder="Tìm theo mã, ISBN, tên sách hoặc tác giả"
            value={draftQ}
            onChange={(event) => changeQuickSearch(event.target.value)}
            allowClear
          />
          <Collapse ghost items={[{
            key: 'advanced',
            label: 'Bộ lọc nâng cao',
            children: <div className="book-filter-grid">
              <div className="member-filter-field">
                <label htmlFor="book-publisher-filter">Nhà xuất bản</label>
                <Input id="book-publisher-filter" aria-label="Nhà xuất bản" placeholder="Nhà xuất bản" value={draftFilters.publisher} onChange={(event) => changePublisher(event.target.value)} />
              </div>
              <div className="member-filter-field">
                <label htmlFor="book-published-range">Ngày xuất bản</label>
                <RangePicker
                  id="book-published-range"
                  aria-label="Khoảng ngày xuất bản"
                  format="DD/MM/YYYY"
                  placeholder={['Từ ngày', 'Đến ngày']}
                  value={dateRange}
                  onChange={(dates) => {
                    changeFilters({
                      publishedFrom: dates?.[0]?.format('YYYY-MM-DD') ?? '',
                      publishedTo: dates?.[1]?.format('YYYY-MM-DD') ?? '',
                    });
                  }}
                />
                {dateError && <span className="member-field-error" role="alert">{dateError}</span>}
              </div>
              <Select
                aria-label="Tình trạng sẵn có"
                value={draftFilters.availability}
                options={[
                  { value: 'ALL', label: 'Tất cả tình trạng' },
                  { value: 'AVAILABLE', label: 'Còn sách' },
                  { value: 'UNAVAILABLE', label: 'Hết sách' },
                ]}
                onChange={(availability: BookFilters['availability']) => changeFilters({ availability })}
              />
              <div className="book-filter-actions">
                <Button onClick={clearFilters}>Xóa bộ lọc</Button>
              </div>
            </div>,
          }]} />
        </section>

        {failed && <Alert
          className="book-alert"
          type="error"
          showIcon
          role="alert"
          title="Không thể tải danh sách sách."
          action={<Button onClick={() => setReloadKey((key) => key + 1)}>Thử lại</Button>}
        />}
        <div className="member-table-wrap" aria-busy={loading}>
          <Table<BookListItem>
            rowKey="id"
            columns={columns}
            dataSource={result?.content ?? []}
            pagination={false}
            loading={loading ? { indicator: <Spin aria-label="Đang tải danh sách sách" /> } : false}
            onChange={onTableChange}
            locale={{ emptyText: failed ? 'Không thể tải dữ liệu. Hãy thử lại.' : 'Không có sách phù hợp.' }}
            sortDirections={['ascend', 'descend', 'ascend']}
            showSorterTooltip={false}
          />
        </div>
        {result && result.totalElements > 0 && <div className="member-pagination-row">
          <span role="status">Tổng số {result.totalElements} sách</span>
          <Pagination
            aria-label="Phân trang danh sách sách"
            current={page}
            pageSize={PAGE_SIZE}
            total={result.totalElements}
            showSizeChanger={false}
            onChange={setPage}
          />
        </div>}
      </section>
      {createOpen && <BookFormModal onCancel={() => setCreateOpen(false)} onSaved={() => setReloadKey((key) => key + 1)} />}
      {importOpen && <BookImportModal onCancel={() => setImportOpen(false)} onImported={() => setReloadKey((key) => key + 1)} />}
    </main>
  );
}
