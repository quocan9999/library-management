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

import {
  CheckIcon,
  ChevronLeftIcon,
  LockIcon,
  MailIcon,
} from '@/components/icons/AuthIcons';
import {
  LibbyAlert,
  LibbyButton,
  LibbyInput,
  LibbyPasswordCriteria,
  LibbyStatusCircle,
  LibbyTopBar,
} from '@/components/ui';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { extractErrorMessage } from '@/services/api';
import { authService } from '@/services/authService';
import { validateEmail } from '@/utils/validation';

export default function RegisterScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isCriteriaMet, setIsCriteriaMet] = useState(false);

  // Quản lý trạng thái chuyển sang màn hình Kiểm tra email (VerifyApp.dc.html)
  const [isRegistered, setIsRegistered] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [isCounting, setIsCounting] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPasswordMatch = password.length > 0 && password === confirmPassword;
  const isEmailValid = validateEmail(email) === null;
  const isFormValid = isEmailValid && isCriteriaMet && isPasswordMatch;

  // Đếm ngược 60s cho nút gửi lại email xác thực
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

  const handleRegister = async () => {
    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      return;
    }

    if (!isFormValid) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);

      await authService.register(email.trim(), password);
      // Đăng ký thành công -> chuyển sang màn hình "Kiểm tra email" (VerifyApp.dc.html)
      setIsRegistered(true);
      setCountdown(60);
      setIsCounting(true);
    } catch (error) {
      const msg = extractErrorMessage(
        error,
        'Không thể tạo tài khoản. Vui lòng thử lại.'
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
        // Bỏ qua nếu thiết bị không có ứng dụng email
      }
    }
  };

  const handleResend = async () => {
    if (isCounting || isLoading) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      await authService.resendVerification(email.trim());
      setCountdown(60);
      setIsCounting(true);
    } catch (error) {
      const msg = extractErrorMessage(
        error,
        'Không thể gửi lại email xác thực. Vui lòng thử lại.'
      );
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Header thanh gọn đồng bộ Figma (Hình 2): nút quay lại + logo libby. */}
      <LibbyTopBar
        onBackPress={() => {
          if (isRegistered) {
            setIsRegistered(false);
          } else {
            router.back();
          }
        }}
      />

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
            {!isRegistered ? (
              /* TRẠNG THÁI 1: FORM ĐĂNG KÝ (RegisterApp.dc.html) */
              <View>
                <Text style={styles.sheetTitle}>Tạo tài khoản</Text>
                <Text style={styles.sheetSubtitle}>
                  Tạo tài khoản để mượn sách online.
                </Text>

                {/* Banner thông báo lỗi nếu có */}
                {errorMessage && (
                  <LibbyAlert
                    message={errorMessage}
                    style={styles.alertSpacing}
                    type="error"
                  />
                )}

                <View style={styles.formContainer}>
                  {/* Input Email với validate chặt chẽ theo chuẩn Zod web */}
                  <LibbyInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={!!emailError || (!!errorMessage && !email)}
                    errorMessage={emailError || undefined}
                    keyboardType="email-address"
                    label="Email"
                    leftIcon={
                      <MailIcon
                        color={LibbyColors.textMuted}
                        size={20}
                        strokeWidth={2}
                      />
                    }
                    placeholder="email@vidu.com"
                    value={email}
                    onBlur={() => {
                      if (email.trim().length > 0) {
                        setEmailError(validateEmail(email));
                      }
                    }}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (emailError) {
                        setEmailError(validateEmail(text));
                      }
                      if (errorMessage) setErrorMessage(null);
                    }}
                  />

                  {/* Input Mật khẩu */}
                  <LibbyInput
                    isPassword
                    label="Mật khẩu"
                    leftIcon={
                      <LockIcon
                        color={LibbyColors.textMuted}
                        size={20}
                        strokeWidth={2}
                      />
                    }
                    placeholder="Tạo mật khẩu"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                  />

                  {/* Hộp 3 tiêu chí mật khẩu realtime - chỉ hiển thị khi bắt đầu nhập mật khẩu */}
                  {password.length > 0 && (
                    <LibbyPasswordCriteria
                      password={password}
                      onValidChange={setIsCriteriaMet}
                    />
                  )}

                  {/* Input Xác nhận mật khẩu */}
                  <View>
                    <LibbyInput
                      isPassword
                      label="Xác nhận mật khẩu"
                      leftIcon={
                        <LockIcon
                          color={LibbyColors.textMuted}
                          size={20}
                          strokeWidth={2}
                        />
                      }
                      placeholder="Nhập lại mật khẩu"
                      value={confirmPassword}
                      onChangeText={(text) => {
                        setConfirmPassword(text);
                        if (errorMessage) setErrorMessage(null);
                      }}
                    />

                    {/* Nhãn Mật khẩu khớp */}
                    {isPasswordMatch && (
                      <View style={styles.matchRow}>
                        <View style={styles.matchBadge}>
                          <CheckIcon
                            color={LibbyColors.ink}
                            size={12}
                            strokeWidth={3.5}
                          />
                        </View>
                        <Text style={styles.matchText}>Mật khẩu khớp</Text>
                      </View>
                    )}

                    {/* Cảnh báo mật khẩu chưa khớp khi đã nhập */}
                    {confirmPassword.length > 0 && !isPasswordMatch && (
                      <Text style={styles.mismatchText}>
                        Mật khẩu xác nhận chưa khớp
                      </Text>
                    )}
                  </View>

                  {/* Nút Tạo tài khoản */}
                  <LibbyButton
                    disabled={!isFormValid}
                    loading={isLoading}
                    style={styles.submitButton}
                    title="Tạo tài khoản"
                    variant={isFormValid ? 'primary' : 'disabled'}
                    onPress={handleRegister}
                  />
                </View>

                {/* Chuyển hướng Đăng nhập */}
                <View style={styles.footerRow}>
                  <Text style={styles.footerText}>Đã có tài khoản? </Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => router.replace('/(auth)/login')}
                  >
                    <Text style={styles.loginLink}>Đăng nhập</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* TRẠNG THÁI 2: KIỂM TRA EMAIL SAU KHI ĐĂNG KÝ (VerifyApp.dc.html) */
              <View style={styles.verifyContainer}>
                {/* Vòng tròn icon thư 104px màu xanh chanh */}
                <LibbyStatusCircle variant="mail" />

                <Text style={styles.verifyTitle}>Kiểm tra email</Text>

                <Text style={styles.verifySubtitle}>
                  Tài khoản đã được đăng ký. Hãy kiểm tra hộp thư và mở liên kết xác thực trong vòng 30 phút.
                </Text>

                {/* Khối hiển thị email đăng ký */}
                <View style={styles.emailBadgeBox}>
                  <MailIcon
                    color={LibbyColors.textMuted}
                    size={22}
                    strokeWidth={2}
                  />
                  <View style={styles.emailBadgeContent}>
                    <Text style={styles.emailBadgeLabel}>Email đăng ký</Text>
                    <Text style={styles.emailBadgeValue}>{email.trim()}</Text>
                  </View>
                </View>

                {errorMessage && (
                  <LibbyAlert
                    message={errorMessage}
                    style={styles.alertSpacing}
                    type="error"
                  />
                )}

                {/* Nút Mở ứng dụng email */}
                <LibbyButton
                  style={styles.openMailButton}
                  title="Mở ứng dụng email"
                  variant="primary"
                  onPress={handleOpenMailApp}
                />

                {/* Nút Gửi lại sau ... giây / Gửi lại email */}
                <LibbyButton
                  disabled={isCounting}
                  loading={isLoading}
                  style={styles.resendButton}
                  title={
                    isCounting
                      ? `Gửi lại sau ${countdown} giây`
                      : 'Gửi lại email'
                  }
                  variant={isCounting ? 'disabled' : 'secondary'}
                  onPress={handleResend}
                />

                <Text style={styles.spamNote}>
                  Không thấy email? Hãy kiểm tra thư rác.
                </Text>

                {/* Quay lại đăng nhập */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  style={styles.backLinkRow}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <ChevronLeftIcon
                    color={LibbyColors.primary}
                    size={18}
                    strokeWidth={2.5}
                  />
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
    paddingBottom: 36,
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
    color: LibbyColors.textMuted,
    marginTop: 6,
  },
  alertSpacing: {
    marginTop: 16,
    width: '100%',
  },
  formContainer: {
    marginTop: 22,
    gap: 14,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  matchBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: LibbyColors.lime,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 13,
    color: LibbyColors.successText,
  },
  mismatchText: {
    fontFamily: LibbyFonts.medium,
    fontSize: 12,
    color: LibbyColors.errorText,
    marginTop: 6,
  },
  submitButton: {
    marginTop: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: 24,
  },
  footerText: {
    fontFamily: LibbyFonts.regular,
    fontSize: 14,
    color: LibbyColors.textMuted,
  },
  loginLink: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 14,
    color: LibbyColors.primary,
  },

  /* Styles cho trạng thái VerifyApp (Kiểm tra email) */
  verifyContainer: {
    alignItems: 'center',
  },
  verifyTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.9,
    lineHeight: 33,
    color: LibbyColors.ink,
    textAlign: 'center',
    marginTop: 24,
  },
  verifySubtitle: {
    fontFamily: LibbyFonts.regular,
    fontSize: 15,
    lineHeight: 22.5,
    color: LibbyColors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  emailBadgeBox: {
    marginTop: 20,
    backgroundColor: LibbyColors.subtleBg,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  emailBadgeContent: {
    flex: 1,
  },
  emailBadgeLabel: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 13,
    color: LibbyColors.textMuted,
  },
  emailBadgeValue: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 16,
    color: LibbyColors.ink,
    marginTop: 2,
  },
  openMailButton: {
    marginTop: 22,
  },
  resendButton: {
    marginTop: 10,
  },
  spamNote: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: LibbyColors.textMuted,
    textAlign: 'center',
    marginTop: 14,
  },
  backLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingVertical: 10,
  },
  backLinkText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 15,
    color: LibbyColors.primary,
  },
});
