import { Alert, Button, Input } from 'antd';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { loginSchema, type LoginForm } from '../auth/loginSchema';
import { getLoginError, mapLoginValidationErrors } from '../auth/messages';
import type { LoginCredentials } from '../auth/types';
import { AuthLayout } from '../components/AuthLayout';
import { ResendVerificationForm } from './ResendVerificationForm';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const accountDisabledNotice = (location.state as { accountDisabled?: unknown } | null)?.accountDisabled === true;
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
    <AuthLayout ariaLabel="Đăng nhập hệ thống quản lý thư viện" centered>
      <div className="login-content">
        <h1>Đăng nhập</h1>

        {accountDisabledNotice && <Alert
          className="login-alert"
          type="warning"
          showIcon
          role="status"
          title="Phiên đăng nhập đã bị thu hồi"
          description="Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên."
        />}

        {serverError && (
          <div className="login-feedback">
            <Alert
              className="login-alert"
              type="error"
              showIcon
              role="alert"
              title={serverError.title}
              description={serverError.description}
            />
            {serverError.code === 'EMAIL_NOT_VERIFIED' && (
              <div className="login-resend">
                <ResendVerificationForm compact secondary initialEmail={resendEmail} />
              </div>
            )}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
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

          <p className="login-forgot-link"><Link to="/forgot-password">Quên mật khẩu?</Link></p>

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

        <p className="auth-alternate">
          Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
