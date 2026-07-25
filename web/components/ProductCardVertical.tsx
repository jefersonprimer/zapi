import React from "react";
import Image from "next/image";
import { Store as StoreIcon, Plus, Minus, Percent } from "lucide-react";
import { type StoreProduct } from "@/lib/api";
import { formatPrice, getImageUrl } from "@/lib/utils";

interface ProductCardVerticalProps {
  product: StoreProduct;
  quantity?: number;
  isCurrent?: boolean;
  onSelect: (product: StoreProduct) => void;
  onAddToCart: (product: StoreProduct) => void;
  onRemoveFromCart: (productId: string) => void;
}

export default function ProductCardVertical({
  product,
  quantity = 0,
  isCurrent = false,
  onSelect,
  onAddToCart,
  onRemoveFromCart,
}: ProductCardVerticalProps) {
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
    <div
      onClick={() => onSelect(product)}
      className={`bg-surface border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 group p-2 flex flex-col justify-between relative cursor-pointer ${
        isCurrent
          ? "border-neutral-900 dark:border-white ring-2 ring-neutral-900/20 dark:ring-white/20"
          : "border-card-border hover:border-neutral-400 dark:hover:border-neutral-600"
      }`}
    >
      {/* Product Image at Top */}
      <div className="relative h-38 w-full rounded-xl bg-background border-card-border overflow-hidden">
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
            <StoreIcon className="h-8 w-8 opacity-30" />
          </div>
        )}

        {/* Promotional Discount Badge */}
        {hasDiscount && (
          <div className="absolute top-1.5 left-1.5 z-10 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 font-extrabold text-[9px] px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
            <Percent className="h-2.5 w-2.5" />
            <span>-{discountPercent}%</span>
          </div>
        )}

        {/* Floating Quick Add Button */}
        <div className="absolute bottom-1.5 right-1.5 z-10">
          {quantity > 0 ? (
            <div className="flex items-center gap-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg p-1 shadow-md">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromCart(product.id);
                }}
                className="p-0.5 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="font-bold text-xs min-w-3 text-center font-sans">
                {quantity}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(product);
                }}
                className="p-0.5 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(product);
              }}
              className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface border border-card-border text-muted-text hover:text-foreground hover:border-neutral-900 dark:hover:border-white hover:bg-neutral-100 dark:hover:bg-neutral-800 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Adicionar à sacola"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Product Details (Below Image) */}
      <div className="py-2 flex-grow flex flex-col justify-between">
        <div>
          {/* Product Name */}
          <h4 className="font-medium text-foreground text-sm line-clamp-3">
            {product.name}
          </h4>

          {/* Price below image/name */}
          <div className="my-1 font-sans flex items-baseline flex-wrap gap-1">
            {hasDiscount ? (
              <>
                <span className="font-extrabold text-foreground text-sm">
                  {formatPrice(product.promotional_price!)}
                </span>
                <span className="text-[10px] text-muted-text line-through">
                  {formatPrice(product.price)}
                </span>
              </>
            ) : (
              <span className="font-bold text-foreground text-sm">
                {formatPrice(product.price)}
              </span>
            )}
            {product.sale_type === "weight" && (
              <span className="text-[9px] text-muted-text font-normal">
                /kg
              </span>
            )}
          </div>

          {/* Description below price */}
          {product.description && (
            <p className="text-xs text-muted-text line-clamp-2 leading-tight">
              {product.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
