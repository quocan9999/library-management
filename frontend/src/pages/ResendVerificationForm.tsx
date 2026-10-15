import { Alert, Button, Input } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../auth/api';
import { getResendError, mapResendValidationErrors } from '../auth/messages';

const resendSchema = z.object({
  email: z.string()
    .trim()
    .min(1, 'Vui lòng nhập địa chỉ email.')
    .max(255, 'Email không được vượt quá 255 ký tự.')
    .email('Vui lòng nhập địa chỉ email hợp lệ.')
    .transform((email) => email.toLowerCase()),
});

type ResendFormInput = z.input<typeof resendSchema>;
type ResendFormValues = z.output<typeof resendSchema>;

interface ResendVerificationFormProps {
  initialEmail?: string;
  initialCooldownSeconds?: number;
  hideEmailField?: boolean;
  compact?: boolean;
  secondary?: boolean;
  inlineResend?: boolean;
  onRequested?: (email: string) => void;
}

export function ResendVerificationForm({
  initialEmail = '',
  initialCooldownSeconds = 0,
  hideEmailField = false,
  compact = false,
  secondary = false,
  inlineResend = false,
  onRequested,
}: ResendVerificationFormProps) {
  const [serverError, setServerError] = useState<ReturnType<typeof getResendError> | null>(null);
  const [requested, setRequested] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(Math.max(0, initialCooldownSeconds));
  const cooldownUntil = useRef(initialCooldownSeconds > 0 ? Date.now() + initialCooldownSeconds * 1000 : 0);
  const sending = useRef(false);
  const {
    control,
    register,
    handleSubmit,
    setError,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ResendFormInput, unknown, ResendFormValues>({
    resolver: zodResolver(resendSchema),
    defaultValues: { email: initialEmail },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const isCoolingDown = cooldownSeconds > 0;
  useEffect(() => {
    if (!isCoolingDown) return undefined;
    const interval = window.setInterval(() => {
      setCooldownSeconds(Math.max(0, Math.ceil((cooldownUntil.current - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isCoolingDown]);

  const onSubmit = async ({ email }: ResendFormValues) => {
    if (sending.current || Date.now() < cooldownUntil.current) return;
    sending.current = true;
    setServerError(null);
    if (!inlineResend) setRequested(false);

    try {
      await authApi.resendVerification(email);
      setRequested(true);
      cooldownUntil.current = Date.now() + 60_000;
      setCooldownSeconds(60);
      onRequested?.(email);
    } catch (error) {
      const fieldErrors = mapResendValidationErrors(error);
      if (fieldErrors?.email) {
        setError('email', { type: 'server', message: fieldErrors.email });
      } else {
        const copy = getResendError(error);
        setServerError(copy);
        if (copy.retryAfterSeconds) {
          cooldownUntil.current = Date.now() + copy.retryAfterSeconds * 1000;
          setCooldownSeconds(copy.retryAfterSeconds);
        }
      }
    } finally {
      sending.current = false;
    }
  };

  return (
    <div className={`resend-panel${compact ? ' resend-panel--compact' : ''}`}>
      {requested && !inlineResend && (
        <Alert
          className="login-alert"
          type="success"
          showIcon
          role="status"
          title="Yêu cầu đã được tiếp nhận"
          description="Nếu email cần xác thực, hướng dẫn sẽ được gửi đến hộp thư."
        />
      )}
      {serverError && (
        <Alert
          className="login-alert"
          type="warning"
          showIcon
          role="alert"
          title={serverError.title}
          description={serverError.description}
        />
      )}

      <form className="resend-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {(hideEmailField || (inlineResend && requested)) && <input type="hidden" {...register('email')} />}
        {!hideEmailField && !(inlineResend && requested) && <div className="form-field">
          <label htmlFor="resend-email">Email</label>
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="resend-email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="ban@example.com"
                size="large"
                status={errors.email ? 'error' : undefined}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'resend-email-error' : undefined}
                onChange={(event) => {
                  field.onChange(event);
                  setRequested(false);
                  if (errors.email) void trigger('email');
                }}
              />
            )}
          />
          {errors.email?.message && (
            <p className="field-error" id="resend-email-error" role="alert">{errors.email.message}</p>
          )}
        </div>}

        {inlineResend && (hideEmailField || requested) ? (
          <p className="field-hint">
            Không thấy email? Hãy kiểm tra thư rác hoặc{' '}
            {cooldownSeconds > 0 ? <span>gửi lại sau {cooldownSeconds} giây</span> : (
              <button className="password-recovery-resend" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'đang gửi lại…' : 'gửi lại'}
              </button>
            )}.
          </p>
        ) : <>
        {cooldownSeconds > 0 && (
          <p className="resend-cooldown" role="status" aria-live="polite">
            Vui lòng chờ {cooldownSeconds} giây trước khi gửi yêu cầu tiếp theo.
          </p>
        )}

        <Button
          className={secondary ? undefined : 'login-submit'}
          type={secondary ? 'default' : 'primary'}
          htmlType="submit"
          size={secondary ? 'middle' : 'large'}
          block={!secondary}
          style={secondary ? { alignSelf: 'flex-start' } : undefined}
          loading={isSubmitting}
          disabled={isSubmitting || cooldownSeconds > 0}
        >
          {isSubmitting ? 'Đang gửi yêu cầu…' : 'Gửi lại email xác thực'}
        </Button>
        </>}
      </form>
    </div>
  );
}
