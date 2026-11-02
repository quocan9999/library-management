import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { LibbyColors, LibbyFonts } from '@/constants/theme';

export type LibbyLogoVariant = 'dark' | 'light' | 'violet' | 'lime' | 'header';

export interface LibbyLogoProps {
  variant?: LibbyLogoVariant;
  size?: 'sm' | 'md' | 'lg' | 'hero' | 'header';
  showText?: boolean;
  style?: ViewStyle;
}

export const LibbyLogo: React.FC<LibbyLogoProps> = ({
  variant = 'light',
  size = variant === 'header' ? 'header' : 'md',
  showText = true,
  style,
}) => {
  const dimensions = {
    sm: { icon: 32, fontSize: 24, gap: 8 },
    md: { icon: 40, fontSize: 32, gap: 10 },
    header: { icon: 36, fontSize: 34, gap: 10 },
    lg: { icon: 56, fontSize: 44, gap: 14 },
    hero: { icon: 88, fontSize: 68, gap: 18 },
  }[size];

  let rectFill: string = LibbyColors.primary;
  let pathFill: string = LibbyColors.white;
  let dotFill: string = LibbyColors.lime;
  let textFill: string = LibbyColors.ink;
  let dotTextFill: string = LibbyColors.lime;
  const isHeaderVariant = variant === 'header';

  if (variant === 'dark' || variant === 'header') {
    rectFill = LibbyColors.primary;
    pathFill = LibbyColors.white;
    dotFill = LibbyColors.lime;
    textFill = LibbyColors.white;
    dotTextFill = LibbyColors.lime;
  } else if (variant === 'violet') {
    rectFill = LibbyColors.white;
    pathFill = LibbyColors.primary;
    dotFill = LibbyColors.lime;
    textFill = LibbyColors.white;
    dotTextFill = LibbyColors.lime;
  } else if (variant === 'lime') {
    rectFill = LibbyColors.ink;
    pathFill = LibbyColors.lime;
    dotFill = LibbyColors.white;
    textFill = LibbyColors.ink;
    dotTextFill = LibbyColors.white;
  }

  const iconElement = (
    <Svg
      width={dimensions.icon}
      height={dimensions.icon}
      viewBox="0 0 64 64"
      fill="none"
    >
      <Rect width="64" height="64" rx={18} fill={rectFill} />
      <Path
        d="M21 14h22a4 4 0 0 1 4 4v32l-15-9-15 9V18a4 4 0 0 1 4-4z"
        fill={pathFill}
      />
      <Circle cx="46" cy="17" r={8} fill={dotFill} />
    </Svg>
  );

  return (
    <View style={[styles.container, { gap: dimensions.gap }, style]}>
      {isHeaderVariant ? (
        <View style={styles.headerIconWrapper}>{iconElement}</View>
      ) : (
        iconElement
      )}

      {showText && (
        <Text
          style={[
            styles.logoText,
            {
              fontSize: dimensions.fontSize,
              color: textFill,
              letterSpacing: isHeaderVariant ? -1.36 : -1,
            },
          ]}
        >
          libby<Text style={{ color: dotTextFill }}>.</Text>
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontFamily: LibbyFonts.display,
    letterSpacing: -1,
    includeFontPadding: false,
  },
});
