import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { UserProfile } from '@/services/profileService';

interface MemberCardProps {
  profile: UserProfile | null;
  email: string;
}

export const MemberCard: React.FC<MemberCardProps> = ({ profile, email }) => {
  const displayName = profile?.fullName || profile?.username || email.split('@')[0] || 'Độc giả';
  const initial = displayName.charAt(0).toUpperCase();

  const roleText =
    profile?.role === 'USER'
      ? 'Độc giả thành viên'
      : profile?.role === 'ADMIN'
      ? 'Quản trị viên'
      : 'Thành viên thư viện';

  const memberCode = profile?.memberCode || (profile?.memberId ? `LIB-${profile.memberId}` : 'LIB-MEMBER');

  return (
    <View style={styles.card}>
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.userInfo}>
          <Text numberOfLines={1} style={styles.userName}>
            {displayName}
          </Text>
          <Text numberOfLines={1} style={styles.userEmail}>
            {email}
          </Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{roleText}</Text>
        </View>
        <Text style={styles.codeText}>Mã thành viên: {memberCode}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: LibbyColors.ink,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: LibbyColors.accentLime,
    backgroundColor: LibbyColors.accentLime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: LibbyFonts.bold,
    fontSize: 24,
    color: LibbyColors.ink,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontFamily: LibbyFonts.display,
    fontSize: 22,
    color: LibbyColors.white,
    letterSpacing: -0.3,
  },
  userEmail: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: '#C9C3F0',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  roleBadge: {
    backgroundColor: LibbyColors.accentLime,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  roleText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 12,
    color: LibbyColors.ink,
  },
  codeText: {
    fontFamily: LibbyFonts.medium,
    fontSize: 12,
    color: '#C9C3F0',
    letterSpacing: 0.5,
  },
});
