import React, { useState } from 'react';

export type UserBookCoverTheme = 'ink' | 'violet' | 'lime' | 'lilac';

export type UserBookCoverSize = 'sm' | 'md' | 'lg' | 'catalog';

export interface UserBookCoverProps {
  title: string;
  coverImageUrl?: string | null;
  theme?: UserBookCoverTheme;
  themeIndex?: number;
  size?: UserBookCoverSize;
  className?: string;
  style?: React.CSSProperties;
}

const COLOR_PAIRS: Array<{ bg: string; color: string; theme: UserBookCoverTheme }> = [
  { theme: 'ink', bg: '#14112B', color: '#C8FF3D' },
  { theme: 'violet', bg: '#6C4DFF', color: '#FFFFFF' },
  { theme: 'lime', bg: '#C8FF3D', color: '#14112B' },
  { theme: 'lilac', bg: '#EFEBFF', color: '#14112B' },
];

export const UserBookCover: React.FC<UserBookCoverProps> = ({
  title,
  coverImageUrl,
  theme,
  themeIndex = 0,
  size = 'catalog',
  className = '',
  style = {},
}) => {
  const [imageError, setImageError] = useState(false);

  // Pick color pair either by explicit theme or cyclic index
  const activePair = theme
    ? COLOR_PAIRS.find((p) => p.theme === theme) || COLOR_PAIRS[0]
    : COLOR_PAIRS[Math.abs(themeIndex) % COLOR_PAIRS.length];

  const getSizeStyles = (): {
    width?: string;
    height: string;
    borderRadius: string;
    fontSize: string;
    padding: string;
  } => {
    switch (size) {
      case 'sm':
        return {
          width: '56px',
          height: '76px',
          borderRadius: '12px',
          fontSize: '11px',
          padding: '6px',
        };
      case 'md':
        return {
          width: '72px',
          height: '100px',
          borderRadius: '14px',
          fontSize: '13px',
          padding: '8px',
        };
      case 'lg':
        return {
          width: '96px',
          height: '132px',
          borderRadius: '16px',
          fontSize: '15px',
          padding: '12px',
        };
      case 'catalog':
      default:
        return {
          width: '100%',
          height: '170px',
          borderRadius: '0px',
          fontSize: '26px',
          padding: '20px',
        };
    }
  };

  const dim = getSizeStyles();

  if (coverImageUrl && !imageError) {
    return (
      <div
        className={`user-book-cover overflow-hidden flex-none relative ${className}`}
        style={{
          width: dim.width,
          height: dim.height,
          borderRadius: dim.borderRadius,
          backgroundColor: activePair.bg,
          ...style,
        }}
      >
        <img
          src={coverImageUrl}
          alt={title}
          onError={() => setImageError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`user-book-cover flex-none select-none ${className}`}
      style={{
        width: dim.width,
        height: dim.height,
        borderRadius: dim.borderRadius,
        backgroundColor: activePair.bg,
        color: activePair.color,
        padding: dim.padding,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'flex-end',
        overflow: 'hidden',
        fontFamily: 'var(--user-font-display, "Bricolage Grotesque", sans-serif)',
        fontWeight: 800,
        fontSize: dim.fontSize,
        lineHeight: 1,
        letterSpacing: '-0.03em',
        wordBreak: 'break-word',
        ...style,
      }}
    >
      <span
        style={{
          display: '-webkit-box',
          WebkitLineClamp: size === 'catalog' ? 2 : 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {title}
      </span>
    </div>
  );
};
