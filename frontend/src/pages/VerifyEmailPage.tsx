import { Alert, Button } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../auth/api';
import { getVerificationError, type VerificationErrorState } from '../auth/messages';
import { clearRegistrationEmail, readRegistrationEmail } from '../auth/registrationStorage';
import { AuthLayout } from '../components/AuthLayout';
import { ResendVerificationForm } from './ResendVerificationForm';

type VerificationStatus = 'checking' | 'success' | 'missing' | VerificationErrorState;
type VerificationResult = { requestKey: string; status: VerificationStatus };

const verificationCopy: Record<Exclude<VerificationStatus, 'checking' | 'success' | 'unavailable'>, string> = {
  missing: 'Liên kết xác thực không hợp lệ.',
  invalid: 'Liên kết xác thực không hợp lệ.',
  expired: 'Liên kết xác thực đã hết hạn.',
  used: 'Liên kết xác thực này đã được sử dụng.',
  revoked: 'Liên kết xác thực đã được thay thế.',
};

const verificationRequests = new Map<string, Promise<void>>();
const pendingVerificationKeys = new Set<string>();

function verifyTokenOnce(rawToken: string): Promise<void> {
  const pending = verificationRequests.get(rawToken);
  if (pending) return pending;

  const request = authApi.verifyEmail(rawToken).finally(() => {
    if (verificationRequests.get(rawToken) === request) {
      verificationRequests.delete(rawToken);
    }
  });
  verificationRequests.set(rawToken, request);
  return request;
}

function requestVerification(rawToken: string): Promise<Exclude<VerificationStatus, 'checking' | 'missing'>> {
  return verifyTokenOnce(rawToken)
    .then(() => {
      clearRegistrationEmail();
      return 'success' as const;
    })
    .catch((error: unknown) => getVerificationError(error));
}

export function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const tokenFromUrl = new URLSearchParams(location.search).get('token');
  const navigationState = location.state as { verificationRequestKey?: string } | null;
  const requestKey = tokenFromUrl ? location.key : navigationState?.verificationRequestKey ?? null;
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [registrationEmail] = useState(readRegistrationEmail);
  const processedLocationKey = useRef<string | null>(null);
  const cleanupTarget = useRef<string | null>(null);
  const rawToken = useRef<string | null>(null);

  const status = result?.requestKey === requestKey
    ? result.status
    : tokenFromUrl || (requestKey && pendingVerificationKeys.has(requestKey))
      ? 'checking'
      : requestKey
        ? 'unavailable'
        : 'missing';

  useEffect(() => {
    const searchlessLocation = `${location.pathname}${location.hash}`;
    if (!location.search && cleanupTarget.current === searchlessLocation) {
      cleanupTarget.current = null;
      return;
    }
    if (processedLocationKey.current === location.key) return;
    processedLocationKey.current = location.key;

    if (!tokenFromUrl) return;

    rawToken.current = tokenFromUrl;
    pendingVerificationKeys.add(location.key);
    cleanupTarget.current = searchlessLocation;
    navigate(
      { pathname: location.pathname, search: '', hash: location.hash },
      { replace: true, state: { verificationRequestKey: location.key } },
    );
    void requestVerification(tokenFromUrl).then((resultStatus) => {
      pendingVerificationKeys.delete(location.key);
      setResult({ requestKey: location.key, status: resultStatus });
    });
  }, [location.hash, location.key, location.pathname, location.search, navigate, tokenFromUrl]);

  const retryVerification = () => {
    if (rawToken.current && requestKey) {
      pendingVerificationKeys.add(requestKey);
      setResult({ requestKey, status: 'checking' });
      void requestVerification(rawToken.current).then((resultStatus) => {
        pendingVerificationKeys.delete(requestKey);
        setResult({ requestKey, status: resultStatus });
      });
    }
  };
  const isTerminalError = status === 'missing' || status === 'invalid'
    || status === 'expired' || status === 'used' || status === 'revoked';

  return (
    <AuthLayout ariaLabel="Xác thực email tài khoản">
      <div className="login-content auth-flow-content">
        <p className="eyebrow">XÁC THỰC TÀI KHOẢN</p>
        <h1>{status === 'success' ? 'Email đã được xác thực' : 'Xác thực email'}</h1>

        {status === 'checking' && (
          <div className="auth-state" role="status" aria-live="polite">
            <span className="session-bootstrap__mark" aria-hidden="true" />
            <p>Đang kiểm tra liên kết xác thực…</p>
          </div>
        )}

        {status === 'success' && (
          <>
            <Alert
              className="login-alert"
              type="success"
              showIcon
              role="status"
              title="Email đã được xác thực thành công."
              description="Bây giờ bạn có thể đăng nhập bằng email và mật khẩu."
            />
            <Link className="login-submit auth-action-link" to="/login">Đăng nhập ngay</Link>
          </>
        )}

        {isTerminalError && (
          <>
            <Alert
              className="login-alert"
              type="error"
              showIcon
              role="alert"
              title={verificationCopy[status as keyof typeof verificationCopy]}
              description="Bạn có thể yêu cầu gửi lại hướng dẫn xác thực bên dưới."
            />
            <ResendVerificationForm initialEmail={registrationEmail ?? ''} />
            <p className="auth-alternate"><Link to="/login">Quay lại đăng nhập</Link></p>
          </>
        )}

        {status === 'unavailable' && (
          <>
            <Alert
              className="login-alert"
              type="warning"
              showIcon
              role="alert"
              title="Không thể kết nối để xác thực email. Vui lòng thử lại."
              description="Email chưa được xác nhận. Hãy thử lại hoặc yêu cầu gửi email xác thực mới."
            />
            <Button
              className="login-submit"
              type="primary"
              size="large"
              block
              onClick={retryVerification}
            >
              Thử lại
            </Button>
            <ResendVerificationForm initialEmail={registrationEmail ?? ''} />
            <p className="auth-alternate"><Link to="/login">Quay lại đăng nhập</Link></p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
