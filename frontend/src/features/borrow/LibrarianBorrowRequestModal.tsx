import { Alert, Button, Checkbox, Descriptions, Modal, Skeleton, Tag, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatVnd } from '../books/formatting';
import type { BorrowItem, StaffBorrowRequest } from './types';
import {
  formatDeskDate,
  getReadyItems,
  getRequestFeeTotal,
  ITEM_STATUS_LABELS,
  statusTagColor,
} from './staffBorrowPresentation';

interface LibrarianBorrowRequestModalProps {
  open: boolean;
  loading: boolean;
  error: string;
  request: StaffBorrowRequest | null;
  canPrepare: boolean;
  canCancel: boolean;
  canHandover: boolean;
  canReturn?: boolean;
  pendingKey: string | null;
  onClose: () => void;
  onRetry: () => void;
  onMarkPrepared: (request: StaffBorrowRequest, itemIds: number[]) => void;
  onCancelReady: (request: StaffBorrowRequest, item: BorrowItem) => void;
  onReject: (request: StaffBorrowRequest, item: BorrowItem) => void;
  onHandover: (request: StaffBorrowRequest) => void;
  onReturn?: (request: StaffBorrowRequest, itemIds: number[], physicalBookReceived: boolean, lateFeeCollected: boolean) => void;
  onCopyReference: (reference: string) => void;
}

function formatFee(amount: number): string {
  return amount > 0 ? formatVnd(amount) : 'Không thu phí';
}

function ItemAction({
  item,
  request,
  pendingKey,
  canCancel,
  canPrepare,
  onCancelReady,
  onReject,
}: Pick<LibrarianBorrowRequestModalProps, 'pendingKey' | 'canCancel' | 'canPrepare' | 'onCancelReady' | 'onReject'> & {
  item: BorrowItem;
  request: StaffBorrowRequest;
}) {
  const loading = pendingKey === `${request.loanCode}:${item.id}`;

  return <div className="librarian-borrow-modal-item__actions">
    {canPrepare && ['RESERVED', 'PREPARING'].includes(item.status) && <Button
      danger
      disabled={pendingKey !== null}
      loading={loading}
      onClick={() => onReject(request, item)}
    >Ghi nhận không tìm thấy sách</Button>}
    {canCancel && item.status === 'READY_FOR_PICKUP' && <Button
      danger
      disabled={pendingKey !== null}
      loading={loading}
      onClick={() => onCancelReady(request, item)}
    >Hủy READY theo yêu cầu thành viên</Button>}
  </div>;
}

export function LibrarianBorrowRequestModal(props: LibrarianBorrowRequestModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [selectedPreparationIds, setSelectedPreparationIds] = useState<Set<number>>(() => new Set());
  const [selectedReturnIds, setSelectedReturnIds] = useState<Set<number>>(() => new Set());
  const [physicalBookReceived, setPhysicalBookReceived] = useState(false);
  const [lateFeeCollected, setLateFeeCollected] = useState(false);
  const request = props.request;
  const readyItems = request ? getReadyItems(request) : [];
  const preparationItems = request && props.canPrepare
    ? request.items.filter((item) => ['RESERVED', 'PREPARING'].includes(item.status))
    : [];
  const selectedPreparationItems = preparationItems.filter((item) => selectedPreparationIds.has(item.id));
  const borrowedItems = request?.items.filter((item) => item.status === 'BORROWED') ?? [];
  const selectedReturnItems = borrowedItems.filter((item) => selectedReturnIds.has(item.id));
  const isCounterRequest = request?.origin === 'COUNTER';
  const totalFee = request && isCounterRequest ? getRequestFeeTotal(request) : 0;
  const inactiveStatuses = ['CANCELLED', 'REJECTED', 'EXPIRED'];
  const preparingWarningCount = request?.preparingOverdueItemIds.length ?? 0;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const returnItemsOverdueMap = useMemo(() => {
    const map = new Map<number, { overdueDays: number; calculatedLateFee: number }>();
    for (const item of borrowedItems) {
      if (item.dueDate && item.dueDate < todayStr) {
        const due = new Date(item.dueDate + 'T00:00:00Z');
        const todayDate = new Date(todayStr + 'T00:00:00Z');
        const diffMs = todayDate.getTime() - due.getTime();
        const overdueDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        const calculatedLateFee = overdueDays * item.lateFeePerDay;
        map.set(item.id, { overdueDays, calculatedLateFee });
      }
    }
    return map;
  }, [borrowedItems, todayStr]);

  const totalSelectedLateFee = useMemo(() => {
    let sum = 0;
    for (const item of selectedReturnItems) {
      const overdue = returnItemsOverdueMap.get(item.id);
      if (overdue) sum += overdue.calculatedLateFee;
    }
    return sum;
  }, [selectedReturnItems, returnItemsOverdueMap]);

  const hasSelectedOverdue = totalSelectedLateFee > 0;

  useEffect(() => {
    setSelectedPreparationIds(new Set());
    setSelectedReturnIds(new Set());
    setPhysicalBookReceived(false);
    setLateFeeCollected(false);
  }, [request?.loanCode]);

  return <Modal
    rootClassName="librarian-borrow-modal"
    open={props.open}
    centered
    width={880}
    keyboard
    closable={false}
    onCancel={props.onClose}
    afterOpenChange={(open) => { if (open) closeButtonRef.current?.focus(); }}
    title={<div className="librarian-borrow-modal__title">
      <span className="sr-only">{request?.loanCode ?? 'Chi tiết yêu cầu mượn'}</span>
      <Button ref={closeButtonRef} aria-label="Đóng chi tiết yêu cầu" onClick={props.onClose}>Đóng</Button>
    </div>}
    footer={request ? <div className="librarian-borrow-modal__footer">
      <div className="librarian-borrow-modal__total">
        <Typography.Text type="secondary">
          {selectedReturnItems.length > 0 ? 'Tổng phạt trễ đã chọn:' : 'Tổng phí mượn:'}
        </Typography.Text>
        <Typography.Text strong>
          {formatVnd(selectedReturnItems.length > 0 ? totalSelectedLateFee : totalFee)}
        </Typography.Text>
      </div>
      {selectedReturnItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginBottom: '12px', padding: '12px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: '6px' }}>
          <Checkbox
            checked={physicalBookReceived}
            onChange={(e) => setPhysicalBookReceived(e.target.checked)}
          >
            <strong>Xác nhận đã nhận sách vật lý tại quầy từ độc giả</strong>
          </Checkbox>
          {hasSelectedOverdue && (
            <Checkbox
              checked={lateFeeCollected}
              onChange={(e) => setLateFeeCollected(e.target.checked)}
            >
              <span style={{ color: '#cf1322' }}>
                <strong>Xác nhận đã thu đủ tiền phạt trễ hạn: {formatVnd(totalSelectedLateFee)} tại quầy (Bắt buộc)</strong>
              </span>
            </Checkbox>
          )}
        </div>
      )}
      <div className="librarian-borrow-modal__footer-actions">
        {preparationItems.length > 0 && <>
          <Typography.Text type="secondary">
            {selectedPreparationItems.length > 0
              ? `Đã chọn ${selectedPreparationItems.length} cuốn sách`
              : 'Chọn sách đã chuẩn bị xong.'}
          </Typography.Text>
          <Button
            type="primary"
            disabled={selectedPreparationItems.length === 0 || props.pendingKey !== null}
            loading={props.pendingKey === `${request.loanCode}:prepare-selected`}
            onClick={() => props.onMarkPrepared(request, selectedPreparationItems.map((item) => item.id))}
          >Đã chuẩn bị sách</Button>
        </>}
        {props.canHandover && readyItems.length > 0 && <>
          <Button
            type="primary"
            disabled={props.pendingKey !== null}
            onClick={() => props.onHandover(request)}
          >Xác nhận bàn giao sách</Button>
        </>}
        {props.canReturn && selectedReturnItems.length > 0 && (
          <Button
            type="primary"
            disabled={
              props.pendingKey !== null ||
              !physicalBookReceived ||
              (hasSelectedOverdue && !lateFeeCollected)
            }
            loading={props.pendingKey === `${request.loanCode}:return-selected`}
            onClick={() => {
              if (props.onReturn) {
                props.onReturn(
                  request,
                  selectedReturnItems.map((item) => item.id),
                  physicalBookReceived,
                  lateFeeCollected
                );
              }
            }}
          >
            Xác nhận nhận trả {selectedReturnItems.length} cuốn sách
          </Button>
        )}
        {preparationItems.length === 0 && !(props.canHandover && readyItems.length > 0) && selectedReturnItems.length === 0 && <Button onClick={props.onClose}>Đóng chi tiết</Button>}
      </div>
    </div> : null}
    styles={{
      body: { padding: 0, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' },
      footer: { padding: 0 },
    }}
  >
    <div className="librarian-borrow-modal__body">
      {props.loading && <div className="librarian-borrow-modal__loading" role="status"><Skeleton active paragraph={{ rows: 5 }} /></div>}
      {!props.loading && props.error && <Alert
        className="librarian-borrow-modal__error"
        type="error"
        showIcon
        role="alert"
        title={props.error}
        action={<Button onClick={props.onRetry}>Thử lại</Button>}
      />}
      {!props.loading && !props.error && request && <>
        {preparingWarningCount > 0 && <Alert
          className="librarian-borrow-modal__warning"
          type="warning"
          showIcon
          role="status"
          title={`Có ${preparingWarningCount} sách đã ở trạng thái chuẩn bị quá 24 giờ. Hãy kiểm tra và cập nhật trạng thái tại quầy.`}
        />}
        <section className="librarian-borrow-modal__section" aria-label="Thông tin yêu cầu">
          <Typography.Title level={5}>Thông tin yêu cầu</Typography.Title>
          <Descriptions size="small" column={1} colon={false}>
            <Descriptions.Item label="Thành viên">
              <span className="librarian-borrow-modal__member">
                <Typography.Text strong>{request.member.fullName}</Typography.Text>
                <Typography.Text type="secondary">{request.member.memberCode}</Typography.Text>
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">{formatDeskDate(request.createdAt)}</Descriptions.Item>
          </Descriptions>
          <div className="librarian-borrow-modal__qr">
            <QRCodeSVG value={request.pickupReference} size={104} level="M" title={`Mã QR của yêu cầu ${request.loanCode}`} />
            <div>
              <Typography.Text strong>Mã QR nhận sách</Typography.Text>
              <Typography.Text code className="librarian-borrow-modal__reference">{request.pickupReference}</Typography.Text>
              <Button size="small" onClick={() => props.onCopyReference(request.pickupReference)}>Sao chép mã</Button>
            </div>
          </div>
        </section>

        <section className="librarian-borrow-modal__section" aria-label="Sách trong yêu cầu">
          <div className="librarian-borrow-modal__section-heading">
            <Typography.Title level={5}>Sách trong yêu cầu</Typography.Title>
            <Typography.Text type="secondary">{request.items.length} cuốn</Typography.Text>
          </div>
          <div className="librarian-borrow-modal__items">
            {request.items.map((item) => {
              const isReady = item.status === 'READY_FOR_PICKUP';
              const feeInactive = inactiveStatuses.includes(item.status);
              return <article key={item.id} className="librarian-borrow-modal-item" data-loan-item={item.id}>
                <div className="librarian-borrow-modal-item__heading">
                  <div className="librarian-borrow-modal-item__book">
                    <Typography.Text strong ellipsis={{ tooltip: item.title }}>{item.title}</Typography.Text>
                    <Typography.Text type="secondary">{item.bookCode} · {item.author}</Typography.Text>
                  </div>
                  <Tag color={statusTagColor(item.status)}>{ITEM_STATUS_LABELS[item.status === 'PREPARING' ? 'RESERVED' : item.status]}</Tag>
                </div>
                {preparationItems.some((preparationItem) => preparationItem.id === item.id) && <Checkbox
                  aria-label={`Đánh dấu ${item.title} đã chuẩn bị xong`}
                  checked={selectedPreparationIds.has(item.id)}
                  disabled={props.pendingKey !== null}
                  onChange={(event) => setSelectedPreparationIds((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(item.id);
                    else next.delete(item.id);
                    return next;
                  })}
                >Đã chuẩn bị xong</Checkbox>}
                {props.canReturn && item.status === 'BORROWED' && <Checkbox
                  aria-label={`Đánh dấu ${item.title} để nhận trả`}
                  checked={selectedReturnIds.has(item.id)}
                  disabled={props.pendingKey !== null}
                  onChange={(event) => setSelectedReturnIds((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(item.id);
                    else next.delete(item.id);
                    return next;
                  })}
                >Chọn nhận trả sách này</Checkbox>}
                {item.status === 'BORROWED' && (
                  <div style={{ marginTop: '4px', fontSize: '13px' }}>
                    <span>Hạn trả: {item.dueDate ? formatDeskDate(item.dueDate) : '—'}</span>
                    {returnItemsOverdueMap.has(item.id) ? (
                      <Tag color="error" style={{ marginLeft: '8px' }}>
                        Quá hạn {returnItemsOverdueMap.get(item.id)!.overdueDays} ngày · Phạt: {formatVnd(returnItemsOverdueMap.get(item.id)!.calculatedLateFee)}
                      </Tag>
                    ) : (
                      <Tag color="success" style={{ marginLeft: '8px' }}>Còn hạn</Tag>
                    )}
                  </div>
                )}
                {item.status === 'RETURNED' && (
                  <div style={{ marginTop: '4px', fontSize: '13px', color: '#595959' }}>
                    <span>Ngày trả: {item.returnedAt ? formatDeskDate(item.returnedAt) : '—'}</span>
                    {item.lateFee > 0 && (
                      <span style={{ marginLeft: '8px', color: '#cf1322' }}>
                        Phí trễ đã nộp: {formatVnd(item.lateFee)}
                      </span>
                    )}
                  </div>
                )}
                <div className={`librarian-borrow-modal-item__fee${feeInactive || (isCounterRequest && !isReady) ? ' librarian-borrow-modal-item__fee--inactive' : ''}`} data-loan-item-fee={item.id}>
                  <span>{isCounterRequest
                    ? (isReady ? 'Phí cần thu tại quầy' : 'Phí mượn chưa thu')
                    : (feeInactive ? 'Phí mượn' : 'Đã thanh toán trực tuyến')}</span>
                  {isCounterRequest
                    ? isReady ? <strong>{formatFee(item.borrowFee)}</strong> : <span><del>{formatVnd(item.borrowFee)}</del> · Chưa thu</span>
                    : feeInactive
                      ? <span><del>{formatVnd(item.borrowFee)}</del> · Không còn hiệu lực</span>
                      : <strong>{formatFee(item.borrowFee)}</strong>}
                </div>
                {isReady && <Typography.Text type="secondary" className="librarian-borrow-modal-item__deadline">
                  Hạn nhận: {item.pickupExpiresAt ? formatDeskDate(item.pickupExpiresAt) : '—'}
                </Typography.Text>}
                <ItemAction
                  item={item}
                  request={request}
                  pendingKey={props.pendingKey}
                  canCancel={props.canCancel}
                  canPrepare={props.canPrepare}
                  onCancelReady={props.onCancelReady}
                  onReject={props.onReject}
                />
              </article>;
            })}
            {request.items.length === 0 && <Typography.Text type="secondary">Yêu cầu chưa có sách.</Typography.Text>}
          </div>
        </section>
      </>}
    </div>
  </Modal>;
}
