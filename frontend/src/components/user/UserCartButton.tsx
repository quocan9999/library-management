import React from 'react';

export interface UserCartButtonProps {
  count?: number;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const UserCartButton: React.FC<UserCartButtonProps> = ({
  count = 0,
  onClick,
  className = '',
  style = {},
}) => {
  const displayCount = count > 99 ? '99+' : count;

  return (
    <button
      type="button"
      aria-label={`Giỏ mượn, ${count} sách`}
      onClick={onClick}
      className={`user-cart-button user-no-select user-pressable ${className}`}
      style={{
        position: 'relative',
        width: '48px',
        height: '48px',
        border: '0',
        borderRadius: '24px',
        backgroundColor: '#EFEBFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        ...style,
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#14112B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 7h12l1 13H5z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
      {count > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            minWidth: '22px',
            height: '22px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '11px',
            backgroundColor: '#C8FF3D',
            color: '#14112B',
            border: '2px solid #14112B',
            fontSize: '12px',
            fontWeight: 700,
            fontFamily: 'var(--user-font-body, "Be Vietnam Pro", sans-serif)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          {displayCount}
        </span>
      )}
    </button>
  );
};
