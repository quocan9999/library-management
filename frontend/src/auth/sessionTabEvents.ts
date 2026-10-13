export const SESSION_TAB_EVENT_KEY = 'library:session-tab-event';
export type SessionTabEvent = 'password-reset' | 'signed-in' | 'email-verified';

function readEvent(): string | null {
  try {
    return localStorage.getItem(SESSION_TAB_EVENT_KEY);
  } catch {
    return null;
  }
}

export function publishSessionTabEvent(type: SessionTabEvent): void {
  try {
    // Chỉ lưu tín hiệu; không chia sẻ token, email hay mật khẩu giữa các tab.
    localStorage.setItem(SESSION_TAB_EVENT_KEY, JSON.stringify({ type, id: crypto.randomUUID() }));
  } catch {
    // Storage bị chặn không được làm thất bại thao tác đã thành công trên server.
  }
}

export function subscribeToSessionTabEvents(listener: (type: SessionTabEvent) => void): () => void {
  let lastSeen = readEvent();
  const receive = (value: string | null) => {
    if (!value || value === lastSeen) return;
    let type: unknown;
    try {
      type = JSON.parse(value).type;
    } catch {
      return;
    }
    if (type !== 'password-reset' && type !== 'signed-in' && type !== 'email-verified') return;
    // Tab nền sẽ khôi phục phiên khi người dùng quay lại, tránh refresh đồng thời.
    if (type === 'signed-in' && document.visibilityState === 'hidden') return;
    lastSeen = value;
    listener(type);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === SESSION_TAB_EVENT_KEY) receive(event.newValue);
  };
  const onFocus = () => receive(readEvent());
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onFocus);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onFocus);
  };
}
