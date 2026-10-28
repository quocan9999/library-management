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

import { LockIcon, MailIcon } from '@/components/icons/AuthIcons';
import {
  LibbyAlert,
  LibbyButton,
  LibbyHeroHeader,
  LibbyInput,
} from '@/components/ui';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { extractErrorMessage } from '@/services/api';
import { validateEmail } from '@/utils/validation';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    if (identifier.includes('@')) {
      const emailValidation = validateEmail(identifier);
      if (emailValidation) {
        setIdentifierError(emailValidation);
        return;
      }
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      await login(identifier.trim(), password);
      // Chuyển hướng về trang chủ độc giả sau khi đăng nhập thành công
      router.replace('/');
    } catch (error) {
      const msg = extractErrorMessage(
        error,
        'Email hoặc mật khẩu không chính xác'
      );
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flexOne}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header thương hiệu độc quyền của màn Đăng nhập (Hình 1): Logo, Slogan & 3 thẻ sách 3D */}
          <LibbyHeroHeader />

          {/* Phần Bottom Sheet bo cong màu trắng */}
          <View style={styles.sheetContainer}>
            <Text style={styles.sheetTitle}>Đăng nhập</Text>
            <Text style={styles.sheetSubtitle}>Chào mừng bạn quay lại libby.</Text>

            {/* Banner thông báo lỗi nếu có */}
            {errorMessage && (
              <LibbyAlert
                message={errorMessage}
                style={styles.alertSpacing}
                type="error"
              />
            )}

            {/* Trường nhập Email & Mật khẩu */}
            <View style={styles.formContainer}>
              <LibbyInput
                autoCapitalize="none"
                autoCorrect={false}
                error={!!identifierError || !!errorMessage}
                errorMessage={identifierError || undefined}
                keyboardType="email-address"
                label="Email"
                leftIcon={<MailIcon color={LibbyColors.textMuted} size={20} strokeWidth={2} />}
                placeholder="email@vidu.com"
                value={identifier}
                onBlur={() => {
                  if (identifier.includes('@')) {
                    setIdentifierError(validateEmail(identifier));
                  }
                }}
                onChangeText={(text) => {
                  setIdentifier(text);
                  if (identifierError) {
                    setIdentifierError(text.includes('@') ? validateEmail(text) : null);
                  }
                  if (errorMessage) setErrorMessage(null);
                }}
              />

              <LibbyInput
                error={!!errorMessage}
                isPassword
                label="Mật khẩu"
                leftIcon={<LockIcon color={LibbyColors.textMuted} size={20} strokeWidth={2} />}
                placeholder="Nhập mật khẩu"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />
            </View>

            {/* Quên mật khẩu link */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.forgotPasswordContainer}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            {/* Nút Đăng nhập chính */}
            <LibbyButton
              disabled={!identifier.trim() || !password}
              loading={isLoading}
              style={styles.loginButton}
              title="Đăng nhập"
              variant="primary"
              onPress={handleLogin}
            />

            {/* Chuyển hướng Đăng ký */}
            <Text style={styles.noAccountText}>Chưa có tài khoản?</Text>

            <LibbyButton
              style={styles.registerButton}
              title="Đăng ký"
              variant="secondary"
              onPress={() => router.push('/(auth)/register')}
            />
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: LibbyColors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 2,
    borderColor: LibbyColors.ink,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
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
    gap: 16,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingVertical: 6,
  },
  forgotPasswordText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 14,
    color: LibbyColors.primary,
  },
  loginButton: {
    marginTop: 12,
  },
  noAccountText: {
    fontFamily: LibbyFonts.regular,
    fontSize: 14,
    color: LibbyColors.textMuted,
    textAlign: 'center',
    marginTop: 22,
  },
  registerButton: {
    marginTop: 10,
  },
});
