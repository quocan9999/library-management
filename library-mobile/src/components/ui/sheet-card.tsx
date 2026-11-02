import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { LibbyColors } from '@/constants/theme';

export interface LibbySheetCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const LibbySheetCard: React.FC<LibbySheetCardProps> = ({ children, style }) => {
  return (
    <View style={[styles.sheet, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: LibbyColors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 2,
    borderColor: LibbyColors.ink,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
  },
});
