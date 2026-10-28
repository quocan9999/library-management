import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LibbyButton, LibbyInput } from '@/components/ui';
import { LibbyBackButton } from '@/components/ui/back-button';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/services/profileService';

export default function ChangeEmailScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const currentEmail = user?.email || '';

  const [step, setStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [code, setCode] = useState('');

  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setTimeout(() => {
      setCooldownSeconds((sec) => Math.max(0, sec - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  const validateRequestStep = (): boolean => {
    const nextErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedNewEmail = newEmail.trim().toLowerCase();

    if (!trimmedNewEmail) {
      nextErrors.newEmail = 'Vui lòng nhập địa chỉ email mới.';
    } else if (!emailRegex.test(trimmedNewEmail)) {
      nextErrors.newEmail = 'Vui lòng nhập địa chỉ email hợp lệ.';
    } else if (trimmedNewEmail === currentEmail.trim().toLowerCase()) {
      nextErrors.newEmail = 'Email mới phải khác email hiện tại.';
    }

    if (!currentPassword.trim()) {
      nextErrors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSendCode = async (isResend = false) => {
    setServerError(null);
    if (!isResend && !validateRequestStep()) return;

    setSubmitting(true);
    try {
      await profileService.requestChangeEmail({
        newEmail: newEmail.trim().toLowerCase(),
        currentPassword,
      });
      setCooldownSeconds(60);
      setStep('VERIFY');
      setErrors({});
    } catch (err: any) {
      setServerError(err.message || 'Không thể gửi mã xác thực. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    setServerError(null);
    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      setErrors({ code: 'Mã xác thực phải gồm đúng 6 chữ số.' });
      return;
    }

    setSubmitting(true);
    try {
      await profileService.verifyChangeEmail(trimmedCode);
      const updatedEmail = newEmail.trim().toLowerCase();
      try {
        await refreshUser();
      } catch {
        // Ignored
      }
      Alert.alert(
        'Đổi email thành công',
        `Email tài khoản của bạn đã được cập nhật sang: ${updatedEmail}`,
        [
          {
            text: 'Xong',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err: any) {
      setServerError(err.message || 'Mã xác thực không hợp lệ hoặc đã hết hạn.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <LibbyBackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Đổi email</Text>
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
              <Text style={styles.cardHeading}>
                {step === 'REQUEST' ? 'Yêu cầu đổi email' : 'Xác thực email mới'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {step === 'REQUEST'
                  ? 'Nhập email mới và mật khẩu hiện tại để nhận mã xác thực OTP gửi về hộp thư mới.'
                  : `Nhập mã 6 chữ số vừa được gửi đến ${newEmail.trim().toLowerCase()}`}
              </Text>
            </View>

            {serverError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{serverError}</Text>
              </View>
            )}

            {step === 'REQUEST' ? (
              <>
                <LibbyInput
                  label="Email hiện tại"
                  value={currentEmail}
                  editable={false}
                  inputStyle={styles.readOnlyInput}
                />

                <LibbyInput
                  label="Email mới"
                  placeholder="name@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={newEmail}
                  onChangeText={(val) => {
                    setNewEmail(val);
                    setServerError(null);
                    if (errors.newEmail) {
                      setErrors((prev) => ({ ...prev, newEmail: '' }));
                    }
                  }}
                  errorMessage={errors.newEmail}
                />

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

                <View style={styles.actionRow}>
                  <LibbyButton
                    title={submitting ? 'Đang gửi mã…' : 'Gửi mã xác thực'}
                    variant="primary"
                    disabled={submitting}
                    onPress={() => handleSendCode(false)}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxText}>
                    Mã xác thực đã được gửi đến{' '}
                    <Text style={styles.infoBoxBold}>{newEmail.trim().toLowerCase()}</Text>. Mã có
                    hiệu lực trong 10 phút.
                  </Text>
                </View>

                <LibbyInput
                  label="Mã xác thực 6 chữ số"
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={(val) => {
                    setCode(val.replace(/\D/g, ''));
                    setServerError(null);
                    if (errors.code) {
                      setErrors((prev) => ({ ...prev, code: '' }));
                    }
                  }}
                  errorMessage={errors.code}
                />

                <View style={styles.verifyActionsRow}>
                  <Pressable
                    onPress={() => {
                      setStep('REQUEST');
                      setServerError(null);
                      setCode('');
                    }}
                    style={styles.changeEmailLink}
                  >
                    <Text style={styles.changeEmailLinkText}>Dùng email khác</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleSendCode(true)}
                    disabled={cooldownSeconds > 0 || submitting}
                    style={styles.resendBtn}
                  >
                    <Text
                      style={[
                        styles.resendBtnText,
                        cooldownSeconds > 0 && styles.resendBtnTextDisabled,
                      ]}
                    >
                      {cooldownSeconds > 0
                        ? `Gửi lại sau ${cooldownSeconds}s`
                        : 'Gửi lại mã'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.actionRow}>
                  <LibbyButton
                    title={submitting ? 'Đang xác nhận…' : 'Xác nhận đổi email'}
                    variant="primary"
                    disabled={submitting}
                    onPress={handleVerifyCode}
                  />
                </View>
              </>
            )}
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
  readOnlyInput: {
    color: LibbyColors.textMuted,
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
  infoBox: {
    backgroundColor: '#EFEBFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D4C9FF',
  },
  infoBoxText: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: LibbyColors.ink,
    lineHeight: 19,
  },
  infoBoxBold: {
    fontFamily: LibbyFonts.bold,
  },
  verifyActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  changeEmailLink: {
    paddingVertical: 6,
  },
  changeEmailLinkText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 13,
    color: LibbyColors.textMuted,
    textDecorationLine: 'underline',
  },
  resendBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  resendBtnText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 13,
    color: LibbyColors.accentViolet,
  },
  resendBtnTextDisabled: {
    color: LibbyColors.placeholder,
  },
  actionRow: {
    marginTop: 8,
  },
});
