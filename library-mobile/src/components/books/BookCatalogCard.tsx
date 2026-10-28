import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DEFAULT_BOOK_COVER_URL, LibbyColors, LibbyFonts } from '@/constants/theme';
import { CatalogBook } from '@/services/bookCatalogService';

interface BookCatalogCardProps {
  book: CatalogBook;
  themeIndex?: number;
  cardWidth?: number;
  onPress?: () => void;
  onAddToCart?: () => void;
}

const THEMES = [
  { bg: LibbyColors.accentViolet, text: LibbyColors.white },
  { bg: LibbyColors.ink, text: LibbyColors.accentLime },
  { bg: LibbyColors.accentLime, text: LibbyColors.ink },
];

export const BookCatalogCard: React.FC<BookCatalogCardProps> = ({
  book,
  themeIndex = 0,
  cardWidth,
  onPress,
}) => {
  const [imageError, setImageError] = useState(false);
  const currentTheme = THEMES[Math.abs(themeIndex) % THEMES.length];
  const isAvailable = book.availableQuantity > 0;

  const formattedFee = (book.borrowFee || 0).toLocaleString('vi-VN');
  const imageUri = (!imageError && (book.coverImageUrl || DEFAULT_BOOK_COVER_URL)) || null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        cardWidth ? { width: cardWidth } : null,
        pressed && { opacity: 0.88 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Sách ${book.title}`}
    >
      <View style={[styles.cover, { backgroundColor: currentTheme.bg }]}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.coverImage}
            contentFit="cover"
            transition={200}
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.typographyFallback}>
            <Text
              numberOfLines={3}
              style={[styles.coverTitle, { color: currentTheme.text }]}
            >
              {book.title}
            </Text>
          </View>
        )}
      </View>

      <Text numberOfLines={2} style={styles.bookTitle}>
        {book.title}
      </Text>

      <View style={styles.feeRow}>
        <Text style={styles.feeAmount}>{formattedFee} đ </Text>
        <Text style={styles.feeUnit}>/lượt</Text>
      </View>

      <View
        style={[
          styles.badge,
          isAvailable ? styles.badgeAvailable : styles.badgeOutOfStock,
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            isAvailable ? styles.badgeTextAvailable : styles.badgeTextOutOfStock,
          ]}
        >
          {isAvailable
            ? `Còn ${book.availableQuantity}/${book.totalQuantity}`
            : 'Hết sách'}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 160,
    gap: 8,
    marginBottom: 8,
  },
  cover: {
    width: '100%',
    aspectRatio: 0.72,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    overflow: 'hidden',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  typographyFallback: {
    flex: 1,
    padding: 14,
    justifyContent: 'flex-end',
  },
  coverTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 20,
    lineHeight: 23,
    letterSpacing: -0.5,
  },
  bookTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.3,
    color: LibbyColors.ink,
    minHeight: 40,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  feeAmount: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 14,
    color: LibbyColors.ink,
  },
  feeUnit: {
    fontFamily: LibbyFonts.regular,
    fontSize: 12,
    color: LibbyColors.textMuted,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeAvailable: {
    backgroundColor: LibbyColors.accentLime,
  },
  badgeOutOfStock: {
    backgroundColor: '#FFE4E8',
  },
  badgeText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 12,
  },
  badgeTextAvailable: {
    color: LibbyColors.ink,
  },
  badgeTextOutOfStock: {
    color: '#9B1C31',
  },
});
