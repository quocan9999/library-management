import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LibbyBackButton } from '@/components/ui/back-button';
import { LibbyLogo } from '@/components/ui/brand-logo';
import { LibbyColors } from '@/constants/theme';

export interface LibbyTopBarProps {
  onBackPress?: () => void;
  showBackButton?: boolean;
  style?: ViewStyle;
}

export const LibbyTopBar: React.FC<LibbyTopBarProps> = ({
  onBackPress,
  showBackButton = true,
  style,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top },
        style,
      ]}
    >
      <View style={styles.content}>
        {showBackButton && onBackPress ? (
          <LibbyBackButton onPress={onBackPress} />
        ) : (
          <View style={styles.spacer} />
        )}

        <LibbyLogo variant="header" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: LibbyColors.primary,
    flexShrink: 0,
  },
  content: {
    height: 60,
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spacer: {
    width: 44,
  },
});
