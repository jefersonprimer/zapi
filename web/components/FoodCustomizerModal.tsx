import React, { useState } from "react";
import Image from "next/image";
import {
  X,
  Plus,
  Minus,
  Store as StoreIcon,
  Percent,
  ShoppingBag,
} from "lucide-react";
import { type StoreProduct } from "@/lib/api";
import { formatPrice, getImageUrl } from "@/lib/utils";

interface AddonOption {
  id: string;
  name: string;
  price: number;
  maxQuantity: number;
}

const MOCK_ADDONS: AddonOption[] = [
  { id: "bacon", name: "Bacon Fatiado Extra", price: 4.5, maxQuantity: 3 },
  { id: "cheese", name: "Queijo Prato Duplo", price: 3.0, maxQuantity: 2 },
  { id: "sauce", name: "Molho Especial da Casa", price: 1.5, maxQuantity: 4 },
  { id: "egg", name: "Ovo Frito Gema Mole", price: 2.0, maxQuantity: 2 },
  {
    id: "patty",
    name: "Hambúrguer Artesanal Extra (150g)",
    price: 8.0,
    maxQuantity: 1,
  },
];

interface FoodCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: StoreProduct | null;
  onConfirm: (customProduct: StoreProduct) => void;
}

export default function FoodCustomizerModal({
  isOpen,
  onClose,
  product,
  onConfirm,
}: FoodCustomizerModalProps) {
  const [addonQuantities, setAddonQuantities] = useState<
    Record<string, number>
  >({});
  const [productQuantity, setProductQuantity] = useState<number>(1);
  const [instructions, setInstructions] = useState<string>("");

  if (!isOpen || !product) return null;

  const handleAddonChange = (addonId: string, delta: number, max: number) => {
    setAddonQuantities((prev) => {
      const current = prev[addonId] || 0;
      const next = Math.max(0, Math.min(max, current + delta));
      return { ...prev, [addonId]: next };
    });
  };

  const hasDiscount =
    product.promotional_price != null &&
    product.promotional_price > 0 &&
    product.promotional_price < product.price;

  const discountPercent = hasDiscount
    ? Math.round(
        ((product.price - product.promotional_price!) / product.price) * 100,
      )
    : 0;

  const basePrice = hasDiscount ? product.promotional_price! : product.price;

  const addonsTotal = MOCK_ADDONS.reduce((acc, addon) => {
    const qty = addonQuantities[addon.id] || 0;
    return acc + addon.price * qty;
  }, 0);

  const unitPrice = basePrice + addonsTotal;
  const totalPrice = unitPrice * productQuantity;

  const handleConfirm = () => {
    // Generate addon summary
    const activeAddons = MOCK_ADDONS.filter(
      (addon) => (addonQuantities[addon.id] || 0) > 0,
    ).map((addon) => {
      const qty = addonQuantities[addon.id];
      return `${qty}x ${addon.name}`;
    });

    // Create a modified product representation to store customization details
    const addonDetails =
      activeAddons.length > 0 ? ` (+ ${activeAddons.join(", ")})` : "";
    const note = instructions.trim() ? ` [Obs: ${instructions}]` : "";

    const customizedProduct: StoreProduct = {
      ...product,
      // Change ID or keep same? We can create a slightly modified ID or keep same.
      // If we keep the same, it aggregates. But let's create a custom dynamic product so it lists separately!
      id:
        activeAddons.length > 0 || note
          ? `${product.id}-custom-${Date.now()}`
          : product.id,
      name: `${product.name}${addonDetails}`,
      description: `${product.description || ""}${note}`.trim(),
      price: product.price + addonsTotal,
      promotional_price:
        product.promotional_price != null
          ? product.promotional_price + addonsTotal
          : null,
    };

    // We call onConfirm with the customized product and we can add it to the cart multiple times
    for (let i = 0; i < productQuantity; i++) {
      onConfirm(customizedProduct);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-surface dark:bg-card-bg border border-card-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col z-10 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border bg-muted/5">
          <div></div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-text hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {/* Product Detail Main Card lookalike layout */}
          <div className="flex flex-col sm:flex-row gap-6 pb-6 border-b border-card-border">
            {/* Image */}
            <div className="relative h-28 w-28 sm:h-36 sm:w-36 flex-shrink-0 overflow-hidden rounded-xl bg-background border border-card-border align-self-start">
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
                  <StoreIcon className="h-10 w-10 opacity-30" />
                </div>
              )}

              {hasDiscount && (
                <div className="absolute top-2 left-2 z-10 bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/40 font-extrabold text-[9px] px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
                  <Percent className="h-2.5 w-2.5" />
                  <span>-{discountPercent}%</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-grow space-y-2">
              <h2 className="text-xl font-medium text-foreground leading-tight">
                {product.name}
              </h2>
              {product.description && (
                <p className="text-xs text-muted-text leading-relaxed">
                  {product.description}
                </p>
              )}
              <div className="flex items-baseline gap-2 pt-1 font-sans">
                {hasDiscount ? (
                  <>
                    <span className="text-lg font-extrabold text-foreground">
                      {formatPrice(product.promotional_price!)}
                    </span>
                    <span className="text-xs text-muted-text line-through">
                      {formatPrice(product.price)}
                    </span>
                  </>
                ) : (
                  <span className="text-lg font-extrabold text-foreground">
                    {formatPrice(product.price)}
                  </span>
                )}
                {product.sale_type === "weight" && (
                  <span className="text-[10px] text-muted-text">/kg</span>
                )}
              </div>
            </div>
          </div>

          {/* Add-ons List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-foreground">
                Adicionais Extras
              </h4>
              <span className="text-[10px] text-muted-text bg-muted/30 px-2 py-0.5 rounded">
                Opcional
              </span>
            </div>

            <div className="space-y-2.5">
              {MOCK_ADDONS.map((addon) => {
                const qty = addonQuantities[addon.id] || 0;
                return (
                  <div
                    key={addon.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-card-border bg-surface hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {addon.name}
                      </p>
                      <p className="text-xs text-emerald-500 font-sans font-medium mt-0.5">
                        +{formatPrice(addon.price)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 bg-background border border-card-border rounded-lg p-1">
                      <button
                        onClick={() =>
                          handleAddonChange(addon.id, -1, addon.maxQuantity)
                        }
                        disabled={qty === 0}
                        className="p-1 rounded bg-surface text-muted-text hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="font-bold text-xs min-w-4 text-center font-sans">
                        {qty}
                      </span>
                      <button
                        onClick={() =>
                          handleAddonChange(addon.id, 1, addon.maxQuantity)
                        }
                        disabled={qty >= addon.maxQuantity}
                        className="p-1 rounded bg-surface text-muted-text hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Instructions / Observations */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-foreground">
              Observações adicionais
            </h4>
            <textarea
              placeholder="Ex: Tirar cebola, maionese à parte, ponto da carne, etc..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={200}
              className="w-full p-3 bg-background border border-card-border rounded-xl text-xs text-foreground placeholder:text-muted-text focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none h-20"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-card-border bg-muted/5 flex flex-col sm:flex-row items-center gap-4">
          {/* Main Product Quantity Selector */}
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto bg-background border border-card-border rounded-xl p-1.5">
            <button
              onClick={() =>
                setProductQuantity((prev) => Math.max(1, prev - 1))
              }
              disabled={productQuantity === 1}
              className="p-1.5 rounded-lg bg-surface border border-card-border hover:bg-card-border text-foreground transition-all disabled:opacity-40 cursor-pointer"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="font-extrabold text-sm px-2 min-w-6 text-center font-sans">
              {productQuantity}
            </span>
            <button
              onClick={() => setProductQuantity((prev) => prev + 1)}
              className="p-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleConfirm}
            className="w-full sm:flex-grow py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="h-4 w-4" />
              <span>Adicionar à Sacola</span>
            </div>
            <span className="font-sans text-sm">{formatPrice(totalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
