import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from './api';
import { subscribeToSessionTabEvents } from './sessionTabEvents';
import { setAccessToken } from './tokenStore';

export function SessionTabSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = useRef(location.pathname);
  pathname.current = location.pathname;

  useEffect(() => {
    let active = true;
    let generation = 0;
    const unsubscribe = subscribeToSessionTabEvents((type) => {
      const currentGeneration = ++generation;
      if (type === 'password-reset') {
        setAccessToken(null);
        if (pathname.current === '/forgot-password') navigate('/login', { replace: true });
        return;
      }
      if (pathname.current !== '/login' && pathname.current !== '/forgot-password') return;
      // Cookie HttpOnly được chia sẻ giữa các tab; xác minh phiên qua server như khi F5.
      void authApi.restoreSession().then((result) => {
        if (!active || currentGeneration !== generation) return;
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
