import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { AlertCircleIcon, CheckIcon } from '@/components/icons/AuthIcons';
import { LibbyColors, LibbyFonts } from '@/constants/theme';

export interface LibbyAlertProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  style?: ViewStyle;
}

export const LibbyAlert: React.FC<LibbyAlertProps> = ({
  message,
  type = 'error',
  style,
}) => {
  const isError = type === 'error';
  const isSuccess = type === 'success';

  const bgColor = isError
    ? LibbyColors.errorBg
    : isSuccess
    ? LibbyColors.successBg
    : LibbyColors.lilac;

  const textColor = isError
    ? LibbyColors.errorText
    : isSuccess
    ? LibbyColors.successText
    : LibbyColors.primary;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }, style]}>
      {isError && (
        <AlertCircleIcon size={18} color={LibbyColors.errorText} strokeWidth={2.2} />
      )}
      {isSuccess && (
        <CheckIcon size={18} color={LibbyColors.successText} strokeWidth={2.5} />
      )}
      <Text style={[styles.text, { color: textColor }]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  text: {
    flex: 1,
    fontFamily: LibbyFonts.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
});
