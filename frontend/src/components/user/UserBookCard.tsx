import React from 'react';
import { UserBookCover, type UserBookCoverTheme } from './UserBookCover';
import { UserBadge } from './UserBadge';
import { UserButton } from './UserButton';

export interface UserBookCardItem {
  id: number | string;
  bookCode?: string;
  title: string;
  author: string;
  coverImageUrl?: string | null;
  borrowFee?: number;
  lateFeePerDay?: number;
  availableQuantity?: number;
  totalQuantity?: number;
  waitlistCount?: number;
  maxWaitlistSlots?: number;
}

export interface UserBookCardProps {
  book: UserBookCardItem;
  themeIndex?: number;
  theme?: UserBookCoverTheme;
  isInCart?: boolean;
  onAction?: (book: UserBookCardItem) => void;
  onOpenCart?: () => void;
  onClickTitle?: (book: UserBookCardItem) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const UserBookCard: React.FC<UserBookCardProps> = ({
  book,
  themeIndex = 0,
  theme,
  isInCart = false,
  onAction,
  onOpenCart,
  onClickTitle,
  className = '',
  style = {},
}) => {
  const available = book.availableQuantity ?? 0;
  const total = book.totalQuantity ?? 0;
  const isAvailable = available > 0;
  const waitlist = book.waitlistCount ?? 0;
  const maxWaitlist = book.maxWaitlistSlots ?? total * 4;
  const canWaitlist = !isAvailable && total > 0 && waitlist < maxWaitlist;

  const formatCurrency = (val?: number) => {
    if (typeof val !== 'number') return '0 đ';
    return `${val.toLocaleString('vi-VN')} đ`;
  };

  const renderBadge = () => {
    if (isAvailable) {
      return (
        <UserBadge variant="success">
          Còn {available}/{total}
        </UserBadge>
      );
    }
    return <UserBadge variant="error">Hết sách</UserBadge>;
  };

  const renderActionButton = () => {
    if (isInCart) {
      return (
        <UserButton
          variant="outline"
          fullWidth
          onClick={() => {
            if (onOpenCart) {
              onOpenCart();
            } else {
              onAction?.(book);
            }
          }}
          style={{ marginTop: 'auto' }}
        >
          Đã trong giỏ
        </UserButton>
      );
    }

    if (isAvailable) {
      return (
        <UserButton
          variant="primary"
          fullWidth
          onClick={() => onAction?.(book)}
          style={{ marginTop: 'auto' }}
        >
          Chọn mượn
        </UserButton>
      );
    }

    if (canWaitlist) {
      return (
        <UserButton
          variant="outline"
          fullWidth
          onClick={() => onAction?.(book)}
          style={{ marginTop: 'auto' }}
        >
          Vào hàng chờ
        </UserButton>
      );
    }

    return (
      <UserButton
        variant="muted"
        fullWidth
        disabled
        style={{ marginTop: 'auto' }}
      >
        Hết sách
      </UserButton>
    );
  };

  return (
    <div
      className={`user-book-card ${className}`}
      style={{
        backgroundColor: '#FFFFFF',
        border: '2px solid #14112B',
        borderRadius: '24px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div
        style={{ cursor: onClickTitle ? 'pointer' : 'default' }}
        onClick={() => onClickTitle?.(book)}
      >
        <UserBookCover
          title={book.title}
          coverImageUrl={book.coverImageUrl}
          theme={theme}
          themeIndex={themeIndex}
          size="catalog"
        />
      </div>

      <div
        style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flex: 1,
        }}
      >
        <div
          onClick={() => onClickTitle?.(book)}
          style={{
            fontFamily: 'var(--user-font-display, "Bricolage Grotesque", "Be Vietnam Pro", sans-serif)',
            fontWeight: 800,
            fontSize: '20px',
            letterSpacing: '-0.02em',
            color: '#14112B',
            cursor: onClickTitle ? 'pointer' : 'default',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '48px',
          }}
        >
          {book.title}
        </div>

        <div
          style={{
            fontSize: '14px',
            color: '#4B4570',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {book.author}
        </div>

        <div>
          <span
            style={{
              fontWeight: 700,
              fontSize: '20px',
              fontFamily: 'var(--user-font-body, "Be Vietnam Pro", sans-serif)',
              color: '#14112B',
            }}
          >
            {formatCurrency(book.borrowFee)}
          </span>{' '}
          <span style={{ fontSize: '13px', color: '#4B4570' }}>/lượt</span>
        </div>

        <div style={{ alignSelf: 'flex-start' }}>{renderBadge()}</div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '13px',
            color: '#4B4570',
          }}
        >
          <span>{book.bookCode || '—'}</span>
          <span>Trễ {formatCurrency(book.lateFeePerDay)}/ngày</span>
        </div>

        <div style={{ fontSize: '13px', color: '#4B4570' }}>
          Hàng chờ: {isAvailable ? '—' : `${waitlist} / ${maxWaitlist}`}
        </div>

        {renderActionButton()}
      </div>
    </div>
  );
};
