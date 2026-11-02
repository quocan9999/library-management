import React from 'react';
import { StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';

import { ChevronLeftIcon } from '@/components/icons/AuthIcons';
import { LibbyColors } from '@/constants/theme';

export interface LibbyBackButtonProps {
  onPress: () => void;
  style?: ViewStyle;
}

export const LibbyBackButton: React.FC<LibbyBackButtonProps> = ({
  onPress,
  style,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityLabel="Quay lại"
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.button, style]}
    >
      <ChevronLeftIcon size={22} color={LibbyColors.ink} strokeWidth={2.5} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    backgroundColor: LibbyColors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
