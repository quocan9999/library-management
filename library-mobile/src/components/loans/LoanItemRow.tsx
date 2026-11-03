import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCoverMini } from '@/components/books/BookCoverMini';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { BorrowItem, borrowService, LoanItemStatus } from '@/services/borrowService';

interface LoanItemRowProps {
  item: BorrowItem;
  loanCode: string;
  onItemUpdated?: () => void;
}

const STATUS_LABELS: Record<LoanItemStatus, string> = {
  RESERVED: 'Đang giữ sách',
  PREPARING: 'Đang chuẩn bị',
  READY_FOR_PICKUP: 'Sẵn sàng nhận',
  BORROWED: 'Đang mượn',
  RETURNED: 'Đã trả',
  LOST: 'Báo mất sách',
  CANCELLED: 'Đã hủy',
  REJECTED: 'Không tìm thấy sách',
  EXPIRED: 'Đã hết hạn nhận',
};

export const LoanItemRow: React.FC<LoanItemRowProps> = ({ item, loanCode, onItemUpdated }) => {
  const [loadingAction, setLoadingAction] = useState(false);

  const getBadgeStyle = (status: LoanItemStatus) => {
    switch (status) {
      case 'READY_FOR_PICKUP':
        return { bg: LibbyColors.accentLime, text: LibbyColors.ink };
      case 'PREPARING':
      case 'RESERVED':
        return { bg: '#FFE8A3', text: '#7A4B00' };
      case 'BORROWED':
        return { bg: '#EFEBFF', text: LibbyColors.accentViolet };
      case 'RETURNED':
        return { bg: '#E5F8ED', text: '#0A7A38' };
      case 'LOST':
      case 'CANCELLED':
      case 'REJECTED':
      case 'EXPIRED':
        return { bg: '#FFE4E8', text: '#9B1C31' };
      default:
        return { bg: '#ECE8FF', text: LibbyColors.textMuted };
    }
  };

  const badgeStyle = getBadgeStyle(item.status);

  // Format date helper
  const formatDate = (isoDate?: string | null): string => {
    if (!isoDate) return '—';
    try {
      const d = new Date(isoDate);
      if (Number.isNaN(d.getTime())) return '—';
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return '—';
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Xác nhận hủy sách',
      `Bạn có chắc chắn muốn hủy cuốn "${item.title}" khỏi yêu cầu mượn?`,
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy sách',
          style: 'destructive',
          onPress: async () => {
            setLoadingAction(true);
            try {
              await borrowService.cancelItem(loanCode, item.id);
              Alert.alert('Thành công', 'Đã hủy cuốn sách khỏi yêu cầu.');
              onItemUpdated?.();
            } catch (err: any) {
              Alert.alert('Không thể hủy', err.message || 'Đã có lỗi xảy ra.');
            } finally {
              setLoadingAction(false);
            }
          },
        },
      ]
    );
  };

  const handleRenew = () => {
    Alert.alert(
      'Gia hạn sách',
      `Gia hạn thêm 7 ngày cho cuốn "${item.title}"?`,
      [
        { text: 'Đóng', style: 'cancel' },
        {
          text: 'Xác nhận gia hạn',
          onPress: async () => {
            setLoadingAction(true);
            try {
              await borrowService.renewItem(loanCode, item.id, item.version);
              Alert.alert('Thành công', 'Cuốn sách đã được gia hạn thêm 7 ngày.');
              onItemUpdated?.();
            } catch (err: any) {
              Alert.alert('Không thể gia hạn', err.message || 'Đã có lỗi xảy ra.');
            } finally {
              setLoadingAction(false);
            }
          },
        },
      ]
    );
  };

  const canCancel =
    (item.status === 'RESERVED' || item.status === 'PREPARING') && !(item.paidBorrowFee > 0);
  const canRenew = item.status === 'BORROWED' && item.renewalCount < 2;

  const formattedBorrowFee = (item.borrowFee || 0).toLocaleString('vi-VN');
  const formattedDeposit = (item.depositAmount || 0).toLocaleString('vi-VN');
  const formattedLateFeePerDay = (item.lateFeePerDay || 0).toLocaleString('vi-VN');
  const formattedRefunded = (item.depositRefundedAmount ?? item.depositAmount ?? 0).toLocaleString(
    'vi-VN'
  );
  const isLost = item.status === 'LOST';
  const depositRefunded = !!item.depositRefundedAt;
  const depositForfeited = !!item.depositForfeitedAt || isLost;
  const depositHeld =
    item.status === 'BORROWED' && !depositRefunded && !depositForfeited && item.depositAmount > 0;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <BookCoverMini
          coverImageUrl={item.coverImageUrl}
          title={item.title}
          marginLeft={0}
        />

        <View style={styles.info}>
          <Text numberOfLines={2} style={styles.title}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={styles.author}>
            {item.author || 'Tác giả'}
          </Text>

          {item.status === 'BORROWED' && item.dueDate && (
            <Text style={styles.deadlineText}>Hạn trả: {formatDate(item.dueDate)}</Text>
          )}

          {item.status === 'READY_FOR_PICKUP' && item.pickupExpiresAt && (
            <Text style={styles.pickupDeadlineText}>
              Hạn nhận: {formatDate(item.pickupExpiresAt)}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.feeRow}>
        <Text style={styles.feeText}>
          Phí mượn <Text style={styles.feeValue}>{formattedBorrowFee} đ</Text>
        </Text>
        <Text style={styles.feeText}>
          Cọc <Text style={styles.feeValue}>{formattedDeposit} đ</Text>
        </Text>
        {item.status === 'BORROWED' && (
          <Text style={styles.feeText}>
            Phí trễ/ngày <Text style={styles.feeValue}>{formattedLateFeePerDay} đ</Text>
          </Text>
        )}
      </View>

      {(depositRefunded || depositForfeited || depositHeld) && (
        <View style={styles.depositRow}>
          {depositRefunded && (
            <View style={[styles.depositBadge, styles.depositRefundedBadge]}>
              <Text style={styles.depositRefundedText}>Đã hoàn cọc {formattedRefunded} đ</Text>
            </View>
          )}
          {depositForfeited && (
            <View style={[styles.depositBadge, styles.depositForfeitedBadge]}>
              <Text style={styles.depositForfeitedText}>Tịch thu cọc {formattedDeposit} đ</Text>
            </View>
          )}
          {depositHeld && (
            <View style={[styles.depositBadge, styles.depositHeldBadge]}>
              <Text style={styles.depositHeldText}>Đang giữ cọc</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.bottomRow}>
        <View style={[styles.badge, { backgroundColor: badgeStyle.bg }]}>
          <Text style={[styles.badgeText, { color: badgeStyle.text }]}>
            {STATUS_LABELS[item.status] || item.status}
          </Text>
        </View>

        <View style={styles.actions}>
          {canCancel && (
            <Pressable
              onPress={handleCancel}
              disabled={loadingAction}
              style={({ pressed }) => [styles.actionBtn, styles.cancelBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </Pressable>
          )}

          {canRenew && (
            <Pressable
              onPress={handleRenew}
              disabled={loadingAction}
              style={({ pressed }) => [styles.actionBtn, styles.renewBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.renewBtnText}>Gia hạn (+7d)</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDFD',
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  title: {
    fontFamily: LibbyFonts.display,
    fontSize: 16,
    color: LibbyColors.ink,
    letterSpacing: -0.2,
  },
  author: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: LibbyColors.textMuted,
  },
  feeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingLeft: 56,
  },
  feeText: {
    fontFamily: LibbyFonts.regular,
    fontSize: 12,
    color: LibbyColors.textMuted,
  },
  feeValue: {
    fontFamily: LibbyFonts.semiBold,
    color: LibbyColors.ink,
  },
  depositRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 56,
  },
  depositBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  depositRefundedBadge: {
    backgroundColor: '#E5F8ED',
  },
  depositRefundedText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 12,
    color: '#0A7A38',
  },
  depositForfeitedBadge: {
    backgroundColor: '#FFE4E8',
  },
  depositForfeitedText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 12,
    color: '#9B1C31',
  },
  depositHeldBadge: {
    backgroundColor: '#EFEBFF',
  },
  depositHeldText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 12,
    color: LibbyColors.accentViolet,
  },
  deadlineText: {
    fontFamily: LibbyFonts.medium,
    fontSize: 12,
    color: LibbyColors.accentViolet,
    marginTop: 2,
  },
  pickupDeadlineText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 12,
    color: '#0A7A38',
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 56,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  cancelBtn: {
    borderColor: '#FFD1D8',
    backgroundColor: '#FFF0F2',
  },
  cancelBtnText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 12,
    color: '#9B1C31',
  },
  renewBtn: {
    borderColor: LibbyColors.ink,
    backgroundColor: LibbyColors.ink,
  },
  renewBtnText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 12,
    color: LibbyColors.white,
  },
});
