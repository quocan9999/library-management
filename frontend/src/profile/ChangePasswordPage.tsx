import { Alert, Button, Input } from 'antd';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { profileApi } from './api';
import { changePasswordSchema, type ChangePasswordFormInput, type ChangePasswordFormValues } from './changePasswordSchema';
import { getChangePasswordError, mapChangePasswordValidationErrors } from './messages';

export function ChangePasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormInput, unknown, ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
    mode: 'onSubmit',
    criteriaMode: 'all',
  });

  const onSubmit = async (values: ChangePasswordFormValues) => {
    setServerError(null);
    setChanged(false);
    try {
      await profileApi.changePassword(values);
      reset();
      setChanged(true);
    } catch (error) {
      const fieldErrors = mapChangePasswordValidationErrors(error);
      if (fieldErrors?.currentPassword) {
        setError('currentPassword', { type: 'server', message: fieldErrors.currentPassword });
      }
      if (fieldErrors?.newPassword) setError('newPassword', { type: 'server', message: fieldErrors.newPassword });
      if (fieldErrors?.confirmNewPassword) {
        setError('confirmNewPassword', { type: 'server', message: fieldErrors.confirmNewPassword });
      }
      if (!fieldErrors) setServerError(getChangePasswordError(error));
    }
  };

  const passwordErrors = errors.newPassword?.types
    ? [...new Set(Object.values(errors.newPassword.types).flat().filter(
      (message): message is string => typeof message === 'string',
    ))]
    : errors.newPassword?.message ? [errors.newPassword.message] : [];

  return (
    <main className="profile-page" aria-labelledby="change-password-title">
      <header className="profile-page__heading">
        <p className="profile-page__eyebrow">BẢO MẬT TÀI KHOẢN</p>
        <h1 id="change-password-title">Đổi mật khẩu</h1>
        <p>Nhập mật khẩu hiện tại để thiết lập mật khẩu mới.</p>
      </header>

      <section className="profile-form-card" aria-label="Biểu mẫu đổi mật khẩu">
        {changed && (
          <Alert
            className="profile-form-card__alert"
            type="success"
            showIcon
            role="status"
            title="Mật khẩu đã được thay đổi thành công."
            description="Phiên đăng nhập hiện tại và các phiên khác vẫn được giữ nguyên."
          />
        )}
        {serverError && (
          <Alert className="profile-form-card__alert" type="error" showIcon role="alert" title={serverError} />
        )}

        <form className="profile-password-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-field">
            <label htmlFor="profile-current-password">Mật khẩu hiện tại</label>
            <Controller
              name="currentPassword"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  id="profile-current-password"
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu hiện tại"
                  size="large"
                  status={errors.currentPassword ? 'error' : undefined}
                  aria-invalid={Boolean(errors.currentPassword)}
                  aria-describedby={errors.currentPassword ? 'profile-current-password-error' : undefined}
                  onChange={(event) => {
                    field.onChange(event);
                    if (errors.currentPassword) void trigger('currentPassword');
                    if (errors.newPassword) void trigger('newPassword');
                    setServerError(null);
                    setChanged(false);
                  }}
                />
              )}
            />
            {errors.currentPassword?.message && (
              <p className="field-error" id="profile-current-password-error" role="alert">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="profile-new-password">Mật khẩu mới</label>
            <Controller
              name="newPassword"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  id="profile-new-password"
                  autoComplete="new-password"
                  placeholder="Tạo mật khẩu mới"
                  size="large"
                  status={errors.newPassword ? 'error' : undefined}
                  aria-invalid={Boolean(errors.newPassword)}
                  aria-describedby={passwordErrors.length
                    ? 'profile-password-hint profile-new-password-error'
                    : 'profile-password-hint'}
                  onChange={(event) => {
                    field.onChange(event);
                    if (errors.newPassword) void trigger('newPassword');
                    if (errors.confirmNewPassword) void trigger('confirmNewPassword');
                    setServerError(null);
                    setChanged(false);
                  }}
                />
              )}
            />
            <p className="field-hint" id="profile-password-hint">
              8–20 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt; không có khoảng trắng.
            </p>
            {passwordErrors.length > 0 && (
              <ul className="field-error-list" id="profile-new-password-error" aria-label="Lỗi mật khẩu mới">
                {passwordErrors.map((message) => <li key={message}>{message}</li>)}
              </ul>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="profile-confirm-password">Xác nhận mật khẩu mới</label>
            <Controller
              name="confirmNewPassword"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  id="profile-confirm-password"
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu mới"
                  size="large"
                  status={errors.confirmNewPassword ? 'error' : undefined}
                  aria-invalid={Boolean(errors.confirmNewPassword)}
                  aria-describedby={errors.confirmNewPassword ? 'profile-confirm-password-error' : undefined}
                  onChange={(event) => {
                    field.onChange(event);
                    if (errors.confirmNewPassword) void trigger('confirmNewPassword');
                    setChanged(false);
                  }}
                />
              )}
            />
            {errors.confirmNewPassword?.message && (
              <p className="field-error" id="profile-confirm-password-error" role="alert">
                {errors.confirmNewPassword.message}
              </p>
            )}
          </div>

          <div className="profile-password-form__actions">
            <Link to="/profile">Quay lại hồ sơ</Link>
            <Button type="primary" htmlType="submit" size="large" loading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? 'Đang cập nhật…' : 'Đổi mật khẩu'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
