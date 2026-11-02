import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterChipGroup, FilterChipOption } from '@/components/books/FilterChipGroup';
import { LoanQrModal } from '@/components/loans/LoanQrModal';
import { LoanRequestCard } from '@/components/loans/LoanRequestCard';
import { LibbyButton } from '@/components/ui';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import {
  BorrowItem,
  BorrowRequestFilter,
  BorrowRequestSummary,
  borrowService,
  LoanItemStatus,
} from '@/services/borrowService';

const LOAN_FILTERS: FilterChipOption[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'READY', label: 'Sẵn sàng nhận' },
  { value: 'BORROWED', label: 'Đang mượn' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'HISTORY', label: 'Lịch sử' },
];

const HISTORY_STATUSES: LoanItemStatus[] = ['RETURNED', 'CANCELLED', 'REJECTED', 'EXPIRED'];

function filterItem(item: BorrowItem, filter: string): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'HISTORY') return HISTORY_STATUSES.includes(item.status);
  if (filter === 'PENDING') return item.status === 'RESERVED' || item.status === 'PREPARING';
  if (filter === 'READY') return item.status === 'READY_FOR_PICKUP';
  if (filter === 'BORROWED') return item.status === 'BORROWED';
  if (filter === 'CANCELLED') return item.status === 'CANCELLED';
  return true;
}

export default function MyBooksScreen() {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [loans, setLoans] = useState<BorrowRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [qrRequest, setQrRequest] = useState<BorrowRequestSummary | null>(null);

  const fetchLoans = useCallback(async () => {
    try {
      const serverStatus: BorrowRequestFilter =
        selectedFilter === 'READY'
          ? 'READY_FOR_PICKUP'
          : selectedFilter === 'ALL'
          ? 'ALL'
          : (selectedFilter as BorrowRequestFilter);

      const res = await borrowService.listMine(0, serverStatus, 10);
      setLoans(res.content);
    } catch (err) {
      console.warn('Lỗi fetchLoans:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFilter]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLoans();
  };

  // Filter visible items inside each request
  const visibleRequests = useMemo(() => {
    return loans
      .map((req) => ({
        ...req,
        items: req.items.filter((item) => filterItem(item, selectedFilter)),
      }))
      .filter((req) => req.items.length > 0);
  }, [loans, selectedFilter]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Sách của tôi</Text>
        <Text style={styles.pageSubtitle}>
          Theo dõi yêu cầu mượn, hạn nhận và gia hạn sách trực tuyến.
        </Text>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterWrapper}>
        <FilterChipGroup
          options={LOAN_FILTERS}
          selectedValue={selectedFilter}
          onSelect={setSelectedFilter}
        />
      </View>

      {/* Main Loan List */}
      <ScrollView
        style={styles.scrollList}
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
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={LibbyColors.primary} size="large" />
          </View>
        ) : visibleRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {selectedFilter === 'ALL'
                ? 'Bạn chưa có yêu cầu mượn sách'
                : 'Chưa có sách ở trạng thái này'}
            </Text>
            <Text style={styles.emptyDesc}>
              {selectedFilter === 'ALL'
                ? 'Khi đặt mượn, mã QR nhận sách và trạng thái từng cuốn sẽ xuất hiện tại đây.'
                : 'Các trạng thái được lọc theo từng cuốn sách trong yêu cầu.'}
            </Text>

            {selectedFilter === 'ALL' && (
              <View style={styles.exploreBtnContainer}>
                <LibbyButton
                  title="Khám phá sách"
                  variant="primary"
                  onPress={() => router.push('/(tabs)')}
                />
              </View>
            )}
          </View>
        ) : (
          visibleRequests.map((req) => (
            <LoanRequestCard
              key={req.loanCode}
              request={req}
              onShowQr={(r) => setQrRequest(r)}
              onItemUpdated={fetchLoans}
            />
          ))
        )}
      </ScrollView>

      {/* QR Code Presentation Modal */}
      <LoanQrModal
        visible={!!qrRequest}
        onClose={() => setQrRequest(null)}
        loanCode={qrRequest?.loanCode || ''}
        pickupReference={qrRequest?.pickupReference}
        itemCount={qrRequest?.itemCount || qrRequest?.items.length}
        items={qrRequest?.items}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1FF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 4,
  },
  pageTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 32,
    color: LibbyColors.ink,
    letterSpacing: -0.6,
  },
  pageSubtitle: {
    fontFamily: LibbyFonts.regular,
    fontSize: 14,
    color: LibbyColors.textMuted,
  },
  filterWrapper: {
    paddingVertical: 8,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 32,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: LibbyColors.white,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  emptyTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 20,
    color: LibbyColors.ink,
    textAlign: 'center',
  },
  emptyDesc: {
    fontFamily: LibbyFonts.regular,
    fontSize: 14,
    color: LibbyColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  exploreBtnContainer: {
    marginTop: 12,
    width: '100%',
  },
});
