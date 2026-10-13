// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionTabSync } from '../../auth/SessionTabSync';
import { publishSessionTabEvent, SESSION_TAB_EVENT_KEY } from '../../auth/sessionTabEvents';
import { getAccessToken, setAccessToken } from '../../auth/tokenStore';

const mocks = vi.hoisted(() => ({ restoreSession: vi.fn(), validateSession: vi.fn() }));
vi.mock('../../auth/api', () => ({ authApi: mocks }));

function LocationProbe() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}
function mount(path = '/forgot-password') {
  render(<MemoryRouter initialEntries={[path]}><SessionTabSync /><LocationProbe /></MemoryRouter>);
}
function event(type: string) {
  const newValue = JSON.stringify({ type, id: crypto.randomUUID() });
  localStorage.setItem(SESSION_TAB_EVENT_KEY, newValue);
  window.dispatchEvent(new StorageEvent('storage', { key: SESSION_TAB_EVENT_KEY, newValue }));
}
afterEach(() => {
  cleanup();
  localStorage.clear();
  setAccessToken(null);
  vi.restoreAllMocks();
  mocks.restoreSession.mockReset();
  mocks.validateSession.mockReset();
});

describe('session synchronization between tabs', () => {
  it('silently redirects the old forgot tab to login after reset and clears a revoked token', async () => {
    setAccessToken('old-token');
    mocks.validateSession.mockRejectedValue({ isAxiosError: true, response: { status: 401 } });
    mount();
    await act(async () => event('password-reset'));
    expect(screen.getByTestId('path').textContent).toBe('/login');
    expect(getAccessToken()).toBeNull();
    expect(mocks.restoreSession).not.toHaveBeenCalled();
    expect(mocks.validateSession).toHaveBeenCalledWith('old-token');
  });

  it.each(['/admin/roles', '/profile'])('preserves another account session at %s when the backend accepts it', async (path) => {
    setAccessToken('account-B');
    mocks.validateSession.mockResolvedValue({ id: 2 });
    mount(path);
    await act(async () => event('password-reset'));
    expect(getAccessToken()).toBe('account-B');
    expect(screen.getByTestId('path').textContent).toBe(path);
    expect(mocks.validateSession).toHaveBeenCalledWith('account-B');
  });

  it('redirects a signed-in reset account to login after the backend rejects its token', async () => {
    setAccessToken('account-A');
    mocks.validateSession.mockRejectedValue({ isAxiosError: true, response: { status: 401 } });
    mount('/profile');
    await act(async () => event('password-reset'));
    expect(getAccessToken()).toBeNull();
    expect(screen.getByTestId('path').textContent).toBe('/login');
  });

  it('does not clear a valid session on a temporary backend failure', async () => {
    setAccessToken('account-B');
    mocks.validateSession.mockRejectedValue({ isAxiosError: true, response: { status: 503 } });
    mount('/profile');
    await act(async () => event('password-reset'));
    expect(getAccessToken()).toBe('account-B');
    expect(screen.getByTestId('path').textContent).toBe('/profile');
  });

  it('does not clear a newly installed token after a late validation rejection', async () => {
    let reject!: (error: unknown) => void;
    mocks.validateSession.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    setAccessToken('account-A');
    mount('/login');
    act(() => event('password-reset'));
    setAccessToken('account-B');
    await act(async () => reject({ isAxiosError: true, response: { status: 401 } }));
    expect(getAccessToken()).toBe('account-B');
  });

  it('does not cancel revoked-session validation for a sign-in event ignored on a protected route', async () => {
    let reject!: (error: unknown) => void;
    mocks.validateSession.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    setAccessToken('account-A');
    mount('/profile');
    act(() => event('password-reset'));
    act(() => event('signed-in'));
    await act(async () => reject({ isAxiosError: true, response: { status: 401 } }));
    expect(getAccessToken()).toBeNull();
    expect(screen.getByTestId('path').textContent).toBe('/login');
  });

  it('does not overwrite a local login with an older pending session restore', async () => {
    let resolve!: (result: { accessToken: string }) => void;
    mocks.restoreSession.mockImplementation(() => new Promise((done) => { resolve = done; }));
    mount('/login');
    act(() => event('signed-in'));
    setAccessToken('new-local-login');
    await act(async () => resolve({ accessToken: 'older-restored-session' }));
    expect(getAccessToken()).toBe('new-local-login');
  });

  it('keeps the reset success tab on its current page', () => {
    mount('/reset-password');
    act(() => event('password-reset'));
    expect(screen.getByTestId('path').textContent).toBe('/reset-password');
  });

  it('restores the server session and enters the app after sign-in elsewhere', async () => {
    mocks.restoreSession.mockResolvedValue({ accessToken: 'restored-token' });
    mount('/login');
    await act(async () => event('signed-in'));
    expect(getAccessToken()).toBe('restored-token');
    expect(screen.getByTestId('path').textContent).toBe('/');
  });

  it('defers session restore until a background tab becomes visible and processes it once', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    mocks.restoreSession.mockResolvedValue({ accessToken: 'restored-token' });
    mount();
    act(() => event('password-reset'));
    act(() => event('signed-in'));
    expect(mocks.restoreSession).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible');
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    act(() => window.dispatchEvent(new Event('focus')));
    expect(mocks.restoreSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('path').textContent).toBe('/');
  });

  it('stays on login if the shared cookie no longer represents a valid session', async () => {
    mocks.restoreSession.mockRejectedValue(new Error('expired'));
    mount('/login');
    await act(async () => event('signed-in'));
    expect(getAccessToken()).toBeNull();
    expect(screen.getByTestId('path').textContent).toBe('/login');
  });

  it('does not install a late restored token after a reset event', async () => {
    let resolve!: (result: { accessToken: string }) => void;
    mocks.restoreSession.mockImplementation(() => new Promise((done) => { resolve = done; }));
    mount();
    act(() => event('signed-in'));
    act(() => event('password-reset'));
    await act(async () => resolve({ accessToken: 'stale-token' }));
    expect(getAccessToken()).toBeNull();
    expect(screen.getByTestId('path').textContent).toBe('/login');
  });

  it('ignores unrelated storage events and removes listeners on unmount', async () => {
    mount();
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: '{}' })));
    cleanup();
    act(() => event('signed-in'));
    await waitFor(() => expect(mocks.restoreSession).not.toHaveBeenCalled());
  });

  it('publishes only an event type and unique identifier without sensitive data', () => {
    publishSessionTabEvent('password-reset');
    const value = JSON.parse(localStorage.getItem(SESSION_TAB_EVENT_KEY)!);
    expect(value.type).toBe('password-reset');
    expect(Object.keys(value).sort()).toEqual(['id', 'type']);
    expect(value.id).toBeTruthy();
  });
});
