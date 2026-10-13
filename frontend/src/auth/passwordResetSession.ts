import axios from 'axios';
import { authApi } from './api';
import { getAccessToken, setAccessToken } from './tokenStore';

export async function clearRevokedSessionAfterReset(isCurrent = () => true): Promise<boolean> {
  const token = getAccessToken();
  if (!token) return false;
  try {
    await authApi.validateSession(token);
  } catch (error) {
    if (!isCurrent() || getAccessToken() !== token || !axios.isAxiosError(error)) return false;
    const status = error.response?.status;
    if (status === 401 && error.response?.data?.code === 'AUTH_TOKEN_EXPIRED') {
      // Hết TTL không chứng minh phiên bị reset. Chỉ nhận token refresh của cùng account.
      try {
        const result = await authApi.restoreSession();
        if (!isCurrent() || getAccessToken() !== token) return false;
        const user = await authApi.validateSession(result.accessToken);
        const payload = token.split('.')[1];
        const subject = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).sub;
        if (isCurrent() && getAccessToken() === token && String(user.id) === subject) {
          setAccessToken(result.accessToken);
        }
      } catch (refreshError) {
        if (isCurrent() && getAccessToken() === token && axios.isAxiosError(refreshError)
            && refreshError.response?.status === 401) {
          setAccessToken(null);
          return true;
        }
      }
      return false;
    }
    const disabled = status === 403 && error.response?.data?.code === 'AUTH_ACCOUNT_DISABLED';
    if (status === 401 || disabled) {
      setAccessToken(null);
      return true;
    }
  }
  return false;
}
