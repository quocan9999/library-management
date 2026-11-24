import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  AvailabilityFilter,
  CATALOG_SORT_OPTIONS,
  CatalogFilterModal,
  CatalogSortOption,
  DEFAULT_CATALOG_SORT,
} from '@/components/books/CatalogFilterModal';
import { FilterChipGroup, FilterChipOption } from '@/components/books/FilterChipGroup';
import { CartDrawerModal } from '@/components/cart/CartDrawerModal';
import { LoanQrModal } from '@/components/loans/LoanQrModal';
import { ReadyPickupCard } from '@/components/loans/ReadyPickupCard';
import { LibbyButton } from '@/components/ui';
import { ToastMessage } from '@/components/ui/ToastMessage';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { bookCatalogService, CatalogBook } from '@/services/bookCatalogService';
import { borrowService, BorrowRequestSummary } from '@/services/borrowService';
import { categoryService, CategorySummary } from '@/services/categoryService';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { itemCount, openCart } = useCart();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.floor((windowWidth - 40 - 14) / 2);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterAvailability, setFilterAvailability] = useState<AvailabilityFilter>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<CatalogSortOption>(DEFAULT_CATALOG_SORT);
  const [categoryOptions, setCategoryOptions] = useState<CategorySummary[]>([]);

  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [readyLoans, setReadyLoans] = useState<BorrowRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals & toast states
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [showLoginToast, setShowLoginToast] = useState(true);
  const [selectedBook, setSelectedBook] = useState<CatalogBook | null>(null);
  const [qrRequest, setQrRequest] = useState<BorrowRequestSummary | null>(null);
  const [toastText, setToastText] = useState('Đăng nhập thành công');

  const displayName =
    user?.fullName || user?.username || (user?.email ? user.email.split('@')[0] : 'Độc giả');
  const userInitial = displayName.charAt(0).toUpperCase();

  const loadCategories = useCallback(async () => {
    const options = await categoryService.getOptions();
    setCategoryOptions(options);
    setSelectedCategoryId((prev) =>
      prev !== null && !options.some((cat) => cat.id === prev) ? null : prev
    );
  }, []);

  const loadData = useCallback(
    async (targetPage = 0, append = false) => {
      if (append) {
        setLoadingMore(true);
      }
      try {
        const queryParams = {
          q: searchQuery.trim() || undefined,
          availability:
            filterAvailability === 'ALL'
              ? undefined
              : (filterAvailability as 'AVAILABLE' | 'UNAVAILABLE'),
          categoryId: selectedCategoryId ?? undefined,
          sort: sortBy,
          page: targetPage,
          size: 10,
        };

        if (append) {
          const nextPageData = await bookCatalogService.listBooks(queryParams);
          setBooks((prev) => [...prev, ...nextPageData.content]);
          setTotalElements(nextPageData.totalElements);
          setCurrentPage(nextPageData.page);
          setHasMore(!nextPageData.last);
          return;
        }

        const [booksRes, loansRes] = await Promise.allSettled([
          bookCatalogService.listBooks(queryParams),
          borrowService.listMine(0, 'READY_FOR_PICKUP', 10),
        ]);

        if (booksRes.status === 'fulfilled') {
          setBooks(booksRes.value.content);
          setTotalElements(booksRes.value.totalElements);
          setCurrentPage(booksRes.value.page);
          setHasMore(!booksRes.value.last);
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
        setLoadingMore(false);
      }
    },
    [searchQuery, filterAvailability, selectedCategoryId, sortBy]
  );

  useEffect(() => {
    let cancelled = false;
    categoryService.getOptions().then((options) => {
      if (cancelled) return;
      setCategoryOptions(options);
      setSelectedCategoryId((prev) =>
        prev !== null && !options.some((cat) => cat.id === prev) ? null : prev
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const queryParams = {
      q: searchQuery.trim() || undefined,
      availability:
        filterAvailability === 'ALL'
          ? undefined
          : (filterAvailability as 'AVAILABLE' | 'UNAVAILABLE'),
      categoryId: selectedCategoryId ?? undefined,
      sort: sortBy,
      page: 0,
      size: 10,
    };

    Promise.allSettled([
      bookCatalogService.listBooks(queryParams),
      borrowService.listMine(0, 'READY_FOR_PICKUP', 10),
    ])
      .then(([booksRes, loansRes]) => {
        if (cancelled) return;
        if (booksRes.status === 'fulfilled') {
          setBooks(booksRes.value.content);
          setTotalElements(booksRes.value.totalElements);
          setCurrentPage(booksRes.value.page);
          setHasMore(!booksRes.value.last);
        } else {
          console.warn('Lỗi tải danh mục sách:', booksRes.reason);
        }
        if (loansRes.status === 'fulfilled') {
          setReadyLoans(loansRes.value.content);
        } else {
          console.warn('Lỗi tải sách chờ nhận:', loansRes.reason);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchQuery, filterAvailability, selectedCategoryId, sortBy]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCategories();
    loadData(0, false);
  };

  const handleLoadMore = () => {
    if (loading || loadingMore || !hasMore) return;
    loadData(currentPage + 1, true);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategoryId(null);
    setFilterAvailability('ALL');
    setSortBy(DEFAULT_CATALOG_SORT);
  };

  const handleBookAddedSuccess = (msg: string) => {
    setToastText(msg);
    setShowLoginToast(true);
  };

  const categoryChipOptions = useMemo<FilterChipOption[]>(
    () => [
      { value: 'ALL', label: 'Tất cả' },
      ...categoryOptions.map((cat) => ({
        value: String(cat.id),
        label: cat.name,
      })),
    ],
    [categoryOptions]
  );

  const selectedCategoryName = useMemo(
    () => categoryOptions.find((cat) => cat.id === selectedCategoryId)?.name ?? null,
    [categoryOptions, selectedCategoryId]
  );

  const activeAvailabilityLabel =
    filterAvailability === 'AVAILABLE'
      ? 'Còn sách'
      : filterAvailability === 'UNAVAILABLE'
      ? 'Hết sách'
      : null;

  const activeSortLabel =
    sortBy === DEFAULT_CATALOG_SORT
      ? null
      : CATALOG_SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label ?? null;

  const activeFilterCount =
    (selectedCategoryId !== null ? 1 : 0) +
    (filterAvailability !== 'ALL' ? 1 : 0) +
    (sortBy !== DEFAULT_CATALOG_SORT ? 1 : 0);

  const hasAnyFilterOrSearch = activeFilterCount > 0 || searchQuery.trim().length > 0;

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

          {/* Search Pill + Integrated Filter Trigger */}
          <View style={styles.searchRow}>
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

            <Pressable
              onPress={() => setFilterModalVisible(true)}
              style={[
                styles.filterButton,
                activeFilterCount > 0 ? styles.filterButtonActive : styles.filterButtonIdle,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Bộ lọc thư viện, đang bật ${activeFilterCount} bộ lọc`}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 7h16M7 12h10M10 17h4"
                  stroke={LibbyColors.ink}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
              </Svg>
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </Pressable>
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
                onPress={
                  hasAnyFilterOrSearch
                    ? handleResetFilters
                    : () => setFilterModalVisible(true)
                }
                accessibilityRole="button"
              >
                <Text style={styles.viewAllText}>
                  {hasAnyFilterOrSearch ? 'Xóa lọc' : 'Bộ lọc'}
                </Text>
              </Pressable>
            </View>

            {/* Quick Category Strip */}
            {categoryOptions.length > 0 && (
              <FilterChipGroup
                options={categoryChipOptions}
                selectedValue={selectedCategoryId === null ? 'ALL' : String(selectedCategoryId)}
                onSelect={(value) =>
                  setSelectedCategoryId(value === 'ALL' ? null : Number(value))
                }
              />
            )}

            {/* Result Summary & Active Filter Chips */}
            <View style={styles.resultMetaRow}>
              <Text style={styles.resultCountText}>
                {loading ? 'Đang tải sách...' : `${totalElements} đầu sách`}
              </Text>
              <Pressable
                onPress={() => setFilterModalVisible(true)}
                style={styles.sortTrigger}
                accessibilityRole="button"
              >
                <Text style={styles.sortTriggerText}>
                  {activeSortLabel || 'Sắp xếp & lọc'}
                </Text>
              </Pressable>
            </View>

            {activeFilterCount > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.activeFiltersRow}
              >
                {selectedCategoryName && (
                  <Pressable
                    onPress={() => setSelectedCategoryId(null)}
                    style={styles.activeFilterPill}
                    accessibilityRole="button"
                  >
                    <Text style={styles.activeFilterPillText}>
                      Thể loại: {selectedCategoryName} ×
                    </Text>
                  </Pressable>
                )}

                {activeAvailabilityLabel && (
                  <Pressable
                    onPress={() => setFilterAvailability('ALL')}
                    style={styles.activeFilterPill}
                    accessibilityRole="button"
                  >
                    <Text style={styles.activeFilterPillText}>
                      {activeAvailabilityLabel} ×
                    </Text>
                  </Pressable>
                )}

                {activeSortLabel && (
                  <Pressable
                    onPress={() => setSortBy(DEFAULT_CATALOG_SORT)}
                    style={styles.activeFilterPill}
                    accessibilityRole="button"
                  >
                    <Text style={styles.activeFilterPillText}>
                      {activeSortLabel} ×
                    </Text>
                  </Pressable>
                )}
              </ScrollView>
            )}

            {/* Book Cards Grid (2-column layout stretching down) */}
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={LibbyColors.primary} size="large" />
              </View>
            ) : books.length === 0 ? (
              <View style={styles.emptyBooksBox}>
                <Text style={styles.emptyBooksText}>Không tìm thấy sách phù hợp.</Text>
                {hasAnyFilterOrSearch && (
                  <LibbyButton
                    title="Đặt lại bộ lọc"
                    variant="outline"
                    onPress={handleResetFilters}
                    style={styles.resetEmptyButton}
                  />
                )}
              </View>
            ) : (
              <>
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

                {hasMore && (
                  <View style={styles.loadMoreWrapper}>
                    <LibbyButton
                      title="Xem thêm sách"
                      variant="outline"
                      loading={loadingMore}
                      onPress={handleLoadMore}
                    />
                  </View>
                )}
              </>
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
      <CatalogFilterModal
        visible={filterModalVisible}
        categories={categoryOptions}
        selectedCategoryId={selectedCategoryId}
        selectedAvailability={filterAvailability}
        selectedSort={sortBy}
        onClose={() => setFilterModalVisible(false)}
        onApply={({ categoryId, availability, sort }) => {
          setSelectedCategoryId(categoryId);
          setFilterAvailability(availability);
          setSortBy(sort);
        }}
      />

      <BookDetailModal
        book={selectedBook}
        visible={!!selectedBook}
        onClose={() => setSelectedBook(null)}
        onAddedSuccess={handleBookAddedSuccess}
      />

      <CartDrawerModal
        onCheckoutSuccess={(loanCode, paymentStatus) => {
          loadData(0, false);
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  searchBar: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: LibbyColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  searchInput: {
    flex: 1,
    fontFamily: LibbyFonts.regular,
    fontSize: 15,
    color: LibbyColors.ink,
    height: '100%',
  },
  filterButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterButtonIdle: {
    backgroundColor: LibbyColors.lilac,
    borderColor: LibbyColors.lilac,
  },
  filterButtonActive: {
    backgroundColor: LibbyColors.accentLime,
    borderColor: LibbyColors.accentLime,
  },
  filterBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: LibbyColors.ink,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontFamily: LibbyFonts.bold,
    fontSize: 11,
    color: LibbyColors.white,
  },
  contentScroll: {
    flex: 1,
  },
  scrollInner: {
    paddingVertical: 20,
    gap: 24,
  },
  section: {
    gap: 14,
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
  resultMetaRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultCountText: {
    fontFamily: LibbyFonts.medium,
    fontSize: 13,
    color: LibbyColors.textMuted,
  },
  sortTrigger: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: LibbyColors.white,
    borderWidth: 1,
    borderColor: LibbyColors.borderLight,
  },
  sortTriggerText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 12,
    color: LibbyColors.ink,
  },
  activeFiltersRow: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
  },
  activeFilterPill: {
    backgroundColor: LibbyColors.lilac,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LibbyColors.ink,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  activeFilterPillText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 12,
    color: LibbyColors.ink,
  },
  bookGrid: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  loadMoreWrapper: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBooksBox: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 14,
  },
  emptyBooksText: {
    fontFamily: LibbyFonts.regular,
    fontSize: 14,
    color: LibbyColors.textMuted,
  },
  resetEmptyButton: {
    width: 'auto',
    minWidth: 180,
  },
});
