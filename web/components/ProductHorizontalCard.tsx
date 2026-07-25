import React from "react";
import Image from "next/image";
import { Store as StoreIcon, Plus, Minus, Percent } from "lucide-react";
import { type StoreProduct } from "@/lib/api";
import { formatPrice, getImageUrl } from "@/lib/utils";

interface ProductHorizontalCardProps {
  product: StoreProduct;
  quantity?: number;
  isCurrent?: boolean;
  onSelect: (product: StoreProduct) => void;
  onAddToCart: (product: StoreProduct) => void;
  onRemoveFromCart: (productId: string) => void;
}

export default function ProductHorizontalCard({
  product,
  quantity = 0,
  isCurrent = false,
  onSelect,
  onAddToCart,
  onRemoveFromCart,
}: ProductHorizontalCardProps) {
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
      className={`bg-surface border rounded-xl overflow-hidden hover:shadow-md transition-all duration-300 group p-3 flex gap-3 h-[130px] items-center relative cursor-pointer ${
        isCurrent
          ? "border-neutral-900 dark:border-white ring-2 ring-neutral-900/20 dark:ring-white/20"
          : "border-card-border hover:border-neutral-400 dark:hover:border-neutral-600"
      }`}
    >
      {/* Product Details (Left Side) */}
      <div className="flex-grow flex flex-col justify-between h-full min-w-0 py-0.5">
        <div>
          {/* Product Name */}
          <h4 className="font-semibold text-foreground text-sm line-clamp-2 leading-snug group-hover:text-emerald-500 transition-colors">
            {product.name}
          </h4>

          {/* Description */}
          {product.description && (
            <p className="text-xs text-muted-text line-clamp-2 mt-1 leading-normal pr-2">
              {product.description}
            </p>
          )}
        </div>

        {/* Price & Tag */}
        <div className="font-sans flex items-baseline flex-wrap gap-1.5 mt-auto">
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
            <span className="text-[9px] text-muted-text font-normal">/kg</span>
          )}
        </div>
      </div>

      {/* Image & Quick Add (Right Side) */}
      <div className="relative h-[96px] w-[96px] flex-shrink-0 rounded-lg bg-background border border-card-border overflow-hidden">
        {product.image ? (
          <Image
            src={getImageUrl(product.image)}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-text bg-muted/10">
            <StoreIcon className="h-6 w-6 opacity-30" />
          </div>
        )}

        {/* Promotional Discount Badge */}
        {hasDiscount && (
          <div className="absolute top-1 left-1 z-10 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 font-extrabold text-[8px] px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-0.5">
            <Percent className="h-2 w-2" />
            <span>-{discountPercent}%</span>
          </div>
        )}

        {/* Floating Quick Add Button (Overlaid on Bottom Right of the image) */}
        <div className="absolute bottom-1 right-1 z-10">
          {quantity > 0 ? (
            <div className="flex items-center gap-1 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-md p-1 shadow-md">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromCart(product.id);
                }}
                className="p-0.5 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <span className="font-bold text-[10px] min-w-2.5 text-center font-sans">
                {quantity}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(product);
                }}
                className="p-0.5 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(product);
              }}
              className="flex items-center justify-center h-6 w-6 rounded-md bg-surface border border-card-border text-muted-text hover:text-foreground hover:border-neutral-900 dark:hover:border-white hover:bg-neutral-100 dark:hover:bg-neutral-800 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Adicionar à sacola"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
