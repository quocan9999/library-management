import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { LibbyButton } from '@/components/ui';
import { DEFAULT_BOOK_COVER_URL, LibbyColors, LibbyFonts } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { CatalogBook } from '@/services/bookCatalogService';

interface BookDetailModalProps {
  book: CatalogBook | null;
  visible: boolean;
  onClose: () => void;
  onAddedSuccess?: (msg: string) => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  visible,
  onClose,
  onAddedSuccess,
}) => {
  const { addToCart, isInCart } = useCart();
  const [imageError, setImageError] = useState(false);

  if (!book) return null;

  const inCart = isInCart(book.id);
  const isAvailable = book.availableQuantity > 0;
  const formattedFee = (book.borrowFee || 0).toLocaleString('vi-VN');
  const imageUri = (!imageError && (book.coverImageUrl || DEFAULT_BOOK_COVER_URL)) || null;

  const handleAddToCart = () => {
    const res = addToCart(book);
    if (res.success) {
      onAddedSuccess?.(res.message || 'Đã thêm vào giỏ mượn.');
      onClose();
    } else {
      alert(res.message || 'Không thể thêm vào giỏ mượn.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.sheetTitle}>Thông tin sách</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 6l12 12M18 6L6 18"
                  stroke={LibbyColors.ink}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </View>

          {/* Book Hero Card */}
          <View style={styles.bookHero}>
            <View style={styles.coverBox}>
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.coverImage}
                  contentFit="cover"
                  transition={150}
                  onError={() => setImageError(true)}
                />
              ) : (
                <Text numberOfLines={4} style={styles.coverText}>
                  {book.title}
                </Text>
              )}
            </View>

            <View style={styles.bookInfo}>
              <Text numberOfLines={2} style={styles.titleText}>
                {book.title}
              </Text>
              <Text style={styles.authorText}>Tác giả: {book.author || 'Đang cập nhật'}</Text>
              {book.publisher && (
                <Text style={styles.publisherText}>NXB: {book.publisher}</Text>
              )}
              <View style={styles.feeContainer}>
                <Text style={styles.feeVal}>{formattedFee} đ </Text>
                <Text style={styles.feeSub}>/lượt mượn</Text>
              </View>
            </View>
          </View>

          {/* Status Row */}
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Tình trạng:</Text>
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
                  ? `Còn ${book.availableQuantity} trên tổng số ${book.totalQuantity} cuốn`
                  : 'Tạm thời hết sách'}
              </Text>
            </View>
          </View>

          {/* Action Button */}
          <View style={styles.footer}>
            <LibbyButton
              title={
                inCart
                  ? 'Đã có trong giỏ mượn'
                  : isAvailable
                  ? 'Thêm vào giỏ mượn'
                  : 'Hết sách'
              }
              variant={inCart ? 'outline' : 'primary'}
              disabled={inCart || !isAvailable}
              onPress={handleAddToCart}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20, 17, 43, 0.45)',
  },
  sheet: {
    backgroundColor: LibbyColors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: LibbyColors.ink,
    padding: 24,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 22,
    color: LibbyColors.ink,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFEBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookHero: {
    flexDirection: 'row',
    gap: 16,
  },
  coverBox: {
    width: 90,
    height: 120,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    backgroundColor: LibbyColors.accentViolet,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverText: {
    fontFamily: LibbyFonts.display,
    fontSize: 14,
    color: LibbyColors.white,
    lineHeight: 16,
    padding: 10,
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  titleText: {
    fontFamily: LibbyFonts.display,
    fontSize: 18,
    color: LibbyColors.ink,
    letterSpacing: -0.3,
  },
  authorText: {
    fontFamily: LibbyFonts.regular,
    fontSize: 14,
    color: LibbyColors.textMuted,
  },
  publisherText: {
    fontFamily: LibbyFonts.regular,
    fontSize: 12,
    color: LibbyColors.textMuted,
  },
  feeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  feeVal: {
    fontFamily: LibbyFonts.display,
    fontSize: 18,
    color: LibbyColors.ink,
  },
  feeSub: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: LibbyColors.textMuted,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ECE8FF',
  },
  statusLabel: {
    fontFamily: LibbyFonts.medium,
    fontSize: 14,
    color: LibbyColors.ink,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
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
  footer: {
    paddingTop: 8,
  },
});
