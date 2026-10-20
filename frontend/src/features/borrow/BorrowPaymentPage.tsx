import { Alert, Button, Card, Descriptions, Result, Skeleton, Typography } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { formatVnd } from '../books/formatting';
import { borrowApi } from './api';
import { borrowErrorMessage, borrowErrorNotificationType } from './errors';
import type { BorrowRequest } from './types';

const MOCK_BANK_DETAILS = {
  bank: 'VietQR mô phỏng',
  accountNumber: '0000000000',
  beneficiary: 'THU VIEN DEMO',
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(date);
}

export function BorrowPaymentPage() {
  const { loanCode = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useAppNotification();
  const [request, setRequest] = useState<BorrowRequest | null>(null);
  const [failure, setFailure] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const actionLock = useRef(false);
  const paymentCode = `THANH TOAN ${loanCode}`;
  const qrValue = JSON.stringify({
    bank: MOCK_BANK_DETAILS.bank,
    accountNumber: MOCK_BANK_DETAILS.accountNumber,
    beneficiary: MOCK_BANK_DETAILS.beneficiary,
    amount: request?.paymentAmount ?? 0,
    content: paymentCode,
  });

  const loadRequest = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFailure('');
    try {
      const data = await borrowApi.getMine(loanCode, signal);
      setRequest(data);
    } catch (error: unknown) {
      if (!signal?.aborted) setFailure(borrowErrorMessage(error, 'read'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [loanCode]);

  useEffect(() => {
    const controller = new AbortController();
    void loadRequest(controller.signal);
    return () => controller.abort();
  }, [loadRequest]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const expired = request?.paymentStatus === 'PENDING' && request.paymentExpiresAt
    ? Date.parse(request.paymentExpiresAt) <= now
    : request?.paymentStatus === 'EXPIRED';

  const confirmPayment = async () => {
    if (!request || request.paymentStatus !== 'PENDING' || expired || actionLock.current) return;
    actionLock.current = true;
    setPending(true);
    try {
      const updated = await borrowApi.confirmMockPayment(request.loanCode, {
        expectedLoanVersion: request.version,
        confirmedAmount: request.paymentAmount ?? 0,
      });
      setRequest(updated);
      notify('success', {
        title: 'Đã ghi nhận thanh toán',
        description: `Yêu cầu ${updated.loanCode} đã sẵn sàng để thư viện xử lý.`,
      });
    } catch (error: unknown) {
      notify(borrowErrorNotificationType(error), {
        title: 'Không thể xác nhận thanh toán',
        description: borrowErrorMessage(error),
      });
      if (error instanceof Error) await loadRequest();
    } finally {
      actionLock.current = false;
      setPending(false);
    }
  };

  if (loading) return <main className="borrow-stage"><div className="borrow-loading" role="status"><Skeleton active paragraph={{ rows: 5 }} /></div></main>;
  if (failure || !request) return <main className="borrow-stage">
    <Alert type="error" showIcon role="alert" title={failure || 'Không tìm thấy yêu cầu mượn.'}
      action={<Button onClick={() => { void loadRequest(); }}>Tải lại</Button>} />
    <Link className="member-back-link" to="/my-loans">Quay lại sách của tôi</Link>
  </main>;

  const paymentStatus = request.paymentStatus ?? 'PENDING';
  const paid = paymentStatus === 'PAID' || paymentStatus === 'NOT_REQUIRED';
  const amount = request.paymentAmount ?? 0;

  return <main className="borrow-stage borrow-payment" aria-labelledby="borrow-payment-heading">
    <header className="borrow-heading">
      <div>
        <h1 id="borrow-payment-heading">Thanh toán yêu cầu {request.loanCode}</h1>
        <p className="role-intro">Quét VietQR mô phỏng hoặc xem thông tin chuyển khoản mẫu để hoàn tất yêu cầu mượn.</p>
      </div>
      <Link className="member-back-link" to="/my-loans">Sách của tôi</Link>
    </header>

    {paid ? <Result
      status="success"
      title={amount > 0 ? 'Yêu cầu đã được thanh toán' : 'Yêu cầu không phát sinh phí'}
      subTitle={amount > 0 ? `Đã ghi nhận ${formatVnd(amount)} cho yêu cầu ${request.loanCode}.` : `Yêu cầu ${request.loanCode} đã được tạo.`}
      extra={<Button type="primary" onClick={() => navigate('/my-loans')}>Theo dõi yêu cầu</Button>}
    /> : paymentStatus === 'EXPIRED' || expired ? <Result
      status="warning"
      title="Yêu cầu thanh toán đã hết hạn"
      subTitle="Sách đã được trả lại kho và yêu cầu này không thể thanh toán tiếp. Hãy tạo yêu cầu mới."
      extra={<Button type="primary" onClick={() => navigate('/books')}>Chọn sách lại</Button>}
    /> : <div className="borrow-payment__layout">
      <Card className="borrow-payment__qr-card">
        <div className="borrow-payment__qr" aria-label="Mã QR VietQR mô phỏng">
          <QRCodeSVG value={qrValue} size={220} level="M" title={`VietQR mô phỏng cho yêu cầu ${request.loanCode}`} />
        </div>
        <TagMock />
        <Typography.Text type="secondary">Mã QR chỉ dùng để mô phỏng thanh toán, không kết nối ngân hàng.</Typography.Text>
      </Card>
      <Card title="Thông tin thanh toán" className="borrow-payment__details">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Đơn vị">{MOCK_BANK_DETAILS.bank}</Descriptions.Item>
          <Descriptions.Item label="Số tài khoản">{MOCK_BANK_DETAILS.accountNumber}</Descriptions.Item>
          <Descriptions.Item label="Người nhận">{MOCK_BANK_DETAILS.beneficiary}</Descriptions.Item>
          <Descriptions.Item label="Nội dung chuyển khoản">{paymentCode}</Descriptions.Item>
          <Descriptions.Item label="Số tiền"><Typography.Title level={4}>{formatVnd(amount)}</Typography.Title></Descriptions.Item>
          <Descriptions.Item label="Hạn giữ yêu cầu">{formatDate(request.paymentExpiresAt)}</Descriptions.Item>
        </Descriptions>
        <Alert type="info" showIcon title="Bản mô phỏng"
          description="Nút xác nhận bên dưới sẽ ghi nhận thanh toán thành công trong hệ thống. Không cần thực hiện chuyển khoản thật." />
        <Button type="primary" size="large" block loading={pending} disabled={expired}
          onClick={() => { void confirmPayment(); }}>
          Tôi đã thanh toán
        </Button>
      </Card>
    </div>}

    <section className="borrow-payment__books" aria-label="Sách trong yêu cầu">
      <Typography.Title level={4}>Sách trong yêu cầu</Typography.Title>
      {request.items.map((item) => <div key={item.id} className="borrow-payment__book-row">
        <span><strong>{item.title}</strong><Typography.Text type="secondary">{item.bookCode} · {item.author}</Typography.Text></span>
        <Typography.Text strong>{formatVnd(item.borrowFee)}</Typography.Text>
      </div>)}
    </section>
  </main>;
}

function TagMock() {
  return <span className="borrow-payment__mock-label">VietQR mô phỏng</span>;
}
