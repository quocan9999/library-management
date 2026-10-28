import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  CheckIcon,
  LockIcon,
  MailIcon,
} from '@/components/icons/AuthIcons';
import {
  LibbyAlert,
  LibbyButton,
  LibbyInput,
  LibbyPasswordCriteria,
  LibbyTopBar,
} from '@/components/ui';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { extractErrorMessage } from '@/services/api';
import { authService } from '@/services/authService';

export default function RegisterScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isCriteriaMet, setIsCriteriaMet] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isPasswordMatch = password.length > 0 && password === confirmPassword;
  const isFormValid =
    email.trim().length > 0 &&
    email.includes('@') &&
    isCriteriaMet &&
    isPasswordMatch;

  const handleRegister = async () => {
    if (!isFormValid) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await authService.register(email.trim(), password);
      setSuccessMessage(
        res.emailVerificationRequired
          ? 'Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt tài khoản.'
          : 'Tài khoản của bạn đã được tạo thành công!'
      );
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

  return (
    <View style={styles.screen}>
      {/* Header thanh gọn đồng bộ Figma (Hình 2): nút quay lại + logo libby. */}
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
            <Text style={styles.sheetTitle}>Tạo tài khoản</Text>
            <Text style={styles.sheetSubtitle}>Tạo tài khoản để mượn sách online.</Text>

            {/* Banner thông báo lỗi nếu có */}
            {errorMessage && (
              <LibbyAlert
                message={errorMessage}
                style={styles.alertSpacing}
                type="error"
              />
            )}

            {/* Banner thành công */}
            {successMessage && (
              <LibbyAlert
                message={successMessage}
                style={styles.alertSpacing}
                type="success"
              />
            )}

            <View style={styles.formContainer}>
              {/* Input Email */}
              <LibbyInput
                autoCapitalize="none"
                autoCorrect={false}
                error={!!errorMessage && !email}
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

              {/* Input Mật khẩu */}
              <LibbyInput
                isPassword
                label="Mật khẩu"
                leftIcon={<LockIcon color={LibbyColors.textMuted} size={20} strokeWidth={2} />}
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
                  leftIcon={<LockIcon color={LibbyColors.textMuted} size={20} strokeWidth={2} />}
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
                      <CheckIcon color={LibbyColors.ink} size={12} strokeWidth={3.5} />
                    </View>
                    <Text style={styles.matchText}>Mật khẩu khớp</Text>
                  </View>
                )}

                {/* Cảnh báo mật khẩu chưa khớp khi đã nhập */}
                {confirmPassword.length > 0 && !isPasswordMatch && (
                  <Text style={styles.mismatchText}>Mật khẩu xác nhận chưa khớp</Text>
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

              {/* Nếu đã đăng ký thành công thì hiện nút chuyển qua Đăng nhập */}
              {successMessage && (
                <LibbyButton
                  style={styles.loginRedirectButton}
                  title="Đăng nhập ngay"
                  variant="secondary"
                  onPress={() => router.replace('/(auth)/login')}
                />
              )}
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
  loginRedirectButton: {
    marginTop: 10,
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
});
