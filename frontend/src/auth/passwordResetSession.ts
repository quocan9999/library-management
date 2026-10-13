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
    const disabled = status === 403 && error.response?.data?.code === 'AUTH_ACCOUNT_DISABLED';
    if (status === 401 || disabled) {
      setAccessToken(null);
      return true;
    }
  }
  return false;
}
