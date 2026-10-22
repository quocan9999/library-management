import React from 'react';

export type UserButtonVariant =
  | 'primary'
  | 'outline'
  | 'dark'
  | 'dark-outline'
  | 'lime-outline'
  | 'muted'
  | 'ghost';

export type UserButtonSize = 'sm' | 'md' | 'lg';

export interface UserButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: UserButtonVariant;
  size?: UserButtonSize;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const UserButton: React.FC<UserButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
  style = {},
  disabled,
  ...rest
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    if (disabled || variant === 'muted') {
      return {
        background: '#EFEBFF',
        color: '#7A7499',
        border: '2px solid #EFEBFF',
        cursor: 'not-allowed',
      };
    }

    switch (variant) {
      case 'primary':
        return {
          background: '#6C4DFF',
          color: '#FFFFFF',
          border: '2px solid #6C4DFF',
        };
      case 'outline':
        return {
          background: '#FFFFFF',
          color: '#6C4DFF',
          border: '2px solid #6C4DFF',
        };
      case 'dark':
        return {
          background: '#14112B',
          color: '#FFFFFF',
          border: '2px solid #14112B',
        };
      case 'dark-outline':
        return {
          background: 'transparent',
          color: '#14112B',
          border: '2px solid #14112B',
        };
      case 'lime-outline':
        return {
          background: 'transparent',
          color: '#C8FF3D',
          border: '2px solid #C8FF3D',
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: '#14112B',
          border: 'none',
        };
      default:
        return {};
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          height: '36px',
          padding: '0 16px',
          borderRadius: '18px',
          fontSize: '13px',
        };
      case 'lg':
        return {
          height: '52px',
          padding: '0 28px',
          borderRadius: '26px',
          fontSize: '16px',
        };
      case 'md':
      default:
        return {
          height: '48px',
          padding: '0 22px',
          borderRadius: '24px',
          fontSize: '15px',
        };
    }
  };

  return (
    <button
      className={`user-button select-none transition-colors duration-150 inline-flex items-center justify-center font-semibold ${className}`}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--user-font-body, "Be Vietnam Pro", sans-serif)',
        fontWeight: 600,
        outline: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : 'auto',
        ...getSizeStyles(),
        ...getVariantStyles(),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
};
