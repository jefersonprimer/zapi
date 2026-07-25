import React from "react";
import Image from "next/image";
import {
  Store as StoreIcon,
  Plus,
  Minus,
  Percent,
} from "lucide-react";
import { type StoreProduct } from "@/lib/api";
import { formatPrice, getImageUrl } from "@/lib/utils";

interface ProductDetailMainCardProps {
  product: StoreProduct;
  quantity?: number;
  onAddToCart: (product: StoreProduct) => void;
  onRemoveFromCart: (productId: string) => void;
}

export default function ProductDetailMainCard({
  product,
  quantity = 0,
  onAddToCart,
  onRemoveFromCart,
}: ProductDetailMainCardProps) {
  const hasDiscount =
    product.promotional_price != null &&
    product.promotional_price > 0 &&
    product.promotional_price < product.price;

  const discountPercent = hasDiscount
    ? Math.round(
        ((product.price - product.promotional_price!) / product.price) * 100,
      )
    : 0;

  return (
    <div className="bg-surface p-4 flex items-center justify-center rounded-xl">
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-10 items-center justify-center w-full max-w-4xl mx-auto">
        {/* Product Image */}
        <div className="relative h-64 w-64 sm:h-80 sm:w-80 overflow-hidden rounded-xl justify-self-center md:justify-self-end">
          {product.image ? (
            <Image
              src={getImageUrl(product.image)}
              alt={product.name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-text bg-muted/10">
              <StoreIcon className="h-16 w-16 opacity-30" />
            </div>
          )}

          {/* Promotional Discount Badge */}
          {hasDiscount && (
            <div className="absolute top-4 left-4 z-10 bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/40 font-bold text-xs px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
              <Percent className="h-3.5 w-3.5" />
              <span>-{discountPercent}% OFF</span>
            </div>
          )}
        </div>

        {/* Product Info & Actions */}
        <div className="flex flex-col justify-center space-y-6 w-full max-w-xl justify-self-center md:justify-self-start">
          <div>
            <h1 className="text-2xl sm:text-3xl font-medium text-foreground leading-tight">
              {product.name}
            </h1>

            {/* Price Section */}
            <div className="mt-4 flex items-baseline gap-3">
              {hasDiscount ? (
                <>
                  <span className="text-3xl font-bold text-foreground">
                    {formatPrice(product.promotional_price!)}
                  </span>
                  <span className="text-lg text-muted-text line-through">
                    {formatPrice(product.price)}
                  </span>
                </>
              ) : (
                <span className="text-3xl font-bold text-foreground">
                  {formatPrice(product.price)}
                </span>
              )}
              {product.sale_type === "weight" && (
                <span className="text-sm text-muted-text font-normal">
                  / kg
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="mt-4">
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}
          </div>

          {/* Quantity Controls & Add to Cart */}
          <div className="pt-4 border-t border-card-border flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto bg-background border border-card-border rounded-xl p-1.5">
              <button
                onClick={() => onRemoveFromCart(product.id)}
                disabled={quantity === 0}
                className="p-2 rounded-lg bg-surface border border-card-border hover:bg-card-border text-foreground transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="font-extrabold text-base px-3 min-w-8 text-center font-sans">
                {quantity}
              </span>
              <button
                onClick={() => onAddToCart(product)}
                className="p-2 rounded-lg bg-foreground text-background hover:opacity-90 transition-all cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => onAddToCart(product)}
              className="w-full sm:w-auto py-3.5 px-6 bg-foreground hover:opacity-90 active:scale-[0.99] text-background font-extrabold text-sm rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {quantity > 0
                  ? `Adicionar Mais (${quantity} na sacola)`
                  : "Adicionar à Sacola"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
