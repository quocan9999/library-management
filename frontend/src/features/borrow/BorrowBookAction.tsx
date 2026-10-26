import { Button, Modal } from 'antd';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { notify } = useAppNotification();
  const hasCreatePermission = usePermission('borrow:create');
  const canCreate = role === 'USER' && hasCreatePermission;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const canRequest = book.availableQuantity > 0;

  const submit = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      const created = await borrowApi.createRequest([book.id]);
      setConfirmOpen(false);
      if (onCreated) onCreated();
      else navigate(`/borrow-payment/${encodeURIComponent(created.loanCode)}`);
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
      {canRequest ? 'Đặt mượn' : 'Hết sách'}
    </Button>
    <Modal
      open={confirmOpen}
      title="Xác nhận yêu cầu mượn"
      okText={pending ? 'Đang gửi…' : 'Xác nhận đặt mượn'}
      cancelText="Xem lại"
      confirmLoading={pending}
      onCancel={() => { if (!pending) setConfirmOpen(false); }}
      onOk={() => { void submit(); }}
    >
      <p><strong>{book.title}</strong> · {book.author}</p>
      <p>Phí mượn đã công bố: {new Intl.NumberFormat('vi-VN').format(book.borrowFee)} ₫.</p>
      <p>Yêu cầu sẽ được xử lý theo tình trạng bản sách tại thời điểm máy chủ nhận.</p>
      <p>Chỉ xác nhận thành công khi máy chủ trả kết quả. Nếu kết nối hết thời gian chờ, hãy tải danh sách yêu cầu trước khi gửi lại.</p>
    </Modal>
  </div>;
}
