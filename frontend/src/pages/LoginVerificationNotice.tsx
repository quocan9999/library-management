import { Alert } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authApi } from '../auth/api';
import { getResendError } from '../auth/messages';

export function LoginVerificationNotice({ identifier }: { identifier: string }) {
  const [sending, setSending] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const deadline = useRef(0);
  const inFlight = useRef(false);
  const automaticIdentifier = useRef<string | null>(null);

  const send = useCallback(async () => {
    if (inFlight.current || Date.now() < deadline.current) return;
    inFlight.current = true;
    setSending(true);
    setRequested(false);
    setError(null);
    try {
      await authApi.resendLoginVerification(identifier);
      setRequested(true);
      deadline.current = Date.now() + 60_000;
      setSeconds(60);
    } catch (failure) {
      const copy = getResendError(failure);
      setError(copy.description);
      if (copy.retryAfterSeconds) {
        deadline.current = Date.now() + copy.retryAfterSeconds * 1000;
        setSeconds(copy.retryAfterSeconds);
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }, [identifier]);

  useEffect(() => {
    // StrictMode có thể chạy lại effect; mỗi lần hiển thị chỉ gửi tự động một yêu cầu.
    if (automaticIdentifier.current === identifier) return;
    automaticIdentifier.current = identifier;
    void send();
  }, [identifier, send]);

  const coolingDown = seconds > 0;
  useEffect(() => {
    if (!coolingDown) return;
    const timer = window.setInterval(() => {
      setSeconds(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [coolingDown]);

  return <Alert
    className="login-alert"
    type="warning"
    showIcon
    title="Tài khoản này chưa xác thực email"
    description={<>
      <p>{sending ? 'Đang yêu cầu gửi lại email xác thực…' : requested
        ? 'Chúng tôi đã gửi email với đường link xác thực email. Hãy vào hộp thư để kiểm tra.'
        : 'Hãy xác thực email trước khi đăng nhập.'}</p>
      <p>Không thấy email? Hãy kiểm tra hộp thư spam hoặc{' '}
        <button className="password-recovery-resend" type="button" disabled={sending || coolingDown} onClick={() => void send()}>
          {sending ? 'đang gửi lại…' : coolingDown ? `gửi lại trong ${seconds}s` : 'gửi lại'}
        </button>.
      </p>
      {error && <p className="field-error" role="alert">{error}</p>}
    </>}
  />;
}
