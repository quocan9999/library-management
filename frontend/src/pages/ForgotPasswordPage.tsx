import { Alert, Button, Input } from 'antd';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { authApi } from '../auth/api';
import {
  getForgotPasswordError,
  mapForgotPasswordValidationErrors,
  type ForgotPasswordErrorCopy,
} from '../auth/messages';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormInput,
  type ForgotPasswordFormValues,
} from '../auth/passwordRecoverySchema';
import { AuthLayout } from '../components/AuthLayout';

export function ForgotPasswordPage() {
  const [requested, setRequested] = useState(false);
  const [serverError, setServerError] = useState<ForgotPasswordErrorCopy | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormInput, unknown, ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const onSubmit = async ({ email }: ForgotPasswordFormValues) => {
    setServerError(null);
    setRequested(false);
    try {
      await authApi.forgotPassword(email);
      setRequested(true);
    } catch (error) {
      const fieldErrors = mapForgotPasswordValidationErrors(error);
      if (fieldErrors?.email) setError('email', { type: 'server', message: fieldErrors.email });
      setServerError(getForgotPasswordError(error));
    }
  };

  return (
    <AuthLayout ariaLabel="Yêu cầu đặt lại mật khẩu tài khoản thư viện">
      <div className="login-content auth-flow-content">
        <p className="eyebrow">KHÔI PHỤC TÀI KHOẢN</p>
        <h1>Quên mật khẩu</h1>
        <p className="login-intro">
          Nhập email tài khoản để nhận liên kết đặt lại mật khẩu nếu địa chỉ đó đủ điều kiện.
        </p>

        {requested ? (
          <>
            <Alert
              className="login-alert"
              type="success"
              showIcon
              role="status"
              title="Yêu cầu đã được tiếp nhận"
              description="Nếu email đủ điều kiện, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư."
            />
            <p className="auth-alternate"><Link to="/login">Đăng nhập</Link></p>
          </>
        ) : (
          <>
            <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
              {serverError && (
                <Alert
                  className="login-alert"
                  type="error"
                  showIcon
                  role="alert"
                  title={serverError.title}
                  description={serverError.retryAfterSeconds
                    ? `${serverError.description} Có thể thử lại sau ${serverError.retryAfterSeconds} giây.`
                    : serverError.description}
                />
              )}

              <div className="form-field">
                <label htmlFor="forgot-password-email">Email</label>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="forgot-password-email"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="ban@example.com"
                      size="large"
                      status={errors.email ? 'error' : undefined}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? 'forgot-password-email-error' : undefined}
                      onChange={(event) => {
                        field.onChange(event);
                        setServerError(null);
                      }}
                    />
                  )}
                />
                {errors.email?.message && (
                  <p className="field-error" id="forgot-password-email-error" role="alert">
                    {errors.email.message}
                  </p>
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
                {isSubmitting ? 'Đang gửi yêu cầu…' : 'Gửi liên kết đặt lại mật khẩu'}
              </Button>
            </form>
            <p className="auth-alternate"><Link to="/login">Quay lại đăng nhập</Link></p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
