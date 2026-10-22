import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LibbyLogo } from './LibbyLogo';
import { UserCartButton } from './UserCartButton';
import { UserAvatarMenu } from './UserAvatarMenu';

export interface UserHeaderProps {
  cartCount?: number;
  onOpenCart?: () => void;
  userFullName?: string;
  userEmail?: string;
  userInitial?: string;
  onLogout?: () => void;
  className?: string;
}

export const UserHeader: React.FC<UserHeaderProps> = ({
  cartCount = 0,
  onOpenCart,
  userFullName,
  userEmail,
  userInitial,
  onLogout,
  className = '',
}) => {
  return (
    <header
      className={`user-header select-none ${className}`}
      style={{
        height: '72px',
        padding: '0 40px',
        display: 'flex',
        alignItems: 'center',
        gap: '40px',
        backgroundColor: '#14112B',
        color: '#FFFFFF',
        fontFamily: 'var(--user-font-body, "Be Vietnam Pro", sans-serif)',
        flexShrink: 0,
      }}
    >
      <Link to="/books" style={{ textDecoration: 'none' }}>
        <LibbyLogo variant="dark" size="md" />
      </Link>

      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '28px',
          fontSize: '15px',
          fontWeight: 600,
        }}
      >
        <NavLink
          to="/books"
          style={({ isActive }) => ({
            color: '#FFFFFF',
            textDecoration: 'none',
            borderBottom: isActive ? '3px solid #C8FF3D' : '3px solid transparent',
            padding: '6px 0',
            transition: 'border-color 0.15s ease',
          })}
        >
          Khám phá
        </NavLink>

        <NavLink
          to="/my-loans"
          style={({ isActive }) => ({
            color: '#FFFFFF',
            textDecoration: 'none',
            borderBottom: isActive ? '3px solid #C8FF3D' : '3px solid transparent',
            padding: '6px 0',
            transition: 'border-color 0.15s ease',
          })}
        >
          Sách của tôi
        </NavLink>
      </nav>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <UserCartButton count={cartCount} onClick={onOpenCart} />
        <UserAvatarMenu
          fullName={userFullName}
          email={userEmail}
          initial={userInitial}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
};
