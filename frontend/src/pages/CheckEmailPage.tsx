import { Link, useLocation } from 'react-router-dom';
import { readRegistrationCooldownSeconds, readRegistrationEmail, saveRegistrationEmail } from '../auth/registrationStorage';
import { AuthLayout } from '../components/AuthLayout';
import { ResendVerificationForm } from './ResendVerificationForm';

export function CheckEmailPage() {
  const email = readRegistrationEmail();
  const state = useLocation().state as { registrationCooldownUntil?: number } | null;
  const deadline = state?.registrationCooldownUntil;
  const initialCooldownSeconds = Math.max(readRegistrationCooldownSeconds(),
    typeof deadline === 'number' && Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0);

  return (
    <AuthLayout ariaLabel="Kiểm tra email xác thực" centered>
      <div className="login-content auth-flow-content">
        <h1>Kiểm tra email</h1>
        <p className="login-intro">
          Tài khoản đã được đăng ký. Hãy kiểm tra hộp thư và mở liên kết xác thực trong vòng 30 phút.
        </p>
        {email && (
          <p className="check-email-address">
            Email đăng ký: <strong>{email}</strong>
          </p>
        )}
        <ResendVerificationForm
          inlineResend
          initialCooldownSeconds={initialCooldownSeconds}
          initialEmail={email ?? ''}
          hideEmailField={Boolean(email)}
          onRequested={(requestedEmail) => saveRegistrationEmail(requestedEmail, 60)}
        />
        <p className="auth-alternate"><Link to="/login">Quay lại đăng nhập</Link></p>
      </div>
    </AuthLayout>
  );
}
