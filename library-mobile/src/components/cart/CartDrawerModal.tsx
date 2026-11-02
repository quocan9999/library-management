import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BookCoverMini } from '@/components/books/BookCoverMini';
import { LibbyButton } from '@/components/ui';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { borrowService, BorrowRequest } from '@/services/borrowService';

interface CartDrawerModalProps {
  onCheckoutSuccess?: (loanCode: string, paymentStatus?: BorrowRequest['paymentStatus']) => void;
}

export const CartDrawerModal: React.FC<CartDrawerModalProps> = ({ onCheckoutSuccess }) => {
  const {
    isCartOpen,
    closeCart,
    items,
    removeFromCart,
    clearCart,
    totalFee,
    totalDeposit,
    totalPayment,
  } = useCart();
  const [submitting, setSubmitting] = useState(false);

  const formattedFee = totalFee.toLocaleString('vi-VN');
  const formattedDeposit = totalDeposit.toLocaleString('vi-VN');
  const formattedTotal = totalPayment.toLocaleString('vi-VN');

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const bookIds = items.map((b) => b.id);
      const res = await borrowService.createRequest(bookIds);
      clearCart();
      closeCart();
      Alert.alert(
        'Đặt mượn thành công!',
        `Yêu cầu mã ${res.loanCode} đã được ghi nhận. ${
          res.paymentStatus === 'PENDING'
            ? 'Vui lòng hoàn tất thanh toán để thư viện chuẩn bị sách.'
            : 'Vui lòng kiểm tra mã QR trong mục Sách của tôi để nhận sách.'
        }`
      );
      onCheckoutSuccess?.(res.loanCode, res.paymentStatus);
    } catch (err: any) {
      Alert.alert('Không thể đặt mượn', err.message || 'Đã có lỗi xảy ra.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={isCartOpen}
      transparent
      animationType="slide"
      onRequestClose={closeCart}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={closeCart} />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Giỏ mượn</Text>
              <Pressable
                onPress={closeCart}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Đóng giỏ mượn"
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
            <Text style={styles.headerSubtitle}>
              Tối đa 3 đầu sách cho mỗi lượt mượn trực tuyến.
            </Text>
          </View>

          {/* Body items */}
          <ScrollView
            style={styles.itemsList}
            contentContainerStyle={styles.itemsContent}
            showsVerticalScrollIndicator={false}
          >
            {items.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M6 7h12l1 13H5z"
                      stroke={LibbyColors.ink}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M9 7a3 3 0 0 1 6 0"
                      stroke={LibbyColors.ink}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Text style={styles.emptyTitle}>Giỏ mượn chưa có sách nào</Text>
                <Text style={styles.emptySubtitle}>
                  {'Hãy khám phá các đầu sách và bấm "Thêm vào giỏ mượn".'}
                </Text>
              </View>
            ) : (
              items.map((item, idx) => (
                <View key={item.id} style={styles.itemRow}>
                  <BookCoverMini
                    coverImageUrl={item.coverImageUrl}
                    title={item.title}
                    index={idx}
                    marginLeft={0}
                  />

                  <View style={styles.itemInfo}>
                    <Text numberOfLines={1} style={styles.itemTitle}>
                      {item.title}
                    </Text>
                    <Text style={styles.itemFee}>
                      Phí {(item.borrowFee || 0).toLocaleString('vi-VN')} đ · Cọc{' '}
                      {(item.price || 0).toLocaleString('vi-VN')} đ
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => removeFromCart(item.id)}
                    style={styles.deleteBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Xóa ${item.title}`}
                  >
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M6 6l12 12M18 6L6 18"
                        stroke={LibbyColors.ink}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                      />
                    </Svg>
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>

          {/* Footer Checkout */}
          {items.length > 0 && (
            <View style={styles.footer}>
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Tổng phí mượn</Text>
                <Text style={styles.subtotalAmount}>{formattedFee} đ</Text>
              </View>
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Tổng tiền cọc</Text>
                <Text style={styles.subtotalAmount}>{formattedDeposit} đ</Text>
              </View>
              <View style={[styles.subtotalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Tổng thanh toán</Text>
                <Text style={styles.grandTotalAmount}>{formattedTotal} đ</Text>
              </View>
              <Text style={styles.depositNote}>
                Tiền cọc được hoàn trả 100% khi trả sách nguyên vẹn tại quầy.
              </Text>

              <LibbyButton
                title={
                  submitting
                    ? 'Đang gửi yêu cầu...'
                    : `Đặt mượn (${items.length} sách)`
                }
                variant="primary"
                disabled={submitting}
                onPress={handleCheckout}
              />
            </View>
          )}
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
  sheetContainer: {
    backgroundColor: LibbyColors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: LibbyColors.ink,
    maxHeight: '85%',
    minHeight: 360,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECE8FF',
    gap: 6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 28,
    color: LibbyColors.ink,
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFEBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSubtitle: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: LibbyColors.textMuted,
  },
  itemsList: {
    flexGrow: 1,
  },
  itemsContent: {
    padding: 24,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFEBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 16,
    color: LibbyColors.ink,
  },
  emptySubtitle: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: LibbyColors.textMuted,
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F7F5FF',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECE8FF',
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 16,
    color: LibbyColors.ink,
    letterSpacing: -0.2,
  },
  itemFee: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: LibbyColors.textMuted,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LibbyColors.white,
    borderWidth: 1,
    borderColor: '#ECE8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    borderTopWidth: 2,
    borderTopColor: LibbyColors.ink,
    gap: 14,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  subtotalLabel: {
    fontFamily: LibbyFonts.regular,
    fontSize: 14,
    color: LibbyColors.textMuted,
  },
  subtotalAmount: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 14,
    color: LibbyColors.ink,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: LibbyColors.borderSubtle,
    paddingTop: 8,
    marginTop: 2,
  },
  grandTotalLabel: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 16,
    color: LibbyColors.ink,
  },
  grandTotalAmount: {
    fontFamily: LibbyFonts.display,
    fontSize: 26,
    color: LibbyColors.ink,
    letterSpacing: -0.5,
  },
  depositNote: {
    fontFamily: LibbyFonts.regular,
    fontSize: 12,
    color: LibbyColors.textMuted,
    lineHeight: 17,
  },
});
