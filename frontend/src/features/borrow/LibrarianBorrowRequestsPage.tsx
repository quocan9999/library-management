import { Alert, Button, Checkbox, Input, Modal, Pagination, Select, Skeleton, Tag } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { borrowApi } from './api';
import { borrowErrorCode, borrowErrorMessage, borrowErrorNotificationType, borrowErrorStatus } from './errors';
import { formatVnd } from '../books/formatting';
import type { BorrowRequestFilter, HandoverRequest, LoanItemStatus, PageResponse, StaffBorrowRequest } from './types';

const EMPTY_STAFF_REQUESTS: StaffBorrowRequest[] = [];

function staffStatusLabel(status: LoanItemStatus): string {
  const labels: Record<LoanItemStatus, string> = {
    WAITLISTED: 'Trong hàng chờ', RESERVED: 'Đang giữ sách', PREPARING: 'Đang chuẩn bị',
    READY_FOR_PICKUP: 'Sẵn sàng nhận', BORROWED: 'Đang mượn', RETURNED: 'Đã trả', CANCELLED: 'Đã hủy',
    REJECTED: 'Không tìm thấy sách', EXPIRED: 'Đã hết hạn nhận',
  };
  return labels[status] ?? status;
}

function formatDeadline(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function LibrarianBorrowRequestsPage() {
  const { permissions } = useAuth();
  const { notify } = useAppNotification();
  const canPrepare = permissions.includes('borrow:prepare');
  const canCancel = permissions.includes('borrow:cancel');
  const canHandover = permissions.includes('borrow:handover') && permissions.includes('borrow:fee-confirm');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<BorrowRequestFilter>('PENDING');
  const [loaded, setLoaded] = useState<{ key: string; data: PageResponse<StaffBorrowRequest> } | null>(null);
  const [loadFailure, setLoadFailure] = useState<{ key: string; message: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const actionLock = useRef(false);
  const [verifiedLoans, setVerifiedLoans] = useState<Set<string>>(() => new Set());
  const [handoverRequest, setHandoverRequest] = useState<StaffBorrowRequest | null>(null);
  const [lookupValue, setLookupValue] = useState('');
  const [lookupResult, setLookupResult] = useState<StaffBorrowRequest | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [cancelAction, setCancelAction] = useState<{ request: StaffBorrowRequest; itemId: number } | null>(null);
  const [rejectAction, setRejectAction] = useState<{ request: StaffBorrowRequest; itemId: number } | null>(null);
  const requestKey = `${page}:${filter}:${reloadKey}`;
  const result = loaded?.key === requestKey ? loaded.data : null;
  const requests = result?.content ?? EMPTY_STAFF_REQUESTS;
  const loadError = loadFailure?.key === requestKey ? loadFailure.message : '';
  const loadState = result ? 'ready' : loadError ? 'error' : 'loading';

  useEffect(() => {
    let current = true;
    void borrowApi.listStaff(page - 1, filter)
      .then((data) => {
        if (!current) return;
        if (data.totalPages > 0 && page > data.totalPages) {
          setPage(data.totalPages);
          return;
        }
        setLoaded({ key: requestKey, data });
      })
      .catch((error: unknown) => { if (current) setLoadFailure({ key: requestKey, message: borrowErrorMessage(error, 'read') }); });
    return () => { current = false; };
  }, [filter, page, reloadKey, requestKey]);

  const allRequests = useMemo(() => {
    const byCode = new Map(requests.map((request) => [request.loanCode, request]));
    if (lookupResult) byCode.set(lookupResult.loanCode, lookupResult);
    return [...byCode.values()];
  }, [lookupResult, requests]);

  const refreshAfterConflict = (error: unknown, request: StaffBorrowRequest) => {
    const code = borrowErrorCode(error);
    const staleRequest = borrowErrorStatus(error) === 409
      || code === 'BORROW_FEE_MISMATCH'
      || code === 'BORROW_INVALID_HANDOVER_SET';
    if (!staleRequest) return;

    setReloadKey((key) => key + 1);
    setHandoverRequest((current) => current?.loanCode === request.loanCode ? null : current);
    setVerifiedLoans((current) => {
      const next = new Set(current);
      next.delete(request.loanCode);
      return next;
    });
    if (lookupResult?.loanCode === request.loanCode) {
      void borrowApi.findPickup(request.pickupReference)
        .then(setLookupResult)
        .catch(() => setLookupResult(null));
    }
  };

  const runItemAction = async (request: StaffBorrowRequest, itemId: number, action: 'prepare' | 'ready' | 'cancel' | 'reject') => {
    if (actionLock.current) return;
    actionLock.current = true;
    const pendingId = `${request.loanCode}:${itemId}`;
    setPendingKey(pendingId);
    try {
      if (action === 'prepare') await borrowApi.prepare(request.loanCode, itemId);
      else if (action === 'ready') await borrowApi.markReady(request.loanCode, itemId);
      else if (action === 'cancel') await borrowApi.cancelReady(request.loanCode, itemId);
      else await borrowApi.reject(request.loanCode, itemId);
      if (action === 'cancel') setCancelAction(null);
      if (action === 'reject') setRejectAction(null);
      notify('success', {
        title: action === 'cancel' ? 'Đã hủy sách READY' : action === 'reject' ? 'Đã ghi nhận kết quả kiểm tra' : 'Đã cập nhật trạng thái',
        description: action === 'cancel'
          ? 'Đã hủy sách theo yêu cầu thành viên.'
          : action === 'reject'
            ? 'Đã ghi nhận không tìm thấy bản sách vật lý; không tăng số bản sẵn có.'
            : 'Trạng thái được xác nhận từ máy chủ.',
      });
      setReloadKey((key) => key + 1);
      if (lookupResult?.loanCode === request.loanCode) {
        try { setLookupResult(await borrowApi.findPickup(request.pickupReference)); } catch { setLookupResult(null); }
      }
    } catch (error: unknown) {
      refreshAfterConflict(error, request);
      if (borrowErrorStatus(error) === 409 && action === 'cancel') setCancelAction(null);
      if (borrowErrorStatus(error) === 409 && action === 'reject') setRejectAction(null);
      const notificationType = borrowErrorNotificationType(error);
      notify(notificationType, {
        title: notificationType === 'warning' ? 'Trạng thái yêu cầu đã thay đổi' : 'Không thể cập nhật yêu cầu',
        description: borrowErrorMessage(error),
      });
    } finally {
      actionLock.current = false;
      setPendingKey(null);
    }
  };

  const lookupPickup = async () => {
    const reference = lookupValue.trim();
    if (!reference || lookupPending) return;
    setLookupPending(true);
    setLookupResult(null);
    try {
      const found = await borrowApi.findPickup(reference);
      setLookupResult(found);
    } catch (error: unknown) {
      notify(borrowErrorNotificationType(error), {
        title: 'Không thể tra cứu mã nhận sách',
        description: borrowErrorMessage(error, 'read'),
      });
    } finally {
      setLookupPending(false);
    }
  };

  const completeHandover = async () => {
    if (!handoverRequest || !canHandover || !verifiedLoans.has(handoverRequest.loanCode) || actionLock.current) return;
    const readyItems = handoverRequest.items.filter((item) => item.status === 'READY_FOR_PICKUP');
    if (readyItems.length === 0) return;
    actionLock.current = true;
    setPendingKey(`${handoverRequest.loanCode}:handover`);
    const body: HandoverRequest = {
      identityVerified: true,
      expectedLoanVersion: handoverRequest.version,
      items: readyItems.map((item) => ({ loanItemId: item.id, collectedBorrowFee: item.borrowFee })),
    };
    try {
      await borrowApi.handover(handoverRequest.loanCode, body);
      setHandoverRequest(null);
      setVerifiedLoans((current) => {
        const next = new Set(current);
        next.delete(handoverRequest.loanCode);
        return next;
      });
      notify('success', {
        title: 'Đã hoàn tất bàn giao',
        description: 'Đã xác nhận phí và bàn giao toàn bộ sách READY còn lại.',
      });
      setReloadKey((key) => key + 1);
      if (lookupResult?.loanCode === handoverRequest.loanCode) {
        try { setLookupResult(await borrowApi.findPickup(handoverRequest.pickupReference)); } catch { setLookupResult(null); }
      }
    } catch (error: unknown) {
      refreshAfterConflict(error, handoverRequest);
      const notificationType = borrowErrorNotificationType(error);
      notify(notificationType, {
        title: notificationType === 'warning' ? 'Yêu cầu đã thay đổi' : 'Không thể xác nhận bàn giao',
        description: borrowErrorMessage(error),
      });
    } finally {
      actionLock.current = false;
      setPendingKey(null);
    }
  };

  return <main className="borrow-stage" aria-labelledby="staff-borrow-heading">
    <header className="borrow-heading">
      <div>
        <p className="role-eyebrow">QUẦY DỊCH VỤ THƯ VIỆN</p>
        <h1 id="staff-borrow-heading">Yêu cầu mượn tại quầy</h1>
        <p className="role-intro">Nhập mã từ QR, xác minh thành viên, chuẩn bị sách và xác nhận phí cho toàn bộ sách READY.</p>
      </div>
      <Button onClick={() => setReloadKey((key) => key + 1)}>Tải lại danh sách</Button>
    </header>

    <section className="borrow-lookup" aria-label="Tra cứu mã QR nhận sách">
      <Input.Search
        aria-label="Mã QR / mã nhận sách"
        placeholder="Quét hoặc dán mã QR nhận sách"
        value={lookupValue}
        onChange={(event) => setLookupValue(event.target.value)}
        onSearch={() => { void lookupPickup(); }}
        loading={lookupPending}
        enterButton="Tra cứu"
      />
      <p>Máy quét bàn phím có thể nhập trực tiếp mã. QR chỉ dùng để tra cứu yêu cầu, không thay thế xác minh danh tính.</p>
    </section>

    <section className="borrow-toolbar borrow-toolbar--filter" aria-label="Lọc yêu cầu tại quầy">
      <Select
        aria-label="Lọc trạng thái yêu cầu tại quầy"
        value={filter}
        onChange={(value: BorrowRequestFilter) => { setFilter(value); setPage(1); }}
        options={[
          { value: 'PENDING', label: 'Cần xử lý trước' },
          { value: 'READY_FOR_PICKUP', label: 'Sẵn sàng nhận' },
          { value: 'WAITLISTED', label: 'Hàng chờ' },
          { value: 'BORROWED', label: 'Đang mượn' },
          { value: 'HISTORY', label: 'Lịch sử' },
          { value: 'ALL', label: 'Tất cả yêu cầu' },
        ]}
      />
    </section>

    {loadState === 'loading' && <div className="borrow-loading" role="status"><Skeleton active paragraph={{ rows: 4 }} /></div>}
    {loadState === 'error' && <Alert className="borrow-page-alert" type="error" showIcon role="alert" title={loadError} action={<Button onClick={() => setReloadKey((key) => key + 1)}>Tải lại</Button>} />}
    {loadState === 'ready' && allRequests.length === 0 && <section className="borrow-empty"><h2>{filter === 'PENDING' ? 'Không có yêu cầu cần xử lý' : 'Không có yêu cầu phù hợp'}</h2><p>Yêu cầu mới sẽ xuất hiện tại đây sau khi thành viên đặt mượn.</p></section>}
    {loadState === 'ready' && allRequests.length > 0 && <section className="borrow-requests" aria-label="Danh sách yêu cầu">
      {allRequests.map((request) => <article key={request.loanCode} className="borrow-request staff-borrow-request" data-borrow-request={request.loanCode}>
        <header className="borrow-request__heading">
          <div>
            <p className="role-eyebrow">YÊU CẦU {request.loanCode}</p>
            <h2>{request.member.fullName}</h2>
            <p>Mã thành viên {request.member.memberCode} · {request.items.length} sách</p>
          </div>
          <div className="staff-borrow-request__identity">
            <Tag color="blue">{request.status}</Tag>
            <code>{request.pickupReference}</code>
          </div>
        </header>
        {request.preparingOverdueItemIds.length > 0 && <Alert
          className="borrow-page-alert"
          type="warning"
          showIcon
          role="status"
          title={`Có ${request.preparingOverdueItemIds.length} sách đã ở trạng thái chuẩn bị quá 24 giờ. Hãy kiểm tra và cập nhật trạng thái tại quầy.`}
        />}
        <div className="borrow-request__items">
          {request.items.map((item) => <section key={item.id} className="borrow-item" data-loan-item={item.id}>
            <div className="borrow-item__main">
              <div><h3>{item.title}</h3><p>{item.bookCode} · {item.author}</p></div>
              <Tag color={item.status === 'READY_FOR_PICKUP' ? 'green' : item.status === 'BORROWED' ? 'blue' : 'default'}>{staffStatusLabel(item.status)}</Tag>
            </div>
            <dl className="borrow-item__fees">
              <div><dt>Phí mượn đã chốt</dt><dd>{formatVnd(item.borrowFee)}</dd></div>
              {item.status === 'READY_FOR_PICKUP' && <div><dt>Hạn nhận</dt><dd>{formatDeadline(item.pickupExpiresAt)}</dd></div>}
            </dl>
            <div className="borrow-item__actions">
              {canPrepare && item.status === 'RESERVED' && <Button
                disabled={pendingKey !== null}
                loading={pendingKey === `${request.loanCode}:${item.id}`}
                onClick={() => { void runItemAction(request, item.id, 'prepare'); }}
              >Chuẩn bị sách</Button>}
              {canPrepare && item.status === 'PREPARING' && <Button
                type="primary"
                disabled={pendingKey !== null}
                loading={pendingKey === `${request.loanCode}:${item.id}`}
                onClick={() => { void runItemAction(request, item.id, 'ready'); }}
              >Đánh dấu READY</Button>}
              {canPrepare && ['RESERVED', 'PREPARING'].includes(item.status) && <Button
                danger
                disabled={pendingKey !== null}
                loading={pendingKey === `${request.loanCode}:${item.id}`}
                onClick={() => setRejectAction({ request, itemId: item.id })}
              >Ghi nhận không tìm thấy sách</Button>}
              {canCancel && item.status === 'READY_FOR_PICKUP' && <Button
                danger
                disabled={pendingKey !== null}
                loading={pendingKey === `${request.loanCode}:${item.id}`}
                onClick={() => setCancelAction({ request, itemId: item.id })}
              >Hủy READY theo yêu cầu thành viên</Button>}
            </div>
          </section>)}
        </div>
        {canHandover && request.items.some((item) => item.status === 'READY_FOR_PICKUP') && <div className="borrow-handover">
          <Checkbox
            checked={verifiedLoans.has(request.loanCode)}
            disabled={pendingKey !== null}
            onChange={(event) => setVerifiedLoans((current) => {
              const next = new Set(current);
              if (event.target.checked) next.add(request.loanCode);
              else next.delete(request.loanCode);
              return next;
            })}
          >Đã xác minh danh tính thành viên tại quầy</Checkbox>
          <Button
            type="primary"
            disabled={!verifiedLoans.has(request.loanCode) || pendingKey !== null}
            onClick={() => setHandoverRequest(request)}
          >Thu phí và bàn giao</Button>
        </div>}
      </article>)}
    </section>}
    {loadState === 'ready' && result && result.totalPages > 1 && <Pagination
      className="borrow-pagination"
      current={page}
      pageSize={result.size}
      total={result.totalElements}
      showSizeChanger={false}
      onChange={setPage}
      aria-label="Trang yêu cầu tại quầy"
    />}

    <Modal
      open={cancelAction !== null}
      title="Xác nhận hủy sách READY"
      okText="Xác nhận hủy READY"
      cancelText="Quay lại"
      confirmLoading={cancelAction !== null && pendingKey === `${cancelAction.request.loanCode}:${cancelAction.itemId}`}
      onCancel={() => { if (pendingKey === null) setCancelAction(null); }}
      onOk={() => {
        if (cancelAction) void runItemAction(cancelAction.request, cancelAction.itemId, 'cancel');
      }}
    >
      {cancelAction && <p>Thành viên {cancelAction.request.member.fullName} đã yêu cầu hủy “{cancelAction.request.items.find((item) => item.id === cancelAction.itemId)?.title ?? 'sách này'}” trước khi thu phí.</p>}
    </Modal>

    <Modal
      open={rejectAction !== null}
      title="Xác nhận không tìm thấy bản sách"
      okText="Xác nhận không tìm thấy sách"
      cancelText="Quay lại"
      okButtonProps={{ danger: true }}
      confirmLoading={rejectAction !== null && pendingKey === `${rejectAction.request.loanCode}:${rejectAction.itemId}`}
      onCancel={() => { if (pendingKey === null) setRejectAction(null); }}
      onOk={() => {
        if (rejectAction) void runItemAction(rejectAction.request, rejectAction.itemId, 'reject');
      }}
    >
      {rejectAction && <p>Ghi nhận “{rejectAction.request.items.find((item) => item.id === rejectAction.itemId)?.title ?? 'sách này'}” không tìm thấy tại quầy. Trạng thái sẽ chuyển sang REJECTED; thao tác này không làm tăng số bản sẵn có.</p>}
    </Modal>

    <Modal
      open={handoverRequest !== null}
      title="Xác nhận phí và bàn giao"
      okText="Xác nhận thu phí và bàn giao"
      cancelText="Quay lại"
      confirmLoading={pendingKey === `${handoverRequest?.loanCode}:handover`}
      okButtonProps={{ disabled: !handoverRequest || !verifiedLoans.has(handoverRequest.loanCode) }}
      onCancel={() => { if (pendingKey === null) setHandoverRequest(null); }}
      onOk={() => { void completeHandover(); }}
    >
      {handoverRequest && <>
        <p>Xác nhận thành viên <strong>{handoverRequest.member.fullName}</strong> · {handoverRequest.member.memberCode} đã nhận đúng các sách sau.</p>
        <ul className="handover-fee-list">
          {handoverRequest.items.filter((item) => item.status === 'READY_FOR_PICKUP').map((item) => <li key={item.id}>
            <span>{item.title}</span><strong>{formatVnd(item.borrowFee)}</strong>
          </li>)}
        </ul>
        <p>Hệ thống gửi toàn bộ sách READY còn lại cùng phí đã chốt trong một giao dịch. Phí 0 ₫ vẫn được xác nhận.</p>
      </>}
    </Modal>
  </main>;
}
