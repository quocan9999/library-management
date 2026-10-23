import React, { useEffect, useRef } from 'react';
import { UserBookCover } from './UserBookCover';
import { UserButton } from './UserButton';

export interface UserCartItem {
  id: number | string;
  title: string;
  borrowFee?: number;
  coverImageUrl?: string | null;
  bookCode?: string;
  themeIndex?: number;
}

export interface UserCartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: UserCartItem[];
  onRemoveItem: (id: number | string) => void;
  onCheckout: () => void;
  isSubmitting?: boolean;
}

export const UserCartDrawer: React.FC<UserCartDrawerProps> = ({
  open,
  onClose,
  items,
  onRemoveItem,
  onCheckout,
  isSubmitting = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus management & scroll lock
  useEffect(() => {
    if (!open) return undefined;

    // Save active element that opened the drawer
    triggerRef.current = document.activeElement as HTMLElement | null;

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus close button initially
    const timer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    // Escape listener and focus trap
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  const totalFee = items.reduce((sum, item) => sum + (item.borrowFee ?? 0), 0);

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString('vi-VN')} đ`;
  };

  return (
    <div
      className="user-cart-overlay user-no-select"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        className="user-overlay-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer content */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-cart-drawer-title"
        className="user-cart-content user-cart-drawer-panel"
        style={{
          position: 'relative',
          width: '440px',
          maxWidth: 'calc(100vw - 20px)',
          height: '100%',
          backgroundColor: '#FFFFFF',
          borderLeft: '2px solid #14112B',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--user-font-body, "Be Vietnam Pro", sans-serif)',
          color: '#14112B',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ padding: '28px 28px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2
              id="user-cart-drawer-title"
              style={{
                margin: 0,
                fontFamily: 'var(--user-font-display, "Bricolage Grotesque", "Be Vietnam Pro", sans-serif)',
                fontWeight: 800,
                fontSize: '32px',
                letterSpacing: '-0.03em',
              }}
            >
              Giỏ mượn
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Đóng giỏ mượn"
              onClick={onClose}
              className="user-pressable"
              style={{
                width: '44px',
                height: '44px',
                border: 0,
                borderRadius: '22px',
                backgroundColor: '#EFEBFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#14112B"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div style={{ fontSize: '13px', color: '#4B4570' }}>
            Tối đa 3 đầu sách cho mỗi lượt mượn trực tuyến.
          </div>
        </div>

        {/* List items */}
        <div
          style={{
            flex: 1,
            padding: '0 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto',
          }}
        >
          {items.length === 0 ? (
            <div
              style={{
                padding: '48px 16px',
                textAlign: 'center',
                color: '#4B4570',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '32px',
                  backgroundColor: '#EFEBFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#14112B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 7h12l1 13H5z" />
                  <path d="M9 7a3 3 0 0 1 6 0" />
                </svg>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 600 }}>Giỏ mượn chưa có sách nào</span>
              <span style={{ fontSize: '14px' }}>Hãy khám phá các đầu sách và bấm "Chọn mượn".</span>
            </div>
          ) : (
            items.map((item, index) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  backgroundColor: '#F7F5FF',
                  borderRadius: '20px',
                  padding: '12px',
                }}
              >
                <UserBookCover
                  title={item.title}
                  coverImageUrl={item.coverImageUrl}
                  themeIndex={item.themeIndex ?? index}
                  size="sm"
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--user-font-display, "Bricolage Grotesque", "Be Vietnam Pro", sans-serif)',
                      fontWeight: 800,
                      fontSize: '17px',
                      letterSpacing: '-0.02em',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.title}
                  </span>
                  <span style={{ fontSize: '14px', color: '#4B4570' }}>
                    {formatCurrency(item.borrowFee ?? 0)}{' '}
                    <span style={{ fontSize: '12px' }}>/lượt</span>
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={`Xóa ${item.title} khỏi giỏ`}
                  onClick={() => onRemoveItem(item.id)}
                  className="user-pressable"
                  style={{
                    flex: 'none',
                    width: '36px',
                    height: '36px',
                    border: 0,
                    borderRadius: '18px',
                    backgroundColor: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#14112B"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div
            style={{
              padding: '24px 28px 28px',
              borderTop: '2px solid #14112B',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '16px', fontWeight: 600 }}>Tổng phí mượn</span>
              <span
                style={{
                  fontFamily: 'var(--user-font-display, "Bricolage Grotesque", "Be Vietnam Pro", sans-serif)',
                  fontWeight: 800,
                  fontSize: '28px',
                  letterSpacing: '-0.03em',
                  color: '#14112B',
                }}
              >
                {formatCurrency(totalFee)}
              </span>
            </div>
            <UserButton
              variant="primary"
              size="lg"
              fullWidth
              onClick={onCheckout}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Đang gửi yêu cầu...' : 'Đặt mượn'}
            </UserButton>
          </div>
        )}
      </div>
    </div>
  );
};
