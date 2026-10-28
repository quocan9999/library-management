import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import {
  CheckIcon,
  ClockIcon,
  MailBigIcon,
} from '@/components/icons/AuthIcons';
import { LibbyColors } from '@/constants/theme';

export type LibbyStatusCircleVariant = 'mail' | 'success' | 'expired';

export interface LibbyStatusCircleProps {
  variant: LibbyStatusCircleVariant;
  style?: ViewStyle;
}

export const LibbyStatusCircle: React.FC<LibbyStatusCircleProps> = ({
  variant,
  style,
}) => {
  let bgColor: string = LibbyColors.lime;
  let icon = <CheckIcon size={52} color={LibbyColors.ink} strokeWidth={3} />;

  if (variant === 'mail') {
    bgColor = LibbyColors.lime;
    icon = <MailBigIcon size={48} color={LibbyColors.ink} strokeWidth={2.2} />;
  } else if (variant === 'expired') {
    bgColor = LibbyColors.errorBg;
    icon = <ClockIcon size={52} color={LibbyColors.errorText} strokeWidth={2.4} />;
  }

  return (
    <View style={[styles.circle, { backgroundColor: bgColor }, style]}>
      {icon}
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
});
