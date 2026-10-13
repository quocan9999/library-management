import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Input } from 'antd';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { RequirePermission } from '../auth/permissions';
import type { ApiEnvelope } from '../auth/types';
import { profileApi } from './api';
import { createChangeEmailSchema, changeEmailCodeSchema, type ChangeEmailFormInput, type ChangeEmailFormValues } from './changeEmailSchema';

const RESEND_COOLDOWN_SECONDS = 60;

function getErrorMessage(error: unknown, step: 'request' | 'verify'): string {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) return 'Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.';
  const code = error.response?.data?.code;
  if (code === 'CURRENT_PASSWORD_INVALID') return 'Mật khẩu hiện tại không chính xác.';
  if (code === 'EMAIL_ALREADY_REGISTERED') return 'Email này đã được sử dụng bởi tài khoản khác.';
  if (code === 'EMAIL_CHANGE_CODE_INVALID') return 'Mã xác thực không hợp lệ hoặc đã hết hạn. Vui lòng gửi lại mã và dùng mã mới nhất.';
  if (code === 'EMAIL_CHANGE_RATE_LIMITED') return 'Bạn đã thao tác quá nhanh. Vui lòng đợi rồi thử lại.';
  if (code === 'EMAIL_CHANGE_EMAIL_SEND_FAILED' || error.response?.status === 503) {
    return 'Không thể gửi email lúc này. Vui lòng thử lại sau ít phút.';
  }
  if (error.response?.status === 500) return 'Hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau.';
  return step === 'request'
    ? 'Không thể gửi mã xác thực. Vui lòng kiểm tra thông tin và thử lại.'
    : 'Không thể xác nhận email lúc này. Vui lòng thử lại.';
}

export function ChangeEmailPage() {
  const { currentUser, refreshCapabilities } = useAuth();
  const currentEmail = currentUser?.email ?? '';
  const requestSchema = useMemo(() => createChangeEmailSchema(currentEmail), [currentEmail]);
  const [credentials, setCredentials] = useState<ChangeEmailFormValues | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [changedEmail, setChangedEmail] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const requestForm = useForm<ChangeEmailFormInput, unknown, ChangeEmailFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { newEmail: '', currentPassword: '' },
    mode: 'onSubmit',
  });
  const codeForm = useForm<{ code: string }>({
    resolver: zodResolver(changeEmailCodeSchema),
    defaultValues: { code: '' },
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldownSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  const sendCode = async (values: ChangeEmailFormValues, isResend = false) => {
    setServerError(null);
    try {
      await profileApi.requestEmailChange(values);
      setCredentials(values);
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
      requestForm.reset({ newEmail: values.newEmail, currentPassword: '' });
      codeForm.reset();
    } catch (error) {
      setServerError(getErrorMessage(error, 'request'));
      if (!isResend) setCredentials(null);
    }
  };

  const submitCode = async ({ code }: { code: string }) => {
    setServerError(null);
    try {
      await profileApi.verifyEmailChange({ code });
      const email = credentials?.newEmail ?? currentEmail;
      try {
        await refreshCapabilities({ force: true });
      } catch {
        // Email đã được cập nhật; giữ thông báo thành công dù lần tải lại /auth/me tạm lỗi.
      }
      setChangedEmail(email);
      setCredentials(null);
      requestForm.reset();
      codeForm.reset();
    } catch (error) {
      setServerError(getErrorMessage(error, 'verify'));
    }
  };

  return (
    <RequirePermission permission="account:change-email" allowedRoles={['ROLE_USER']}>
    <main className="profile-page profile-page--form" aria-labelledby="change-email-title">
      <header className="profile-page__heading">
        <h1 id="change-email-title">Đổi email</h1>
        <p>Xác nhận mật khẩu hiện tại và mã gửi đến email mới để cập nhật tài khoản.</p>
      </header>

      <section className="profile-form-card" aria-label="Biểu mẫu đổi email">
        {changedEmail && (
          <Alert
            className="profile-form-card__alert"
            type="success"
            showIcon
            role="status"
            title="Email đã được thay đổi thành công."
            description={<>Email đăng nhập mới: <strong>{changedEmail}</strong>.</>}
          />
        )}
        {serverError && <Alert className="profile-form-card__alert" type="error" showIcon role="alert" title={serverError} />}

        {!credentials && !changedEmail && (
          <form className="profile-password-form" onSubmit={requestForm.handleSubmit((values) => sendCode(values))} noValidate>
            <div className="form-field">
              <label htmlFor="profile-current-email">Email hiện tại</label>
              <Input id="profile-current-email" value={currentEmail} readOnly size="large" />
            </div>
            <div className="form-field">
              <label htmlFor="profile-new-email">Email mới</label>
              <Controller name="newEmail" control={requestForm.control} render={({ field }) => (
                <Input {...field} id="profile-new-email" type="email" autoComplete="email" placeholder="name@example.com" size="large"
                  status={requestForm.formState.errors.newEmail ? 'error' : undefined} aria-invalid={Boolean(requestForm.formState.errors.newEmail)} />
              )} />
              {requestForm.formState.errors.newEmail?.message && (
                <p className="field-error" role="alert">{requestForm.formState.errors.newEmail.message}</p>
              )}
            </div>
            <div className="form-field">
              <label htmlFor="profile-email-current-password">Mật khẩu hiện tại</label>
              <Controller name="currentPassword" control={requestForm.control} render={({ field }) => (
                <Input.Password {...field} id="profile-email-current-password" autoComplete="current-password" placeholder="Nhập mật khẩu hiện tại" size="large"
                  status={requestForm.formState.errors.currentPassword ? 'error' : undefined} aria-invalid={Boolean(requestForm.formState.errors.currentPassword)} />
              )} />
              {requestForm.formState.errors.currentPassword?.message && (
                <p className="field-error" role="alert">{requestForm.formState.errors.currentPassword.message}</p>
              )}
            </div>
            <div className="profile-password-form__actions">
              <Link to="/profile">Quay lại hồ sơ</Link>
              <Button type="primary" htmlType="submit" size="large" loading={requestForm.formState.isSubmitting} disabled={requestForm.formState.isSubmitting}>
                {requestForm.formState.isSubmitting ? 'Đang gửi…' : 'Gửi mã xác thực'}
              </Button>
            </div>
          </form>
        )}

        {credentials && !changedEmail && (
          <>
            <Alert className="profile-form-card__alert" type="info" showIcon role="status"
              title={`Mã xác thực đã được gửi đến ${credentials.newEmail}. Mã có hiệu lực trong 10 phút.`} />
            <form className="profile-password-form" onSubmit={codeForm.handleSubmit(submitCode)} noValidate>
              <div className="form-field">
                <label htmlFor="profile-email-code">Mã xác thực 6 chữ số</label>
                <Controller name="code" control={codeForm.control} render={({ field }) => (
                  <Input {...field} id="profile-email-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" size="large"
                    status={codeForm.formState.errors.code ? 'error' : undefined} aria-invalid={Boolean(codeForm.formState.errors.code)} />
                )} />
                {codeForm.formState.errors.code?.message && (
                  <p className="field-error" role="alert">{codeForm.formState.errors.code.message}</p>
                )}
              </div>
              <div className="profile-password-form__actions">
                <button type="button" className="profile-action__link" onClick={() => {
                  setCredentials(null);
                  setServerError(null);
                  setCooldownSeconds(0);
                }}>Dùng email khác</button>
                <div>
                  <Button type="link" disabled={cooldownSeconds > 0} onClick={() => void sendCode(credentials, true)}>
                    {cooldownSeconds > 0 ? `Gửi lại sau ${cooldownSeconds} giây` : 'Gửi lại mã xác thực'}
                  </Button>
                  <Button type="primary" htmlType="submit" size="large" loading={codeForm.formState.isSubmitting} disabled={codeForm.formState.isSubmitting}>
                    {codeForm.formState.isSubmitting ? 'Đang xác nhận…' : 'Xác nhận đổi email'}
                  </Button>
                </div>
              </div>
            </form>
          </>
        )}

        {changedEmail && <div className="profile-password-form__actions"><Link to="/profile">Quay lại hồ sơ</Link></div>}
      </section>
    </main>
    </RequirePermission>
  );
}
