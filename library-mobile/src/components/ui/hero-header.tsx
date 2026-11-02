import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LibbyLogo } from '@/components/ui/brand-logo';
import { LibbyStackedCards } from '@/components/ui/stacked-cards';
import { LibbyColors, LibbyFonts } from '@/constants/theme';

export interface LibbyHeroHeaderProps {
  slogan?: string;
  style?: ViewStyle;
}

/**
 * Component Hero Header chuyên biệt cho màn hình Đăng nhập (Hình 1).
 * Giữ nguyên vẹn thiết kế: logo Libby, slogan định vị và 3 thẻ sách 3D nghiêng.
 */
export const LibbyHeroHeader: React.FC<LibbyHeroHeaderProps> = ({
  slogan = 'Thư viện online · Mượn trên app · Lấy tại quầy',
  style,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.heroContainer,
        { paddingTop: Math.max(insets.top, 16) },
        style,
      ]}
    >
      <View style={styles.brandSection}>
        <LibbyLogo size="lg" variant="header" />
        {slogan ? <Text style={styles.sloganText}>{slogan}</Text> : null}
      </View>

      {/* 3 thẻ sách 3D nghiêng -12deg, +4deg, +16deg */}
      <LibbyStackedCards />
    </View>
  );
};

const styles = StyleSheet.create({
  heroContainer: {
    backgroundColor: LibbyColors.primary,
    position: 'relative',
    height: 233,
    flexShrink: 0,
  },
  brandSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  sloganText: {
    fontFamily: LibbyFonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: '#EFEBFF',
    maxWidth: 200,
  },
});
