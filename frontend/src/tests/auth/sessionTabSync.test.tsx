// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionTabSync } from '../../auth/SessionTabSync';
import { publishSessionTabEvent, SESSION_TAB_EVENT_KEY } from '../../auth/sessionTabEvents';
import { getAccessToken, setAccessToken } from '../../auth/tokenStore';

const mocks = vi.hoisted(() => ({ restoreSession: vi.fn() }));
vi.mock('../../auth/api', () => ({ authApi: { restoreSession: mocks.restoreSession } }));

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
});

describe('session synchronization between tabs', () => {
  it('silently redirects the old forgot tab to login after reset and clears its token', () => {
    setAccessToken('old-token');
    mount();
    act(() => event('password-reset'));
    expect(screen.getByTestId('path').textContent).toBe('/login');
    expect(getAccessToken()).toBeNull();
    expect(mocks.restoreSession).not.toHaveBeenCalled();
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
