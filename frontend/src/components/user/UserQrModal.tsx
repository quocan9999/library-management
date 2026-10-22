import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

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
  if (!open) return null;

  const valueToEncode = qrPayload || loanCode || 'LIBBY_DEFAULT';

  return (
    <div
      className={`user-qr-modal-overlay select-none ${className}`}
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
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(20, 17, 43, 0.38)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal Dialog */}
      <div
        className="user-qr-dialog"
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
          gap: '20px',
          zIndex: 1001,
          fontFamily: 'var(--user-font-body, "Be Vietnam Pro", sans-serif)',
          color: '#14112B',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div
              style={{
                fontFamily: 'var(--user-font-display, "Bricolage Grotesque", sans-serif)',
                fontWeight: 800,
                fontSize: '32px',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              Yêu cầu {loanCode}
            </div>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
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
              outline: 'none',
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
            padding: '24px',
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
              size={220}
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
