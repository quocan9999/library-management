import { Alert, Button, Input } from 'antd';
import { useEffect, useState } from 'react';
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
  compact?: boolean;
  onRequested?: (email: string) => void;
}

export function ResendVerificationForm({
  initialEmail = '',
  initialCooldownSeconds = 0,
  compact = false,
  onRequested,
}: ResendVerificationFormProps) {
  const [serverError, setServerError] = useState<ReturnType<typeof getResendError> | null>(null);
  const [requested, setRequested] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(Math.max(0, initialCooldownSeconds));
  const {
    control,
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
      setCooldownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isCoolingDown]);

  const onSubmit = async ({ email }: ResendFormValues) => {
    setServerError(null);
    setRequested(false);

    try {
      await authApi.resendVerification(email);
      setRequested(true);
      setCooldownSeconds(60);
      onRequested?.(email);
    } catch (error) {
      const fieldErrors = mapResendValidationErrors(error);
      if (fieldErrors?.email) {
        setError('email', { type: 'server', message: fieldErrors.email });
      } else {
        const copy = getResendError(error);
        setServerError(copy);
        if (copy.retryAfterSeconds) setCooldownSeconds(copy.retryAfterSeconds);
      }
    }
  };

  return (
    <div className={`resend-panel${compact ? ' resend-panel--compact' : ''}`}>
      {requested && (
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
        <div className="form-field">
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
        </div>

        {cooldownSeconds > 0 && (
          <p className="resend-cooldown" role="status" aria-live="polite">
            Vui lòng chờ {cooldownSeconds} giây trước khi gửi yêu cầu tiếp theo.
          </p>
        )}

        <Button
          className="login-submit"
          type="primary"
          htmlType="submit"
          size="large"
          block
          loading={isSubmitting}
          disabled={isSubmitting || cooldownSeconds > 0}
        >
          {isSubmitting ? 'Đang gửi yêu cầu…' : 'Gửi lại email xác thực'}
        </Button>
      </form>
    </div>
  );
}
