import type { ThemeConfig } from 'antd';

export const userAntdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#6C4DFF',
    colorSuccess: '#C8FF3D',
    colorWarning: '#FFF1C2',
    colorError: '#9B1C31',
    colorBgBase: '#FFFFFF',
    colorTextBase: '#14112B',
    fontFamily: "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: 24,
    borderRadiusSM: 14,
    borderRadiusLG: 28,
    lineWidth: 2,
    colorBorder: '#14112B',
  },
  components: {
    Button: {
      borderRadius: 9999,
      controlHeight: 48,
      fontWeight: 600,
      fontFamily: "'Be Vietnam Pro', sans-serif",
      defaultBorderColor: '#14112B',
      defaultColor: '#14112B',
      primaryShadow: 'none',
    },
    Input: {
      borderRadius: 9999,
      controlHeight: 48,
      colorBorder: '#14112B',
      activeBorderColor: '#6C4DFF',
      hoverBorderColor: '#6C4DFF',
    },
    Modal: {
      borderRadiusLG: 32,
      contentBg: '#FFFFFF',
    },
    Drawer: {
      colorBgElevated: '#FFFFFF',
    },
    Badge: {
      borderRadius: 14,
      fontFamily: "'Be Vietnam Pro', sans-serif",
    },
    Tabs: {
      colorPrimary: '#6C4DFF',
      itemSelectedColor: '#14112B',
      fontFamily: "'Be Vietnam Pro', sans-serif",
    },
  },
};
