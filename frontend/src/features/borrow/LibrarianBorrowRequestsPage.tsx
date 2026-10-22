import { Alert, Button, Checkbox, Modal } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { formatVnd } from '../books/formatting';
import { borrowApi } from './api';
import { borrowErrorCode, borrowErrorMessage, borrowErrorNotificationType, borrowErrorStatus } from './errors';
import { LibrarianBorrowRequestModal } from './LibrarianBorrowRequestModal';
import { LibrarianCounterBorrowRequestModal } from './LibrarianCounterBorrowRequestModal';
import { LibrarianBorrowRequestFilters } from './LibrarianBorrowRequestFilters';
import { LibrarianBorrowRequestTable } from './LibrarianBorrowRequestTable';
import {
  getRequestFeeTotal,
  getReadyItems,
  type StaffDeskFilter,
} from './staffBorrowPresentation';
import type { BorrowItem, HandoverRequest, PageResponse, StaffBorrowRequest } from './types';

type ItemAction = 'cancel' | 'reject';
type DrawerRequestState = {
  reference: string;
  retryKey: number;
  status: 'loading' | 'ready' | 'error';
  request?: StaffBorrowRequest;
  error?: string;
};

export function LibrarianBorrowRequestsPage() {
  const { permissions } = useAuth();
  const { notify } = useAppNotification();
  const canPrepare = permissions.includes('borrow:prepare');
  const canCancel = permissions.includes('borrow:cancel');
  const canHandover = permissions.includes('borrow:handover') && permissions.includes('borrow:fee-confirm');
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedReference = searchParams.get('request')?.trim() ?? '';
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<StaffDeskFilter>('ALL');
  const [loaded, setLoaded] = useState<{ key: string; data: PageResponse<StaffBorrowRequest> } | null>(null);
  const [loadFailure, setLoadFailure] = useState<{ key: string; message: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailRetryKey, setDetailRetryKey] = useState(0);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [lookupValue, setLookupValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState('createdAt,desc');
  const [drawerRequestState, setDrawerRequestState] = useState<DrawerRequestState | null>(null);
  const [counterFeesCollected, setCounterFeesCollected] = useState<Set<string>>(() => new Set());
  const [handoverRequest, setHandoverRequest] = useState<StaffBorrowRequest | null>(null);
  const [counterCreateOpen, setCounterCreateOpen] = useState(false);
  const [cancelAction, setCancelAction] = useState<{ request: StaffBorrowRequest; item: BorrowItem } | null>(null);
  const [rejectAction, setRejectAction] = useState<{ request: StaffBorrowRequest; item: BorrowItem } | null>(null);
  const actionLock = useRef(false);

  const requestKey = JSON.stringify([page, filter, searchQuery, sort, reloadKey]);
  const result = loaded?.key === requestKey ? loaded.data : null;
  const loadError = loadFailure?.key === requestKey ? loadFailure.message : '';
  const loadState = result ? 'ready' : loadError ? 'error' : 'loading';
  const detailStateMatches = drawerRequestState?.reference === selectedReference
    && drawerRequestState.retryKey === detailRetryKey;
  const selectedRequest = detailStateMatches && drawerRequestState?.status === 'ready'
    ? drawerRequestState.request ?? null
    : null;
  const detailLoading = selectedReference !== '' && (!detailStateMatches || drawerRequestState?.status === 'loading');
  const detailFailure = detailStateMatches && drawerRequestState?.status === 'error'
    ? drawerRequestState.error ?? ''
    : '';
  useEffect(() => {
    let current = true;
    void borrowApi.listStaff(page - 1, filter, undefined, searchQuery, sort)
      .then((data) => {
        if (!current) return;
        if (data.totalPages > 0 && page > data.totalPages) {
          setPage(data.totalPages);
          return;
        }
        setLoaded({ key: requestKey, data });
      })
      .catch((error: unknown) => {
        if (current) setLoadFailure({ key: requestKey, message: borrowErrorMessage(error, 'read') });
      });
    return () => { current = false; };
  }, [filter, page, reloadKey, requestKey, searchQuery, sort]);

  useEffect(() => {
    if (!selectedReference) return;
    if (drawerRequestState?.reference === selectedReference && drawerRequestState.retryKey === detailRetryKey) return;

    let current = true;
    void borrowApi.findPickup(selectedReference)
      .then((request) => {
        if (current) setDrawerRequestState({ reference: selectedReference, retryKey: detailRetryKey, status: 'ready', request });
      })
      .catch((error: unknown) => {
        if (current) setDrawerRequestState({ reference: selectedReference, retryKey: detailRetryKey, status: 'error', error: borrowErrorMessage(error, 'read') });
      });
    return () => { current = false; };
  }, [selectedReference, drawerRequestState?.reference, drawerRequestState?.retryKey, detailRetryKey]);

  const closeDrawer = () => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('request');
      return next;
    });
    setHandoverRequest(null);
    setCounterFeesCollected((current) => {
      const next = new Set(current);
      if (selectedRequest) next.delete(selectedRequest.loanCode);
      return next;
    });
  };

  const openRequest = (request: StaffBorrowRequest) => {
    setDrawerRequestState({ reference: request.pickupReference, retryKey: detailRetryKey, status: 'ready', request });
    setCounterFeesCollected((current) => {
      const next = new Set(current);
      next.delete(request.loanCode);
      return next;
    });
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('request', request.pickupReference);
      return next;
    });
  };

  const refreshAfterConflict = (error: unknown, request: StaffBorrowRequest) => {
    const code = borrowErrorCode(error);
    const staleRequest = borrowErrorStatus(error) === 409
      || code === 'BORROW_FEE_MISMATCH'
      || code === 'BORROW_INVALID_HANDOVER_SET';
    if (!staleRequest) return;

    setReloadKey((key) => key + 1);
    setCounterFeesCollected((current) => {
      const next = new Set(current);
      next.delete(request.loanCode);
      return next;
    });
    setHandoverRequest((current) => current?.loanCode === request.loanCode ? null : current);
    if (selectedReference === request.pickupReference) {
      void borrowApi.findPickup(request.pickupReference)
        .then((fresh) => {
          setDrawerRequestState({ reference: request.pickupReference, retryKey: detailRetryKey, status: 'ready', request: fresh });
        })
        .catch((refreshError: unknown) => setDrawerRequestState({
          reference: request.pickupReference,
          retryKey: detailRetryKey,
          status: 'error',
          error: borrowErrorMessage(refreshError, 'read'),
        }));
    }
  };

  const markSelectedBooksPrepared = async (request: StaffBorrowRequest, itemIds: number[]) => {
    if (itemIds.length === 0 || !canPrepare || actionLock.current) return;

    actionLock.current = true;
    setPendingKey(`${request.loanCode}:prepare-selected`);
    try {
      const updatedRequest = await borrowApi.markPrepared(request.loanCode, itemIds);
      setDrawerRequestState((current) => current?.request?.loanCode === request.loanCode
        ? { ...current, status: 'ready', request: updatedRequest }
        : current);
      setCounterFeesCollected((current) => {
        const next = new Set(current);
        next.delete(request.loanCode);
        return next;
      });
      setReloadKey((key) => key + 1);
      notify('success', {
        title: 'Đã chuẩn bị sách',
        description: `Đã chuyển ${itemIds.length} cuốn sang sẵn sàng nhận. Thông báo nhận sách sẽ được gửi trong một email.`,
      });
    } catch (error: unknown) {
      refreshAfterConflict(error, request);
      notify(borrowErrorNotificationType(error), {
        title: 'Không thể xác nhận đã chuẩn bị sách',
        description: borrowErrorMessage(error),
      });
    } finally {
      actionLock.current = false;
      setPendingKey(null);
    }
  };

  const runItemAction = async (request: StaffBorrowRequest, itemId: number, action: ItemAction) => {
    if (actionLock.current) return;
    actionLock.current = true;
    const nextPendingKey = `${request.loanCode}:${itemId}`;
    setPendingKey(nextPendingKey);
    try {
      let updated: StaffBorrowRequest;
      if (action === 'cancel') updated = await borrowApi.cancelReady(request.loanCode, itemId);
      else updated = await borrowApi.reject(request.loanCode, itemId);

      setDrawerRequestState((current) => current?.request?.loanCode === request.loanCode
        ? { ...current, status: 'ready', request: updated }
        : current);
      if (action === 'cancel') setCancelAction(null);
      if (action === 'reject') setRejectAction(null);
      setCounterFeesCollected((current) => {
        const next = new Set(current);
        next.delete(request.loanCode);
        return next;
      });
      notify('success', {
        title: action === 'cancel' ? 'Đã hủy sách READY' : 'Đã ghi nhận kết quả kiểm tra',
        description: action === 'cancel'
          ? 'Đã hủy sách theo yêu cầu thành viên.'
          : 'Đã ghi nhận không tìm thấy bản sách vật lý; không tăng số bản sẵn có.',
      });
      setReloadKey((key) => key + 1);
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

  const applySearch = () => {
    const reference = lookupValue.trim();
    setSearchQuery(reference);
    setPage(1);
    setReloadKey((key) => key + 1);
  };

  const completeHandover = async () => {
    if (!handoverRequest || !canHandover
      || (handoverRequest.origin === 'COUNTER' && !counterFeesCollected.has(handoverRequest.loanCode))
      || actionLock.current) return;
    const readyItems = getReadyItems(handoverRequest);
    if (readyItems.length === 0) return;

    actionLock.current = true;
    setPendingKey(`${handoverRequest.loanCode}:handover`);
    const body: HandoverRequest = {
      identityVerified: true,
      expectedLoanVersion: handoverRequest.version,
      items: handoverRequest.origin === 'COUNTER'
        ? readyItems.map((item) => ({ loanItemId: item.id, collectedBorrowFee: item.borrowFee }))
        : [],
    };
    try {
      const updated = await borrowApi.handover(handoverRequest.loanCode, body);
      setDrawerRequestState((current) => current?.request?.loanCode === handoverRequest.loanCode
        ? { ...current, status: 'ready', request: updated }
        : current);
      setHandoverRequest(null);
      setCounterFeesCollected((current) => {
        const next = new Set(current);
        next.delete(handoverRequest.loanCode);
        return next;
      });
      notify('success', {
        title: 'Đã hoàn tất bàn giao',
        description: handoverRequest.origin === 'COUNTER'
          ? 'Đã xác nhận khoản thu tại quầy và bàn giao toàn bộ sách READY còn lại.'
          : 'Đã bàn giao toàn bộ sách READY còn lại; phí đã được thanh toán trực tuyến.',
      });
      setReloadKey((key) => key + 1);
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

  const retryDrawerRequest = () => setDetailRetryKey((key) => key + 1);

  const copyReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference);
      notify('success', { title: 'Đã sao chép mã QR', description: 'Mã nhận sách đã được sao chép.' });
    } catch {
      notify('error', { title: 'Không thể sao chép mã QR', description: 'Trình duyệt không cho phép sao chép vào bộ nhớ tạm.' });
    }
  };

  const emptyCopy = useMemo(() => filter === 'ALL' && !searchQuery
    ? { title: 'Chưa có yêu cầu mượn', description: 'Quét mã QR để tra cứu hoặc đổi bộ lọc trạng thái.' }
    : { title: 'Không có yêu cầu phù hợp', description: 'Kiểm tra lại từ khóa hoặc xóa bộ lọc để xem tất cả yêu cầu.' }, [filter, searchQuery]);
  const modalHandoverFee = handoverRequest ? getRequestFeeTotal(handoverRequest) : 0;
  const handoverBooks = handoverRequest
    ? Array.from(getReadyItems(handoverRequest).reduce((groups, item) => {
      const current = groups.get(item.bookId) ?? { id: item.bookId, title: item.title, quantity: 0, fee: 0 };
      current.quantity += 1;
      current.fee += item.borrowFee;
      groups.set(item.bookId, current);
      return groups;
    }, new Map<number, { id: number; title: string; quantity: number; fee: number }>()).values())
    : [];

  return <main className="role-stage member-stage">
    <section className="role-workspace member-workspace" aria-labelledby="staff-borrow-heading">
    <header className="role-heading">
      <div>
        <h1 id="staff-borrow-heading">Xử lý yêu cầu mượn tại quầy</h1>
        <p className="role-intro">Tra cứu yêu cầu, chuẩn bị sách và xác nhận bàn giao tại quầy.</p>
      </div>
      <div className="librarian-borrow-page__heading-actions">
        {canPrepare && <Button type="primary" onClick={() => setCounterCreateOpen(true)}>Tạo yêu cầu tại quầy</Button>}
        <Button onClick={() => setReloadKey((key) => key + 1)}>Tải lại danh sách</Button>
      </div>
    </header>

    <LibrarianBorrowRequestFilters
      value={filter}
      onChange={(nextFilter) => { setFilter(nextFilter); setPage(1); }}
      lookupValue={lookupValue}
      lookupLoading={loadState === 'loading'}
      onLookupChange={(value) => {
        setLookupValue(value);
        if (!value.trim()) { setSearchQuery(''); setPage(1); }
      }}
      onLookup={applySearch}
      onClear={() => { setFilter('ALL'); setLookupValue(''); setSearchQuery(''); setSort('createdAt,desc'); setPage(1); }}
    />

    {loadState === 'error' && <Alert
      className="librarian-borrow-page-error"
      type="error"
      showIcon
      role="alert"
      title={loadError}
      action={<Button onClick={() => setReloadKey((key) => key + 1)}>Tải lại</Button>}
    />}
    {loadState !== 'error' && <LibrarianBorrowRequestTable
      result={result}
      loading={loadState === 'loading'}
      page={page}
      sort={sort}
      onSortChange={(nextSort) => { setSort(nextSort); setPage(1); }}
      emptyTitle={emptyCopy.title}
      emptyDescription={emptyCopy.description}
      onPageChange={setPage}
      onOpen={openRequest}
    />}

    <LibrarianBorrowRequestModal
      open={selectedReference !== ''}
      loading={detailLoading}
      error={detailFailure}
      request={selectedRequest?.pickupReference === selectedReference ? selectedRequest : null}
      canPrepare={canPrepare}
      canCancel={canCancel}
      canHandover={canHandover}
      pendingKey={pendingKey}
      onClose={closeDrawer}
      onRetry={retryDrawerRequest}
      onMarkPrepared={(request, itemIds) => { void markSelectedBooksPrepared(request, itemIds); }}
      onCancelReady={(request, item) => setCancelAction({ request, item })}
      onReject={(request, item) => setRejectAction({ request, item })}
      onHandover={setHandoverRequest}
      onCopyReference={(reference) => { void copyReference(reference); }}
    />

    <LibrarianCounterBorrowRequestModal
      open={counterCreateOpen}
      onClose={() => setCounterCreateOpen(false)}
      onCreated={(request) => {
        setCounterCreateOpen(false);
        setFilter('ALL');
        setLookupValue('');
        setSearchQuery('');
        setSort('createdAt,desc');
        setPage(1);
        setReloadKey((key) => key + 1);
        openRequest(request);
      }}
    />

    <Modal
      open={cancelAction !== null}
      title="Xác nhận hủy sách READY"
      okText="Xác nhận hủy sách"
      cancelText="Quay lại"
      confirmLoading={cancelAction !== null && pendingKey === `${cancelAction.request.loanCode}:${cancelAction.item.id}`}
      onCancel={() => { if (pendingKey === null) setCancelAction(null); }}
      onOk={() => {
        if (cancelAction) void runItemAction(cancelAction.request, cancelAction.item.id, 'cancel');
      }}
    >
      {cancelAction && <p>Thành viên {cancelAction.request.member.fullName} đã yêu cầu hủy “{cancelAction.item.title}”.
        {cancelAction.request.origin === 'ONLINE' && cancelAction.item.paidBorrowFee > 0
          ? ' Khoản phí đã thanh toán trên website; hãy hoàn lại trực tiếp cho thành viên tại quầy. Hệ thống không tự hoàn tiền.'
          : ' Nếu đã thu phí trực tiếp, hãy hoàn lại cho thành viên tại quầy.'}</p>}
    </Modal>

    <Modal
      open={rejectAction !== null}
      title="Xác nhận không tìm thấy bản sách"
      okText="Xác nhận không tìm thấy sách"
      cancelText="Quay lại"
      okButtonProps={{ danger: true }}
      confirmLoading={rejectAction !== null && pendingKey === `${rejectAction.request.loanCode}:${rejectAction.item.id}`}
      onCancel={() => { if (pendingKey === null) setRejectAction(null); }}
      onOk={() => {
        if (rejectAction) void runItemAction(rejectAction.request, rejectAction.item.id, 'reject');
      }}
    >
      {rejectAction && <p>Ghi nhận “{rejectAction.item.title}” không tìm thấy tại quầy. Trạng thái sẽ chuyển sang REJECTED; thao tác này không làm tăng số bản sẵn có.</p>}
    </Modal>

    <Modal
      open={handoverRequest !== null}
      title="Xác nhận bàn giao sách"
      okText="Xác nhận bàn giao sách"
      cancelText="Quay lại"
      confirmLoading={pendingKey === `${handoverRequest?.loanCode}:handover`}
      okButtonProps={{ disabled: !handoverRequest
        || (handoverRequest.origin === 'COUNTER' && !counterFeesCollected.has(handoverRequest.loanCode)) }}
      onCancel={() => { if (pendingKey === null) setHandoverRequest(null); }}
      onOk={() => { void completeHandover(); }}
    >
      {handoverRequest && <>
        <p>Xác nhận thành viên <strong>{handoverRequest.member.fullName}</strong> · {handoverRequest.member.memberCode} đã nhận đúng các sách sau.</p>
        <ul className="handover-fee-list">
          {handoverBooks.map((book) => <li key={book.id}>
            <span>{book.title}</span>
            <strong>{book.quantity} cuốn</strong>
            {handoverRequest.origin === 'COUNTER' && <span>{book.fee > 0 ? formatVnd(book.fee) : 'Miễn phí'}</span>}
          </li>)}
        </ul>
        {handoverRequest.origin === 'COUNTER' && <>
          <p>Tổng phí cần thu trực tiếp tại quầy: <strong>{formatVnd(modalHandoverFee)}</strong>.</p>
          <Checkbox
            checked={counterFeesCollected.has(handoverRequest.loanCode)}
            disabled={pendingKey !== null}
            onChange={(event) => setCounterFeesCollected((current) => {
              const next = new Set(current);
              if (event.target.checked) next.add(handoverRequest.loanCode);
              else next.delete(handoverRequest.loanCode);
              return next;
            })}
          >Đã thu đủ phí mượn tại quầy</Checkbox>
        </>}
      </>}
    </Modal>
    </section>
  </main>;
}
