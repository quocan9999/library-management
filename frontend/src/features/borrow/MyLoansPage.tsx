import { Alert, Button, Modal, Pagination, Skeleton, Tag } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePermission } from '../../auth/permissions';
import { borrowApi } from './api';
import { borrowErrorMessage, borrowErrorStatus } from './errors';
import { formatVnd } from '../books/formatting';
import type { BorrowItem, BorrowRequestFilter, BorrowRequestSummary, LoanItemStatus, PageResponse } from './types';

type LoanFilter = 'ALL' | 'PENDING' | 'WAITLISTED' | 'READY' | 'BORROWED' | 'HISTORY';
type LoanAction = { type: 'cancel' | 'renew'; loanCode: string; item: BorrowItem };

const HISTORY_STATUSES: LoanItemStatus[] = ['RETURNED', 'CANCELLED', 'REJECTED', 'EXPIRED'];
const LOAN_FILTERS: Array<{ key: LoanFilter; label: string }> = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ xử lý' },
  { key: 'WAITLISTED', label: 'Waitlist' },
  { key: 'READY', label: 'Sẵn sàng nhận' },
  { key: 'BORROWED', label: 'Đang mượn' },
  { key: 'HISTORY', label: 'Lịch sử' },
];

function filterItem(item: BorrowItem, filter: LoanFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'HISTORY') return HISTORY_STATUSES.includes(item.status);
  if (filter === 'PENDING') return ['RESERVED', 'PREPARING'].includes(item.status);
  if (filter === 'READY') return item.status === 'READY_FOR_PICKUP';
  return item.status === filter;
}

function statusLabel(status: LoanItemStatus): string {
  const labels: Record<LoanItemStatus, string> = {
    WAITLISTED: 'Trong hàng chờ', RESERVED: 'Đang giữ sách', PREPARING: 'Đang chuẩn bị',
    READY_FOR_PICKUP: 'Sẵn sàng nhận', BORROWED: 'Đang mượn', RETURNED: 'Đã trả', CANCELLED: 'Đã hủy',
    REJECTED: 'Không tìm thấy sách', EXPIRED: 'Đã hết hạn nhận',
  };
  return labels[status] ?? status;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
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
  return requests.map((request) => ({ ...request, items: request.items.filter((item) => filterItem(item, filter)) }))
    .filter((request) => request.items.length > 0);
}

function requestStatus(filter: LoanFilter): BorrowRequestFilter {
  if (filter === 'READY') return 'READY_FOR_PICKUP';
  return filter;
}

export function MyLoansPage() {
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
  const [feedback, setFeedback] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
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
    void borrowApi.listMine(page - 1, status, controller.signal)
      .then((data) => { if (current) setLoaded({ key: requestKey, data }); })
      .catch((error: unknown) => { if (current) setFailed({ key: requestKey, message: borrowErrorMessage(error, 'read') }); });
    return () => { current = false; controller.abort(); };
  }, [page, reloadKey, requestKey, status]);

  const visible = useMemo(() => getVisibleItems(result?.content ?? [], filter), [filter, result]);

  const confirmAction = async () => {
    if (!action || actionLock.current) return;
    actionLock.current = true;
    setPending(true);
    setFeedback(null);
    try {
      if (action.type === 'cancel') await borrowApi.cancelMine(action.loanCode, action.item.id);
      else await borrowApi.renewMine(action.loanCode, action.item.id, action.item.version);
      setAction(null);
      setFeedback(action.type === 'cancel' ? 'Đã cập nhật trạng thái hủy từ máy chủ.' : 'Đã gia hạn miễn phí thêm 7 ngày.');
      setReloadKey((key) => key + 1);
    } catch (error: unknown) {
      if (borrowErrorStatus(error) === 409) {
        setReloadKey((key) => key + 1);
        setAction(null);
      }
      setFeedback(borrowErrorMessage(error));
    } finally {
      actionLock.current = false;
      setPending(false);
    }
  };

  return <main className="borrow-stage" aria-labelledby="my-loans-heading">
    <header className="borrow-heading">
      <div>
        <p className="role-eyebrow">TÀI KHOẢN THÀNH VIÊN</p>
        <h1 id="my-loans-heading">Sách của tôi</h1>
        <p className="role-intro">Theo dõi từng cuốn trong yêu cầu, vị trí hàng chờ, hạn nhận và gia hạn.</p>
      </div>
      <div className="borrow-heading-actions">
        <Button onClick={() => setReloadKey((key) => key + 1)}>Tải lại danh sách</Button>
        <Link className="member-back-link" to="/books">Tìm sách</Link>
      </div>
    </header>

    {feedback && <Alert className="borrow-page-alert" type={feedback.includes('Đã ') ? 'success' : 'warning'} showIcon role="status" title={feedback} closable onClose={() => setFeedback(null)} />}
    <nav className="borrow-tabs" aria-label="Lọc sách theo trạng thái" role="tablist">
      {LOAN_FILTERS.map((option) => <button
        key={option.key}
        type="button"
        role="tab"
        aria-selected={filter === option.key}
        className={`borrow-tab${filter === option.key ? ' is-active' : ''}`}
        onClick={() => { setFilter(option.key); setPage(1); }}
      >{option.label}</button>)}
    </nav>

    {loadState === 'loading' && <div className="borrow-loading" role="status"><Skeleton active paragraph={{ rows: 3 }} /></div>}
    {loadState === 'error' && <Alert
      className="borrow-page-alert"
      type="error"
      showIcon
      role="alert"
      title={loadError}
      action={<Button onClick={() => setReloadKey((key) => key + 1)}>Tải lại</Button>}
    />}
    {loadState === 'ready' && visible.length === 0 && <section className="borrow-empty" aria-live="polite">
      <h2>{filter === 'ALL' ? 'Bạn chưa có yêu cầu mượn sách' : 'Chưa có sách ở trạng thái này'}</h2>
      <p>{filter === 'ALL' ? 'Khi đặt mượn, mã QR nhận sách và trạng thái từng cuốn sẽ xuất hiện tại đây.' : 'Các trạng thái được lọc trên từng cuốn, kể cả khi cùng một yêu cầu có nhiều trạng thái.'}</p>
      {filter === 'ALL' && <Link className="permission-home-button" to="/books">Khám phá sách</Link>}
    </section>}
    {loadState === 'ready' && visible.length > 0 && <section className="borrow-requests" aria-label="Yêu cầu và sách">
      {visible.map((request) => <article key={request.loanCode} className="borrow-request" data-borrow-request={request.loanCode}>
        <header className="borrow-request__heading">
          <div>
            <p className="role-eyebrow">YÊU CẦU {request.loanCode}</p>
            <h2>{request.items.length} {request.items.length === 1 ? 'cuốn' : 'cuốn'} trong nhóm này</h2>
            <p>Ngày tạo {formatDate(request.createdAt)} · {request.itemCount} sách trong yêu cầu</p>
          </div>
          {request.pickupReference && <div className="borrow-qr" aria-label={`Mã QR nhận sách cho ${request.loanCode}`}>
            <QRCodeSVG value={request.pickupReference} size={112} level="M" marginSize={4} title={`Mã QR nhận sách cho ${request.loanCode}`} />
            <span>Mã nhận sách</span>
            <code>{request.pickupReference}</code>
          </div>}
        </header>
        <div className="borrow-request__items">
          {request.items.map((loanItem) => <section key={loanItem.id} className="borrow-item" data-loan-item={loanItem.id}>
            <div className="borrow-item__main">
              <div>
                <h3>{loanItem.title}</h3>
                <p>{loanItem.bookCode} · {loanItem.author}</p>
              </div>
              <Tag color={loanItem.status === 'READY_FOR_PICKUP' ? 'green' : loanItem.status === 'BORROWED' ? 'blue' : 'default'}>{statusLabel(loanItem.status)}</Tag>
            </div>
            {loanItem.status === 'WAITLISTED' && <p className="borrow-item__detail">Vị trí {loanItem.waitlistPosition ?? '—'} trong {loanItem.waitlistTotal ?? '—'} người chờ. Hệ thống tự tính lại vị trí khi tải mới.</p>}
            {loanItem.status === 'READY_FOR_PICKUP' && <p className="borrow-item__deadline" role="timer">
              {readyCountdown(loanItem.pickupExpiresAt, now) ?? `Thời hạn nhận: ${formatDate(loanItem.pickupExpiresAt)}`}
            </p>}
            {loanItem.status === 'BORROWED' && <p className="borrow-item__detail">Hạn trả: {formatDate(loanItem.dueDate)} · Đã gia hạn {loanItem.renewalCount} / 1 lần</p>}
            <dl className="borrow-item__fees">
              <div><dt>Phí mượn</dt><dd>{formatVnd(loanItem.borrowFee)}</dd></div>
              {loanItem.status === 'BORROWED' && <div><dt>Phí trễ / ngày</dt><dd>{formatVnd(loanItem.lateFeePerDay)}</dd></div>}
            </dl>
            <div className="borrow-item__actions">
              {canCancel && ['WAITLISTED', 'RESERVED', 'PREPARING', 'READY_FOR_PICKUP'].includes(loanItem.status)
                && <Button disabled={pending} onClick={() => setAction({ type: 'cancel', loanCode: request.loanCode, item: loanItem })}>Hủy sách này</Button>}
              {canRenew && loanItem.status === 'BORROWED' && loanItem.renewalCount === 0
                && <Button type="primary" disabled={pending} onClick={() => setAction({ type: 'renew', loanCode: request.loanCode, item: loanItem })}>Gia hạn miễn phí 7 ngày</Button>}
            </div>
          </section>)}
        </div>
      </article>)}
    </section>}
    {loadState === 'ready' && result && result.totalPages > 1 && <Pagination
      className="borrow-pagination"
      current={page}
      pageSize={result.size}
      total={result.totalElements}
      showSizeChanger={false}
      onChange={setPage}
      aria-label="Trang yêu cầu mượn"
    />}

    <Modal
      open={action !== null}
      title={action?.type === 'cancel' ? 'Xác nhận hủy sách' : 'Gia hạn sách miễn phí'}
      okText={action?.type === 'cancel' ? 'Xác nhận hủy' : 'Gia hạn thêm 7 ngày'}
      cancelText="Quay lại"
      confirmLoading={pending}
      onCancel={() => { if (!pending) setAction(null); }}
      onOk={() => { void confirmAction(); }}
    >
      {action?.type === 'cancel' && <p>Bạn muốn hủy “{action.item.title}” khỏi yêu cầu này? Sách READY được phép hủy tại quầy trước khi xác nhận phí.</p>}
      {action?.type === 'renew' && <p>Gia hạn “{action.item.title}” thêm 7 ngày miễn phí từ hạn trả hiện tại. Mỗi sách chỉ được gia hạn một lần trong thời gian máy chủ cho phép.</p>}
    </Modal>
  </main>;
}
