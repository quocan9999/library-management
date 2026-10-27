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
      {/* Khối bìa sách với theme pastel */}
      <div
        style={{
          width: '100%',
          height: '240px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: onClickTitle ? 'pointer' : 'default',
        }}
        onClick={() => onClickTitle?.(book)}
      >
        <UserBookCover
          title={book.title}
          coverImageUrl={book.coverImageUrl}
          themeIndex={themeIndex}
          theme={theme}
          style={{ width: '130px', height: '185px' }}
        />
      </div>

      {/* Thông tin nội dung sách */}
      <div
        style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          gap: '12px',
          borderTop: '2px solid #14112B',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {renderBadge()}
          <span
            style={{
              fontWeight: 800,
              fontSize: '15px',
              color: '#6C4DFF',
            }}
          >
            {formatCurrency(book.borrowFee)}
          </span>
        </div>

        <h3
          onClick={() => onClickTitle?.(book)}
          style={{
            fontFamily: 'var(--user-font-display, "Bricolage Grotesque", "Be Vietnam Pro", sans-serif)',
            fontWeight: 700,
            fontSize: '18px',
            color: '#14112B',
            margin: 0,
            lineHeight: 1.3,
            cursor: onClickTitle ? 'pointer' : 'default',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minHeight: '46px',
          }}
          title={book.title}
        >
          {book.title}
        </h3>

        <p
          style={{
            color: '#4B4570',
            fontSize: '14px',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={book.author}
        >
          {book.author}
        </p>

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

        {renderActionButton()}
      </div>
    </div>
  );
};
