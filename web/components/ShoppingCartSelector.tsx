"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Store,
  Trash2,
  Minus,
  Plus,
  ChevronRight,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/utils";

export default function ShoppingCartSelector() {
  const {
    cart,
    cartStore,
    addToCart,
    removeFromCart,
    clearCart,
    cartCount,
    cartTotal,
  } = useCart();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex items-center justify-center h-9 w-9 rounded-full border border-card-border/60 bg-surface dark:bg-card-bg/60 hover:border-foreground/40 hover:shadow-sm transition-all cursor-pointer ${
          cartCount > 0
            ? "text-foreground border-foreground/30 bg-neutral-100 dark:bg-neutral-800"
            : "text-muted-text hover:text-foreground"
        }`}
        aria-label="Sacola de compras"
      >
        <ShoppingBag className="h-4.5 w-4.5" />
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-black dark:bg-white text-white dark:text-black text-[9px] font-bold flex items-center justify-center shadow-sm animate-pulse">
            {cartCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 rounded-2xl bg-surface dark:bg-card-bg border border-card-border/70 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-4 border-b border-card-border/40 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-foreground">
                Sua Sacola
              </span>
              {cartStore && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Store className="h-3 w-3 text-muted-text" />
                  <span className="text-[10px] text-muted-text font-medium truncate max-w-[160px]">
                    {cartStore.name}
                  </span>
                </div>
              )}
            </div>
            {cartCount > 0 && (
              <button
                onClick={clearCart}
                className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" /> Limpar
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto p-4 space-y-3.5">
            {cart.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-2.5">
                  <ShoppingBag className="h-5 w-5 text-muted-text/60" />
                </div>
                <span className="text-xs text-muted-text font-medium">
                  Sacola vazia
                </span>
                <span className="text-[10px] text-muted-text/60 mt-0.5">
                  Adicione itens de uma loja para começar
                </span>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex justify-between items-start gap-3"
                >
                  <div className="flex-grow min-w-0">
                    <span className="text-xs font-semibold text-foreground block truncate">
                      {item.product.name}
                    </span>
                    <span className="text-[10px] text-muted-text mt-0.5 block">
                      {formatPrice(
                        item.product.promotional_price &&
                          item.product.promotional_price > 0 &&
                          item.product.promotional_price <
                            item.product.price
                          ? item.product.promotional_price
                          : item.product.price,
                      )}
                    </span>
                  </div>

                  {/* Quantity buttons */}
                  <div className="flex items-center border border-card-border/60 rounded-full p-0.5 bg-neutral-50 dark:bg-neutral-900/40">
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-surface dark:hover:bg-card-bg text-muted-text hover:text-foreground cursor-pointer transition-colors"
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="text-[10px] font-bold text-foreground px-2 min-w-[16px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => addToCart(item.product, cartStore!)}
                      className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-surface dark:hover:bg-card-bg text-muted-text hover:text-foreground cursor-pointer transition-colors"
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && cartStore && (
            <div className="p-4 bg-neutral-50/50 dark:bg-neutral-900/20 border-t border-card-border/40">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-medium text-muted-text">
                  Subtotal
                </span>
                <span className="text-xs font-bold text-foreground">
                  {formatPrice(cartTotal)}
                </span>
              </div>
              <Link
                href="/checkout"
                onClick={() => setIsOpen(false)}
                className="w-full py-2.5 px-4 bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-[0.98] text-white dark:text-black text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all"
              >
                <span>Finalizar Pedido</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
