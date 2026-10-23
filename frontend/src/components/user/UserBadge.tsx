import React from 'react';

export type UserBadgeVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'waitlist'
  | 'neutral'
  | 'subtle'
  | 'outline'
  | 'preparing';

export interface UserBadgeProps {
  variant?: UserBadgeVariant;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const UserBadge: React.FC<UserBadgeProps> = ({
  variant = 'success',
  children,
  className = '',
  style = {},
}) => {
  const getColors = (): { bg: string; text: string; border?: string } => {
    switch (variant) {
      case 'success':
        return { bg: '#C8FF3D', text: '#14112B' };
      case 'error':
        return { bg: '#FFE4E8', text: '#9B1C31' };
      case 'warning':
        return { bg: '#FFF1C2', text: '#7A4B00' };
      case 'waitlist':
        return { bg: '#E3DCFF', text: '#14112B' };
      case 'neutral':
        return { bg: '#14112B', text: '#FFFFFF' };
      case 'subtle':
        return { bg: '#EFEBFF', text: '#14112B' };
      case 'preparing':
        return { bg: '#EFEBFF', text: '#4B4570' };
      case 'outline':
        return { bg: 'transparent', text: '#14112B', border: '2px solid #14112B' };
      default:
        return { bg: '#EFEBFF', text: '#14112B' };
    }
  };

  const { bg, text, border } = getColors();

  return (
    <span
      className={`user-badge user-no-select ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '14px',
        padding: '4px 12px',
        fontSize: '13px',
        fontWeight: 600,
        lineHeight: 1.25,
        backgroundColor: bg,
        color: text,
        border: border || 'none',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--user-font-body, "Be Vietnam Pro", sans-serif)',
        ...style,
      }}
    >
      {children}
    </span>
  );
};
