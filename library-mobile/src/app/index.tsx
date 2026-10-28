import { Redirect } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LibbyButton, LibbyLogo, LibbySheetCard } from '@/components/ui';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

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
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <LibbyLogo size="md" variant="violet" />
        <Text style={styles.headerTitle}>Trang chủ Độc giả</Text>
      </View>

      <LibbySheetCard style={styles.contentCard}>
        <View style={styles.welcomeBox}>
          <Text style={styles.greetingText}>Xin chào,</Text>
          <Text style={styles.userNameText}>
            {user?.fullName || user?.username || user?.email || 'Độc giả Libby'}
          </Text>
          <Text style={styles.userEmailText}>{user?.email}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Vai trò tài khoản:</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role || 'READER'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <LibbyButton
          style={styles.logoutButton}
          title="Đăng xuất"
          variant="outline"
          onPress={logout}
        />
      </LibbySheetCard>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LibbyColors.primary,
  },
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
  topHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: LibbyFonts.bold,
    fontSize: 16,
    color: LibbyColors.white,
  },
  contentCard: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  welcomeBox: {
    backgroundColor: LibbyColors.subtleBg,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    marginBottom: 24,
  },
  greetingText: {
    fontFamily: LibbyFonts.regular,
    fontSize: 14,
    color: LibbyColors.muted,
  },
  userNameText: {
    fontFamily: LibbyFonts.display,
    fontSize: 24,
    color: LibbyColors.ink,
    marginTop: 4,
  },
  userEmailText: {
    fontFamily: LibbyFonts.medium,
    fontSize: 14,
    color: LibbyColors.primary,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontFamily: LibbyFonts.medium,
    fontSize: 15,
    color: LibbyColors.ink,
  },
  roleBadge: {
    backgroundColor: LibbyColors.lime,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontFamily: LibbyFonts.bold,
    fontSize: 12,
    color: LibbyColors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: LibbyColors.borderLight,
    marginVertical: 20,
  },
  logoutButton: {
    marginTop: 'auto',
    marginBottom: 20,
  },
});
