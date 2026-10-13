import { Alert, Button, Input } from 'antd';
import { useEffect, useRef, useState } from 'react';
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
  const [requestedEmail, setRequestedEmail] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
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

  useEffect(() => {
    if (!cooldownUntil) return undefined;
    const update = () => setCooldownSeconds(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const sendRequest = async (email: string) => {
    if (sendingRef.current || Date.now() < cooldownUntil) return;
    sendingRef.current = true;
    setIsSending(true);
    setServerError(null);
    try {
      await authApi.forgotPassword(email);
      setRequestedEmail(email);
      setRequested(true);
      setCooldownUntil(Date.now() + 60_000);
      setCooldownSeconds(60);
    } catch (error) {
      const fieldErrors = mapForgotPasswordValidationErrors(error);
      if (fieldErrors?.email) setError('email', { type: 'server', message: fieldErrors.email });
      const copy = getForgotPasswordError(error);
      setServerError(copy);
      if (copy.retryAfterSeconds) {
        setCooldownUntil(Date.now() + copy.retryAfterSeconds * 1000);
        setCooldownSeconds(copy.retryAfterSeconds);
      }
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  const onSubmit = ({ email }: ForgotPasswordFormValues) => sendRequest(email);

  return (
    <AuthLayout ariaLabel="Yêu cầu đặt lại mật khẩu tài khoản thư viện" centered>
      <div className="login-content auth-flow-content">
        <h1>Quên mật khẩu</h1>

        {requested ? (
          <>
            {serverError && <Alert className="password-recovery-error" type="error" showIcon role="alert" title={serverError.title} description={serverError.description} />}
            <Alert
              className="login-alert password-recovery-alert"
              type="success"
              showIcon
              role="status"
              title="Kiểm tra email của bạn!"
              description="Nếu email này có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu trong vài phút."
            />
            <p className="field-hint password-recovery-hint">
              Không thấy email? Hãy kiểm tra thư rác hoặc{' '}
              {cooldownSeconds > 0 ? (
                <span>gửi lại sau {cooldownSeconds} giây</span>
              ) : (
                <button
                  className="password-recovery-resend"
                  type="button"
                  disabled={isSending}
                  onClick={() => { void sendRequest(requestedEmail); }}
                >
                  {isSending ? 'đang gửi lại…' : 'gửi lại'}
                </button>
              )}.
            </p>
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
                loading={isSubmitting || isSending}
                disabled={isSubmitting || isSending || cooldownSeconds > 0}
              >
                {isSubmitting || isSending ? 'Đang gửi yêu cầu…' : cooldownSeconds > 0 ? `Gửi lại sau ${cooldownSeconds} giây` : 'Gửi liên kết đặt lại mật khẩu'}
              </Button>
            </form>
            <p className="auth-alternate"><Link to="/login">Quay lại đăng nhập</Link></p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
