import React from 'react';
import { Dropdown } from 'antd';
import { Link } from 'react-router-dom';

export interface UserAvatarMenuProps {
  fullName?: string;
  email?: string;
  initial?: string;
  onLogout?: () => void;
  className?: string;
}

export const UserAvatarMenu: React.FC<UserAvatarMenuProps> = ({
  fullName = 'Độc giả',
  email = '',
  initial,
  onLogout,
  className = '',
}) => {
  const displayInitial =
    initial ||
    (fullName ? fullName.trim().charAt(fullName.trim().length - 1).toUpperCase() : 'T');

  const menuContent = (
    <div
      className="user-avatar-popup select-none"
      style={{
        width: '272px',
        boxSizing: 'border-box',
        backgroundColor: '#FFFFFF',
        border: '2px solid #14112B',
        borderRadius: '24px',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        fontFamily: 'var(--user-font-body, "Be Vietnam Pro", sans-serif)',
        boxShadow: 'none',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid #EFEBFF',
          marginBottom: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--user-font-display, "Bricolage Grotesque", sans-serif)',
            fontWeight: 800,
            fontSize: '18px',
            letterSpacing: '-0.02em',
            color: '#14112B',
          }}
        >
          {fullName}
        </span>
        {email && (
          <span style={{ fontSize: '13px', color: '#4B4570', wordBreak: 'break-all' }}>
            {email}
          </span>
        )}
      </div>

      <Link
        to="/my-loans"
        style={{
          height: '44px',
          borderRadius: '14px',
          backgroundColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 14px',
          fontSize: '15px',
          fontWeight: 600,
          color: '#14112B',
          textDecoration: 'none',
          transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EFEBFF')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#14112B"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
        </svg>
        Sách của tôi
      </Link>

      <Link
        to="/profile"
        style={{
          height: '44px',
          borderRadius: '14px',
          backgroundColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 14px',
          fontSize: '15px',
          fontWeight: 600,
          color: '#14112B',
          textDecoration: 'none',
          transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EFEBFF')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#14112B"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
        Hồ sơ của tôi
      </Link>

      <div style={{ height: '1px', backgroundColor: '#EFEBFF', margin: '4px 6px' }} />

      <button
        type="button"
        onClick={onLogout}
        style={{
          height: '44px',
          borderRadius: '14px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 14px',
          fontSize: '15px',
          fontWeight: 600,
          color: '#9B1C31',
          width: '100%',
          textAlign: 'left',
          transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FFE4E8')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9B1C31"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        Đăng xuất
      </button>
    </div>
  );

  return (
    <Dropdown
      dropdownRender={() => menuContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <button
        type="button"
        aria-label="Menu tài khoản"
        className={`user-avatar-button cursor-pointer transition-transform active:scale-95 ${className}`}
        style={{
          width: '44px',
          height: '44px',
          boxSizing: 'border-box',
          borderRadius: '22px',
          border: '2px solid #6C4DFF',
          backgroundColor: '#C8FF3D',
          color: '#14112B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '16px',
          fontFamily: 'var(--user-font-body, "Be Vietnam Pro", sans-serif)',
          outline: 'none',
          padding: 0,
        }}
      >
        {displayInitial}
      </button>
    </Dropdown>
  );
};
