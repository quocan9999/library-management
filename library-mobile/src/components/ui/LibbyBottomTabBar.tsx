import type { BottomTabBarProps } from 'expo-router/tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { LibbyColors, LibbyFonts } from '@/constants/theme';

interface TabItemConfig {
  key: string;
  name: string;
  label: string;
  renderIcon: (color: string) => React.ReactNode;
}

const TABS: TabItemConfig[] = [
  {
    key: 'index',
    name: 'index',
    label: 'Khám phá',
    renderIcon: (color: string) => (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
        <Path d="M15.5 8.5l-2 5-5 2 2-5z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    key: 'my-books',
    name: 'my-books',
    label: 'Sách của tôi',
    renderIcon: (color: string) => (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    ),
  },
  {
    key: 'profile',
    name: 'profile',
    label: 'Hồ sơ',
    renderIcon: (color: string) => (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} />
        <Path d="M4 21a8 8 0 0 1 16 0" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
];

export const LibbyBottomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const currentRouteName = state.routes[state.index]?.name;

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.tabContainer}>
        {TABS.map((tab) => {
          const isFocused = currentRouteName === tab.name;
          const iconColor = isFocused ? LibbyColors.ink : LibbyColors.textMuted;
          const textColor = isFocused ? LibbyColors.ink : LibbyColors.textMuted;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: tab.name,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(tab.name);
            }
          };

          return (
            <Pressable
              key={tab.key}
              onPress={onPress}
              style={({ pressed }) => [styles.tabButton, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={tab.label}
            >
              <View style={[styles.iconPill, isFocused && styles.activePill]}>
                {tab.renderIcon(iconColor)}
              </View>
              <Text style={[styles.tabLabel, { color: textColor }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: LibbyColors.white,
    borderTopWidth: 2,
    borderTopColor: LibbyColors.ink,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 64,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconPill: {
    width: 64,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  activePill: {
    backgroundColor: LibbyColors.accentLime,
    borderRadius: 16,
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: LibbyFonts.semiBold,
  },
});
