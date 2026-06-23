import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_KEY = 'clintpos_cart';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  barcode?: string;
};

// Simple event system for cross-component cart sync
type CartListener = (cart: CartItem[]) => void;
const listeners: Set<CartListener> = new Set();
let globalCart: CartItem[] = [];

function notifyListeners() {
  listeners.forEach((listener) => listener([...globalCart]));
}

async function persistCart() {
  try {
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(globalCart));
  } catch {}
}

async function loadCart() {
  try {
    const data = await AsyncStorage.getItem(CART_KEY);
    if (data) {
      globalCart = JSON.parse(data);
      notifyListeners();
    }
  } catch {}
}

// Initialize on import
loadCart();

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>(globalCart);

  useEffect(() => {
    const listener = (newCart: CartItem[]) => setCart(newCart);
    listeners.add(listener);
    // Sync immediately
    setCart([...globalCart]);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const addToCart = useCallback((item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    const existing = globalCart.find((i) => i.id === item.id);
    if (existing) {
      globalCart = globalCart.map((i) =>
        i.id === item.id ? { ...i, quantity: i.quantity + (item.quantity || 1) } : i
      );
    } else {
      globalCart = [...globalCart, { ...item, quantity: item.quantity || 1 } as CartItem];
    }
    notifyListeners();
    persistCart();
  }, []);

  const removeFromCart = useCallback((id: string) => {
    const item = globalCart.find((i) => i.id === id);
    if (!item) return;
    if (item.quantity <= 1) {
      globalCart = globalCart.filter((i) => i.id !== id);
    } else {
      globalCart = globalCart.map((i) =>
        i.id === id ? { ...i, quantity: i.quantity - 1 } : i
      );
    }
    notifyListeners();
    persistCart();
  }, []);

  const removeItemCompletely = useCallback((id: string) => {
    globalCart = globalCart.filter((i) => i.id !== id);
    notifyListeners();
    persistCart();
  }, []);

  const clearCart = useCallback(() => {
    globalCart = [];
    notifyListeners();
    persistCart();
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      globalCart = globalCart.filter((i) => i.id !== id);
    } else {
      globalCart = globalCart.map((i) =>
        i.id === id ? { ...i, quantity } : i
      );
    }
    notifyListeners();
    persistCart();
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return {
    cart,
    addToCart,
    removeFromCart,
    removeItemCompletely,
    clearCart,
    updateQuantity,
    cartCount,
    cartTotal,
  };
}
