"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Store, StoreProduct } from "./api";

export interface CartItem {
  product: StoreProduct;
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  cartStore: Store | null;
  addToCart: (product: StoreProduct, store: Store) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartStore, setCartStore] = useState<Store | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    let active = true;
    const init = async () => {
      let loadedCart: CartItem[] | null = null;
      let loadedStore: Store | null = null;
      try {
        const storedCart = localStorage.getItem("zapi_cart");
        const storedStore = localStorage.getItem("zapi_cart_store");
        if (storedCart) loadedCart = JSON.parse(storedCart);
        if (storedStore) loadedStore = JSON.parse(storedStore);
      } catch (err) {
        console.error("Failed to load cart from localStorage:", err);
      }
      await Promise.resolve();
      if (!active) return;
      if (loadedCart) setCart(loadedCart);
      if (loadedStore) setCartStore(loadedStore);
      setIsLoaded(true);
    };
    init();
    return () => {
      active = false;
    };
  }, []);

  // Save cart to localStorage when changed
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("zapi_cart", JSON.stringify(cart));
      if (cartStore) {
        localStorage.setItem("zapi_cart_store", JSON.stringify(cartStore));
      } else {
        localStorage.removeItem("zapi_cart_store");
      }
    } catch (err) {
      console.error("Failed to save cart to localStorage:", err);
    }
  }, [cart, cartStore, isLoaded]);

  const addToCart = (product: StoreProduct, store: Store) => {
    setCart((prev) => {
      const isDifferentStore = cartStore && cartStore.id !== store.id;
      
      if (isDifferentStore) {
        setCartStore(store);
        return [{ product, quantity: 1 }];
      }

      if (!cartStore) {
        setCartStore(store);
      }

      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === productId);
      
      let updatedCart: CartItem[];
      if (existing && existing.quantity > 1) {
        updatedCart = prev.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      } else {
        updatedCart = prev.filter((item) => item.product.id !== productId);
      }

      // If cart is empty, also clear the store
      if (updatedCart.length === 0) {
        setCartStore(null);
      }

      return updatedCart;
    });
  };

  const clearCart = () => {
    setCart([]);
    setCartStore(null);
  };

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotal = cart.reduce((acc, item) => {
    const price =
      item.product.promotional_price &&
      item.product.promotional_price > 0 &&
      item.product.promotional_price < item.product.price
        ? item.product.promotional_price
        : item.product.price;
    return acc + price * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        cartStore,
        addToCart,
        removeFromCart,
        clearCart,
        cartCount,
        cartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
