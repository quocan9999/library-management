import { Button, Modal } from 'antd';
import { useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { usePermission } from '../../auth/permissions';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { MAX_BORROW_BOOKS, borrowApi } from './api';
import { borrowErrorMessage, borrowErrorNotificationType } from './errors';
import type { CatalogBook } from './types';

interface BorrowBookActionProps {
  book: CatalogBook;
  onCreated?: () => void;
  selected?: boolean;
  selectionDisabled?: boolean;
  onToggleSelection?: (book: CatalogBook) => void;
}

export function BorrowBookAction({ book, onCreated, selected = false, selectionDisabled = false, onToggleSelection }: BorrowBookActionProps) {
  const { role } = useAuth();
  const { notify } = useAppNotification();
  const hasCreatePermission = usePermission('borrow:create');
  const canCreate = role === 'USER' && hasCreatePermission;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const waitlistAvailable = book.availableQuantity === 0 && book.waitlistCount < book.waitlistCap;
  const canRequest = book.availableQuantity > 0 || waitlistAvailable;

  const submit = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await borrowApi.createRequest([book.id]);
      setConfirmOpen(false);
      notify('success', {
        title: 'Đã tạo yêu cầu mượn',
        description: 'Trạng thái được xác nhận từ máy chủ.',
      });
      onCreated?.();
    } catch (error: unknown) {
      notify(borrowErrorNotificationType(error), {
        title: 'Không thể tạo yêu cầu mượn',
        description: borrowErrorMessage(error, 'create'),
      });
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  if (!canCreate) return null;

  if (onToggleSelection) {
    const selectionLabel = selected
      ? 'Đã chọn ✓'
      : !canRequest
        ? 'Hết sách'
        : selectionDisabled
          ? `Đã đủ ${MAX_BORROW_BOOKS} sách`
          : book.availableQuantity === 0
            ? 'Vào hàng chờ'
            : 'Chọn mượn';
    return <div className="borrow-action borrow-action--catalog">
      <Button
        type={selected ? 'default' : 'primary'}
        disabled={!selected && (!canRequest || selectionDisabled)}
        aria-pressed={selected}
        aria-label={`${selectionLabel} ${book.title}`}
        block
        onClick={() => onToggleSelection(book)}
      >{selectionLabel}</Button>
    </div>;
  }

  return <div className="borrow-action">
    <Button type="primary" disabled={!canRequest || pending} onClick={() => { setConfirmOpen(true); }}>
      {book.availableQuantity > 0 ? 'Đặt mượn' : waitlistAvailable ? 'Vào hàng chờ' : 'Đã đủ hàng chờ'}
    </Button>
    <Modal
      open={confirmOpen}
      title={waitlistAvailable ? 'Xác nhận vào hàng chờ' : 'Xác nhận yêu cầu mượn'}
      okText={pending ? 'Đang gửi…' : 'Xác nhận đặt mượn'}
      cancelText="Xem lại"
      confirmLoading={pending}
      onCancel={() => { if (!pending) setConfirmOpen(false); }}
      onOk={() => { void submit(); }}
    >
      <p><strong>{book.title}</strong> · {book.author}</p>
      <p>Phí mượn đã công bố: {new Intl.NumberFormat('vi-VN').format(book.borrowFee)} ₫.</p>
      <p>{waitlistAvailable
        ? `Hiện có ${book.waitlistCount} người trong hàng chờ; sức chứa tối đa ${book.waitlistCap}.`
        : 'Yêu cầu sẽ được xử lý theo tình trạng bản sách tại thời điểm máy chủ nhận.'}</p>
      <p>Chỉ xác nhận thành công khi máy chủ trả kết quả. Nếu kết nối hết thời gian chờ, hãy tải danh sách yêu cầu trước khi gửi lại.</p>
    </Modal>
  </div>;
}
