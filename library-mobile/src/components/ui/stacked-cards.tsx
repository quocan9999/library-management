import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { LibbyColors } from '@/constants/theme';

export interface LibbyStackedCardsProps {
  style?: ViewStyle;
}

export const LibbyStackedCards: React.FC<LibbyStackedCardsProps> = ({ style }) => {
  return (
    <View style={[styles.container, style]}>
      {/* Thẻ 1: Xanh chanh, nghiêng -12 độ */}
      <View style={[styles.card, styles.cardLime]} />

      {/* Thẻ 2: Trắng, nghiêng +4 độ */}
      <View style={[styles.card, styles.cardWhite]} />

      {/* Thẻ 3: Đen xanh, nghiêng +16 độ */}
      <View style={[styles.card, styles.cardNavy]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 150,
    height: 130,
  },
  card: {
    position: 'absolute',
    width: 64,
    height: 88,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    boxSizing: 'border-box',
  },
  cardLime: {
    left: 10,
    bottom: 16,
    backgroundColor: LibbyColors.cardLime,
    transform: [{ rotate: '-12deg' }],
  },
  cardWhite: {
    left: 52,
    bottom: 20,
    backgroundColor: LibbyColors.white,
    transform: [{ rotate: '4deg' }],
  },
  cardNavy: {
    left: 92,
    bottom: 10,
    backgroundColor: LibbyColors.ink,
    transform: [{ rotate: '16deg' }],
  },
});
