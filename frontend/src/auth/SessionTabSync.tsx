import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { authApi } from './api';
import { subscribeToSessionTabEvents } from './sessionTabEvents';
import { clearRevokedSessionAfterReset } from './passwordResetSession';
import { clearRegistrationEmail } from './registrationStorage';
import { getAccessToken, setAccessToken } from './tokenStore';
import { clearMemberListState } from '../features/members/listState';
import { useAppNotification } from '../components/AppNotificationProvider';

type SessionRevocationNotice = {
  type: 'warning' | 'error';
  key: string;
  title: string;
  description: string;
  routeState: { accountDisabled?: boolean; accountRoleChanged?: boolean; sessionRevoked?: boolean };
};

function getSessionRevocationNotice(error: unknown): SessionRevocationNotice | null {
  if (!axios.isAxiosError<{ code?: string }>(error)) return null;
  const status = error.response?.status;
  const code = error.response?.data?.code;
  if (status === 401 && code === 'AUTH_ROLE_CHANGED') {
    return {
      type: 'warning',
      key: 'auth-role-changed',
      title: 'Nhóm quyền đã thay đổi',
      description: 'Nhóm quyền của tài khoản đã thay đổi. Vui lòng đăng nhập lại để tiếp tục.',
      routeState: { accountRoleChanged: true },
    };
  }
  if (status === 403 && code === 'AUTH_ACCOUNT_DISABLED') {
    return {
      type: 'error',
      key: 'auth-account-disabled',
      title: 'Tài khoản đã bị vô hiệu hóa',
      description: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.',
      routeState: { accountDisabled: true },
    };
  }
  if (status === 401 && code !== 'AUTH_TOKEN_EXPIRED') {
    return {
      type: 'warning',
      key: 'auth-session-revoked',
      title: 'Phiên đăng nhập đã kết thúc',
      description: 'Phiên đăng nhập này không còn hiệu lực. Vui lòng đăng nhập lại.',
      routeState: { sessionRevoked: true },
    };
  }
  return null;
}

export function SessionTabSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const { notify } = useAppNotification();
  const pathname = useRef(location.pathname);
  useLayoutEffect(() => {
    pathname.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    let generation = 0;
    const unsubscribe = subscribeToSessionTabEvents((type) => {
      if (type === 'email-verified') {
        if (pathname.current === '/check-email') {
          generation += 1;
          clearRegistrationEmail();
          navigate('/login', { replace: true });
        }
        return;
      }
      if (type === 'password-reset') {
        const currentGeneration = ++generation;
        if (pathname.current === '/forgot-password') navigate('/login', { replace: true });
        void clearRevokedSessionAfterReset(() => active && currentGeneration === generation).then((revoked) => {
          if (revoked && active && currentGeneration === generation && pathname.current !== '/reset-password') {
            navigate('/login', { replace: true });
          }
        });
        return;
      }
      if (type === 'session-revoked') {
        const token = getAccessToken();
        if (!token) return;
        const currentGeneration = ++generation;
        void authApi.validateSession(token).catch((error: unknown) => {
          if (!active || currentGeneration !== generation || getAccessToken() !== token) return;
          const notice = getSessionRevocationNotice(error);
          if (!notice) return;
          setAccessToken(null);
          clearMemberListState();
          notify(notice.type, {
            key: notice.key,
            title: notice.title,
            description: notice.description,
          });
          navigate('/login', { replace: true, state: notice.routeState });
        });
        return;
      }
      if (pathname.current !== '/login' && pathname.current !== '/forgot-password') return;
      const currentGeneration = ++generation;
      const previousToken = getAccessToken();
      // Cookie HttpOnly được chia sẻ giữa các tab; xác minh phiên qua server như khi F5.
      void authApi.restoreSession().then((result) => {
        if (!active || currentGeneration !== generation || getAccessToken() !== previousToken) return;
        if (pathname.current !== '/login' && pathname.current !== '/forgot-password') return;
        setAccessToken(result.accessToken);
        navigate('/', { replace: true });
      }).catch(() => undefined);
    });
    return () => {
      active = false;
      generation += 1;
      unsubscribe();
    };
  }, [navigate, notify]);
  return null;
}
