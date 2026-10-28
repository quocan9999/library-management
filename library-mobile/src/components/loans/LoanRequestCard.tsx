import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { BorrowRequestSummary } from '@/services/borrowService';

import { LoanItemRow } from './LoanItemRow';

interface LoanRequestCardProps {
  request: BorrowRequestSummary;
  onShowQr: (request: BorrowRequestSummary) => void;
  onItemUpdated?: () => void;
}

export const LoanRequestCard: React.FC<LoanRequestCardProps> = ({
  request,
  onShowQr,
  onItemUpdated,
}) => {
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

  const hasPickup = !!request.pickupReference;

  return (
    <View style={styles.card}>
      {/* Dark Navy Card Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.loanCode}>Yêu cầu {request.loanCode}</Text>
          <Text style={styles.dateText}>
            Tạo ngày {formatDate(request.createdAt)} · {request.itemCount || request.items.length} sách
          </Text>
        </View>

        {hasPickup && (
          <Pressable
            onPress={() => onShowQr(request)}
            style={({ pressed }) => [styles.qrBtn, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={`Hiện mã QR cho yêu cầu ${request.loanCode}`}
          >
            <Text style={styles.qrBtnText}>Hiện mã QR</Text>
          </Pressable>
        )}
      </View>

      {/* Body with Items */}
      <View style={styles.body}>
        {/* Payment reminder if PENDING */}
        {request.paymentStatus === 'PENDING' && (
          <View style={styles.paymentBox}>
            <View style={styles.paymentBadge}>
              <Text style={styles.paymentBadgeText}>Chờ thanh toán</Text>
            </View>
            <Text style={styles.paymentDesc}>
              Cần thanh toán {(request.paymentAmount || 0).toLocaleString('vi-VN')} đ tại quầy để thư viện chuẩn bị sách.
            </Text>
          </View>
        )}

        {request.items.map((item) => (
          <LoanItemRow
            key={item.id}
            item={item}
            loanCode={request.loanCode}
            onItemUpdated={onItemUpdated}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: LibbyColors.white,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  header: {
    backgroundColor: LibbyColors.ink,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerInfo: {
    flex: 1,
  },
  loanCode: {
    fontFamily: LibbyFonts.display,
    fontSize: 18,
    color: LibbyColors.white,
    letterSpacing: -0.3,
  },
  dateText: {
    fontFamily: LibbyFonts.regular,
    fontSize: 12,
    color: '#C9C3F0',
    marginTop: 2,
  },
  qrBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: LibbyColors.accentLime,
  },
  qrBtnText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 13,
    color: LibbyColors.accentLime,
  },
  body: {
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  paymentBox: {
    marginVertical: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFF8E6',
    borderWidth: 1,
    borderColor: '#FFE28A',
    gap: 6,
  },
  paymentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFE8A3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  paymentBadgeText: {
    fontFamily: LibbyFonts.bold,
    fontSize: 11,
    color: '#7A4B00',
  },
  paymentDesc: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: '#7A4B00',
    lineHeight: 18,
  },
});
