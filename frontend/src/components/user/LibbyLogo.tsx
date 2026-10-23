import React from 'react';

export type LibbyLogoVariant = 'dark' | 'light' | 'violet' | 'lime';

export interface LibbyLogoProps {
  /**
   * Biến thể logo dựa trên màu nền hiển thị:
   * - 'dark': dùng trên nền tối (vd: Header #14112B)
   * - 'light': dùng trên nền sáng (vd: Nền trắng #FFFFFF / #F4F1FF)
   * - 'violet': dùng trên nền màu thương hiệu #6C4DFF
   * - 'lime': dùng trên nền màu điểm nhấn #C8FF3D
   */
  variant?: LibbyLogoVariant;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showText?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const LibbyLogo: React.FC<LibbyLogoProps> = ({
  variant = 'light',
  size = 'md',
  showText = true,
  className = '',
  style = {},
}) => {
  const dimensions = {
    sm: { icon: 32, fontSize: 26, gap: 8 },
    md: { icon: 40, fontSize: 36, gap: 10 },
    lg: { icon: 56, fontSize: 48, gap: 14 },
    hero: { icon: 120, fontSize: 104, gap: 24 },
  }[size];

  // Palette theo biến thể nền hiển thị
  let rectFill = '#6C4DFF';
  let pathFill = '#FFFFFF';
  let dotFill = '#C8FF3D';
  let textFill = '#14112B';
  let dotTextFill = '#C8FF3D';

  if (variant === 'dark') {
    rectFill = '#6C4DFF';
    pathFill = '#FFFFFF';
    dotFill = '#C8FF3D';
    textFill = '#FFFFFF';
    dotTextFill = '#C8FF3D';
  } else if (variant === 'violet') {
    rectFill = '#FFFFFF';
    pathFill = '#6C4DFF';
    dotFill = '#C8FF3D';
    textFill = '#FFFFFF';
    dotTextFill = '#C8FF3D';
  } else if (variant === 'lime') {
    rectFill = '#14112B';
    pathFill = '#C8FF3D';
    dotFill = '#FFFFFF';
    textFill = '#14112B';
    dotTextFill = '#FFFFFF';
  }

  return (
    <div
      className={`user-logo user-no-select ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${dimensions.gap}px`,
        textDecoration: 'none',
        ...style,
      }}
    >
      <svg
        width={dimensions.icon}
        height={dimensions.icon}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <rect width="64" height="64" rx="18" fill={rectFill} />
        <path d="M21 14h22a4 4 0 0 1 4 4v32l-15-9-15 9V18a4 4 0 0 1 4-4z" fill={pathFill} />
        <circle cx="46" cy="17" r="8" fill={dotFill} />
      </svg>
      {showText && (
        <span
          style={{
            fontFamily: 'var(--user-font-display, "Bricolage Grotesque", sans-serif)',
            fontWeight: 800,
            fontSize: `${dimensions.fontSize}px`,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: textFill,
          }}
        >
          libby<span style={{ color: dotTextFill }}>.</span>
        </span>
      )}
    </div>
  );
};
