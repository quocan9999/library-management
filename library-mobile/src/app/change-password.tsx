import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LibbyButton, LibbyInput } from '@/components/ui';
import { LibbyBackButton } from '@/components/ui/back-button';
import { LibbyPasswordCriteria } from '@/components/ui/password-criteria';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { profileService } from '@/services/profileService';

export default function ChangePasswordScreen() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!currentPassword.trim()) {
      nextErrors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.';
    }

    if (!newPassword.trim()) {
      nextErrors.newPassword = 'Vui lòng tạo mật khẩu mới.';
    } else if (!isPasswordValid) {
      nextErrors.newPassword = 'Mật khẩu chưa đáp ứng đủ các tiêu chí bảo mật.';
    } else if (currentPassword.trim() && currentPassword === newPassword) {
      nextErrors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại.';
    }

    if (!confirmNewPassword.trim()) {
      nextErrors.confirmNewPassword = 'Vui lòng xác nhận mật khẩu mới.';
    } else if (newPassword && confirmNewPassword !== newPassword) {
      nextErrors.confirmNewPassword = 'Mật khẩu xác nhận không khớp.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await profileService.changePassword({
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      Alert.alert('Thành công', 'Mật khẩu tài khoản đã được thay đổi thành công.', [
        {
          text: 'Xong',
          onPress: () => router.back(),
        },
      ]);
    } catch (err: any) {
      setServerError(err.message || 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <LibbyBackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Đổi mật khẩu</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <View style={styles.introBox}>
              <Text style={styles.cardHeading}>Thiết lập mật khẩu mới</Text>
              <Text style={styles.cardSubtitle}>
                Nhập mật khẩu hiện tại để xác minh danh tính và thiết lập mật khẩu mới cho tài
                khoản.
              </Text>
            </View>

            {serverError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{serverError}</Text>
              </View>
            )}

            <LibbyInput
              label="Mật khẩu hiện tại"
              placeholder="Nhập mật khẩu hiện tại"
              isPassword
              value={currentPassword}
              onChangeText={(val) => {
                setCurrentPassword(val);
                setServerError(null);
                if (errors.currentPassword) {
                  setErrors((prev) => ({ ...prev, currentPassword: '' }));
                }
              }}
              errorMessage={errors.currentPassword}
            />

            <LibbyInput
              label="Mật khẩu mới"
              placeholder="Tạo mật khẩu mới"
              isPassword
              value={newPassword}
              onChangeText={(val) => {
                setNewPassword(val);
                setServerError(null);
                if (errors.newPassword) {
                  setErrors((prev) => ({ ...prev, newPassword: '' }));
                }
              }}
              errorMessage={errors.newPassword}
            />

            {newPassword.length > 0 && (
              <LibbyPasswordCriteria
                password={newPassword}
                onValidChange={setIsPasswordValid}
              />
            )}

            <LibbyInput
              label="Xác nhận mật khẩu mới"
              placeholder="Nhập lại mật khẩu mới"
              isPassword
              value={confirmNewPassword}
              onChangeText={(val) => {
                setConfirmNewPassword(val);
                setServerError(null);
                if (errors.confirmNewPassword) {
                  setErrors((prev) => ({ ...prev, confirmNewPassword: '' }));
                }
              }}
              errorMessage={errors.confirmNewPassword}
            />

            <View style={styles.actionRow}>
              <LibbyButton
                title={submitting ? 'Đang cập nhật…' : 'Đổi mật khẩu'}
                variant="primary"
                disabled={submitting}
                onPress={handleSubmit}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1FF',
  },
  topHeader: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 20,
    color: LibbyColors.ink,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 44,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: LibbyColors.white,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  introBox: {
    gap: 4,
    paddingBottom: 4,
  },
  cardHeading: {
    fontFamily: LibbyFonts.display,
    fontSize: 18,
    color: LibbyColors.ink,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: LibbyColors.textMuted,
    lineHeight: 18,
  },
  errorBanner: {
    backgroundColor: LibbyColors.errorBg,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFD1D8',
  },
  errorBannerText: {
    fontFamily: LibbyFonts.medium,
    fontSize: 13,
    color: LibbyColors.errorText,
    lineHeight: 18,
  },
  actionRow: {
    marginTop: 8,
  },
});
