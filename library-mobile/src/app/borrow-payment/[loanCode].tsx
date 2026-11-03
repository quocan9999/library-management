import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { LibbyButton } from '@/components/ui';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { BorrowRequest, borrowService } from '@/services/borrowService';

const MOCK_BANK_DETAILS = {
  bank: 'VietQR mô phỏng',
  accountNumber: '0000000000',
  beneficiary: 'THU VIEN DEMO',
};

const formatVnd = (value?: number | null): string => (value || 0).toLocaleString('vi-VN');

const formatRemaining = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function BorrowPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ loanCode?: string | string[] }>();
  const loanCode = Array.isArray(params.loanCode) ? params.loanCode[0] : params.loanCode || '';

  const [request, setRequest] = useState<BorrowRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const actionLock = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    if (!loanCode) return;
    try {
      const data = await borrowService.getMine(loanCode);
      setRequest(data);
      setFailure('');
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : 'Không thể tải thông tin thanh toán.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loanCode]);

  useEffect(() => {
    // Tải dữ liệu ban đầu; các lần setState đều diễn ra sau await nên không gây cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const paymentStatus = request?.paymentStatus ?? 'PENDING';
  const amount = request?.paymentAmount ?? 0;
  const paid = paymentStatus === 'PAID' || paymentStatus === 'NOT_REQUIRED';

  const expiresAtMs = request?.paymentExpiresAt ? Date.parse(request.paymentExpiresAt) : null;
  const remainingMs = expiresAtMs !== null ? Math.max(0, expiresAtMs - now) : null;
  const expired =
    paymentStatus === 'EXPIRED' ||
    (paymentStatus === 'PENDING' && remainingMs !== null && remainingMs === 0);

  const totalBorrowFee =
    request?.items.reduce((sum, item) => sum + (item.borrowFee || 0), 0) ?? 0;
  const totalDeposit =
    request?.items.reduce((sum, item) => sum + (item.depositAmount || 0), 0) ?? 0;

  const qrValue = JSON.stringify({
    bank: MOCK_BANK_DETAILS.bank,
    accountNumber: MOCK_BANK_DETAILS.accountNumber,
    beneficiary: MOCK_BANK_DETAILS.beneficiary,
    amount,
    content: `THANH TOAN ${loanCode}`,
  });

  const handleConfirm = async () => {
    if (!request || request.paymentStatus !== 'PENDING' || expired || actionLock.current) return;
    actionLock.current = true;
    setSubmitting(true);
    try {
      const updated = await borrowService.confirmMockPayment(
        request.loanCode,
        request.version,
        request.paymentAmount ?? 0
      );
      setRequest(updated);
    } catch (error) {
      Alert.alert(
        'Không thể xác nhận thanh toán',
        error instanceof Error ? error.message : 'Đã có lỗi xảy ra, vui lòng thử lại.'
      );
      load();
    } finally {
      actionLock.current = false;
      setSubmitting(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M15 5l-7 7 7 7"
            stroke={LibbyColors.ink}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
      <Text style={styles.headerTitle}>Thanh toán</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (!loanCode) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        {renderHeader()}
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>Không tìm thấy mã yêu cầu mượn.</Text>
          <Text style={styles.stateDesc}>
            Vui lòng kiểm tra lại đường dẫn hoặc mã yêu cầu mượn sách.
          </Text>
          <LibbyButton
            title="Quay lại sách của tôi"
            variant="primary"
            onPress={() => router.replace('/(tabs)/my-books')}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingBox}>
          <ActivityIndicator color={LibbyColors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (failure || !request) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        {renderHeader()}
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>{failure || 'Không tìm thấy yêu cầu mượn.'}</Text>
          <Text style={styles.stateDesc}>
            Vui lòng kiểm tra lại đường dẫn hoặc mã yêu cầu mượn sách.
          </Text>
          <LibbyButton title="Tải lại" variant="primary" onPress={load} />
          <LibbyButton
            title="Quay lại sách của tôi"
            variant="outline"
            onPress={() => router.replace('/(tabs)/my-books')}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (paid) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        {renderHeader()}
        <View style={styles.stateBox}>
          <View style={styles.successIcon}>
            <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
              <Path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke={LibbyColors.ink}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={styles.stateTitle}>
            {amount > 0 ? 'Yêu cầu đã được thanh toán' : 'Yêu cầu không phát sinh phí'}
          </Text>
          <Text style={styles.stateDesc}>
            {amount > 0
              ? `Đã ghi nhận ${formatVnd(amount)} đ cho yêu cầu ${request.loanCode}. Bạn có thể theo dõi tiến độ chuẩn bị sách tại mục Sách của tôi.`
              : `Yêu cầu ${request.loanCode} đã được tạo thành công trong hệ thống.`}
          </Text>
          <LibbyButton
            title="Theo dõi yêu cầu mượn"
            variant="primary"
            onPress={() => router.replace('/(tabs)/my-books')}
          />
          <LibbyButton
            title="Tiếp tục khám phá sách"
            variant="outline"
            onPress={() => router.replace('/(tabs)')}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (expired) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        {renderHeader()}
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>Yêu cầu thanh toán đã hết hạn</Text>
          <Text style={styles.stateDesc}>
            Thời gian giữ sách cho yêu cầu {request.loanCode} đã kết thúc. Sách đã được hoàn lại
            kho chung và yêu cầu này không thể tiếp tục thanh toán.
          </Text>
          <LibbyButton
            title="Chọn sách lại"
            variant="primary"
            onPress={() => router.replace('/(tabs)')}
          />
          <LibbyButton
            title="Xem sách của tôi"
            variant="outline"
            onPress={() => router.replace('/(tabs)/my-books')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {renderHeader()}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={LibbyColors.primary}
          />
        }
      >
        <View style={styles.card}>
          <Text style={styles.loanCode}>Yêu cầu {request.loanCode}</Text>
          <Text style={styles.amountLabel}>Số tiền cần thanh toán</Text>
          <Text style={styles.amount}>{formatVnd(amount)} đ</Text>

          {remainingMs !== null && (
            <Text
              style={[
                styles.countdown,
                remainingMs < 300000 ? styles.countdownUrgent : null,
              ]}
            >
              {remainingMs > 0
                ? `Còn ${formatRemaining(remainingMs)} để hoàn tất thanh toán`
                : 'Đã hết thời gian thanh toán'}
            </Text>
          )}

          <View style={styles.breakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Tổng phí mượn</Text>
              <Text style={styles.breakdownValue}>{formatVnd(totalBorrowFee)} đ</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Tổng tiền cọc (hoàn 100% khi trả sách)</Text>
              <Text style={styles.breakdownValue}>{formatVnd(totalDeposit)} đ</Text>
            </View>
            <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
              <Text style={styles.breakdownTotalLabel}>Tổng thanh toán</Text>
              <Text style={styles.breakdownTotalValue}>{formatVnd(amount)} đ</Text>
            </View>
          </View>

          <View style={styles.itemList}>
            {request.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemHeader}>
                  <Text numberOfLines={2} style={styles.itemTitle}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemTotal}>
                    {formatVnd((item.borrowFee || 0) + (item.depositAmount || 0))} đ
                  </Text>
                </View>
                <Text style={styles.itemFee}>
                  Phí {formatVnd(item.borrowFee)} đ · Cọc {formatVnd(item.depositAmount)} đ
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.qrCard}>
          <Text style={styles.sectionTitle}>Quét VietQR mô phỏng</Text>
          <View style={styles.qrBox}>
            <QRCode value={qrValue} size={196} color={LibbyColors.ink} />
          </View>

          <View style={styles.bankInfo}>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Ngân hàng</Text>
              <Text style={styles.bankValue}>{MOCK_BANK_DETAILS.bank}</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Số tài khoản</Text>
              <Text style={styles.bankValue}>{MOCK_BANK_DETAILS.accountNumber}</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Người thụ hưởng</Text>
              <Text style={styles.bankValue}>{MOCK_BANK_DETAILS.beneficiary}</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Nội dung</Text>
              <Text style={styles.bankValue}>THANH TOAN {request.loanCode}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.note}>
          Đây là giao dịch mô phỏng. Sau khi chuyển khoản, nhấn “Tôi đã chuyển khoản” để hệ
          thống ghi nhận phí mượn và tiền cọc cho yêu cầu này.
        </Text>

        <View style={styles.actions}>
          <LibbyButton
            title={submitting ? 'Đang xác nhận...' : 'Tôi đã chuyển khoản'}
            variant="primary"
            disabled={submitting}
            loading={submitting}
            onPress={handleConfirm}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LibbyColors.white,
    borderWidth: 1.5,
    borderColor: LibbyColors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 22,
    color: LibbyColors.ink,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  card: {
    backgroundColor: LibbyColors.white,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    padding: 20,
    gap: 8,
  },
  loanCode: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 13,
    color: LibbyColors.textMuted,
  },
  amountLabel: {
    fontFamily: LibbyFonts.regular,
    fontSize: 14,
    color: LibbyColors.textMuted,
  },
  amount: {
    fontFamily: LibbyFonts.display,
    fontSize: 38,
    color: LibbyColors.ink,
    letterSpacing: -0.8,
  },
  countdown: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 13,
    color: LibbyColors.accentViolet,
  },
  countdownUrgent: {
    color: '#9B1C31',
  },
  breakdown: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: LibbyColors.borderSubtle,
    gap: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  breakdownLabel: {
    fontFamily: LibbyFonts.regular,
    fontSize: 14,
    color: LibbyColors.textMuted,
  },
  breakdownValue: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 14,
    color: LibbyColors.ink,
  },
  breakdownTotalRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: LibbyColors.borderSubtle,
  },
  breakdownTotalLabel: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 15,
    color: LibbyColors.ink,
  },
  breakdownTotalValue: {
    fontFamily: LibbyFonts.display,
    fontSize: 18,
    color: LibbyColors.accentViolet,
  },
  itemList: {
    marginTop: 10,
    gap: 8,
  },
  itemRow: {
    backgroundColor: LibbyColors.subtleBg,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemTitle: {
    flex: 1,
    fontFamily: LibbyFonts.semiBold,
    fontSize: 13,
    color: LibbyColors.ink,
  },
  itemTotal: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 14,
    color: LibbyColors.ink,
  },
  itemFee: {
    fontFamily: LibbyFonts.regular,
    fontSize: 12,
    color: LibbyColors.textMuted,
  },
  qrCard: {
    backgroundColor: LibbyColors.white,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    padding: 20,
    alignItems: 'center',
    gap: 14,
  },
  sectionTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 20,
    color: LibbyColors.ink,
    letterSpacing: -0.3,
    alignSelf: 'flex-start',
  },
  qrBox: {
    padding: 14,
    backgroundColor: LibbyColors.white,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: LibbyColors.borderSubtle,
  },
  bankInfo: {
    width: '100%',
    gap: 6,
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  bankLabel: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: LibbyColors.textMuted,
  },
  bankValue: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 13,
    color: LibbyColors.ink,
    flexShrink: 1,
    textAlign: 'right',
  },
  note: {
    fontFamily: LibbyFonts.regular,
    fontSize: 12,
    color: LibbyColors.textMuted,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  actions: {
    gap: 10,
  },
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: LibbyColors.accentLime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 24,
    color: LibbyColors.ink,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  stateDesc: {
    fontFamily: LibbyFonts.regular,
    fontSize: 14,
    color: LibbyColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
});
