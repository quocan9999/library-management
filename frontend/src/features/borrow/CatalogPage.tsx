import { Alert, Button, Modal, Pagination, Skeleton } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BORROW_PAGE_SIZE, borrowApi } from './api';
import { BorrowBookAction } from './BorrowBookAction';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { borrowErrorMessage, borrowErrorNotificationType } from './errors';
import { formatVnd } from '../books/formatting';
import type { BorrowListQuery, CatalogBook, PageResponse } from './types';
import {
  UserBookCard,
  UserButton,
  UserFilterChips,
  useUserCart,
  type UserBookCardItem,
  type UserCartItem,
} from '../../components/user';

const AVAILABILITY_CHIPS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'AVAILABLE', label: 'Còn sách' },
  { value: 'UNAVAILABLE', label: 'Hết sách' },
];

export function CatalogPage() {
  const navigate = useNavigate();
  const { notify } = useAppNotification();
  const { cartItems, addToCart, openCart } = useUserCart();

  const [searchDraft, setSearchDraft] = useState('');
  const [queryText, setQueryText] = useState('');
  const [availability, setAvailability] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE'>('ALL');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [loaded, setLoaded] = useState<{ key: string; data: PageResponse<CatalogBook> } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);

  // Waitlist confirmation modal
  const [waitlistBook, setWaitlistBook] = useState<CatalogBook | null>(null);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const waitlistLockRef = useRef(false);

  // Debounce timer for search
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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
        if (controller.signal.aborted) return;
        setFailed({ key: requestKey, message: borrowErrorMessage(error, 'read') });
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [query, requestKey]);

  // Handle typing in search input with 400ms debounce
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = event.target.value;
    setSearchDraft(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const trimmed = val.trim();
      if (trimmed !== queryText) {
        setQueryText(trimmed);
        setPage(1);
      }
    }, 400);
  };

  // Handle Enter key for immediate search
  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      const trimmed = searchDraft.trim();
      if (trimmed !== queryText) {
        setQueryText(trimmed);
        setPage(1);
      }
    }
  };

  // Handle clear button
  const handleClearSearch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSearchDraft('');
    if (queryText !== '') {
      setQueryText('');
      setPage(1);
    }
  };

  // Handle filter chip change
  const handleAvailabilityChange = (val: string) => {
    setAvailability(val as 'ALL' | 'AVAILABLE' | 'UNAVAILABLE');
    setPage(1);
  };

  // Reset filters
  const handleResetFilters = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSearchDraft('');
    setQueryText('');
    setAvailability('ALL');
    setPage(1);
  };

  // Handle book card action button
  const handleBookAction = (book: CatalogBook) => {
    if (book.availableQuantity > 0) {
      const cartItem: UserCartItem = {
        id: book.id,
        title: book.title,
        borrowFee: book.borrowFee,
        coverImageUrl: book.coverImageUrl,
        bookCode: book.bookCode,
      };
      addToCart(cartItem);
    } else {
      setWaitlistBook(book);
    }
  };

  // Submit waitlist request
  const submitWaitlist = async (book: CatalogBook) => {
    if (waitlistLockRef.current) return;
    waitlistLockRef.current = true;
    setWaitlistSubmitting(true);
    try {
      const created = await borrowApi.createRequest([book.id]);
      setWaitlistBook(null);
      navigate(`/borrow-payment/${encodeURIComponent(created.loanCode)}`);
    } catch (error: unknown) {
      notify(borrowErrorNotificationType(error), {
        title: 'Không thể vào hàng chờ',
        description: borrowErrorMessage(error, 'create'),
      });
    } finally {
      waitlistLockRef.current = false;
      setWaitlistSubmitting(false);
    }
  };

  return (
    <div className="user-catalog-page">
      {/* 1. Tiêu đề trang */}
      <div className="user-catalog-header">
        <h1 className="user-title-display-64">Khám phá sách</h1>
        <p className="user-subtitle">
          Tra cứu tình trạng bản sách, phí mượn và hàng chờ hiện tại.
        </p>
      </div>

      {/* 2. Thanh công cụ */}
      <div className="user-catalog-toolbar">
        {/* Hàng 1: Ô tìm kiếm pill với nút xóa tròn */}
        <div className="user-catalog-search-wrapper">
          <input
            type="search"
            aria-label="Tìm sách"
            className="user-search-input"
            placeholder="Tên sách, tác giả hoặc mã sách"
            value={searchDraft}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
          />
          {searchDraft.length > 0 && (
            <button
              type="button"
              className="user-search-clear-btn user-pressable"
              aria-label="Xóa từ khóa"
              onClick={handleClearSearch}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Hàng 2: Bộ lọc tình trạng bằng chip */}
        <UserFilterChips
          ariaLabel="Lọc sách theo tình trạng"
          options={AVAILABILITY_CHIPS}
          value={availability}
          onChange={handleAvailabilityChange}
        />
      </div>

      {/* 3. Các trạng thái giao diện */}
      {/* Đang tải: 8 ô skeleton phẳng */}
      {loadState === 'loading' && (
        <section className="user-catalog-grid" role="status" aria-label="Đang tải danh sách sách">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="user-book-skeleton" />
          ))}
        </section>
      )}

      {/* Lỗi tải */}
      {loadState === 'error' && (
        <section
          className="user-card"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '48px',
          }}
          role="alert"
        >
          <h2 className="user-title-24" style={{ margin: 0 }}>
            Không tải được danh sách sách
          </h2>
          <p
            className="user-subtitle"
            style={{ margin: 0, fontSize: '16px', color: 'var(--user-error-text)' }}
          >
            {loadError || 'Đã có lỗi xảy ra trong quá trình tải dữ liệu.'}
          </p>
          <div style={{ marginTop: '12px' }}>
            <UserButton variant="primary" onClick={() => setReloadKey((k) => k + 1)}>
              Thử lại
            </UserButton>
          </div>
        </section>
      )}

      {/* Không có kết quả */}
      {loadState === 'ready' && result?.content.length === 0 && (
        <section
          className="user-card"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '48px',
          }}
          aria-live="polite"
        >
          <h2 className="user-title-24" style={{ margin: 0 }}>
            Không tìm thấy sách phù hợp
          </h2>
          <p className="user-subtitle" style={{ margin: 0, fontSize: '16px' }}>
            Thử đổi từ khóa hoặc bỏ bộ lọc tình trạng.
          </p>
          <div style={{ marginTop: '12px' }}>
            <UserButton variant="outline" onClick={handleResetFilters}>
              Xóa bộ lọc
            </UserButton>
          </div>
        </section>
      )}

      {/* Sẵn sàng: Lưới sách */}
      {loadState === 'ready' && result && result.content.length > 0 && (
        <>
          <section className="user-catalog-grid" aria-label="Sách trong danh mục">
            {result.content.map((book, index) => {
              const isInCart = cartItems.some((ci) => String(ci.id) === String(book.id));
              const bookCardItem: UserBookCardItem = {
                id: book.id,
                bookCode: book.bookCode,
                title: book.title,
                author: book.author,
                coverImageUrl: book.coverImageUrl,
                borrowFee: book.borrowFee,
                lateFeePerDay: book.lateFeePerDay,
                availableQuantity: book.availableQuantity,
                totalQuantity: book.totalQuantity,
                waitlistCount: book.waitlistCount,
                maxWaitlistSlots: book.waitlistCap,
              };

              return (
                <UserBookCard
                  key={book.id}
                  book={bookCardItem}
                  themeIndex={index}
                  isInCart={isInCart}
                  onOpenCart={openCart}
                  onClickTitle={() => navigate(`/books/${book.id}`)}
                  onAction={() => handleBookAction(book)}
                />
              );
            })}
          </section>

          {result.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '48px' }}>
              <Pagination
                current={page}
                pageSize={BORROW_PAGE_SIZE}
                total={result.totalElements}
                showSizeChanger={false}
                onChange={setPage}
                aria-label="Trang danh mục sách"
              />
            </div>
          )}
        </>
      )}

      {/* Modal xác nhận vào hàng chờ */}
      <Modal
        open={Boolean(waitlistBook)}
        centered
        title="Xác nhận vào hàng chờ"
        okText={waitlistSubmitting ? 'Đang gửi…' : 'Xác nhận vào hàng chờ'}
        cancelText="Hủy"
        confirmLoading={waitlistSubmitting}
        onCancel={() => {
          if (!waitlistSubmitting) setWaitlistBook(null);
        }}
        onOk={() => {
          if (waitlistBook) {
            void submitWaitlist(waitlistBook);
          }
        }}
      >
        {waitlistBook && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ margin: 0 }}>
              <strong>{waitlistBook.title}</strong> · {waitlistBook.author}
            </p>
            <p style={{ margin: 0 }}>
              Phí mượn: {formatVnd(waitlistBook.borrowFee)}
            </p>
            <p style={{ margin: 0 }}>
              Hiện có {waitlistBook.waitlistCount} người trong hàng chờ; sức chứa tối đa {waitlistBook.waitlistCap}.
            </p>
            <p style={{ margin: 0, color: 'var(--user-text-muted)', fontSize: '13px' }}>
              Chỉ xác nhận thành công khi máy chủ trả kết quả. Khi có sách, bạn sẽ nhận được thông báo để tới nhận sách.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
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
