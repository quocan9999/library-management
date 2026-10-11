import { authApi } from './api';
import { getAccessToken, setAccessToken } from './tokenStore';

export async function logoutAndClearAccessToken(): Promise<void> {
  // Chờ backend xác nhận. Nếu request reject, không chạy dòng tiếp theo.
  await authApi.logout(getAccessToken());
  setAccessToken(null);
}
