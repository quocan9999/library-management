import { Alert, Button, Card, Input, Modal, Pagination, Select, Skeleton, Tag } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BORROW_PAGE_SIZE, MAX_BORROW_BOOKS, borrowApi } from './api';
import { BorrowBookAction } from './BorrowBookAction';
import { BorrowCart } from './BorrowCart';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { borrowErrorMessage, borrowErrorNotificationType } from './errors';
import { formatVnd } from '../books/formatting';
import type { BorrowListQuery, CatalogBook, PageResponse } from './types';

function stockLabel(book: CatalogBook): { label: string; tone: 'available' | 'low' | 'unavailable' } {
  if (book.availableQuantity === 0) return { label: 'Hết sách', tone: 'unavailable' };
  if (book.availableQuantity === 1) return { label: 'Sắp hết · còn 1', tone: 'low' };
  return { label: `Còn ${book.availableQuantity}/${book.totalQuantity}`, tone: 'available' };
}

export function CatalogPage() {
  const navigate = useNavigate();
  const { notify } = useAppNotification();
  const [searchDraft, setSearchDraft] = useState('');
  const [queryText, setQueryText] = useState('');
  const [availability, setAvailability] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE'>('ALL');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; data: PageResponse<CatalogBook> } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const [selectedBooks, setSelectedBooks] = useState<CatalogBook[]>([]);
  const [confirmRequestOpen, setConfirmRequestOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const requestLock = useRef(false);
  const totalBorrowFee = useMemo(() => selectedBooks.reduce((total, book) => total + book.borrowFee, 0), [selectedBooks]);

  const query = useMemo<BorrowListQuery>(() => ({
    ...(queryText ? { q: queryText } : {}),
    ...(availability === 'ALL' ? {} : { availability }),
    page: page - 1,
    size: BORROW_PAGE_SIZE,
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

  const toggleBookSelection = (book: CatalogBook) => {
    if (selectedBooks.length === 1 && selectedBooks[0].id === book.id) setCartDrawerOpen(false);
    setSelectedBooks((current) => {
      if (current.some((selected) => selected.id === book.id)) return current.filter((selected) => selected.id !== book.id);
      if (current.length >= MAX_BORROW_BOOKS) return current;
      return [...current, book];
    });
  };

  const submitBorrowRequest = async () => {
    if (requestLock.current || selectedBooks.length < 1 || selectedBooks.length > MAX_BORROW_BOOKS) return;
    requestLock.current = true;
    setRequestPending(true);
    try {
      const created = await borrowApi.createRequest(selectedBooks.map((book) => book.id));
      setConfirmRequestOpen(false);
      setCartDrawerOpen(false);
      setSelectedBooks([]);
      navigate(`/borrow-payment/${encodeURIComponent(created.loanCode)}`);
    } catch (error: unknown) {
      notify(borrowErrorNotificationType(error), {
        title: 'Không thể tạo yêu cầu mượn',
        description: borrowErrorMessage(error, 'create'),
      });
    } finally {
      requestLock.current = false;
      setRequestPending(false);
    }
  };

  return <main className={`borrow-stage${selectedBooks.length > 0 ? ' borrow-stage--with-cart' : ''}`} aria-labelledby="catalog-heading">
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
        {result.content.map((book) => {
          const selected = selectedBooks.some((selection) => selection.id === book.id);
          const stock = stockLabel(book);
          return <Card
            key={book.id}
            className={`catalog-card${selected ? ' catalog-card--selected' : ''}`}
            data-catalog-book={book.id}
          >
            <Link className="catalog-card__cover" to={`/books/${book.id}`} aria-label={`Xem chi tiết ${book.title}`}>
              {book.coverImageUrl
                ? <img src={book.coverImageUrl} alt={`Bìa sách ${book.title}`} loading="lazy" />
                : <span className="catalog-card__cover-placeholder">{book.title}</span>}
              {selected && <span className="catalog-card__selected-mark" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" focusable="false">
                  <path d="m3.5 8.2 2.8 2.7 6.2-6" />
                </svg>
              </span>}
            </Link>
            <div className="catalog-card__body">
              <Link className="catalog-card__title" to={`/books/${book.id}`}>{book.title}</Link>
              <p className="catalog-card__author">{book.author}</p>
              <div className="catalog-card__price-row">
                <p className="catalog-card__price"><strong>{formatVnd(book.borrowFee)}</strong><span>/lượt</span></p>
                <Tag className={`catalog-stock-tag catalog-stock-tag--${stock.tone}`}>{stock.label}</Tag>
              </div>
              <div className="catalog-card__meta-row">
                <span>{book.bookCode}</span>
                <span>Trễ {formatVnd(book.lateFeePerDay)}/ngày</span>
              </div>
              {book.availableQuantity === 0 && <p className="catalog-card__queue">Hàng chờ: {book.waitlistCount} / {book.waitlistCap}</p>}
              <BorrowBookAction
                key={`${book.id}-${book.availableQuantity}-${book.waitlistCount}`}
                book={book}
                selected={selected}
                selectionDisabled={selectedBooks.length >= MAX_BORROW_BOOKS}
                onToggleSelection={toggleBookSelection}
              />
            </div>
          </Card>;
        })}
      </section>
      {result.totalPages > 1 && <Pagination
        className="borrow-pagination"
        current={page}
        pageSize={BORROW_PAGE_SIZE}
        total={result.totalElements}
        showSizeChanger={false}
        onChange={setPage}
        aria-label="Trang danh mục sách"
      />}
    </>}
    <BorrowCart
      books={selectedBooks}
      maximumBooks={MAX_BORROW_BOOKS}
      totalFee={totalBorrowFee}
      locked={requestPending || confirmRequestOpen}
      drawerOpen={cartDrawerOpen}
      onOpenDrawer={() => setCartDrawerOpen(true)}
      onCloseDrawer={() => setCartDrawerOpen(false)}
      onRemove={toggleBookSelection}
      onSubmit={() => setConfirmRequestOpen(true)}
    />
    <Modal
      open={confirmRequestOpen}
      centered
      title="Xác nhận yêu cầu mượn"
      okText={requestPending ? 'Đang gửi…' : 'Xác nhận đặt mượn'}
      cancelText="Xem lại"
      confirmLoading={requestPending}
      onCancel={() => { if (!requestPending) setConfirmRequestOpen(false); }}
      onOk={() => { void submitBorrowRequest(); }}
    >
      <p>Các sách đã chọn sẽ nằm trong cùng một yêu cầu và dùng chung một mã QR nhận sách.</p>
      <ul className="borrow-selection__items">
        {selectedBooks.map((book) => <li key={book.id}>
          <span><strong>{book.title}</strong> · {formatVnd(book.borrowFee)}</span>
          {book.availableQuantity === 0 && <span>Hàng chờ: {book.waitlistCount} / {book.waitlistCap}</span>}
        </li>)}
      </ul>
      <p>Chỉ xác nhận thành công khi máy chủ trả kết quả. Nếu kết nối hết thời gian chờ, hãy tải danh sách yêu cầu trước khi gửi lại.</p>
    </Modal>
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
