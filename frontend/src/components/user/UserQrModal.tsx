import React, { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { UserBadge } from './UserBadge';

export interface UserQrModalProps {
  open: boolean;
  onClose: () => void;
  loanCode: string;
  qrPayload?: string;
  bookTitle?: string;
  bookSubtitle?: string;
  className?: string;
}

export const UserQrModal: React.FC<UserQrModalProps> = ({
  open,
  onClose,
  loanCode,
  qrPayload,
  bookTitle,
  bookSubtitle,
  className = '',
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

    triggerRef.current = document.activeElement as HTMLElement | null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

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

  const valueToEncode = qrPayload || loanCode || 'LIBBY_DEFAULT';

  return (
    <div
      className={`user-qr-modal-overlay user-no-select ${className}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      {/* Backdrop */}
      <div
        className="user-overlay-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-qr-modal-title"
        className="user-qr-dialog user-qr-modal-panel"
        style={{
          position: 'relative',
          width: '440px',
          maxWidth: '100%',
          boxSizing: 'border-box',
          backgroundColor: '#FFFFFF',
          border: '2px solid #14112B',
          borderRadius: '32px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          zIndex: 1001,
          fontFamily: 'var(--user-font-body, "Be Vietnam Pro", sans-serif)',
          color: '#14112B',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <UserBadge variant="success">Mã nhận sách</UserBadge>
            </div>
            <h2
              id="user-qr-modal-title"
              style={{
                margin: 0,
                fontFamily: 'var(--user-font-display, "Bricolage Grotesque", sans-serif)',
                fontWeight: 800,
                fontSize: '32px',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              Yêu cầu {loanCode}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Đóng mã QR"
            onClick={onClose}
            className="user-pressable"
            style={{
              width: '44px',
              height: '44px',
              border: 0,
              borderRadius: '22px',
              backgroundColor: '#EFEBFF',
              color: '#14112B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
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

        {(bookTitle || bookSubtitle) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {bookTitle && (
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#14112B' }}>
                {bookTitle}
              </div>
            )}
            {bookSubtitle && (
              <div style={{ fontSize: '14px', color: '#4B4570' }}>{bookSubtitle}</div>
            )}
          </div>
        )}

        <div
          style={{
            backgroundColor: '#EFEBFF',
            borderRadius: '24px',
            padding: '20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <QRCodeSVG
              value={valueToEncode}
              size={260}
              fgColor="#14112B"
              bgColor="#FFFFFF"
              level="H"
            />
          </div>
        </div>

        <div style={{ fontSize: '14px', lineHeight: 1.5, color: '#4B4570', textAlign: 'center' }}>
          Đưa mã này cho thủ thư tại quầy để quét và nhận sách.
        </div>
      </div>
    </div>
  );
};
