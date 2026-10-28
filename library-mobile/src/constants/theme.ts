/**
 * Libby Mobile Design System Tokens
 * Đồng bộ 100% với Libby Web Design System (userTheme.css)
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#14112B',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#4B4570',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Libby Brand Tokens
 */
export const LibbyColors = {
  primary: '#6C4DFF',
  primaryDark: '#5537DB',
  ink: '#14112B',
  lime: '#C8FF3D',
  lilac: '#EFEBFF',
  subtleBg: '#F7F5FF',
  muted: '#4B4570',
  textMuted: '#4B4570',
  placeholder: '#7A7499',
  border: '#14112B',
  borderLight: '#DDD9F5',
  borderSubtle: '#E5E0FA',
  errorText: '#9B1C31',
  errorBg: '#FFE4E8',
  successText: '#1F7A3A',
  successBg: '#E7F7ED',
  white: '#FFFFFF',
  cardLime: '#C8FF3D',
  cardNavy: '#14112B',
  cardWhite: '#FFFFFF',
} as const;

/**
 * Libby Typography Font Families
 */
export const LibbyFonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semiBold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
} as const;
