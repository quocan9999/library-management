import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { LibbyColors, LibbyFonts } from '@/constants/theme';

export interface FilterChipOption {
  value: string;
  label: string;
}

interface FilterChipGroupProps {
  options: FilterChipOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export const FilterChipGroup: React.FC<FilterChipGroupProps> = ({
  options,
  selectedValue,
  onSelect,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((opt) => {
        const isSelected = selectedValue === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={[
              styles.chip,
              isSelected ? styles.chipActive : styles.chipInactive,
            ]}
            accessibilityRole="button"
            accessibilityState={isSelected ? { selected: true } : {}}
          >
            <Text
              style={[
                styles.chipText,
                isSelected ? styles.chipTextActive : styles.chipTextInactive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 10,
    flexDirection: 'row',
  },
  chip: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: LibbyColors.ink,
  },
  chipInactive: {
    backgroundColor: LibbyColors.white,
  },
  chipText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 14,
  },
  chipTextActive: {
    color: LibbyColors.white,
  },
  chipTextInactive: {
    color: LibbyColors.ink,
  },
});
