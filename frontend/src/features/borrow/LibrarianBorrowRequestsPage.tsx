import { Alert, Button, Checkbox, Input, Modal, Skeleton, Tag } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { borrowApi } from './api';
import { borrowErrorCode, borrowErrorMessage, borrowErrorStatus } from './errors';
import { formatVnd } from '../books/formatting';
import type { HandoverRequest, LoanItemStatus, StaffBorrowRequest } from './types';

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
  const canPrepare = permissions.includes('borrow:prepare');
  const canCancel = permissions.includes('borrow:cancel');
  const canHandover = permissions.includes('borrow:handover') && permissions.includes('borrow:fee-confirm');
  const [loaded, setLoaded] = useState<{ key: number; requests: StaffBorrowRequest[] } | null>(null);
  const [loadFailure, setLoadFailure] = useState<{ key: number; message: string } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const actionLock = useRef(false);
  const [verifiedLoans, setVerifiedLoans] = useState<Set<string>>(() => new Set());
  const [handoverRequest, setHandoverRequest] = useState<StaffBorrowRequest | null>(null);
  const [lookupValue, setLookupValue] = useState('');
  const [lookupResult, setLookupResult] = useState<StaffBorrowRequest | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [cancelAction, setCancelAction] = useState<{ request: StaffBorrowRequest; itemId: number } | null>(null);
  const requests = loaded?.key === reloadKey ? loaded.requests : EMPTY_STAFF_REQUESTS;
  const loadError = loadFailure?.key === reloadKey ? loadFailure.message : '';
  const loadState = loaded?.key === reloadKey ? 'ready' : loadError ? 'error' : 'loading';

  useEffect(() => {
    let current = true;
    void borrowApi.listStaff()
      .then((data) => { if (current) setLoaded({ key: reloadKey, requests: data.content }); })
      .catch((error: unknown) => { if (current) setLoadFailure({ key: reloadKey, message: borrowErrorMessage(error, 'read') }); });
    return () => { current = false; };
  }, [reloadKey]);

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

  const runItemAction = async (request: StaffBorrowRequest, itemId: number, action: 'prepare' | 'ready' | 'cancel') => {
    if (actionLock.current) return;
    actionLock.current = true;
    const pendingId = `${request.loanCode}:${itemId}`;
    setPendingKey(pendingId);
    setFeedback(null);
    try {
      if (action === 'prepare') await borrowApi.prepare(request.loanCode, itemId);
      else if (action === 'ready') await borrowApi.markReady(request.loanCode, itemId);
      else await borrowApi.cancelReady(request.loanCode, itemId);
      if (action === 'cancel') setCancelAction(null);
      setFeedback(action === 'cancel' ? 'Đã hủy sách READY theo yêu cầu thành viên.' : 'Đã cập nhật trạng thái từ máy chủ.');
      setReloadKey((key) => key + 1);
      if (lookupResult?.loanCode === request.loanCode) {
        try { setLookupResult(await borrowApi.findPickup(request.pickupReference)); } catch { setLookupResult(null); }
      }
    } catch (error: unknown) {
      refreshAfterConflict(error, request);
      if (borrowErrorStatus(error) === 409 && action === 'cancel') setCancelAction(null);
      setFeedback(borrowErrorMessage(error));
    } finally {
      actionLock.current = false;
      setPendingKey(null);
    }
  };

  const lookupPickup = async () => {
    const reference = lookupValue.trim();
    if (!reference || lookupPending) return;
    setLookupPending(true);
    setLookupError('');
    setLookupResult(null);
    try {
      const found = await borrowApi.findPickup(reference);
      setLookupResult(found);
      setFeedback(null);
    } catch (error: unknown) {
      setLookupError(borrowErrorMessage(error, 'read'));
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
    setFeedback(null);
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
      setFeedback('Đã xác nhận phí và bàn giao toàn bộ sách READY còn lại.');
      setReloadKey((key) => key + 1);
      if (lookupResult?.loanCode === handoverRequest.loanCode) {
        try { setLookupResult(await borrowApi.findPickup(handoverRequest.pickupReference)); } catch { setLookupResult(null); }
      }
    } catch (error: unknown) {
      refreshAfterConflict(error, handoverRequest);
      setFeedback(borrowErrorMessage(error));
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

    {feedback && <Alert className="borrow-page-alert" type={feedback.startsWith('Đã ') ? 'success' : 'warning'} showIcon role="status" title={feedback} closable onClose={() => setFeedback(null)} />}
    {lookupError && <Alert className="borrow-page-alert" type="error" showIcon role="alert" title={lookupError} closable onClose={() => setLookupError('')} />}
    {loadState === 'loading' && <div className="borrow-loading" role="status"><Skeleton active paragraph={{ rows: 4 }} /></div>}
    {loadState === 'error' && <Alert className="borrow-page-alert" type="error" showIcon role="alert" title={loadError} action={<Button onClick={() => setReloadKey((key) => key + 1)}>Tải lại</Button>} />}
    {loadState === 'ready' && allRequests.length === 0 && <section className="borrow-empty"><h2>Không có yêu cầu đang chờ xử lý</h2><p>Yêu cầu mới sẽ xuất hiện tại đây sau khi thành viên đặt mượn.</p></section>}
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
