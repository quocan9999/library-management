import { useLocalSearchParams, useRouter } from 'expo-router';
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
  ChevronLeftIcon,
  LockIcon,
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

type ResetPageState = 'form' | 'success' | 'expired';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();

  const [token, setToken] = useState<string>(params.token || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isCriteriaMet, setIsCriteriaMet] = useState(false);

  const [pageState, setPageState] = useState<ResetPageState>(
    params.token === 'expired' ? 'expired' : 'form'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPasswordMatch =
    newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid =
    (token.trim().length > 0 || !!params.token) &&
    isCriteriaMet &&
    isPasswordMatch;

  const handleResetPassword = async () => {
    const activeToken = token.trim() || params.token || '';
    if (!activeToken) {
      setErrorMessage('Mã xác thực không hợp lệ hoặc bị thiếu.');
      return;
    }
    if (!isFormValid) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);
      await authService.resetPassword(activeToken, newPassword, confirmPassword);
      setPageState('success');
    } catch (error) {
      const msg = extractErrorMessage(
        error,
        'Đặt lại mật khẩu thất bại. Vui lòng thử lại.'
      );
      if (
        msg.toLowerCase().includes('hết hạn') ||
        msg.toLowerCase().includes('không hợp lệ') ||
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('invalid')
      ) {
        setPageState('expired');
      } else {
        setErrorMessage(msg);
      }
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
            {/* TRẠNG THÁI 1: FORM NHẬP MẬT KHẨU MỚI (ResetApp.dc.html) */}
            {pageState === 'form' && (
              <View>
                <Text style={styles.sheetTitle}>Đặt lại mật khẩu</Text>
                <Text style={styles.sheetSubtitle}>
                  Tạo mật khẩu mới cho tài khoản{' '}
                  <Text style={styles.boldText}>
                    {params.email || 'độc giả'}
                  </Text>
                  .
                </Text>

                {errorMessage && (
                  <LibbyAlert
                    message={errorMessage}
                    style={styles.alertSpacing}
                    type="error"
                  />
                )}

                <View style={styles.formContainer}>
                  {/* Nếu không có token từ URL/deep link, cho phép dán token */}
                  {!params.token && (
                    <LibbyInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      label="Mã xác thực (Token)"
                      placeholder="Dán mã xác thực nhận từ email"
                      value={token}
                      onChangeText={(text) => {
                        setToken(text);
                        if (errorMessage) setErrorMessage(null);
                      }}
                    />
                  )}

                  {/* Input Mật khẩu mới */}
                  <LibbyInput
                    isPassword
                    label="Mật khẩu mới"
                    leftIcon={<LockIcon color={LibbyColors.textMuted} size={20} strokeWidth={2} />}
                    placeholder="Tạo mật khẩu mới"
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                  />

                  {/* Hộp 3 tiêu chí mật khẩu - chỉ hiển thị khi bắt đầu nhập mật khẩu */}
                  {newPassword.length > 0 && (
                    <LibbyPasswordCriteria
                      password={newPassword}
                      onValidChange={setIsCriteriaMet}
                    />
                  )}

                  {/* Input Xác nhận mật khẩu mới */}
                  <LibbyInput
                    isPassword
                    label="Xác nhận mật khẩu mới"
                    leftIcon={<LockIcon color={LibbyColors.textMuted} size={20} strokeWidth={2} />}
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                  />

                  {confirmPassword.length > 0 && !isPasswordMatch && (
                    <Text style={styles.mismatchText}>
                      Mật khẩu xác nhận chưa khớp
                    </Text>
                  )}

                  {/* Nút Đặt lại mật khẩu */}
                  <LibbyButton
                    disabled={!isFormValid}
                    loading={isLoading}
                    style={styles.submitButton}
                    title="Đặt lại mật khẩu"
                    variant={isFormValid ? 'primary' : 'disabled'}
                    onPress={handleResetPassword}
                  />

                  {/* Quay lại đăng nhập */}
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
              </View>
            )}

            {/* TRẠNG THÁI 2: ĐẶT LẠI THÀNH CÔNG (ResetAppDone.dc.html) */}
            {pageState === 'success' && (
              <View style={styles.centerContainer}>
                <LibbyStatusCircle variant="success" />

                <Text style={styles.stateTitle}>Đặt lại mật khẩu thành công</Text>

                <Text style={styles.stateSubtitle}>
                  Mật khẩu của bạn đã được cập nhật. Bạn có thể đăng nhập ngay bằng mật khẩu mới.
                </Text>

                <LibbyButton
                  style={styles.actionButton}
                  title="Đăng nhập ngay"
                  variant="primary"
                  onPress={() => router.replace('/(auth)/login')}
                />
              </View>
            )}

            {/* TRẠNG THÁI 3: LIÊN KẾT HẾT HẠN (ResetAppExpired.dc.html) */}
            {pageState === 'expired' && (
              <View style={styles.centerContainer}>
                <LibbyStatusCircle variant="expired" />

                <Text style={styles.stateTitle}>Liên kết đã hết hạn</Text>

                <Text style={styles.stateSubtitle}>
                  Liên kết đặt lại mật khẩu chỉ có hiệu lực trong 15 phút hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.
                </Text>

                <LibbyButton
                  style={styles.actionButton}
                  title="Yêu cầu liên kết mới"
                  variant="primary"
                  onPress={() => router.replace('/(auth)/forgot-password')}
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
    lineHeight: 22,
    color: LibbyColors.textMuted,
    marginTop: 8,
  },
  boldText: {
    fontWeight: '700',
    color: LibbyColors.ink,
  },
  alertSpacing: {
    marginTop: 16,
  },
  formContainer: {
    marginTop: 22,
    gap: 14,
  },
  mismatchText: {
    fontFamily: LibbyFonts.medium,
    fontSize: 12,
    color: LibbyColors.errorText,
    marginLeft: 14,
  },
  submitButton: {
    marginTop: 8,
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
  centerContainer: {
    alignItems: 'center',
  },
  stateTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.9,
    lineHeight: 33,
    color: LibbyColors.ink,
    textAlign: 'center',
    marginTop: 24,
  },
  stateSubtitle: {
    fontFamily: LibbyFonts.regular,
    fontSize: 15,
    lineHeight: 23,
    color: LibbyColors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 6,
  },
  actionButton: {
    marginTop: 26,
  },
});
