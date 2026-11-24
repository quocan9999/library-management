import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { LibbyButton } from '@/components/ui';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { CategorySummary } from '@/services/categoryService';

export type AvailabilityFilter = 'ALL' | 'AVAILABLE' | 'UNAVAILABLE';

export type CatalogSortOption =
  | 'title,asc'
  | 'createdAt,desc'
  | 'borrowFee,asc'
  | 'availableQuantity,desc';

export const DEFAULT_CATALOG_SORT: CatalogSortOption = 'title,asc';

export const AVAILABILITY_OPTIONS: { value: AvailabilityFilter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'AVAILABLE', label: 'Còn sách' },
  { value: 'UNAVAILABLE', label: 'Hết sách' },
];

export const CATALOG_SORT_OPTIONS: { value: CatalogSortOption; label: string }[] = [
  { value: 'title,asc', label: 'Tên sách (A → Z)' },
  { value: 'createdAt,desc', label: 'Mới cập nhật' },
  { value: 'borrowFee,asc', label: 'Phí mượn thấp → cao' },
  { value: 'availableQuantity,desc', label: 'Còn nhiều nhất' },
];

interface CatalogFilterModalProps {
  visible: boolean;
  categories: CategorySummary[];
  selectedCategoryId: number | null;
  selectedAvailability: AvailabilityFilter;
  selectedSort: CatalogSortOption;
  onClose: () => void;
  onApply: (filters: {
    categoryId: number | null;
    availability: AvailabilityFilter;
    sort: CatalogSortOption;
  }) => void;
}

export const CatalogFilterModal: React.FC<CatalogFilterModalProps> = ({
  visible,
  categories,
  selectedCategoryId,
  selectedAvailability,
  selectedSort,
  onClose,
  onApply,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {visible && (
        <CatalogFilterSheet
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          selectedAvailability={selectedAvailability}
          selectedSort={selectedSort}
          onClose={onClose}
          onApply={onApply}
        />
      )}
    </Modal>
  );
};

const CatalogFilterSheet: React.FC<Omit<CatalogFilterModalProps, 'visible'>> = ({
  categories,
  selectedCategoryId,
  selectedAvailability,
  selectedSort,
  onClose,
  onApply,
}) => {
  const [draftCategoryId, setDraftCategoryId] = useState<number | null>(selectedCategoryId);
  const [draftAvailability, setDraftAvailability] = useState<AvailabilityFilter>(selectedAvailability);
  const [draftSort, setDraftSort] = useState<CatalogSortOption>(selectedSort);

  const handleReset = () => {
    setDraftCategoryId(null);
    setDraftAvailability('ALL');
    setDraftSort(DEFAULT_CATALOG_SORT);
  };

  const handleApply = () => {
    onApply({
      categoryId: draftCategoryId,
      availability: draftAvailability,
      sort: draftSort,
    });
    onClose();
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.sheetTitle}>Bộ lọc & Sắp xếp</Text>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Đóng bộ lọc"
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

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.body}
        >
          {/* Thể loại / Danh mục */}
          {categories.length > 0 && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Thể loại sách</Text>
                <View style={styles.chipWrap}>
                  <Pressable
                    onPress={() => setDraftCategoryId(null)}
                    style={[
                      styles.chip,
                      draftCategoryId === null ? styles.chipActive : styles.chipInactive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: draftCategoryId === null }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        draftCategoryId === null ? styles.chipTextActive : styles.chipTextInactive,
                      ]}
                    >
                      Tất cả
                    </Text>
                  </Pressable>

                  {categories.map((cat) => {
                    const active = draftCategoryId === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setDraftCategoryId(cat.id)}
                        style={[
                          styles.chip,
                          active ? styles.chipActive : styles.chipInactive,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active ? styles.chipTextActive : styles.chipTextInactive,
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={styles.divider} />
            </>
          )}

          {/* Tình trạng sách */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tình trạng sách</Text>
            <View style={styles.chipWrap}>
              {AVAILABILITY_OPTIONS.map((opt) => {
                const active = draftAvailability === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setDraftAvailability(opt.value)}
                    style={[
                      styles.chip,
                      active ? styles.chipActive : styles.chipInactive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active ? styles.chipTextActive : styles.chipTextInactive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Sắp xếp */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Sắp xếp theo</Text>
            <View style={styles.chipWrap}>
              {CATALOG_SORT_OPTIONS.map((opt) => {
                const active = draftSort === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setDraftSort(opt.value)}
                    style={[
                      styles.chip,
                      active ? styles.chipActive : styles.chipInactive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active ? styles.chipTextActive : styles.chipTextInactive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Footer actions */}
        <View style={styles.footer}>
          <LibbyButton
            title="Đặt lại"
            variant="outline"
            onPress={handleReset}
            style={styles.footerButton}
          />
          <LibbyButton
            title="Áp dụng"
            variant="primary"
            onPress={handleApply}
            style={styles.footerButton}
          />
        </View>
      </View>
    </View>
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
    maxHeight: '86%',
    backgroundColor: LibbyColors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: LibbyColors.ink,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 24,
    gap: 16,
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
    backgroundColor: LibbyColors.lilac,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    gap: 16,
    paddingBottom: 4,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 14,
    color: LibbyColors.ink,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
  },
  chipActive: {
    backgroundColor: LibbyColors.ink,
  },
  chipInactive: {
    backgroundColor: LibbyColors.white,
  },
  chipText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 13,
  },
  chipTextActive: {
    color: LibbyColors.white,
  },
  chipTextInactive: {
    color: LibbyColors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: '#ECE8FF',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 4,
  },
  footerButton: {
    flex: 1,
  },
});
