import type { ThemeConfig } from 'antd';

export const userAntdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#6C4DFF',
    colorSuccess: '#1F7A3A',
    colorWarning: '#B26A00',
    colorError: '#9B1C31',
    colorBgBase: '#FFFFFF',
    colorTextBase: '#14112B',
    fontFamily: "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: 12,
    borderRadiusSM: 8,
    borderRadiusLG: 16,
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
    Select: {
      controlHeight: 48,
      borderRadius: 9999,
      colorBorder: '#14112B',
      activeBorderColor: '#6C4DFF',
      hoverBorderColor: '#6C4DFF',
    },
    DatePicker: {
      controlHeight: 48,
      borderRadius: 9999,
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
    Card: {
      borderRadiusLG: 24,
    },
    Badge: {
      fontFamily: "'Be Vietnam Pro', sans-serif",
    },
    Tabs: {
      colorPrimary: '#6C4DFF',
      itemSelectedColor: '#14112B',
      fontFamily: "'Be Vietnam Pro', sans-serif",
    },
    Pagination: {
      colorPrimary: '#6C4DFF',
      itemActiveBg: '#6C4DFF',
      colorPrimaryHover: '#6C4DFF',
      borderRadius: 9999,
      fontFamily: "'Be Vietnam Pro', sans-serif",
    },
  },
};
