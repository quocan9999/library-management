import { Alert, Button, Input } from 'antd';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { loginSchema, type LoginForm } from '../auth/loginSchema';
import { getLoginError, mapLoginValidationErrors } from '../auth/messages';
import type { LoginCredentials } from '../auth/types';
import { AuthLayout } from '../components/AuthLayout';
import { ResendVerificationForm } from './ResendVerificationForm';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<ReturnType<typeof getLoginError> | null>(null);
  const {
    control,
    handleSubmit,
    getValues,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
    mode: 'onSubmit',
  });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      const credentials: LoginCredentials = values;
      await login(credentials);
      navigate('/', { replace: true });
    } catch (error) {
      const fieldErrors = mapLoginValidationErrors(error);
      if (fieldErrors) {
        for (const field of ['identifier', 'password'] as const) {
          const message = fieldErrors[field];
          if (message) setError(field, { type: 'server', message });
        }
        return;
      }
      const copy = getLoginError(error);
      if (copy.code === 'EMAIL_NOT_VERIFIED') {
        setValue('password', '');
      }
      setServerError(copy);
    }
  };

  const identifier = getValues('identifier').trim();
  const resendEmail = identifier.includes('@') ? identifier : '';

  return (
    <AuthLayout ariaLabel="Đăng nhập hệ thống quản lý thư viện">
      <div className="login-content">
        <p className="eyebrow">TRUY CẬP HỆ THỐNG</p>
        <h1>Chào mừng bạn quay lại</h1>
        <p className="login-intro">Đăng nhập để tiếp tục sử dụng hệ thống quản lý thư viện.</p>

        <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError && (
            <Alert
              className="login-alert"
              type="error"
              showIcon
              role="alert"
              title={serverError.title}
              description={serverError.description}
            />
          )}

          <div className="form-field">
            <label htmlFor="identifier">Tên đăng nhập hoặc email</label>
            <Controller
              name="identifier"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="identifier"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Nhập email hoặc tên đăng nhập"
                  size="large"
                  status={errors.identifier ? 'error' : undefined}
                  aria-invalid={Boolean(errors.identifier)}
                  aria-describedby={errors.identifier ? 'identifier-error' : undefined}
                />
              )}
            />
            {errors.identifier?.message && (
              <p className="field-error" id="identifier-error" role="alert">{errors.identifier.message}</p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="password">Mật khẩu</label>
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  id="password"
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  size="large"
                  status={errors.password ? 'error' : undefined}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
              )}
            />
            {errors.password?.message && (
              <p className="field-error" id="password-error" role="alert">{errors.password.message}</p>
            )}
          </div>

          <Button
            className="login-submit"
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
        </form>

        {serverError?.code === 'EMAIL_NOT_VERIFIED' && (
          <div className="login-resend">
            <ResendVerificationForm compact initialEmail={resendEmail} />
          </div>
        )}

        <p className="auth-alternate">
          Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
        </p>
        <p className="privacy-note">
          <span className="privacy-note__icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none">
              <rect x="4.25" y="8.5" width="11.5" height="8.25" rx="1.5" />
              <path d="M6.75 8.5V6.25a3.25 3.25 0 0 1 6.5 0V8.5M10 11.5v2.25" />
            </svg>
          </span>
          Thông tin đăng nhập của bạn được bảo vệ và giữ riêng tư.
        </p>
      </div>
    </AuthLayout>
  );
}
