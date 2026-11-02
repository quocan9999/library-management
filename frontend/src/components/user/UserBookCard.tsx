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
  price?: number;
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
    if (available === 1) {
      return (
        <UserBadge variant="warning">
          Sắp hết · còn 1
        </UserBadge>
      );
    }
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
          aria-label={`Chọn mượn ${book.title}`}
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
      className={`user-book-card user-no-select ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        border: '2px solid #14112B',
        boxShadow: '4px 4px 0px 0px #14112B',
        overflow: 'hidden',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        ...style,
      }}
    >
      {/* Visual Header / Cover Canvas */}
      <div
        style={{
          position: 'relative',
          padding: '24px 20px',
          backgroundColor: '#F7F5FF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '220px',
          overflow: 'hidden',
        }}
      >
        <UserBookCover
          title={book.title}
          coverImageUrl={book.coverImageUrl}
          themeIndex={themeIndex}
          theme={theme}
          size="md"
        />
      </div>

      {/* Meta Content */}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {renderBadge()}
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                fontWeight: 800,
                fontSize: '15px',
                color: '#6C4DFF',
                display: 'block',
              }}
            >
              {formatCurrency(book.borrowFee)}
            </span>
            {book.price !== undefined && book.price > 0 && (
              <span style={{ fontSize: '12px', color: '#7A7599', display: 'block' }}>
                Cọc: {formatCurrency(book.price)}
              </span>
            )}
          </div>
        </div>

        <h3
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
          <a
            href={`/books/${book.id}`}
            role="link"
            onClick={(e) => {
              e.preventDefault();
              onClickTitle?.(book);
            }}
            style={{
              color: 'inherit',
              textDecoration: 'none',
              cursor: onClickTitle ? 'pointer' : 'default',
            }}
          >
            {book.title}
          </a>
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
