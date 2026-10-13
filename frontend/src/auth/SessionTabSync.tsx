import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from './api';
import { subscribeToSessionTabEvents } from './sessionTabEvents';
import { clearRevokedSessionAfterReset } from './passwordResetSession';
import { getAccessToken, setAccessToken } from './tokenStore';

export function SessionTabSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = useRef(location.pathname);
  pathname.current = location.pathname;

  useEffect(() => {
    let active = true;
    let generation = 0;
    const unsubscribe = subscribeToSessionTabEvents((type) => {
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
  }, [navigate]);
  return null;
}
