import '@fontsource-variable/inter';
import 'antd/dist/reset.css';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { AuthProvider } from './auth/AuthContext';
import { AppNotificationProvider } from './components/AppNotificationProvider';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#1a2b49',
          colorError: '#b91c1c',
          colorText: '#181d27',
          colorTextSecondary: '#566072',
          colorBorder: '#cbd5e1',
          colorBgContainer: '#ffffff',
          fontFamily: "'Inter Variable', Inter, ui-sans-serif, system-ui, sans-serif",
          borderRadius: 4,
          controlHeight: 52,
          controlOutline: 'rgba(197, 155, 39, 0.2)',
        },
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <AppNotificationProvider>
            <App />
          </AppNotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
);
