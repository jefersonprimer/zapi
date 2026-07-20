import { create } from "zustand";
import type { SaleType } from "@/services/deliveryApi";

export interface CartAddon {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  /** Units for sale_type=unit; kilograms for sale_type=weight */
  quantity: number;
  saleType: SaleType;
  observation?: string;
  image?: string;
  addons: CartAddon[];
}

interface CartState {
  storeId: string | null;
  storeName: string | null;
  items: CartItem[];
  couponCode: string | null;
  discount: number;
  addItem: (
    storeId: string,
    storeName: string,
    item: CartItem
  ) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateObservation: (productId: string, observation: string) => void;
  updateItemAddons: (productId: string, addons: CartAddon[]) => void;
  setCoupon: (code: string | null, discount: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

const WEIGHT_STEP = 0.1;
const MIN_WEIGHT = 0.1;

function normalizeQuantity(saleType: SaleType, quantity: number): number {
  if (saleType === "weight") {
    const rounded = Math.round(quantity * 10) / 10;
    return Math.max(MIN_WEIGHT, rounded);
  }
  return Math.max(1, Math.round(quantity));
}

export const useCartStore = create<CartState>((set, get) => ({
  storeId: null,
  storeName: null,
  items: [],
  couponCode: null,
  discount: 0,

  addItem: (storeId, storeName, item) => {
    const saleType = item.saleType || "unit";
    const quantity = normalizeQuantity(saleType, item.quantity || (saleType === "weight" ? MIN_WEIGHT : 1));
    const current = get();

    if (current.storeId && current.storeId !== storeId) {
      set({
        storeId,
        storeName,
        items: [{ ...item, saleType, quantity, addons: item.addons || [] }],
        couponCode: null,
        discount: 0,
      });
      return;
    }

    const addonsKey = JSON.stringify((item.addons || []).map((a) => a.id).sort());
    const existing = current.items.find((i) => {
      if (i.productId !== item.productId) return false;
      const existingKey = JSON.stringify(i.addons.map((a) => a.id).sort());
      return existingKey === addonsKey;
    });

    if (existing) {
      const nextQty =
        saleType === "weight"
          ? normalizeQuantity("weight", existing.quantity + quantity)
          : existing.quantity + quantity;
      set({
        storeId,
        storeName,
        items: current.items.map((i) =>
          i === existing ? { ...i, quantity: nextQty } : i
        ),
      });
    } else {
      set({
        storeId,
        storeName,
        items: [
          ...current.items,
          { ...item, saleType, quantity, addons: item.addons || [] },
        ],
      });
    }
  },

  removeItem: (productId) => {
    const items = get().items.filter((i) => i.productId !== productId);
    if (items.length === 0) {
      set({ storeId: null, storeName: null, items: [], couponCode: null, discount: 0 });
    } else {
      set({ items });
    }
  },

  updateQuantity: (productId, quantity) => {
    const item = get().items.find((i) => i.productId === productId);
    if (!item) return;

    const saleType = item.saleType || "unit";
    if (saleType === "weight") {
      if (quantity < MIN_WEIGHT - 0.001) {
        get().removeItem(productId);
        return;
      }
      set({
        items: get().items.map((i) =>
          i.productId === productId
            ? { ...i, quantity: normalizeQuantity("weight", quantity) }
            : i
        ),
      });
      return;
    }

    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set({
      items: get().items.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.round(quantity) } : i
      ),
    });
  },

  updateObservation: (productId, observation) => {
    set({
      items: get().items.map((i) =>
        i.productId === productId ? { ...i, observation } : i
      ),
    });
  },

  updateItemAddons: (productId, addons) => {
    set({
      items: get().items.map((i) =>
        i.productId === productId ? { ...i, addons } : i
      ),
    });
  },

  setCoupon: (code, discount) => {
    set({ couponCode: code, discount });
  },

  clearCart: () => set({ storeId: null, storeName: null, items: [], couponCode: null, discount: 0 }),

  getSubtotal: () =>
    get().items.reduce((sum, item) => {
      const addonsTotal = item.addons.reduce((a, addon) => a + addon.price, 0);
      return sum + (item.price + addonsTotal) * item.quantity;
    }, 0),

  getTotal: () => {
    const subtotal = get().getSubtotal();
    return Math.max(0, subtotal - get().discount);
  },

  getItemCount: () =>
    get().items.reduce((sum, item) => {
      if (item.saleType === "weight") return sum + 1;
      return sum + item.quantity;
    }, 0),
}));

export { WEIGHT_STEP, MIN_WEIGHT };
