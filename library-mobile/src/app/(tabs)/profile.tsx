import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { MemberCard } from '@/components/profile/MemberCard';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { profileService, UserProfile } from '@/services/profileService';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await profileService.getProfile();
      setProfile(data);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={LibbyColors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Hồ sơ của tôi</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={LibbyColors.primary} size="large" />
          </View>
        ) : (
          <>
            {/* Member Identity Card */}
            <MemberCard profile={profile} email={user?.email || ''} />

            {/* Account Settings */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Cài đặt & Tài khoản</Text>
              </View>

              <View style={styles.actionList}>
                <Pressable
                  onPress={() => router.push('/personal-info')}
                  style={styles.actionRow}
                  accessibilityRole="button"
                  accessibilityLabel="Thông tin cá nhân"
                >
                  <View style={styles.actionLeft}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Circle cx={12} cy={8} r={4} stroke={LibbyColors.ink} strokeWidth={2} />
                      <Path
                        d="M4 21a8 8 0 0 1 16 0"
                        stroke={LibbyColors.ink}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={styles.actionText}>Thông tin cá nhân</Text>
                  </View>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M9 18l6-6-6-6"
                      stroke={LibbyColors.textMuted}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/change-password')}
                  style={styles.actionRow}
                  accessibilityRole="button"
                  accessibilityLabel="Đổi mật khẩu"
                >
                  <View style={styles.actionLeft}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M21 2l-2 2m-1.5 1.5L16 7l-2 2-2 2-2 2m-2-2l-2-2m-2 2l2 2m-2 2l2 2m-4 4l-4 4a5 5 0 0 1-7-7l4-4a5 5 0 0 1 7 0"
                        stroke={LibbyColors.ink}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={styles.actionText}>Đổi mật khẩu</Text>
                  </View>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M9 18l6-6-6-6"
                      stroke={LibbyColors.textMuted}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/change-email')}
                  style={styles.actionRow}
                  accessibilityRole="button"
                  accessibilityLabel="Đổi email"
                >
                  <View style={styles.actionLeft}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                        stroke={LibbyColors.ink}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Path
                        d="M22 6l-10 7L2 6"
                        stroke={LibbyColors.ink}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={styles.actionText}>Đổi email</Text>
                  </View>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M9 18l6-6-6-6"
                      stroke={LibbyColors.textMuted}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Pressable>

                <Pressable
                  onPress={handleLogout}
                  style={[styles.actionRow, { borderBottomWidth: 0 }]}
                  accessibilityRole="button"
                >
                  <View style={styles.actionLeft}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                        stroke="#9B1C31"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={[styles.actionText, { color: '#9B1C31' }]}>Đăng xuất</Text>
                  </View>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M9 18l6-6-6-6"
                      stroke="#9B1C31"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1FF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  pageTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 32,
    color: LibbyColors.ink,
    letterSpacing: -0.6,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  cardSection: {
    backgroundColor: LibbyColors.white,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    padding: 20,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 18,
    color: LibbyColors.ink,
    letterSpacing: -0.3,
  },
  actionList: {
    gap: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDFD',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 15,
    color: LibbyColors.ink,
  },
});
