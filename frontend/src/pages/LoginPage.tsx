import { Alert, Button, Input } from 'antd';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { loginSchema, type LoginForm } from '../auth/loginSchema';
import { getLoginError, mapLoginValidationErrors } from '../auth/messages';
import type { LoginCredentials } from '../auth/types';
import { BrandMark } from '../components/BrandMark';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<ReturnType<typeof getLoginError> | null>(null);
  const {
    control,
    handleSubmit,
    setError,
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
      setServerError(getLoginError(error));
    }
  };

  return (
    <main className="auth-stage">
      <section className="auth-card" aria-label="Đăng nhập hệ thống quản lý thư viện">
        <aside className="auth-rail">
          <BrandMark />
          <div className="bookplate-art" aria-hidden="true">
            <svg viewBox="0 0 420 330" fill="none">
              <path className="art-line art-line--soft" d="M60 252V132c0-67 55-122 122-122h56c67 0 122 55 122 122v120" />
              <path className="art-line" d="M90 252V139c0-50 41-91 91-91h58c50 0 91 41 91 91v113" />
              <path className="art-gold" d="M123 249V146c0-33 27-60 60-60h54c33 0 60 27 60 60v103" />
              <path className="art-gold art-line--thin" d="M210 86v162" />
              <path className="art-page" d="M126 185c28-7 57 1 84 22v42c-27-20-56-27-84-20v-44Z" />
              <path className="art-page art-page--right" d="M294 185c-28-7-57 1-84 22v42c27-20 56-27 84-20v-44Z" />
              <path className="art-line art-line--thin" d="M141 198c18-3 38 2 56 14M141 211c18-3 38 2 56 14M279 198c-18-3-38 2-56 14M279 211c-18-3-38 2-56 14" />
              <path className="art-floor" d="M74 270h272M105 283h210" />
              <circle className="art-star" cx="210" cy="24" r="3" />
              <path className="art-star" d="M210 12v7M210 29v7M198 24h7M215 24h7" />
              <path className="art-dot" d="M75 72v2M342 75v2M329 48v2M94 49v2" />
            </svg>
          </div>
          <div className="rail-copy">
            <p className="eyebrow eyebrow--light">KHÔNG GIAN LƯU GIỮ TRI THỨC</p>
            <h2>Tri thức luôn có nơi để trở về.</h2>
            <span className="gold-rule" aria-hidden="true" />
            <p className="rail-description">Nơi lưu giữ những câu chuyện, ý tưởng và kết nối bạn đọc.</p>
          </div>
          <p className="rail-footnote">PHÒNG ĐỌC DÀNH CHO MỌI THẾ HỆ</p>
        </aside>

        <div className="auth-main">
          <div className="mobile-brand"><BrandMark compact /></div>
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
          <p className="auth-footer">HỆ THỐNG QUẢN LÝ THƯ VIỆN <span aria-hidden="true">·</span> TRI THỨC DÀNH CHO MỌI THẾ HỆ</p>
        </div>
      </section>
    </main>
  );
}
