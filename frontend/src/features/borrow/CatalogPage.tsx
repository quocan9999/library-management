import { Alert, Button, Card, Input, Pagination, Select, Skeleton } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { borrowApi } from './api';
import { BorrowBookAction } from './BorrowBookAction';
import { borrowErrorMessage } from './errors';
import { formatVnd } from '../books/formatting';
import type { BorrowListQuery, CatalogBook, PageResponse } from './types';

const PAGE_SIZE = 12;

export function CatalogPage() {
  const [searchDraft, setSearchDraft] = useState('');
  const [queryText, setQueryText] = useState('');
  const [availability, setAvailability] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE'>('ALL');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; data: PageResponse<CatalogBook> } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);

  const query = useMemo<BorrowListQuery>(() => ({
    ...(queryText ? { q: queryText } : {}),
    ...(availability === 'ALL' ? {} : { availability }),
    page: page - 1,
    size: PAGE_SIZE,
    sort: 'title,asc',
  }), [availability, page, queryText]);
  const requestKey = `${JSON.stringify(query)}:${reloadKey}`;
  const result = loaded?.key === requestKey ? loaded.data : null;
  const loadError = failed?.key === requestKey ? failed.message : '';
  const loadState = result ? 'ready' : loadError ? 'error' : 'loading';

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void borrowApi.listCatalog(query, controller.signal)
      .then((data) => {
        if (!current) return;
        setLoaded({ key: requestKey, data });
      })
      .catch((error: unknown) => {
        if (!current) return;
        setFailed({ key: requestKey, message: borrowErrorMessage(error, 'read') });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [query, requestKey]);

  const applySearch = (value: string) => {
    setQueryText(value.trim());
    setPage(1);
  };

  return <main className="borrow-stage" aria-labelledby="catalog-heading">
    <header className="borrow-heading">
      <div>
        <p className="role-eyebrow">DANH MỤC THƯ VIỆN</p>
        <h1 id="catalog-heading">Khám phá sách</h1>
        <p className="role-intro">Tra cứu tình trạng bản sách, phí mượn và sức chứa hàng chờ hiện tại.</p>
      </div>
      <div className="borrow-heading-actions">
        <Button onClick={() => setReloadKey((key) => key + 1)}>Tải lại</Button>
        <Link className="member-back-link" to="/my-loans">Sách của tôi</Link>
      </div>
    </header>

    <section className="borrow-toolbar" aria-label="Tìm sách">
      <Input.Search
        aria-label="Tìm sách"
        placeholder="Tên sách, tác giả hoặc mã sách"
        value={searchDraft}
        onChange={(event) => setSearchDraft(event.target.value)}
        onSearch={applySearch}
        allowClear
      />
      <Select
        aria-label="Lọc tình trạng sách"
        value={availability}
        onChange={(value: 'ALL' | 'AVAILABLE' | 'UNAVAILABLE') => { setAvailability(value); setPage(1); }}
        options={[
          { value: 'ALL', label: 'Mọi tình trạng' },
          { value: 'AVAILABLE', label: 'Còn bản để mượn' },
          { value: 'UNAVAILABLE', label: 'Đang hết bản' },
        ]}
      />
    </section>

    {loadState === 'loading' && <div className="borrow-loading" role="status"><Skeleton active paragraph={{ rows: 3 }} /><Skeleton active paragraph={{ rows: 3 }} /></div>}
    {loadState === 'error' && <Alert
      className="borrow-page-alert"
      type="error"
      showIcon
      role="alert"
      title={loadError}
      action={<Button onClick={() => setReloadKey((key) => key + 1)}>Tải lại</Button>}
    />}
    {loadState === 'ready' && result?.content.length === 0 && <section className="borrow-empty" aria-live="polite">
      <h2>Chưa tìm thấy sách phù hợp</h2>
      <p>Thử một từ khóa khác hoặc xóa bộ lọc tình trạng.</p>
    </section>}
    {loadState === 'ready' && result && result.content.length > 0 && <>
      <section className="catalog-grid" aria-label="Sách trong danh mục">
        {result.content.map((book) => <Card key={book.id} className="catalog-card" data-catalog-book={book.id}>
          <Link className="catalog-card__cover" to={`/books/${book.id}`} aria-label={`Xem chi tiết ${book.title}`}>
            {book.coverImageUrl
              ? <img src={book.coverImageUrl} alt={`Bìa sách ${book.title}`} loading="lazy" />
              : <span aria-hidden="true">SÁCH</span>}
          </Link>
          <div className="catalog-card__body">
            <Link className="catalog-card__title" to={`/books/${book.id}`}>{book.title}</Link>
            <p className="catalog-card__author">{book.author}</p>
            <dl className="catalog-card__facts">
              <div><dt>Mã sách</dt><dd>{book.bookCode}</dd></div>
              <div><dt>Còn bản</dt><dd>{book.availableQuantity} / {book.totalQuantity}</dd></div>
              <div><dt>Phí mượn</dt><dd>{formatVnd(book.borrowFee)}</dd></div>
              <div><dt>Phí trễ mỗi ngày</dt><dd>{formatVnd(book.lateFeePerDay)}</dd></div>
            </dl>
            {book.availableQuantity === 0 && <p className="catalog-card__queue">Hàng chờ: {book.waitlistCount} / {book.waitlistCap}</p>}
            <BorrowBookAction key={`${book.id}-${book.availableQuantity}-${book.waitlistCount}`} book={book} onCreated={() => setReloadKey((key) => key + 1)} />
          </div>
        </Card>)}
      </section>
      {result.totalPages > 1 && <Pagination
        className="borrow-pagination"
        current={page}
        pageSize={PAGE_SIZE}
        total={result.totalElements}
        showSizeChanger={false}
        onChange={setPage}
        aria-label="Trang danh mục sách"
      />}
    </>}
  </main>;
}

export function CatalogDetailPage() {
  const { id: idParam } = useParams();
  const [detail, setDetail] = useState<{ key: string; book: CatalogBook } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const id = Number(idParam);
  const validId = Number.isSafeInteger(id) && id > 0;
  const requestKey = `${idParam ?? ''}:${reloadKey}`;
  const book = detail?.key === requestKey ? detail.book : null;
  const errorMessage = validId ? failure?.key === requestKey ? failure.message : '' : 'Mã sách không hợp lệ.';
  const state = book ? 'ready' : errorMessage ? 'error' : 'loading';

  useEffect(() => {
    if (!validId) return undefined;
    const controller = new AbortController();
    let current = true;
    void borrowApi.getCatalogBook(id, controller.signal)
      .then((data) => { if (current) setDetail({ key: requestKey, book: data }); })
      .catch((error: unknown) => { if (current) setFailure({ key: requestKey, message: borrowErrorMessage(error, 'read') }); });
    return () => { current = false; controller.abort(); };
  }, [id, requestKey, validId]);

  return <main className="borrow-stage" aria-labelledby="catalog-detail-heading">
    <Link className="member-back-link" to="/books">Quay lại danh mục</Link>
    {state === 'loading' && <div className="borrow-loading" role="status"><Skeleton active paragraph={{ rows: 4 }} /></div>}
    {state === 'error' && <Alert type="error" showIcon role="alert" title={errorMessage} action={validId ? <Button onClick={() => setReloadKey((key) => key + 1)}>Tải lại</Button> : undefined} />}
    {state === 'ready' && book && <section className="catalog-detail" aria-labelledby="catalog-detail-heading">
      <div className="catalog-detail__cover">
        {book.coverImageUrl ? <img src={book.coverImageUrl} alt={`Bìa sách ${book.title}`} /> : <span aria-hidden="true">SÁCH</span>}
      </div>
      <div className="catalog-detail__body">
        <p className="role-eyebrow">{book.bookCode}</p>
        <h1 id="catalog-detail-heading">{book.title}</h1>
        <p className="catalog-card__author">{book.author}</p>
        <p>{book.publisher || 'Chưa có thông tin nhà xuất bản'}{book.publishedDate ? ` · ${book.publishedDate}` : ''}</p>
        <dl className="catalog-card__facts">
          <div><dt>Bản sẵn có / tổng số</dt><dd>{book.availableQuantity} / {book.totalQuantity}</dd></div>
          <div><dt>Phí mượn</dt><dd>{formatVnd(book.borrowFee)}</dd></div>
          <div><dt>Phí trễ mỗi ngày</dt><dd>{formatVnd(book.lateFeePerDay)}</dd></div>
          <div><dt>Hàng chờ</dt><dd>{book.waitlistCount} / {book.waitlistCap}</dd></div>
        </dl>
        <BorrowBookAction book={book} />
      </div>
    </section>}
  </main>;
}
