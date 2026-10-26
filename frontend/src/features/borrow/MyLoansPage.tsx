import { Modal, Pagination } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../auth/permissions';
import { useAppNotification } from '../../components/AppNotificationProvider';
import {
  UserBadge,
  type UserBadgeVariant,
  UserBookCover,
  UserButton,
  UserFilterChips,
  type FilterChipOption,
  UserQrModal,
} from '../../components/user';
import { borrowApi } from './api';
import { borrowErrorMessage, borrowErrorNotificationType, borrowErrorStatus } from './errors';
import { formatVnd } from '../books/formatting';
import type { BorrowItem, BorrowRequestFilter, BorrowRequestSummary, LoanItemStatus, PageResponse } from './types';

type LoanFilter = 'ALL' | 'PENDING' | 'READY' | 'BORROWED' | 'CANCELLED' | 'HISTORY';
type LoanAction = { type: 'cancel' | 'renew'; loanCode: string; item: BorrowItem };

const HISTORY_STATUSES: LoanItemStatus[] = ['RETURNED', 'CANCELLED', 'REJECTED', 'EXPIRED'];
const LOAN_FILTERS: FilterChipOption[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'READY', label: 'Sẵn sàng nhận' },
  { value: 'BORROWED', label: 'Đang mượn' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'HISTORY', label: 'Lịch sử' },
];

function filterItem(item: BorrowItem, filter: LoanFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'HISTORY') return HISTORY_STATUSES.includes(item.status);
  if (filter === 'PENDING') return ['RESERVED', 'PREPARING'].includes(item.status);
  if (filter === 'READY') return item.status === 'READY_FOR_PICKUP';
  if (filter === 'CANCELLED') return item.status === 'CANCELLED';
  return item.status === filter;
}

function statusLabel(status: LoanItemStatus): string {
  const labels: Record<LoanItemStatus, string> = {
    RESERVED: 'Đang giữ sách',
    PREPARING: 'Đang chuẩn bị',
    READY_FOR_PICKUP: 'Sẵn sàng nhận',
    BORROWED: 'Đang mượn',
    RETURNED: 'Đã trả',
    CANCELLED: 'Đã hủy',
    REJECTED: 'Không tìm thấy sách',
    EXPIRED: 'Đã hết hạn nhận',
  };
  return labels[status] ?? status;
}

function getItemBadgeVariant(status: LoanItemStatus): UserBadgeVariant {
  switch (status) {    case 'RESERVED':
      return 'subtle';
    case 'PREPARING':
      return 'preparing';
    case 'READY_FOR_PICKUP':
      return 'success';
    case 'BORROWED':
      return 'neutral';
    case 'RETURNED':
      return 'subtle';
    case 'CANCELLED':
    case 'REJECTED':
    case 'EXPIRED':
      return 'error';
    default:
      return 'subtle';
  }
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

function readyCountdown(expiresAt: string | null, now: number | null): string | null {
  if (!expiresAt || now === null) return null;
  const remaining = Date.parse(expiresAt) - now;
  if (!Number.isFinite(remaining)) return null;
  if (remaining <= 0) return 'Đã hết 72 giờ nhận sách; trạng thái cuối cùng do máy chủ xác nhận.';
  const hours = Math.ceil(remaining / 3_600_000);
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return `Còn ${days > 0 ? `${days} ngày ` : ''}${restHours} giờ để nhận`;
}

function getVisibleItems(requests: BorrowRequestSummary[], filter: LoanFilter) {
  // Trạng thái tổng hợp của Loan có thể khác nhau giữa các sách, vì vậy lọc từng LoanItem trước khi nhóm lại.
  return requests
    .map((request) => ({
      ...request,
      items: request.items.filter(
        (item) =>
          filterItem(item, filter)
      ),
    }))
    .filter((request) => request.items.length > 0);
}

function requestStatus(filter: LoanFilter): BorrowRequestFilter {
  if (filter === 'READY') return 'READY_FOR_PICKUP';
  return filter;
}

export function MyLoansPage() {
  const navigate = useNavigate();
  const { notify } = useAppNotification();
  const canCancel = usePermission('borrow:cancel-own');
  const canRenew = usePermission('borrow:renew');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; data: PageResponse<BorrowRequestSummary> } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const [filter, setFilter] = useState<LoanFilter>('ALL');
  const [action, setAction] = useState<LoanAction | null>(null);
  const [pending, setPending] = useState(false);
  const actionLock = useRef(false);
  const [now, setNow] = useState<number | null>(null);
  const [qrRequest, setQrRequest] = useState<BorrowRequestSummary | null>(null);

  const status = requestStatus(filter);
  const requestKey = `${page}:${status}:${reloadKey}`;
  const result = loaded?.key === requestKey ? loaded.data : null;
  const loadError = failed?.key === requestKey ? failed.message : '';
  const loadState = result ? 'ready' : loadError ? 'error' : 'loading';

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void borrowApi
      .listMine(page - 1, status, controller.signal)
      .then((data) => {
        if (current) setLoaded({ key: requestKey, data });
      })
      .catch((error: unknown) => {
        if (current) setFailed({ key: requestKey, message: borrowErrorMessage(error, 'read') });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [page, reloadKey, requestKey, status]);

  const visible = useMemo(() => getVisibleItems(result?.content ?? [], filter), [filter, result]);

  const confirmAction = async () => {
    if (!action || actionLock.current) return;
    actionLock.current = true;
    setPending(true);
    try {
      if (action.type === 'cancel') {
        await borrowApi.cancelMine(action.loanCode, action.item.id);
      } else {
        await borrowApi.renewMine(action.loanCode, action.item.id, action.item.version);
      }
      setAction(null);
      notify('success', {
        title: action.type === 'cancel' ? 'Đã hủy sách' : 'Đã gia hạn sách',
        description:
          action.type === 'cancel'
            ? 'Trạng thái hủy đã được máy chủ xác nhận.'
            : 'Sách đã được gia hạn miễn phí thêm 7 ngày.',
      });
      setReloadKey((key) => key + 1);
    } catch (error: unknown) {
      const staleRequest = borrowErrorStatus(error) === 409;
      if (staleRequest) {
        setReloadKey((key) => key + 1);
        setAction(null);
      }
      notify(borrowErrorNotificationType(error), {
        title: staleRequest ? 'Yêu cầu đã thay đổi' : 'Không thể cập nhật yêu cầu',
        description: borrowErrorMessage(error),
      });
    } finally {
      actionLock.current = false;
      setPending(false);
    }
  };

  return (
    <div className="user-my-loans-page" aria-labelledby="my-loans-heading">
      {/* Khối tiêu đề */}
      <header className="user-my-loans-header">
        <h1
          id="my-loans-heading"
          className="user-title-display-64"
          style={{ margin: 0, color: 'var(--user-ink)' }}
        >
          Sách của tôi
        </h1>
        <p className="user-subtitle" style={{ margin: '8px 0 0 0' }}>
          Theo dõi yêu cầu mượn, vị trí hàng chờ, hạn nhận và gia hạn.
        </p>
      </header>

      {/* Bộ lọc trạng thái */}
      <UserFilterChips
        ariaLabel="Lọc sách theo trạng thái"
        options={LOAN_FILTERS}
        value={filter}
        onChange={(val) => {
          setFilter(val as LoanFilter);
          setPage(1);
        }}
        className="user-my-loans-filter"
      />

      {/* Đang tải */}
      {loadState === 'loading' && (
        <div
          className="user-my-loans-list"
          role="status"
          aria-label="Đang tải danh sách sách của tôi"
        >
          <div className="user-loan-skeleton" />
          <div className="user-loan-skeleton" />
        </div>
      )}

      {/* Lỗi tải */}
      {loadState === 'error' && (
        <div className="user-loan-status-card" role="alert">
          <h2 className="user-title-24" style={{ margin: 0, color: 'var(--user-error)' }}>
            {loadError}
          </h2>
          <UserButton variant="primary" onClick={() => setReloadKey((key) => key + 1)}>
            Tải lại
          </UserButton>
        </div>
      )}

      {/* Trạng thái trống */}
      {loadState === 'ready' && visible.length === 0 && (
        <section className="user-loan-status-card" aria-live="polite">
          <h2 className="user-title-24" style={{ margin: 0, color: 'var(--user-ink)' }}>
            {filter === 'ALL' ? 'Bạn chưa có yêu cầu mượn sách' : 'Chưa có sách ở trạng thái này'}
          </h2>
          <p>
            {filter === 'ALL'
              ? 'Khi đặt mượn, mã QR nhận sách và trạng thái từng cuốn sẽ xuất hiện tại đây.'
              : 'Các trạng thái được lọc trên từng cuốn, kể cả khi cùng một yêu cầu có nhiều trạng thái.'}
          </p>
          {filter === 'ALL' && (
            <UserButton variant="primary" onClick={() => navigate('/books')}>
              Khám phá sách
            </UserButton>
          )}
        </section>
      )}

      {/* Danh sách yêu cầu */}
      {loadState === 'ready' && visible.length > 0 && (
        <section className="user-my-loans-list" aria-label="Yêu cầu và sách">
          {visible.map((request) => (
            <article
              key={request.loanCode}
              className="user-loan-card"
              data-borrow-request={request.loanCode}
            >
              <header className="user-loan-card__header">
                <div className="user-loan-card__header-info">
                  <h2 className="user-title-22" style={{ color: '#FFFFFF', margin: 0 }}>
                    Yêu cầu {request.loanCode}
                  </h2>
                  <span style={{ fontSize: '14px', color: '#C9C3F0' }}>
                    Tạo ngày {formatDate(request.createdAt)} · {request.itemCount} sách
                  </span>
                </div>
                {request.pickupReference && (
                  <UserButton
                    variant="lime-outline"
                    onClick={() => setQrRequest(request)}
                    aria-label={`Hiện mã QR cho yêu cầu ${request.loanCode}`}
                  >
                    Hiện mã QR
                  </UserButton>
                )}
              </header>

              <div className="user-loan-card__body">
                {/* Nhắc nhở thanh toán nếu PENDING */}
                {request.paymentStatus === 'PENDING' && (
                  <div className="user-loan-card__payment-reminder">
                    <UserBadge variant="warning">Chờ thanh toán</UserBadge>
                    <span
                      style={{
                        fontSize: '14px',
                        color: '#7A4B00',
                        fontWeight: 500,
                        flex: 1,
                      }}
                    >
                      Cần thanh toán {formatVnd(request.paymentAmount ?? 0)} để thư viện bắt đầu xử lý.
                    </span>
                    <UserButton
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        navigate(`/borrow-payment/${encodeURIComponent(request.loanCode)}`)
                      }
                    >
                      Tiếp tục thanh toán
                    </UserButton>
                  </div>
                )}

                {/* Danh sách sách trong yêu cầu */}
                <div className="user-loan-card__items">
                  {request.items.map((loanItem, index) => (
                    <section
                      key={loanItem.id}
                      className="user-loan-item"
                      data-loan-item={loanItem.id}
                    >
                      <UserBookCover
                        size="md"
                        themeIndex={index}
                        coverImageUrl={loanItem.coverImageUrl}
                        title={loanItem.title}
                      />
                      <div className="user-loan-item__content">
                        <div className="user-loan-item__title-row">
                          <h3
                            className="user-title-22"
                            style={{ margin: 0, color: 'var(--user-ink)', wordBreak: 'break-word' }}
                          >
                            {loanItem.title}
                          </h3>
                          <UserBadge variant={getItemBadgeVariant(loanItem.status)}>
                            {statusLabel(loanItem.status)}
                          </UserBadge>
                        </div>

                        <div style={{ fontSize: '14px', color: '#4B4570' }}>
                          {loanItem.bookCode} · {loanItem.author}
                        </div>

                        {loanItem.status === 'READY_FOR_PICKUP' && (
                          <p
                            style={{
                              margin: 0,
                              fontSize: '14px',
                              color: 'var(--user-ink)',
                              fontWeight: 600,
                            }}
                            role="timer"
                          >
                            {readyCountdown(loanItem.pickupExpiresAt, now) ??
                              `Thời hạn nhận: ${formatDate(loanItem.pickupExpiresAt)}`}
                          </p>
                        )}

                        {loanItem.status === 'BORROWED' && (
                          <p style={{ margin: 0, fontSize: '14px', color: 'var(--user-ink)' }}>
                            Hạn trả {formatDate(loanItem.dueDate)} · Đã gia hạn {loanItem.renewalCount} / 1 lần
                          </p>
                        )}

                        <div className="user-loan-item__fees">
                          <span>
                            Phí mượn:{' '}
                            <strong style={{ color: 'var(--user-ink)', fontWeight: 600 }}>
                              {formatVnd(loanItem.borrowFee)}
                            </strong>
                          </span>
                          {loanItem.status === 'BORROWED' && (
                            <span>
                              Phí trễ / ngày:{' '}
                              <strong style={{ color: 'var(--user-ink)', fontWeight: 600 }}>
                                {formatVnd(loanItem.lateFeePerDay)}
                              </strong>
                            </span>
                          )}
                        </div>

                        <div className="user-loan-item__actions">
                          {canCancel &&
                            !(request.paymentStatus === 'PAID' && loanItem.paidBorrowFee > 0) &&
                            ['RESERVED', 'PREPARING', 'READY_FOR_PICKUP'].includes(
                              loanItem.status
                            ) && (
                              <UserButton
                                variant="dark-outline"
                                size="sm"
                                disabled={pending}
                                onClick={() =>
                                  setAction({
                                    type: 'cancel',
                                    loanCode: request.loanCode,
                                    item: loanItem,
                                  })
                                }
                              >
                                Hủy sách này
                              </UserButton>
                            )}

                          {canRenew &&
                            loanItem.status === 'BORROWED' &&
                            loanItem.renewalCount === 0 && (
                              <UserButton
                                variant="primary"
                                size="sm"
                                disabled={pending}
                                onClick={() =>
                                  setAction({
                                    type: 'renew',
                                    loanCode: request.loanCode,
                                    item: loanItem,
                                  })
                                }
                              >
                                Gia hạn miễn phí 7 ngày
                              </UserButton>
                            )}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Phân trang */}
      {loadState === 'ready' && result && result.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
          <Pagination
            current={page}
            pageSize={result.size}
            total={result.totalElements}
            showSizeChanger={false}
            onChange={setPage}
            aria-label="Trang yêu cầu mượn"
          />
        </div>
      )}

      {/* Modal QR */}
      {qrRequest && (
        <UserQrModal
          open={!!qrRequest}
          onClose={() => setQrRequest(null)}
          loanCode={qrRequest.loanCode}
          qrPayload={qrRequest.pickupReference}
          bookTitle={
            qrRequest.items.length === 1
              ? (qrRequest.items[0]?.title ?? '')
              : `${qrRequest.items.length} sách trong yêu cầu`
          }
          bookSubtitle={
            qrRequest.items.length === 1
              ? `${qrRequest.items[0]?.bookCode ?? ''} · ${qrRequest.items[0]?.author ?? ''}`
              : qrRequest.items.map((i) => i.title).join(', ')
          }
        />
      )}

      {/* Modal xác nhận Hủy / Gia hạn */}
      <Modal
        open={action !== null}
        title={
          <span
            style={{
              fontFamily:
                'var(--user-font-display, "Bricolage Grotesque", "Be Vietnam Pro", sans-serif)',
              fontWeight: 800,
              fontSize: '24px',
              letterSpacing: '-0.02em',
            }}
          >
            {action?.type === 'cancel' ? 'Xác nhận hủy sách' : 'Gia hạn sách miễn phí'}
          </span>
        }
        okText={action?.type === 'cancel' ? 'Xác nhận hủy' : 'Gia hạn thêm 7 ngày'}
        cancelText="Quay lại"
        okButtonProps={{ danger: action?.type === 'cancel' }}
        confirmLoading={pending}
        onCancel={() => {
          if (!pending) setAction(null);
        }}
        onOk={() => {
          void confirmAction();
        }}
      >
        {action?.type === 'cancel' && (
          <p style={{ margin: '12px 0 0', lineHeight: 1.6 }}>
            Bạn muốn hủy “{action.item.title}” khỏi yêu cầu này? Nếu khoản phí đã được thanh toán
            trực tuyến, hãy liên hệ thủ thư để được hỗ trợ hoàn tiền trực tiếp tại quầy.
          </p>
        )}
        {action?.type === 'renew' && (
          <p style={{ margin: '12px 0 0', lineHeight: 1.6 }}>
            Gia hạn “{action.item.title}” thêm 7 ngày miễn phí từ hạn trả hiện tại. Mỗi sách chỉ
            được gia hạn một lần trong thời gian máy chủ cho phép.
          </p>
        )}
      </Modal>
    </div>
  );
}
