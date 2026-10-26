import { Alert, Button, Checkbox, Descriptions, Modal, Skeleton, Tag, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatVnd } from '../books/formatting';
import type { BorrowItem, StaffBorrowRequest } from './types';
import {
  getRequestDisplayStatuses,
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
  pendingKey: string | null;
  onClose: () => void;
  onRetry: () => void;
  onMarkPrepared: (request: StaffBorrowRequest, itemIds: number[]) => void;
  onCancelReady: (request: StaffBorrowRequest, item: BorrowItem) => void;
  onReject: (request: StaffBorrowRequest, item: BorrowItem) => void;
  onHandover: (request: StaffBorrowRequest) => void;
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
  const request = props.request;
  const readyItems = request ? getReadyItems(request) : [];
  const preparationItems = request && props.canPrepare
    ? request.items.filter((item) => ['RESERVED', 'PREPARING'].includes(item.status))
    : [];
  const selectedPreparationItems = preparationItems.filter((item) => selectedPreparationIds.has(item.id));
  const isCounterRequest = request?.origin === 'COUNTER';
  const totalFee = request && isCounterRequest ? getRequestFeeTotal(request) : 0;
  const inactiveStatuses = ['CANCELLED', 'REJECTED', 'EXPIRED'];
  const preparingWarningCount = request?.preparingOverdueItemIds.length ?? 0;

  useEffect(() => {
    setSelectedPreparationIds(new Set());
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
      <div>
        <Typography.Title level={4} id="librarian-borrow-request-title">
          {request?.loanCode ?? 'Chi tiết yêu cầu mượn'}
        </Typography.Title>
        {request && getRequestDisplayStatuses(request).map((status) =>
          <Tag key={status} color={statusTagColor(status)}>{ITEM_STATUS_LABELS[status]}</Tag>)}
      </div>
      <Button ref={closeButtonRef} aria-label="Đóng chi tiết yêu cầu" onClick={props.onClose}>Đóng</Button>
    </div>}
    footer={request ? <div className="librarian-borrow-modal__footer">
      <div className="librarian-borrow-modal__total">
        <Typography.Text type="secondary">Tổng phí mượn:</Typography.Text>
        <Typography.Text strong>{formatVnd(totalFee)}</Typography.Text>
      </div>
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
        {preparationItems.length === 0 && !(props.canHandover && readyItems.length > 0) && <Button onClick={props.onClose}>Đóng chi tiết</Button>}
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
