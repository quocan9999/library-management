import { Alert, Button, Input } from 'antd';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../auth/api';
import {
  getPasswordResetError,
  mapResetPasswordValidationErrors,
} from '../auth/messages';
import {
  resetPasswordSchema,
  type ResetPasswordFormInput,
  type ResetPasswordFormValues,
} from '../auth/passwordRecoverySchema';
import { clearRevokedSessionAfterReset } from '../auth/passwordResetSession';
import { publishSessionTabEvent } from '../auth/sessionTabEvents';
import { AuthLayout } from '../components/AuthLayout';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [invalidLink, setInvalidLink] = useState(!token);
  const [serverError, setServerError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    trigger,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormInput, unknown, ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmNewPassword: '' },
    mode: 'onSubmit',
    criteriaMode: 'all',
  });

  const onSubmit = async ({ newPassword, confirmNewPassword }: ResetPasswordFormValues) => {
    if (!token || completed) return;
    setServerError(null);
    setInvalidLink(false);
    try {
      await authApi.resetPassword({ token, newPassword, confirmNewPassword });
      // Phiên tài khoản khác vẫn hợp lệ; chỉ clear khi server xác nhận phiên hiện tại bị thu hồi.
      void clearRevokedSessionAfterReset();
      publishSessionTabEvent('password-reset');
      reset();
      setCompleted(true);
    } catch (error) {
      const fieldErrors = mapResetPasswordValidationErrors(error);
      if (fieldErrors?.newPassword) setError('newPassword', { type: 'server', message: fieldErrors.newPassword });
      if (fieldErrors?.confirmNewPassword) {
        setError('confirmNewPassword', { type: 'server', message: fieldErrors.confirmNewPassword });
      }
      if (fieldErrors) return;
      if (getPasswordResetError(error) === 'invalid') {
        setInvalidLink(true);
      } else {
        setServerError('Không thể đặt lại mật khẩu lúc này. Vui lòng thử lại.');
      }
    }
  };

  const passwordErrors = errors.newPassword?.types
    ? [...new Set(Object.values(errors.newPassword.types).flat().filter(
      (message): message is string => typeof message === 'string',
    ))]
    : errors.newPassword?.message ? [errors.newPassword.message] : [];

  return (
    <AuthLayout ariaLabel="Đặt lại mật khẩu tài khoản thư viện" centered>
      <div className="login-content auth-flow-content">
        <h1>Đặt lại mật khẩu</h1>

        {completed ? (
          <div className="login-form">
            <Alert
              type="success"
              showIcon
              role="status"
              title="Đổi mật khẩu thành công"
              description="Bạn có thể đăng nhập bằng mật khẩu mới."
            />
            <Button type="primary" size="large" block onClick={() => navigate('/login', { replace: true })}>
              Đăng nhập
            </Button>
          </div>
        ) : invalidLink ? (
          <>
            <Alert
              className="login-alert"
              type="error"
              showIcon
              role="alert"
              title="Liên kết không hợp lệ hoặc đã hết hạn"
              description="Hãy yêu cầu một liên kết đặt lại mật khẩu mới để tiếp tục."
            />
            <p className="auth-alternate"><Link to="/forgot-password">Yêu cầu liên kết mới</Link></p>
            <p className="auth-alternate"><Link to="/login">Đăng nhập</Link></p>
          </>
        ) : (
          <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            {serverError && (
              <Alert className="login-alert" type="error" showIcon role="alert" title={serverError} />
            )}

            <div className="form-field">
              <label htmlFor="reset-password-new">Mật khẩu mới</label>
              <Controller
                name="newPassword"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    id="reset-password-new"
                    autoComplete="new-password"
                    placeholder="Tạo mật khẩu mới"
                    size="large"
                    status={errors.newPassword ? 'error' : undefined}
                    aria-invalid={Boolean(errors.newPassword)}
                    aria-describedby={passwordErrors.length ? 'reset-password-hint reset-password-error' : 'reset-password-hint'}
                    onChange={(event) => {
                      field.onChange(event);
                      if (errors.newPassword) void trigger('newPassword');
                      if (errors.confirmNewPassword) void trigger('confirmNewPassword');
                      setServerError(null);
                    }}
                  />
                )}
              />
              <p className="field-hint" id="reset-password-hint">8–20 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt; không có khoảng trắng.</p>
              {passwordErrors.length > 0 && (
                <ul className="field-error-list" id="reset-password-error" aria-label="Lỗi mật khẩu">
                  {passwordErrors.map((message) => <li key={message}>{message}</li>)}
                </ul>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="reset-password-confirm">Xác nhận mật khẩu mới</label>
              <Controller
                name="confirmNewPassword"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    id="reset-password-confirm"
                    autoComplete="new-password"
                    placeholder="Nhập lại mật khẩu mới"
                    size="large"
                    status={errors.confirmNewPassword ? 'error' : undefined}
                    aria-invalid={Boolean(errors.confirmNewPassword)}
                    aria-describedby={errors.confirmNewPassword ? 'reset-password-confirm-error' : undefined}
                    onChange={(event) => {
                      field.onChange(event);
                      if (errors.confirmNewPassword) void trigger('confirmNewPassword');
                    }}
                  />
                )}
              />
              {errors.confirmNewPassword?.message && (
                <p className="field-error" id="reset-password-confirm-error" role="alert">
                  {errors.confirmNewPassword.message}
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
              {isSubmitting ? 'Đang đặt lại mật khẩu…' : 'Đặt lại mật khẩu'}
            </Button>
            <p className="auth-alternate"><Link to="/login">Quay lại đăng nhập</Link></p>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
