import { Alert, Button, Input } from 'antd';
import { useState } from 'react';
import { Controller, useForm, type FieldError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../auth/api';
import {
  getRegisterError,
  mapRegisterValidationErrors,
} from '../auth/messages';
import { registerSchema, type RegisterFormInput, type RegisterFormValues } from '../auth/registerSchema';
import { saveRegistrationEmail } from '../auth/registrationStorage';
import { AuthLayout } from '../components/AuthLayout';

function fieldMessages(error?: FieldError): string[] {
  const values = error?.types ? Object.values(error.types).flat() : [error?.message];
  return [...new Set(values.filter((value): value is string => typeof value === 'string'))];
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<ReturnType<typeof getRegisterError> | null>(null);
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null);
  const [submissionPending, setSubmissionPending] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormInput, unknown, RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
    mode: 'onBlur',
    reValidateMode: 'onChange',
    criteriaMode: 'all',
  });

  const onSubmit = async ({ email, password }: RegisterFormValues) => {
    if (submissionPending) return;
    setSubmissionPending(true);
    setServerError(null);
    setDuplicateEmail(null);
    try {
      const result = await authApi.register({ email, password });
      const registrationCooldownSeconds = saveRegistrationEmail(result.email || email, 60);
      navigate('/check-email', { state: { registrationCooldownSeconds } });
    } catch (error) {
      const fieldErrors = mapRegisterValidationErrors(error);
      if (fieldErrors?.email) setError('email', { type: 'server', message: fieldErrors.email });
      if (fieldErrors?.password) setError('password', { type: 'server', message: fieldErrors.password });
      const copy = getRegisterError(error);
      setServerError(copy);
      if (copy.code === 'EMAIL_NOT_VERIFIED_REGISTERED') setDuplicateEmail(email);
    } finally {
      setSubmissionPending(false);
    }
  };

  const passwordErrors = fieldMessages(errors.password);

  return (
    <AuthLayout ariaLabel="Đăng ký tài khoản thư viện" centered>
      <div className="login-content auth-flow-content">
        <h1>Tạo tài khoản</h1>

        <form className="login-form register-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError && (
            <Alert
              className="login-alert"
              type="error"
              showIcon
              role="alert"
              title={serverError.title}
              description={(
                <span>
                  {serverError.description}
                  {serverError.code === 'EMAIL_ALREADY_REGISTERED' && (
                    <> <Link to="/login">Đăng nhập</Link></>
                  )}
                  {serverError.code === 'EMAIL_NOT_VERIFIED_REGISTERED' && duplicateEmail && (
                    <> <Link to="/check-email" onClick={() => saveRegistrationEmail(duplicateEmail)}>Gửi lại email xác thực</Link></>
                  )}
                </span>
              )}
            />
          )}

          <div className="form-field">
            <label htmlFor="register-email">Email</label>
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="ban@example.com"
                  size="large"
                  status={errors.email ? 'error' : undefined}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'register-email-error' : undefined}
                  onChange={(event) => {
                    field.onChange(event);
                    setServerError(null);
                    if (errors.email) void trigger('email');
                  }}
                />
              )}
            />
            {errors.email?.message && (
              <p className="field-error" id="register-email-error" role="alert">{errors.email.message}</p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="register-password">Mật khẩu</label>
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  id="register-password"
                  autoComplete="new-password"
                  placeholder="Tạo mật khẩu"
                  size="large"
                  status={errors.password ? 'error' : undefined}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={passwordErrors.length ? 'password-hint password-error' : 'password-hint'}
                  onChange={(event) => {
                    field.onChange(event);
                    if (errors.password) void trigger('password');
                    if (errors.confirmPassword) void trigger('confirmPassword');
                  }}
                />
              )}
            />
            <p className="field-hint" id="password-hint">Mật khẩu cần có:</p>
            <ul className="password-rules" aria-label="Yêu cầu mật khẩu">
              <li>8–20 ký tự</li>
              <li>Ít nhất một chữ hoa, chữ thường, chữ số và ký tự đặc biệt</li>
              <li>Không chứa khoảng trắng</li>
            </ul>
            {passwordErrors.length > 0 && (
              <ul className="field-error-list" id="password-error" aria-label="Lỗi mật khẩu">
                {passwordErrors.map((message) => <li key={message}>{message}</li>)}
              </ul>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="register-confirm-password">Xác nhận mật khẩu</label>
            <Controller
              name="confirmPassword"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  id="register-confirm-password"
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                  size="large"
                  status={errors.confirmPassword ? 'error' : undefined}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                  onChange={(event) => {
                    field.onChange(event);
                    if (errors.confirmPassword) void trigger('confirmPassword');
                  }}
                />
              )}
            />
            {errors.confirmPassword?.message && (
              <p className="field-error" id="confirm-password-error" role="alert">
                {errors.confirmPassword.message}
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
            disabled={isSubmitting || submissionPending}
          >
            {isSubmitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
          </Button>
        </form>

        <p className="auth-alternate">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
      </div>
    </AuthLayout>
  );
}
