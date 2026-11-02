import React, { createContext, useContext, useEffect, useState } from 'react';

import { CatalogBook } from '@/services/bookCatalogService';
import { storage } from '@/utils/storage';

const CART_STORAGE_KEY = 'libby_borrow_cart';
export const MAX_CART_ITEMS = 3;

interface AddToCartResult {
  success: boolean;
  message?: string;
}

interface CartContextType {
  items: CatalogBook[];
  itemCount: number;
  totalFee: number;
  totalDeposit: number;
  totalPayment: number;
  isCartOpen: boolean;
  addToCart: (book: CatalogBook) => AddToCartResult;
  removeFromCart: (bookId: number) => void;
  clearCart: () => void;
  isInCart: (bookId: number) => boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CatalogBook[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    const loadCart = async () => {
      try {
        const stored = await storage.getItem(CART_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as CatalogBook[];
          if (Array.isArray(parsed)) {
            setItems(parsed);
          }
        }
      } catch {
        // Ignored
      }
    };
    loadCart();
  }, []);

  const persistCart = async (newItems: CatalogBook[]) => {
    setItems(newItems);
    try {
      await storage.setItem(CART_STORAGE_KEY, JSON.stringify(newItems));
    } catch {
      // Ignored
    }
  };

  const addToCart = (book: CatalogBook): AddToCartResult => {
    if (items.some((item) => item.id === book.id)) {
      return { success: false, message: 'Sách này đã có trong giỏ mượn.' };
    }
    if (items.length >= MAX_CART_ITEMS) {
      return {
        success: false,
        message: `Mỗi lượt chỉ được mượn tối đa ${MAX_CART_ITEMS} đầu sách trực tuyến.`,
      };
    }
    if (book.availableQuantity <= 0) {
      return { success: false, message: 'Sách này hiện đã hết trong kho.' };
    }

    const nextItems = [...items, book];
    persistCart(nextItems);
    return { success: true, message: `Đã thêm "${book.title}" vào giỏ mượn.` };
  };

  const removeFromCart = (bookId: number) => {
    const nextItems = items.filter((item) => item.id !== bookId);
    persistCart(nextItems);
  };

  const clearCart = () => {
    persistCart([]);
  };

  const isInCart = (bookId: number) => {
    return items.some((item) => item.id === bookId);
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const totalFee = items.reduce((sum, item) => sum + (item.borrowFee || 0), 0);
  const totalDeposit = items.reduce((sum, item) => sum + (item.price || 0), 0);
  const totalPayment = totalFee + totalDeposit;

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount: items.length,
        totalFee,
        totalDeposit,
        totalPayment,
        isCartOpen,
        addToCart,
        removeFromCart,
        clearCart,
        isInCart,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
