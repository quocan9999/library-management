import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LibbyLogo } from '@/components/ui';
import { LibbyBottomTabBar } from '@/components/ui/LibbyBottomTabBar';
import { LibbyColors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LibbyLogo size="lg" variant="violet" />
        <ActivityIndicator
          color={LibbyColors.white}
          size="large"
          style={styles.spinner}
        />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <LibbyBottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Khám phá' }} />
      <Tabs.Screen name="my-books" options={{ title: 'Sách của tôi' }} />
      <Tabs.Screen name="profile" options={{ title: 'Hồ sơ' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: LibbyColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  spinner: {
    marginTop: 10,
  },
});
