import { Alert, Button, Input } from 'antd';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../auth/AuthContext';
import type { ApiEnvelope, LoginCredentials } from '../auth/types';
import { BrandMark } from '../components/BrandMark';

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username.'),
  password: z.string().min(1, 'Enter your password.'),
});

type LoginForm = z.infer<typeof loginSchema>;

function loginErrorMessage(error: unknown): string {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
    return 'Sign-in is temporarily unavailable. Please try again.';
  }

  if (!error.response) {
    return 'We could not reach the library service. Check your connection and try again.';
  }

  switch (error.response.data?.code) {
    case 'AUTH_INVALID_CREDENTIALS':
      return 'That email or username and password do not match.';
    case 'AUTH_ACCOUNT_DISABLED':
      return 'This account is currently disabled. Please contact your library administrator.';
    default:
      return 'Sign-in is temporarily unavailable. Please try again.';
  }
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
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
      const response = axios.isAxiosError<ApiEnvelope<unknown>>(error) ? error.response?.data : null;
      if (response?.code === 'VALIDATION_ERROR' && response.errors) {
        let hasFieldError = false;
        for (const field of ['identifier', 'password'] as const) {
          const message = response.errors[field];
          if (message) {
            setError(field, { type: 'server', message });
            hasFieldError = true;
          }
        }
        if (hasFieldError) return;
      }
      setServerError(loginErrorMessage(error));
    }
  };

  return (
    <main className="auth-stage">
      <section className="auth-card" aria-label="Library Management sign in">
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
            <p className="eyebrow eyebrow--light">A QUIETER KIND OF ORDER</p>
            <h2>Knowledge finds its way home.</h2>
            <span className="gold-rule" aria-hidden="true" />
            <p className="rail-description">A thoughtful space for the stories, ideas, and people in your library.</p>
          </div>
          <p className="rail-footnote">A READING ROOM FOR EVERY GENERATION</p>
        </aside>

        <div className="auth-main">
          <div className="mobile-brand"><BrandMark compact /></div>
          <div className="login-content">
            <p className="eyebrow">MEMBER ACCESS</p>
            <h1>Welcome back</h1>
            <p className="login-intro">Sign in to open your library workspace.</p>

            <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
              {serverError && (
                <Alert
                  className="login-alert"
                  type="error"
                  showIcon
                  role="alert"
                  title={serverError}
                />
              )}

              <div className="form-field">
                <label htmlFor="identifier">Email or username</label>
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
                      placeholder="you@example.com or username"
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
                <label htmlFor="password">Password</label>
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <Input.Password
                      {...field}
                      id="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
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
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="privacy-note">
              <span className="privacy-note__icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none">
                  <rect x="4.25" y="8.5" width="11.5" height="8.25" rx="1.5" />
                  <path d="M6.75 8.5V6.25a3.25 3.25 0 0 1 6.5 0V8.5M10 11.5v2.25" />
                </svg>
              </span>
              Your sign-in is protected and private.
            </p>
          </div>
          <p className="auth-footer">LIBRARY MANAGEMENT <span aria-hidden="true">·</span> YOUR READING ROOM, REIMAGINED</p>
        </div>
      </section>
    </main>
  );
}
