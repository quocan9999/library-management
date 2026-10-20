import { Alert, Button, Modal } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { formatVnd } from '../books/formatting';
import { borrowApi } from './api';
import { borrowErrorCode, borrowErrorMessage, borrowErrorNotificationType, borrowErrorStatus } from './errors';
import { LibrarianBorrowRequestDrawer } from './LibrarianBorrowRequestDrawer';
import { LibrarianBorrowRequestFilters } from './LibrarianBorrowRequestFilters';
import { LibrarianBorrowRequestTable } from './LibrarianBorrowRequestTable';
import {
  getRequestFeeTotal,
  getReadyItems,
  type StaffDeskFilter,
} from './staffBorrowPresentation';
import type { BorrowItem, HandoverRequest, PageResponse, StaffBorrowRequest } from './types';

type ItemAction = 'prepare' | 'ready' | 'cancel' | 'reject';
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
  const [verifiedLoans, setVerifiedLoans] = useState<Set<string>>(() => new Set());
  const [handoverRequest, setHandoverRequest] = useState<StaffBorrowRequest | null>(null);
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
  const identityVerified = selectedRequest !== null && verifiedLoans.has(selectedRequest.loanCode);

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
    setVerifiedLoans((current) => {
      const next = new Set(current);
      if (selectedRequest) next.delete(selectedRequest.loanCode);
      return next;
    });
    setHandoverRequest(null);
  };

  const openRequest = (request: StaffBorrowRequest) => {
    setDrawerRequestState({ reference: request.pickupReference, retryKey: detailRetryKey, status: 'ready', request });
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
    setVerifiedLoans((current) => {
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

  const runItemAction = async (request: StaffBorrowRequest, itemId: number, action: ItemAction) => {
    if (actionLock.current) return;
    actionLock.current = true;
    const nextPendingKey = `${request.loanCode}:${itemId}`;
    setPendingKey(nextPendingKey);
    try {
      let updated: StaffBorrowRequest;
      if (action === 'prepare') updated = await borrowApi.prepare(request.loanCode, itemId);
      else if (action === 'ready') updated = await borrowApi.markReady(request.loanCode, itemId);
      else if (action === 'cancel') updated = await borrowApi.cancelReady(request.loanCode, itemId);
      else updated = await borrowApi.reject(request.loanCode, itemId);

      setDrawerRequestState((current) => current?.request?.loanCode === request.loanCode
        ? { ...current, status: 'ready', request: updated }
        : current);
      if (action === 'cancel') setCancelAction(null);
      if (action === 'reject') setRejectAction(null);
      setVerifiedLoans((current) => {
        const next = new Set(current);
        next.delete(request.loanCode);
        return next;
      });
      notify('success', {
        title: action === 'cancel' ? 'Đã hủy sách READY' : action === 'reject' ? 'Đã ghi nhận kết quả kiểm tra' : 'Đã cập nhật trạng thái',
        description: action === 'cancel'
          ? 'Đã hủy sách theo yêu cầu thành viên.'
          : action === 'reject'
            ? 'Đã ghi nhận không tìm thấy bản sách vật lý; không tăng số bản sẵn có.'
            : 'Trạng thái được xác nhận từ máy chủ.',
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
    if (!handoverRequest || !canHandover || !verifiedLoans.has(handoverRequest.loanCode) || actionLock.current) return;
    const readyItems = getReadyItems(handoverRequest);
    if (readyItems.length === 0) return;

    actionLock.current = true;
    setPendingKey(`${handoverRequest.loanCode}:handover`);
    const body: HandoverRequest = {
      identityVerified: true,
      expectedLoanVersion: handoverRequest.version,
      items: readyItems.map((item) => ({ loanItemId: item.id, collectedBorrowFee: item.borrowFee })),
    };
    try {
      const updated = await borrowApi.handover(handoverRequest.loanCode, body);
      setDrawerRequestState((current) => current?.request?.loanCode === handoverRequest.loanCode
        ? { ...current, status: 'ready', request: updated }
        : current);
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
  const handoverConfirmText = modalHandoverFee > 0
    ? `Xác nhận thu ${formatVnd(modalHandoverFee)} và bàn giao`
    : 'Xác nhận miễn phí và bàn giao';

  return <main className="role-stage member-stage">
    <section className="role-workspace member-workspace" aria-labelledby="staff-borrow-heading">
    <header className="role-heading">
      <div>
        <p className="role-eyebrow">QUẦY DỊCH VỤ THƯ VIỆN</p>
        <h1 id="staff-borrow-heading">Xử lý yêu cầu mượn tại quầy</h1>
        <p className="role-intro">Tra cứu yêu cầu và mở chi tiết để chuẩn bị sách, xác nhận phí và bàn giao tại quầy.</p>
      </div>
      <Button onClick={() => setReloadKey((key) => key + 1)}>Tải lại danh sách</Button>
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

    <LibrarianBorrowRequestDrawer
      open={selectedReference !== ''}
      loading={detailLoading}
      error={detailFailure}
      request={selectedRequest?.pickupReference === selectedReference ? selectedRequest : null}
      canPrepare={canPrepare}
      canCancel={canCancel}
      canHandover={canHandover}
      pendingKey={pendingKey}
      identityVerified={identityVerified}
      onIdentityVerifiedChange={(verified) => {
        if (!selectedRequest) return;
        setVerifiedLoans((current) => {
          const next = new Set(current);
          if (verified) next.add(selectedRequest.loanCode);
          else next.delete(selectedRequest.loanCode);
          return next;
        });
      }}
      onClose={closeDrawer}
      onRetry={retryDrawerRequest}
      onPrepare={(request, itemId, action) => { void runItemAction(request, itemId, action); }}
      onCancelReady={(request, item) => setCancelAction({ request, item })}
      onReject={(request, item) => setRejectAction({ request, item })}
      onHandover={setHandoverRequest}
      onCopyReference={(reference) => { void copyReference(reference); }}
    />

    <Modal
      open={cancelAction !== null}
      title="Xác nhận hủy sách READY"
      okText="Xác nhận hủy READY"
      cancelText="Quay lại"
      confirmLoading={cancelAction !== null && pendingKey === `${cancelAction.request.loanCode}:${cancelAction.item.id}`}
      onCancel={() => { if (pendingKey === null) setCancelAction(null); }}
      onOk={() => {
        if (cancelAction) void runItemAction(cancelAction.request, cancelAction.item.id, 'cancel');
      }}
    >
      {cancelAction && <p>Thành viên {cancelAction.request.member.fullName} đã yêu cầu hủy “{cancelAction.item.title}” trước khi thu phí.</p>}
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
      title="Xác nhận phí và bàn giao"
      okText={handoverConfirmText}
      cancelText="Quay lại"
      confirmLoading={pendingKey === `${handoverRequest?.loanCode}:handover`}
      okButtonProps={{ disabled: !handoverRequest || !verifiedLoans.has(handoverRequest.loanCode) }}
      onCancel={() => { if (pendingKey === null) setHandoverRequest(null); }}
      onOk={() => { void completeHandover(); }}
    >
      {handoverRequest && <>
        <p>Xác nhận thành viên <strong>{handoverRequest.member.fullName}</strong> · {handoverRequest.member.memberCode} đã nhận đúng các sách sau.</p>
        <ul className="handover-fee-list">
          {getReadyItems(handoverRequest).map((item) => <li key={item.id}>
            <span>{item.title}</span><strong>{item.borrowFee > 0 ? formatVnd(item.borrowFee) : 'Miễn phí'}</strong>
          </li>)}
        </ul>
        <p>Hệ thống xác nhận phí và bàn giao toàn bộ sách READY còn lại trong cùng một giao dịch. Mỗi khoản phí, kể cả 0 ₫, đều cần được xác nhận.</p>
      </>}
    </Modal>
    </section>
  </main>;
}
