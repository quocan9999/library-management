import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCoverMini } from '@/components/books/BookCoverMini';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { BorrowRequestSummary } from '@/services/borrowService';

interface ReadyPickupCardProps {
  request: BorrowRequestSummary;
  onShowQr: () => void;
}

export const ReadyPickupCard: React.FC<ReadyPickupCardProps> = ({ request, onShowQr }) => {
  const router = useRouter();
  const firstBook = request.items[0];
  const otherBooksCount = Math.max(0, (request.itemCount || request.items.length) - 1);

  // Format date helper
  const formatPickupDate = (isoDate?: string | null): string => {
    if (!isoDate) return 'Hôm nay';
    try {
      const d = new Date(isoDate);
      if (Number.isNaN(d.getTime())) return 'Hôm nay';
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return 'Hôm nay';
    }
  };

  const pickupDate = formatPickupDate(firstBook?.pickupExpiresAt || request.createdAt);

  return (
    <View style={styles.card}>
      {/* Dark Card Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text numberOfLines={1} style={styles.loanCodeTitle}>
            Yêu cầu {request.loanCode}
          </Text>
          <Text style={styles.deadlineSubtitle}>Nhận trước {pickupDate}</Text>
        </View>

        <Pressable
          onPress={onShowQr}
          style={({ pressed }) => [styles.qrButton, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel={`Hiện mã QR cho yêu cầu ${request.loanCode}`}
        >
          <Text style={styles.qrButtonText}>Hiện mã QR</Text>
        </Pressable>
      </View>

      {/* Card Body */}
      <View style={styles.body}>
        {/* Stacked Mini Book Covers */}
        <View style={styles.stackWrapper}>
          <BookCoverMini
            coverImageUrl={request.items[0]?.coverImageUrl}
            title={request.items[0]?.title}
            index={0}
            marginLeft={0}
          />
          {request.items.length > 1 && (
            <BookCoverMini
              coverImageUrl={request.items[1]?.coverImageUrl}
              title={request.items[1]?.title}
              index={1}
              marginLeft={-18}
            />
          )}
          {request.items.length > 2 && (
            <BookCoverMini
              coverImageUrl={request.items[2]?.coverImageUrl}
              title={request.items[2]?.title}
              index={2}
              marginLeft={-18}
            />
          )}
        </View>

        {/* Book Info */}
        <View style={styles.bookDetails}>
          <Text numberOfLines={1} style={styles.bookTitle}>
            {firstBook?.title || 'Sách mượn'}
          </Text>
          {otherBooksCount > 0 ? (
            <Text style={styles.otherBooksText}>và {otherBooksCount} sách khác</Text>
          ) : (
            <Text style={styles.otherBooksText}>{firstBook?.author || 'Tác giả'}</Text>
          )}

          <View style={styles.readyBadge}>
            <Text style={styles.readyBadgeText}>Sẵn sàng nhận</Text>
          </View>

          {request.paymentStatus === 'PENDING' && (
            <Pressable
              onPress={() =>
                router.push(`/borrow-payment/${encodeURIComponent(request.loanCode)}`)
              }
              accessibilityRole="button"
              accessibilityLabel={`Thanh toán yêu cầu ${request.loanCode}`}
            >
              <Text style={styles.paymentText}>
                Chờ thanh toán {(request.paymentAmount || 0).toLocaleString('vi-VN')} đ · Thanh
                toán ngay
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 320,
    backgroundColor: LibbyColors.white,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    borderRadius: 24,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: LibbyColors.ink,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  loanCodeTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 18,
    color: LibbyColors.white,
    letterSpacing: -0.3,
  },
  deadlineSubtitle: {
    fontFamily: LibbyFonts.regular,
    fontSize: 12,
    color: '#C9C3F0',
    marginTop: 2,
  },
  qrButton: {
    height: 40,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: LibbyColors.accentLime,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrButtonText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 14,
    color: LibbyColors.accentLime,
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stackWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookDetails: {
    flex: 1,
    gap: 5,
  },
  bookTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 17,
    letterSpacing: -0.3,
    color: LibbyColors.ink,
  },
  otherBooksText: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: LibbyColors.textMuted,
  },
  readyBadge: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: LibbyColors.accentLime,
  },
  readyBadgeText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 12,
    color: LibbyColors.ink,
  },
  paymentText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 12,
    color: '#9B1C31',
    lineHeight: 16,
  },
});
