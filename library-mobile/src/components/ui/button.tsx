import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { LibbyColors, LibbyFonts } from '@/constants/theme';

export type LibbyButtonVariant = 'primary' | 'secondary' | 'outline' | 'disabled';

export interface LibbyButtonProps {
  title: string;
  onPress?: () => void;
  variant?: LibbyButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const LibbyButton: React.FC<LibbyButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
}) => {
  const isActuallyDisabled = disabled || loading || variant === 'disabled';

  let containerStyle: ViewStyle = styles.primaryContainer;
  let labelStyle: TextStyle = styles.primaryText;
  let indicatorColor: string = LibbyColors.white;

  if (isActuallyDisabled) {
    containerStyle = styles.disabledContainer;
    labelStyle = styles.disabledText;
    indicatorColor = LibbyColors.placeholder;
  } else if (variant === 'secondary') {
    containerStyle = styles.secondaryContainer;
    labelStyle = styles.secondaryText;
    indicatorColor = LibbyColors.primary;
  } else if (variant === 'outline') {
    containerStyle = styles.outlineContainer;
    labelStyle = styles.outlineText;
    indicatorColor = LibbyColors.ink;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={isActuallyDisabled}
      onPress={onPress}
      style={[styles.baseButton, containerStyle, style]}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon && <View style={styles.leftIconWrapper}>{leftIcon}</View>}
          <Text style={[styles.baseText, labelStyle, textStyle]}>{title}</Text>
          {rightIcon && <View style={styles.rightIconWrapper}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 16,
    textAlign: 'center',
  },
  primaryContainer: {
    backgroundColor: LibbyColors.primary,
    borderWidth: 2,
    borderColor: LibbyColors.primary,
  },
  primaryText: {
    color: LibbyColors.white,
  },
  secondaryContainer: {
    backgroundColor: LibbyColors.white,
    borderWidth: 2,
    borderColor: LibbyColors.primary,
  },
  secondaryText: {
    color: LibbyColors.primary,
  },
  outlineContainer: {
    backgroundColor: LibbyColors.white,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
  },
  outlineText: {
    color: LibbyColors.ink,
  },
  disabledContainer: {
    backgroundColor: LibbyColors.lilac,
    borderWidth: 2,
    borderColor: LibbyColors.lilac,
  },
  disabledText: {
    color: LibbyColors.placeholder,
  },
  leftIconWrapper: {
    marginRight: 8,
  },
  rightIconWrapper: {
    marginLeft: 8,
  },
});
