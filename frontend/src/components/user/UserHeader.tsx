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
      className={`user-header user-no-select ${className}`}
      style={{
        width: '100%',
        height: '72px',
        backgroundColor: '#14112B',
        color: '#FFFFFF',
        fontFamily: 'var(--user-font-body, "Be Vietnam Pro", sans-serif)',
        flexShrink: 0,
      }}
    >
      <div className="user-header__inner">
        <Link to="/books" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
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
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          <UserCartButton count={cartCount} onClick={onOpenCart} />
          <UserAvatarMenu
            fullName={userFullName}
            email={userEmail}
            initial={userInitial}
            onLogout={onLogout}
          />
        </div>
      </div>
    </header>
  );
};
