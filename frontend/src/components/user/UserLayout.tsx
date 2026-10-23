import React, { createContext, useContext, useState, useEffect } from 'react';
import { ConfigProvider, App } from 'antd';
import { Outlet, useNavigate } from 'react-router-dom';
import { userAntdTheme } from './userAntdTheme';
import { UserHeader } from './UserHeader';
import { UserCartDrawer, type UserCartItem } from './UserCartDrawer';
import { useAuth } from '../../auth/AuthContext';
import './userTheme.css';

// Context for managing user cart across reader pages
export interface UserCartContextType {
  cartItems: UserCartItem[];
  addToCart: (item: UserCartItem) => boolean;
  removeFromCart: (id: number | string) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  openCart: () => void;
  closeCart: () => void;
}

export const UserCartContext = createContext<UserCartContextType | undefined>(undefined);

export const useUserCart = (): UserCartContextType => {
  const context = useContext(UserCartContext);
  if (!context) {
    throw new Error('useUserCart must be used within a UserLayout');
  }
  return context;
};

const CART_STORAGE_KEY = 'libby_user_cart_items';

const UserLayoutContent: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { message } = App.useApp();
  const navigate = useNavigate();

  // Load cart items from sessionStorage
  const [cartItems, setCartItems] = useState<UserCartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // ignore
    }
  }, [cartItems]);

  const addToCart = (item: UserCartItem): boolean => {
    if (cartItems.some((ci) => String(ci.id) === String(item.id))) {
      message.warning('Sách này đã có trong giỏ mượn');
      return false;
    }
    if (cartItems.length >= 3) {
      message.warning('Mỗi lượt mượn trực tuyến tối đa 3 đầu sách');
      return false;
    }
    setCartItems((prev) => [...prev, item]);
    return true;
  };

  const removeFromCart = (id: number | string) => {
    setCartItems((prev) => prev.filter((item) => String(item.id) !== String(id)));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    }
  };

  const displayName = currentUser?.username || currentUser?.email || 'Độc giả';
  const userInitial = displayName.trim().charAt(0).toUpperCase() || 'Đ';

  return (
    <UserCartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        openCart: () => setIsCartOpen(true),
        closeCart: () => setIsCartOpen(false),
      }}
    >
      <div className="user-site">
        <UserHeader
          cartCount={cartItems.length}
          onOpenCart={() => setIsCartOpen(true)}
          userFullName={displayName}
          userEmail={currentUser?.email || ''}
          userInitial={userInitial}
          onLogout={handleLogout}
        />

        <main
          style={{
            flex: 1,
            width: '100%',
            maxWidth: '1280px',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          <Outlet />
        </main>

        <UserCartDrawer
          open={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          items={cartItems}
          onRemoveItem={removeFromCart}
          onCheckout={() => {
            setIsCartOpen(false);
            navigate('/borrow-payment/cart');
          }}
        />
      </div>
    </UserCartContext.Provider>
  );
};

export const UserLayout: React.FC = () => {
  return (
    <ConfigProvider theme={userAntdTheme}>
      <App>
        <UserLayoutContent />
      </App>
    </ConfigProvider>
  );
};
