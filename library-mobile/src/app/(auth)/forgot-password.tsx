import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ChevronLeftIcon, MailIcon } from '@/components/icons/AuthIcons';
import {
  LibbyAlert,
  LibbyButton,
  LibbyInput,
  LibbyStatusCircle,
  LibbyTopBar,
} from '@/components/ui';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { extractErrorMessage } from '@/services/api';
import { authService } from '@/services/authService';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [isCounting, setIsCounting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Email format check helper
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Countdown timer for resend
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isCounting && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setIsCounting(false);
    }
    return () => clearTimeout(timer);
  }, [isCounting, countdown]);

  const handleSendEmail = async () => {
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Vui lòng nhập địa chỉ email hợp lệ');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      await authService.forgotPassword(email.trim());
      setIsSent(true);
      setCountdown(60);
      setIsCounting(true);
    } catch (error) {
      const msg = extractErrorMessage(
        error,
        'Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại.'
      );
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenMailApp = async () => {
    try {
      const mailUrl = Platform.OS === 'ios' ? 'message://' : 'mailto:';
      const canOpen = await Linking.canOpenURL(mailUrl);
      if (canOpen) {
        await Linking.openURL(mailUrl);
      } else {
        await Linking.openURL('mailto:');
      }
    } catch {
      try {
        await Linking.openURL('mailto:');
      } catch {
        // Fallback if no email client is available
      }
    }
  };

  const handleResend = async () => {
    if (isCounting || isLoading) return;
    await handleSendEmail();
  };

  return (
    <View style={styles.screen}>
      {/* Header tím đồng bộ Figma: nút quay lại + logo libby. */}
      <LibbyTopBar onBackPress={() => router.back()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flexOne}
      >
        <View style={styles.sheetContainer}>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!isSent ? (
              /* TRẠNG THÁI 1: FORM NHẬP EMAIL (ForgotApp.dc.html) */
              <View>
                <Text style={styles.sheetTitle}>Quên mật khẩu</Text>
                <Text style={styles.sheetSubtitle}>
                  Nhập email đã đăng ký. Chúng tôi sẽ gửi liên kết để bạn đặt lại mật khẩu.
                </Text>

                {errorMessage && (
                  <LibbyAlert
                    message={errorMessage}
                    style={styles.alertSpacing}
                    type="error"
                  />
                )}

                <View style={styles.fieldSection}>
                  <LibbyInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={!!errorMessage}
                    keyboardType="email-address"
                    label="Email"
                    leftIcon={<MailIcon color={LibbyColors.textMuted} size={20} strokeWidth={2} />}
                    placeholder="email@vidu.com"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                  />
                </View>

                <LibbyButton
                  disabled={!isEmailValid}
                  loading={isLoading}
                  style={styles.submitButton}
                  title="Gửi liên kết đặt lại mật khẩu"
                  variant={isEmailValid ? 'primary' : 'disabled'}
                  onPress={handleSendEmail}
                />

                <TouchableOpacity
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  style={styles.backLinkRow}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <ChevronLeftIcon color={LibbyColors.primary} size={18} strokeWidth={2.5} />
                  <Text style={styles.backLinkText}>Quay lại đăng nhập</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* TRẠNG THÁI 2: ĐÃ GỬI EMAIL (ForgotAppSent.dc.html) */
              <View style={styles.sentContainer}>
                <LibbyStatusCircle variant="mail" />

                <Text style={styles.sentTitle}>Kiểm tra email của bạn</Text>

                <Text style={styles.sentSubtitle}>
                  Nếu <Text style={styles.boldEmail}>{email.trim()}</Text> đã đăng ký, chúng tôi vừa gửi liên kết đặt lại mật khẩu tới hộp thư. Liên kết có hiệu lực trong 15 phút.
                </Text>

                <LibbyButton
                  style={styles.openMailButton}
                  title="Mở ứng dụng email"
                  variant="primary"
                  onPress={handleOpenMailApp}
                />

                <LibbyButton
                  disabled={isCounting}
                  loading={isLoading}
                  style={styles.resendButton}
                  title={isCounting ? `Gửi lại sau ${countdown} giây` : 'Gửi lại email'}
                  variant={isCounting ? 'disabled' : 'secondary'}
                  onPress={handleResend}
                />

                <Text style={styles.spamNote}>
                  Không thấy email? Hãy kiểm tra thư mục spam.
                </Text>

                <TouchableOpacity
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  style={styles.backLinkRow}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <ChevronLeftIcon color={LibbyColors.primary} size={18} strokeWidth={2.5} />
                  <Text style={styles.backLinkText}>Quay lại đăng nhập</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: LibbyColors.primary,
  },
  flexOne: {
    flex: 1,
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: LibbyColors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 2,
    borderColor: LibbyColors.ink,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
    flexGrow: 1,
  },
  sheetTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.96,
    lineHeight: 36,
    color: LibbyColors.ink,
  },
  sheetSubtitle: {
    fontFamily: LibbyFonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: LibbyColors.textMuted,
    marginTop: 8,
  },
  alertSpacing: {
    marginTop: 16,
  },
  fieldSection: {
    marginTop: 24,
  },
  submitButton: {
    marginTop: 22,
  },
  backLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 10,
  },
  backLinkText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 15,
    color: LibbyColors.primary,
  },
  sentContainer: {
    alignItems: 'center',
  },
  sentTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.9,
    lineHeight: 33,
    color: LibbyColors.ink,
    textAlign: 'center',
    marginTop: 24,
  },
  sentSubtitle: {
    fontFamily: LibbyFonts.regular,
    fontSize: 15,
    lineHeight: 23,
    color: LibbyColors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  boldEmail: {
    fontWeight: '700',
    color: LibbyColors.ink,
  },
  openMailButton: {
    marginTop: 26,
  },
  resendButton: {
    marginTop: 10,
  },
  spamNote: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: LibbyColors.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
});
