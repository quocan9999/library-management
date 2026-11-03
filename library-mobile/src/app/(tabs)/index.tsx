import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { BookCatalogCard } from '@/components/books/BookCatalogCard';
import { BookDetailModal } from '@/components/books/BookDetailModal';
import { FilterChipGroup, FilterChipOption } from '@/components/books/FilterChipGroup';
import { CartDrawerModal } from '@/components/cart/CartDrawerModal';
import { LoanQrModal } from '@/components/loans/LoanQrModal';
import { ReadyPickupCard } from '@/components/loans/ReadyPickupCard';
import { ToastMessage } from '@/components/ui/ToastMessage';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { bookCatalogService, CatalogBook } from '@/services/bookCatalogService';
import { borrowService, BorrowRequestSummary } from '@/services/borrowService';

const FILTER_OPTIONS: FilterChipOption[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'AVAILABLE', label: 'Còn sách' },
  { value: 'UNAVAILABLE', label: 'Hết sách' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { itemCount, openCart } = useCart();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.floor((windowWidth - 40 - 14) / 2);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('ALL');
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [readyLoans, setReadyLoans] = useState<BorrowRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals & toast states
  const [showLoginToast, setShowLoginToast] = useState(true);
  const [selectedBook, setSelectedBook] = useState<CatalogBook | null>(null);
  const [qrRequest, setQrRequest] = useState<BorrowRequestSummary | null>(null);
  const [toastText, setToastText] = useState('Đăng nhập thành công');

  const displayName =
    user?.fullName || user?.username || (user?.email ? user.email.split('@')[0] : 'Độc giả');
  const userInitial = displayName.charAt(0).toUpperCase();

  const loadData = useCallback(async () => {
    try {
      const [booksRes, loansRes] = await Promise.allSettled([
        bookCatalogService.listBooks({
          q: searchQuery.trim() || undefined,
          availability:
            filterAvailability === 'ALL'
              ? undefined
              : (filterAvailability as 'AVAILABLE' | 'UNAVAILABLE'),
          size: 10,
        }),
        borrowService.listMine(0, 'READY_FOR_PICKUP', 10),
      ]);

      if (booksRes.status === 'fulfilled') {
        setBooks(booksRes.value.content);
      } else {
        console.warn('Lỗi tải danh mục sách:', booksRes.reason);
      }
      if (loansRes.status === 'fulfilled') {
        setReadyLoans(loansRes.value.content);
      } else {
        console.warn('Lỗi tải sách chờ nhận:', loansRes.reason);
      }
    } catch (err) {
      console.warn('Lỗi loadData:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, filterAvailability]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleBookAddedSuccess = (msg: string) => {
    setToastText(msg);
    setShowLoginToast(true);
  };

  return (
    <View style={styles.container}>
      {/* Top Bar (Dark Navy Header) */}
      <View style={styles.topBar}>
        <SafeAreaView edges={['top']}>
          <View style={styles.userRow}>
            {/* User Avatar Circle */}
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.avatarButton}
              accessibilityRole="button"
              accessibilityLabel="Hồ sơ của tôi"
            >
              <Text style={styles.avatarText}>{userInitial}</Text>
            </Pressable>

            {/* Greeting + Name */}
            <View style={styles.greetingBox}>
              <Text style={styles.greetingSubtitle}>Xin chào,</Text>
              <Text numberOfLines={1} style={styles.greetingName}>
                {displayName}
              </Text>
            </View>

            {/* Cart Button */}
            <Pressable
              onPress={openCart}
              style={styles.cartButton}
              accessibilityRole="button"
              accessibilityLabel={`Giỏ mượn, ${itemCount} sách`}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
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
              {itemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{itemCount}</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Search Pill Input */}
          <View style={styles.searchBar}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Circle cx={11} cy={11} r={7} stroke={LibbyColors.textMuted} strokeWidth={2} />
              <Path
                d="M20 20l-3.5-3.5"
                stroke={LibbyColors.textMuted}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm sách, tác giả hoặc mã sách"
              placeholderTextColor={LibbyColors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M6 6l12 12M18 6L6 18"
                    stroke={LibbyColors.textMuted}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </View>

      {/* Main Content Body */}
      <ScrollView
        style={styles.contentScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={LibbyColors.primary}
          />
        }
      >
        <View style={styles.scrollInner}>
          {/* Section 1: Chờ bạn nhận */}
          {readyLoans.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Chờ bạn nhận</Text>
                <Pressable
                  onPress={() => router.push('/(tabs)/my-books')}
                  accessibilityRole="button"
                >
                  <Text style={styles.viewAllText}>Xem tất cả ({readyLoans.length})</Text>
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalCardList}
              >
                {readyLoans.map((loan) => (
                  <ReadyPickupCard
                    key={loan.loanCode}
                    request={loan}
                    onShowQr={() => setQrRequest(loan)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Section 2: Khám phá */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Khám phá</Text>
              <Pressable
                onPress={() => router.push('/(tabs)/my-books')}
                accessibilityRole="button"
              >
                <Text style={styles.viewAllText}>Xem tất cả</Text>
              </Pressable>
            </View>

            {/* Filter Chips */}
            <FilterChipGroup
              options={FILTER_OPTIONS}
              selectedValue={filterAvailability}
              onSelect={setFilterAvailability}
            />

            {/* Book Cards Grid (2-column layout stretching down) */}
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={LibbyColors.primary} size="large" />
              </View>
            ) : books.length === 0 ? (
              <View style={styles.emptyBooksBox}>
                <Text style={styles.emptyBooksText}>Không tìm thấy sách phù hợp.</Text>
              </View>
            ) : (
              <View style={styles.bookGrid}>
                {books.map((book, idx) => (
                  <BookCatalogCard
                    key={book.id}
                    book={book}
                    themeIndex={idx}
                    cardWidth={cardWidth}
                    onPress={() => setSelectedBook(book)}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Toast Message */}
      <ToastMessage
        visible={showLoginToast}
        message={toastText}
        onHide={() => setShowLoginToast(false)}
      />

      {/* Overlays / Modals */}
      <BookDetailModal
        book={selectedBook}
        visible={!!selectedBook}
        onClose={() => setSelectedBook(null)}
        onAddedSuccess={handleBookAddedSuccess}
      />

      <CartDrawerModal
        onCheckoutSuccess={(loanCode, paymentStatus) => {
          loadData();
          if (paymentStatus === 'PENDING') {
            router.push(`/borrow-payment/${encodeURIComponent(loanCode)}`);
            return;
          }
          router.push('/(tabs)/my-books');
        }}
      />

      <LoanQrModal
        visible={!!qrRequest}
        onClose={() => setQrRequest(null)}
        loanCode={qrRequest?.loanCode || ''}
        pickupReference={qrRequest?.pickupReference}
        itemCount={qrRequest?.itemCount || qrRequest?.items.length}
        items={qrRequest?.items}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1FF',
  },
  topBar: {
    backgroundColor: LibbyColors.ink,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userRow: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: LibbyColors.accentLime,
    backgroundColor: LibbyColors.accentLime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: LibbyFonts.bold,
    fontSize: 16,
    color: LibbyColors.ink,
  },
  greetingBox: {
    flex: 1,
    minWidth: 0,
  },
  greetingSubtitle: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: '#C9C3F0',
  },
  greetingName: {
    fontFamily: LibbyFonts.display,
    fontSize: 22,
    color: LibbyColors.white,
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  cartButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFEBFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: LibbyColors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    fontFamily: LibbyFonts.bold,
    fontSize: 11,
    color: LibbyColors.white,
  },
  searchBar: {
    height: 52,
    borderRadius: 26,
    backgroundColor: LibbyColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: LibbyFonts.regular,
    fontSize: 15,
    color: LibbyColors.ink,
    height: '100%',
  },
  contentScroll: {
    flex: 1,
  },
  scrollInner: {
    paddingVertical: 20,
    gap: 24,
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 24,
    color: LibbyColors.ink,
    letterSpacing: -0.4,
  },
  viewAllText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 14,
    color: LibbyColors.accentViolet,
  },
  horizontalCardList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  bookGrid: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBooksBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyBooksText: {
    fontFamily: LibbyFonts.regular,
    fontSize: 14,
    color: LibbyColors.textMuted,
  },
});
