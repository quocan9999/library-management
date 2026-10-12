import { createContext, useCallback, useContext, useMemo, type PropsWithChildren } from 'react';
import { notification } from 'antd';

export type AppNotificationType = 'success' | 'warning' | 'error';

export interface AppNotificationOptions {
  title: string;
  description: string;
  key?: string;
}

interface AppNotificationContextValue {
  notify: (type: AppNotificationType, options: AppNotificationOptions) => void;
  dismiss: (key: string) => void;
}

const fallbackContext: AppNotificationContextValue = {
  notify: () => undefined,
  dismiss: () => undefined,
};

const AppNotificationContext = createContext(fallbackContext);

/** Cung cấp notification theo ngữ cảnh Ant Design cho toàn ứng dụng. */
export function AppNotificationProvider({ children }: PropsWithChildren) {
  const [api, contextHolder] = notification.useNotification({ placement: 'topRight' });
  const notify = useCallback((type: AppNotificationType, options: AppNotificationOptions) => {
    api[type](options);
  }, [api]);
  const dismiss = useCallback((key: string) => api.destroy(key), [api]);
  const value = useMemo(() => ({ notify, dismiss }), [dismiss, notify]);

  return (
    <AppNotificationContext.Provider value={value}>
      {contextHolder}
      {children}
    </AppNotificationContext.Provider>
  );
}

/** Trả về API notification success, warning và error dùng chung. */
export function useAppNotification() {
  return useContext(AppNotificationContext);
}
