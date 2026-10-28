import React, { useEffect } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { CheckIcon } from '@/components/icons/AuthIcons';
import { LibbyColors, LibbyFonts } from '@/constants/theme';

export interface LibbyPasswordCriteriaProps {
  password: string;
  onValidChange?: (isValid: boolean) => void;
  style?: ViewStyle;
}

export const LibbyPasswordCriteria: React.FC<LibbyPasswordCriteriaProps> = ({
  password,
  onValidChange,
  style,
}) => {
  const isLengthValid = password.length >= 8 && password.length <= 20;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9\s]/.test(password);
  const isComplexityValid = hasUpper && hasLower && hasDigit && hasSpecial;
  const isNoWhitespaceValid = password.length > 0 && !/\s/.test(password);

  const isAllValid = isLengthValid && isComplexityValid && isNoWhitespaceValid;

  useEffect(() => {
    onValidChange?.(isAllValid);
  }, [isAllValid, onValidChange]);

  const criteria = [
    { id: 'length', text: 'Từ 8–20 ký tự', valid: isLengthValid },
    {
      id: 'complexity',
      text: 'Có chữ hoa, thường, số, ký tự đặc biệt',
      valid: isComplexityValid,
    },
    { id: 'noWhitespace', text: 'Không chứa khoảng trắng', valid: isNoWhitespaceValid },
  ];

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>YÊU CẦU MẬT KHẨU</Text>

      {criteria.map((item) => (
        <View key={item.id} style={styles.itemRow}>
          <View
            style={[
              styles.badge,
              item.valid ? styles.badgeValid : styles.badgeInvalid,
            ]}
          >
            {item.valid && (
              <CheckIcon size={12} color={LibbyColors.ink} strokeWidth={3} />
            )}
          </View>
          <Text
            style={[
              styles.itemText,
              item.valid ? styles.itemTextValid : styles.itemTextNormal,
            ]}
          >
            {item.text}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: LibbyColors.subtleBg,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    width: '100%',
  },
  title: {
    fontFamily: LibbyFonts.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    color: LibbyColors.placeholder,
    marginBottom: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeValid: {
    backgroundColor: LibbyColors.lime,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
  },
  badgeInvalid: {
    borderWidth: 2,
    borderColor: '#C9C3F0',
  },
  itemText: {
    fontFamily: LibbyFonts.medium,
    fontSize: 13,
  },
  itemTextValid: {
    color: LibbyColors.ink,
  },
  itemTextNormal: {
    color: LibbyColors.muted,
  },
});
