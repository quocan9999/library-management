import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../../auth/api';
import { logoutAndClearAccessToken } from '../../auth/logout';
import { getAccessToken, setAccessToken } from '../../auth/tokenStore';

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
});

describe('logoutAndClearAccessToken', () => {
  it('clears the token only after successful logout', async () => {
    setAccessToken('original-token');
    const logout = vi.spyOn(authApi, 'logout').mockResolvedValue(undefined);

    await expect(logoutAndClearAccessToken()).resolves.toBeUndefined();

    expect(logout).toHaveBeenCalledWith('original-token');
    expect(getAccessToken()).toBeNull();
  });

  it('preserves the token and propagates a logout failure', async () => {
    setAccessToken('original-token');
    const failure = new Error('Network error');
    vi.spyOn(authApi, 'logout').mockRejectedValue(failure);

    await expect(logoutAndClearAccessToken()).rejects.toBe(failure);
    expect(getAccessToken()).toBe('original-token');
  });

  it('keeps the token while the logout request is pending', async () => {
    setAccessToken('original-token');
    let finishLogout!: () => void;
    const pending = new Promise<void>((resolve) => {
      finishLogout = resolve;
    });
    vi.spyOn(authApi, 'logout').mockReturnValue(pending);

    const task = logoutAndClearAccessToken();
    expect(getAccessToken()).toBe('original-token');

    finishLogout();
    await task;
    expect(getAccessToken()).toBeNull();
  });
});
