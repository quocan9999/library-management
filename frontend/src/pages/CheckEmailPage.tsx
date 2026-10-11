import { Link } from 'react-router-dom';
import { readRegistrationEmail, saveRegistrationEmail } from '../auth/registrationStorage';
import { AuthLayout } from '../components/AuthLayout';
import { ResendVerificationForm } from './ResendVerificationForm';

export function CheckEmailPage() {
  const email = readRegistrationEmail();

  return (
    <AuthLayout ariaLabel="Kiểm tra email xác thực">
      <div className="login-content auth-flow-content">
        <p className="eyebrow">CHỈ CÒN MỘT BƯỚC</p>
        <h1>Kiểm tra email</h1>
        <p className="login-intro">
          Tài khoản đã được đăng ký. Hãy kiểm tra hộp thư và mở liên kết xác thực trong vòng 30 phút.
        </p>
        {email && (
          <p className="check-email-address">
            Email đăng ký: <strong>{email}</strong>
          </p>
        )}
        <p className="field-hint">
          Nếu chưa thấy thư, hãy kiểm tra thư rác hoặc yêu cầu gửi lại hướng dẫn.
        </p>
        <ResendVerificationForm
          initialEmail={email ?? ''}
          hideEmailField={Boolean(email)}
          onRequested={saveRegistrationEmail}
        />
        <p className="auth-alternate"><Link to="/login">Quay lại đăng nhập</Link></p>
      </div>
    </AuthLayout>
  );
}
