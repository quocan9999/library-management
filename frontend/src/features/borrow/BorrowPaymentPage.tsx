import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppNotification } from '../../components/AppNotificationProvider';
import {
  UserBadge,
  UserBookCover,
  UserButton,
} from '../../components/user';
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
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

function formatRemainingTime(expiresAt: string | null | undefined, now: number | null): string {
  if (!expiresAt || now === null) return '';
  const diff = Date.parse(expiresAt) - now;
  if (diff <= 0) return 'Đã hết hạn';
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const restMin = minutes % 60;
    return `Hết hạn sau ${hours}h ${restMin}p`;
  }
  return `Hết hạn sau ${minutes}p ${seconds < 10 ? '0' : ''}${seconds}s`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`${label}: ${text}`}
      className="user-pressable"
      style={{
        background: copied ? '#C8FF3D' : '#EFEBFF',
        border: '1.5px solid #14112B',
        borderRadius: '8px',
        padding: '3px 8px',
        fontSize: '12px',
        fontWeight: 600,
        color: '#14112B',
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
      }}
    >
      {copied ? 'Đã chép ✓' : 'Sao chép'}
    </button>
  );
}

export function BorrowPaymentPage() {
  const { loanCode = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useAppNotification();
  const [reloadKey, setReloadKey] = useState(0);
  const [request, setRequest] = useState<BorrowRequest | null>(null);
  const [failure, setFailure] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const actionLock = useRef(false);

  const paymentCode = `THANH TOAN ${loanCode}`;
  const qrValue = JSON.stringify({
    bank: MOCK_BANK_DETAILS.bank,
    accountNumber: MOCK_BANK_DETAILS.accountNumber,
    beneficiary: MOCK_BANK_DETAILS.beneficiary,
    amount: request?.paymentAmount ?? 0,
    content: paymentCode,
  });

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    borrowApi
      .getMine(loanCode, controller.signal)
      .then((data) => {
        if (current) {
          setRequest(data);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (current) {
          setFailure(borrowErrorMessage(error, 'read'));
          setLoading(false);
        }
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [loanCode, reloadKey]);

  const handleReload = () => {
    setLoading(true);
    setFailure('');
    setReloadKey((k) => k + 1);
  };

  const expired =
    request?.paymentStatus === 'PENDING' && request.paymentExpiresAt && now !== null
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
      if (error instanceof Error) handleReload();
    } finally {
      actionLock.current = false;
      setPending(false);
    }
  };

  // Trạng thái đang tải
  if (loading) {
    return (
      <div className="user-payment-page" role="status" aria-label="Đang tải thông tin thanh toán">
        <div className="user-loan-skeleton" style={{ height: '360px', borderRadius: '28px' }} />
      </div>
    );
  }

  // Trạng thái lỗi tải
  if (failure || !request) {
    return (
      <div className="user-payment-page">
        <div className="user-loan-status-card" role="alert">
          <h2 className="user-title-24" style={{ margin: 0, color: 'var(--user-error)' }}>
            {failure || 'Không tìm thấy yêu cầu mượn.'}
          </h2>
          <p style={{ margin: 0 }}>
            Vui lòng kiểm tra lại đường dẫn hoặc mã yêu cầu mượn sách.
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <UserButton variant="primary" onClick={handleReload}>
              Tải lại
            </UserButton>
            <UserButton variant="outline" onClick={() => navigate('/my-loans')}>
              Quay lại sách của tôi
            </UserButton>
          </div>
        </div>
      </div>
    );
  }

  const paymentStatus = request.paymentStatus ?? 'PENDING';
  const paid = paymentStatus === 'PAID' || paymentStatus === 'NOT_REQUIRED';
  const amount = request.paymentAmount ?? 0;
  const isCloseToExpiry =
    request.paymentExpiresAt && now !== null && Date.parse(request.paymentExpiresAt) - now < 300000;

  return (
    <div className="user-payment-page" aria-labelledby="borrow-payment-heading">
      {/* Tiêu đề & Nút quay lại */}
      <header className="user-payment-header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              id="borrow-payment-heading"
              className="user-title-display-64"
              style={{ margin: 0, color: 'var(--user-ink)' }}
            >
              Thanh toán yêu cầu {request.loanCode}
            </h1>
            <p className="user-subtitle" style={{ margin: '8px 0 0 0' }}>
              Quét VietQR mô phỏng hoặc xem thông tin chuyển khoản mẫu để hoàn tất yêu cầu mượn.
            </p>
          </div>
          <UserButton variant="outline" onClick={() => navigate('/my-loans')}>
            Sách của tôi
          </UserButton>
        </div>
      </header>

      {/* Kết quả: Đã thanh toán */}
      {paid ? (
        <article className="user-payment-result-card">
          <div className="user-payment-result-icon user-payment-result-icon--success">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#14112B"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="user-title-heading-32" style={{ margin: 0, color: 'var(--user-ink)' }}>
            {amount > 0 ? 'Yêu cầu đã được thanh toán' : 'Yêu cầu không phát sinh phí'}
          </h2>
          <p className="user-subtitle" style={{ margin: 0, maxWidth: '520px' }}>
            {amount > 0
              ? `Đã ghi nhận ${formatVnd(amount)} cho yêu cầu ${request.loanCode}. Bạn có thể theo dõi tiến độ chuẩn bị sách tại trang Sách của tôi.`
              : `Yêu cầu ${request.loanCode} đã được tạo thành công trong hệ thống.`}
          </p>
          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginTop: '12px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <UserButton variant="primary" size="lg" onClick={() => navigate('/my-loans')}>
              Theo dõi yêu cầu mượn
            </UserButton>
            <UserButton variant="outline" size="lg" onClick={() => navigate('/books')}>
              Tiếp tục khám phá sách
            </UserButton>
          </div>
        </article>
      ) : paymentStatus === 'EXPIRED' || expired ? (
        /* Kết quả: Hết hạn */
        <article className="user-payment-result-card">
          <div className="user-payment-result-icon user-payment-result-icon--warning">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#7A4B00"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="user-title-heading-32" style={{ margin: 0, color: 'var(--user-ink)' }}>
            Yêu cầu thanh toán đã hết hạn
          </h2>
          <p className="user-subtitle" style={{ margin: 0, maxWidth: '540px' }}>
            Thời gian giữ sách cho yêu cầu {request.loanCode} đã kết thúc. Sách đã được hoàn lại kho chung và yêu cầu này không thể tiếp tục thanh toán.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginTop: '12px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <UserButton variant="primary" size="lg" onClick={() => navigate('/books')}>
              Chọn sách lại
            </UserButton>
            <UserButton variant="outline" size="lg" onClick={() => navigate('/my-loans')}>
              Xem sách của tôi
            </UserButton>
          </div>
        </article>
      ) : (
        /* Giao diện thanh toán chính (QR + Thông tin) */
        <div className="user-payment-grid">
          {/* Cột trái: Khung QR Code */}
          <article className="user-payment-qr-card">
            <div className="user-payment-qr-box">
              <QRCodeSVG
                value={qrValue}
                size={220}
                level="M"
                title={`VietQR mô phỏng cho yêu cầu ${request.loanCode}`}
                style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                textAlign: 'center',
              }}
            >
              <UserBadge variant="success">VietQR mô phỏng</UserBadge>
              <span
                style={{
                  fontSize: '13px',
                  color: '#4B4570',
                  maxWidth: '280px',
                  lineHeight: 1.5,
                }}
              >
                Mã QR chỉ dùng để mô phỏng thanh toán thử nghiệm trong hệ thống, không kết nối ngân hàng.
              </span>
            </div>
          </article>

          {/* Cột phải: Thông tin chuyển khoản */}
          <article className="user-payment-details-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <h2 className="user-title-22" style={{ margin: 0, color: 'var(--user-ink)' }}>
                Thông tin thanh toán
              </h2>
              {request.paymentExpiresAt && (
                <UserBadge variant={isCloseToExpiry ? 'error' : 'waitlist'}>
                  {formatRemainingTime(request.paymentExpiresAt, now)}
                </UserBadge>
              )}
            </div>

            {/* Danh sách thông tin */}
            <div className="user-payment-info-list">
              {/* Số tiền cần thanh toán */}
              <div className="user-payment-amount-row">
                <span style={{ fontSize: '14px', color: '#4B4570', fontWeight: 600 }}>
                  Số tiền cần thanh toán
                </span>
                <span
                  style={{
                    fontFamily:
                      'var(--user-font-display, "Bricolage Grotesque", "Be Vietnam Pro", sans-serif)',
                    fontWeight: 800,
                    fontSize: '28px',
                    letterSpacing: '-0.03em',
                    color: 'var(--user-ink)',
                  }}
                >
                  {formatVnd(amount)}
                </span>
              </div>

              {/* Ngân hàng */}
              <div className="user-payment-info-item">
                <span className="user-payment-info-label">Đơn vị thụ hưởng</span>
                <span className="user-payment-info-val">{MOCK_BANK_DETAILS.bank}</span>
              </div>

              {/* Chủ tài khoản */}
              <div className="user-payment-info-item">
                <span className="user-payment-info-label">Người nhận</span>
                <span className="user-payment-info-val">{MOCK_BANK_DETAILS.beneficiary}</span>
              </div>

              {/* Số tài khoản kèm nút Copy */}
              <div className="user-payment-info-item">
                <span className="user-payment-info-label">Số tài khoản</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="user-payment-info-val user-mono">
                    {MOCK_BANK_DETAILS.accountNumber}
                  </span>
                  <CopyButton text={MOCK_BANK_DETAILS.accountNumber} label="Số tài khoản" />
                </div>
              </div>

              {/* Nội dung chuyển khoản kèm nút Copy */}
              <div className="user-payment-info-item">
                <span className="user-payment-info-label">Nội dung chuyển khoản</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className="user-payment-info-val user-mono"
                    style={{ color: 'var(--user-primary)', fontWeight: 700 }}
                  >
                    {paymentCode}
                  </span>
                  <CopyButton text={paymentCode} label="Nội dung chuyển khoản" />
                </div>
              </div>

              {/* Hạn giữ yêu cầu */}
              <div className="user-payment-info-item" style={{ borderBottom: 'none' }}>
                <span className="user-payment-info-label">Hạn giữ yêu cầu</span>
                <span className="user-payment-info-val" style={{ color: '#4B4570' }}>
                  {formatDate(request.paymentExpiresAt)}
                </span>
              </div>
            </div>

            {/* Banner bản mô phỏng */}
            <div className="user-payment-mock-banner">
              <UserBadge variant="warning">Bản mô phỏng</UserBadge>
              <span style={{ fontSize: '13px', color: '#7A4B00', lineHeight: 1.5, flex: 1 }}>
                Nút xác nhận bên dưới sẽ ghi nhận thanh toán thành công trong hệ thống mà không cần thực hiện chuyển khoản thật.
              </span>
            </div>

            {/* Nút Tôi đã thanh toán */}
            <UserButton
              variant="primary"
              size="lg"
              fullWidth
              disabled={expired || pending}
              onClick={() => {
                void confirmPayment();
              }}
            >
              {pending ? 'Đang xác nhận...' : 'Tôi đã thanh toán'}
            </UserButton>
          </article>
        </div>
      )}

      {/* Sách trong yêu cầu */}
      <section className="user-payment-books-card" aria-label="Sách trong yêu cầu">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <h2 className="user-title-22" style={{ margin: 0, color: 'var(--user-ink)' }}>
            Sách trong yêu cầu ({request.items.length})
          </h2>
          <span style={{ fontSize: '14px', color: '#4B4570' }}>
            Tổng phí mượn:{' '}
            <strong style={{ color: 'var(--user-ink)', fontWeight: 700 }}>
              {formatVnd(amount)}
            </strong>
          </span>
        </div>

        <div className="user-payment-books-list">
          {request.items.map((item, index) => (
            <div key={item.id} className="user-payment-book-item">
              <UserBookCover
                size="sm"
                themeIndex={index}
                coverImageUrl={item.coverImageUrl}
                title={item.title}
              />
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontFamily:
                      'var(--user-font-display, "Bricolage Grotesque", "Be Vietnam Pro", sans-serif)',
                    fontWeight: 800,
                    fontSize: '17px',
                    letterSpacing: '-0.02em',
                    color: 'var(--user-ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.title}
                </h3>
                <span style={{ fontSize: '13px', color: '#4B4570' }}>
                  {item.bookCode} · {item.author}
                </span>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span
                  style={{
                    fontFamily:
                      'var(--user-font-display, "Bricolage Grotesque", "Be Vietnam Pro", sans-serif)',
                    fontWeight: 800,
                    fontSize: '17px',
                    color: 'var(--user-ink)',
                  }}
                >
                  {formatVnd(item.borrowFee)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
