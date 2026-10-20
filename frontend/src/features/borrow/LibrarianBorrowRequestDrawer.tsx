import { Alert, Button, Checkbox, Descriptions, Drawer, Skeleton, Tag, Typography } from 'antd';
import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatVnd } from '../books/formatting';
import type { BorrowItem, StaffBorrowRequest } from './types';
import {
  aggregateStatusTagColor,
  formatDeskDate,
  getNextPreparationItem,
  getReadyItems,
  getRequestFeeTotal,
  ITEM_STATUS_LABELS,
  LOAN_STATUS_LABELS,
  statusTagColor,
} from './staffBorrowPresentation';

interface LibrarianBorrowRequestDrawerProps {
  open: boolean;
  loading: boolean;
  error: string;
  request: StaffBorrowRequest | null;
  canPrepare: boolean;
  canCancel: boolean;
  canHandover: boolean;
  pendingKey: string | null;
  identityVerified: boolean;
  onIdentityVerifiedChange: (verified: boolean) => void;
  onClose: () => void;
  onRetry: () => void;
  onPrepare: (request: StaffBorrowRequest, itemId: number, action: 'prepare' | 'ready') => void;
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
}: Pick<LibrarianBorrowRequestDrawerProps, 'pendingKey' | 'canCancel' | 'canPrepare' | 'onCancelReady' | 'onReject'> & {
  item: BorrowItem;
  request: StaffBorrowRequest;
}) {
  const loading = pendingKey === `${request.loanCode}:${item.id}`;

  return <div className="librarian-borrow-item__actions">
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

export function LibrarianBorrowRequestDrawer(props: LibrarianBorrowRequestDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const request = props.request;
  const readyItems = request ? getReadyItems(request) : [];
  const nextPreparationItem = request && props.canPrepare ? getNextPreparationItem(request) : null;
  const totalFee = request ? getRequestFeeTotal(request) : 0;
  const preparingWarningCount = request?.preparingOverdueItemIds.length ?? 0;

  return <Drawer
    rootClassName="librarian-borrow-drawer"
    open={props.open}
    placement="right"
    size="large"
    autoFocus
    keyboard
    mask={{ closable: true }}
    closable={false}
    focusable={{ trap: true, focusTriggerAfterClose: true }}
    onClose={props.onClose}
    afterOpenChange={(open) => { if (open) closeButtonRef.current?.focus(); }}
    title={<div className="librarian-borrow-drawer__title">
      <div>
        <Typography.Title level={4} id="librarian-borrow-request-title">
          {request?.loanCode ?? 'Chi tiết yêu cầu mượn'}
        </Typography.Title>
        {request && <Tag color={aggregateStatusTagColor(request.status)}>{LOAN_STATUS_LABELS[request.status]}</Tag>}
      </div>
      <Button ref={closeButtonRef} aria-label="Đóng chi tiết yêu cầu" onClick={props.onClose}>Đóng</Button>
    </div>}
    footer={request ? <div className="librarian-borrow-drawer__footer">
      <div className="librarian-borrow-drawer__total">
        <Typography.Text type="secondary">Phí mượn các sách READY</Typography.Text>
        <Typography.Text strong>{formatFee(totalFee)}</Typography.Text>
      </div>
      <div className="librarian-borrow-drawer__footer-actions">
        {nextPreparationItem && <Button
          type={readyItems.length === 0 ? 'primary' : 'default'}
          disabled={props.pendingKey !== null}
          loading={props.pendingKey === `${request.loanCode}:${nextPreparationItem.id}`}
          onClick={() => props.onPrepare(
            request,
            nextPreparationItem.id,
            nextPreparationItem.status === 'RESERVED' ? 'prepare' : 'ready',
          )}
        >{nextPreparationItem.status === 'RESERVED' ? 'Bắt đầu chuẩn bị' : 'Đánh dấu sẵn sàng'}: {nextPreparationItem.title}</Button>}
        {props.canHandover && readyItems.length > 0 && <>
          <Checkbox
            checked={props.identityVerified}
            disabled={props.pendingKey !== null}
            onChange={(event) => props.onIdentityVerifiedChange(event.target.checked)}
          >Đã xác minh danh tính tại quầy</Checkbox>
          <Button
            type="primary"
            disabled={!props.identityVerified || props.pendingKey !== null}
            onClick={() => props.onHandover(request)}
          >{totalFee > 0 ? `Thu ${formatVnd(totalFee)} và bàn giao` : 'Xác nhận miễn phí và bàn giao'}</Button>
        </>}
        {!nextPreparationItem && !(props.canHandover && readyItems.length > 0) && <Button onClick={props.onClose}>Đóng chi tiết</Button>}
      </div>
    </div> : null}
    styles={{
      body: { padding: 0, display: 'flex', flexDirection: 'column' },
      footer: { padding: 0 },
    }}
  >
    <div className="librarian-borrow-drawer__body">
      {props.loading && <div className="librarian-borrow-drawer__loading" role="status"><Skeleton active paragraph={{ rows: 5 }} /></div>}
      {!props.loading && props.error && <Alert
        className="librarian-borrow-drawer__error"
        type="error"
        showIcon
        role="alert"
        title={props.error}
        action={<Button onClick={props.onRetry}>Thử lại</Button>}
      />}
      {!props.loading && !props.error && request && <>
        {preparingWarningCount > 0 && <Alert
          className="librarian-borrow-drawer__warning"
          type="warning"
          showIcon
          role="status"
          title={`Có ${preparingWarningCount} sách đã ở trạng thái chuẩn bị quá 24 giờ. Hãy kiểm tra và cập nhật trạng thái tại quầy.`}
        />}
        <section className="librarian-borrow-drawer__section" aria-label="Thông tin yêu cầu">
          <Typography.Title level={5}>Thông tin yêu cầu</Typography.Title>
          <Descriptions size="small" column={1} colon={false}>
            <Descriptions.Item label="Thành viên">
              <span className="librarian-borrow-drawer__member">
                <Typography.Text strong>{request.member.fullName}</Typography.Text>
                <Typography.Text type="secondary">{request.member.memberCode}</Typography.Text>
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">{formatDeskDate(request.createdAt)}</Descriptions.Item>
          </Descriptions>
          <div className="librarian-borrow-drawer__qr">
            <QRCodeSVG value={request.pickupReference} size={104} level="M" title={`Mã QR của yêu cầu ${request.loanCode}`} />
            <div>
              <Typography.Text strong>Mã QR nhận sách</Typography.Text>
              <Typography.Text code className="librarian-borrow-drawer__reference">{request.pickupReference}</Typography.Text>
              <Button size="small" onClick={() => props.onCopyReference(request.pickupReference)}>Sao chép mã</Button>
            </div>
          </div>
        </section>

        <section className="librarian-borrow-drawer__section" aria-label="Sách trong yêu cầu">
          <div className="librarian-borrow-drawer__section-heading">
            <Typography.Title level={5}>Sách trong yêu cầu</Typography.Title>
            <Typography.Text type="secondary">{request.items.length} cuốn</Typography.Text>
          </div>
          <div className="librarian-borrow-drawer__items">
            {request.items.map((item) => {
              const isReady = item.status === 'READY_FOR_PICKUP';
              return <article key={item.id} className="librarian-borrow-item" data-loan-item={item.id}>
                <div className="librarian-borrow-item__heading">
                  <div className="librarian-borrow-item__book">
                    <Typography.Text strong ellipsis={{ tooltip: item.title }}>{item.title}</Typography.Text>
                    <Typography.Text type="secondary">{item.bookCode} · {item.author}</Typography.Text>
                  </div>
                  <Tag color={statusTagColor(item.status)}>{ITEM_STATUS_LABELS[item.status]}</Tag>
                </div>
                <div className={`librarian-borrow-item__fee${isReady ? '' : ' librarian-borrow-item__fee--inactive'}`} data-loan-item-fee={item.id}>
                  <span>{isReady ? 'Phí cần xác nhận' : 'Phí snapshot'}</span>
                  {isReady
                    ? <strong>{formatFee(item.borrowFee)}</strong>
                    : <span><del>{formatVnd(item.borrowFee)}</del> · Không thu tại quầy</span>}
                </div>
                {isReady && <Typography.Text type="secondary" className="librarian-borrow-item__deadline">
                  Hạn nhận: {item.pickupExpiresAt ? formatDeskDate(item.pickupExpiresAt) : '—'}
                </Typography.Text>}
                {item.status === 'WAITLISTED' && item.waitlistPosition !== null && <Typography.Text type="secondary" className="librarian-borrow-item__waitlist">
                  Hàng chờ: {item.waitlistPosition} / {item.waitlistTotal ?? '—'}
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
  </Drawer>;
}
