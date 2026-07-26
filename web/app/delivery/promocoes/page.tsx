"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { slugify } from "@/lib/utils";
import {
  listPromotions,
  PromotionalProduct,
  formatProductPrice,
} from "@/lib/api";
import {
  Store as StoreIcon,
  Tag,
  Motorbike,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

function PromotionsPageContent() {
  const [promotions, setPromotions] = useState<PromotionalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadPromotions() {
      try {
        setLoading(true);
        const data = await listPromotions();
        setPromotions(data.promotions || []);
      } catch (err) {
        console.error("Error loading promotions:", err);
        setError(
          "Não foi possível carregar as promoções. Tente novamente mais tarde.",
        );
      } finally {
        setLoading(false);
      }
    }
    loadPromotions();
  }, []);

  const filteredPromotions = promotions.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.store_name.toLowerCase().includes(query) ||
      (item.description && item.description.toLowerCase().includes(query))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Header & Breadcrumbs */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Link
            href="/delivery"
            className="hover:text-foreground transition-colors"
          >
            Delivery
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-semibold text-foreground">Promoções</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
                Todas as Promoções
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-surface dark:bg-card-bg border border-card-border rounded-2xl">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-foreground">
            Ops, algo deu errado
          </h3>
          <p className="text-xs text-muted-foreground mt-2 max-w-xs">{error}</p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div
              key={n}
              className="h-72 rounded-2xl bg-card-bg/60 border border-card-border/40 animate-pulse p-4 flex flex-col justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted/60" />
                <div className="h-4 w-24 bg-muted/60 rounded" />
              </div>
              <div className="h-32 w-full bg-muted/50 rounded-xl my-2" />
              <div className="space-y-2">
                <div className="h-4 w-3/4 bg-muted/60 rounded" />
                <div className="h-5 w-1/2 bg-muted/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Promotions Grid */}
      {!loading && !error && (
        <>
          {filteredPromotions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-surface dark:bg-card-bg border border-card-border rounded-2xl shadow-sm">
              <div className="h-14 w-14 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                <Tag className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Nenhuma promoção encontrada
              </h3>
              <p className="text-xs text-muted-foreground mt-2 max-w-xs">
                {searchQuery
                  ? "Tente buscar por outro termo ou produto."
                  : "Não há promoções ativas no momento."}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-4 px-4 py-2 text-xs font-semibold text-emerald-500 border border-emerald-500/30 hover:border-emerald-500 rounded-full transition-colors cursor-pointer"
                >
                  Limpar busca
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
              {filteredPromotions.map((item) => {
                const discountPct = Math.round(
                  ((item.price - item.promotional_price) / item.price) * 100,
                );

                return (
                  <Link
                    href={`/delivery/${slugify(item.store_city || "loja")}/${slugify(item.store_name)}?product=${item.id}`}
                    key={item.id}
                    className="group rounded-2xl p-2.5 bg-surface dark:bg-card-bg border border-card-border/60 hover:border-neutral-400 dark:hover:border-neutral-500 shadow-sm hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 transition-all duration-300 flex flex-col overflow-hidden relative"
                  >
                    {/* Store Logo & Name & Delivery Fee */}
                    <div className="py-2 px-1 bg-muted/30 border-b border-card-border/30 flex items-center justify-between gap-2 rounded-t-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.store_avatar ? (
                          <Image
                            src={item.store_avatar}
                            alt={item.store_name}
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full object-cover border border-card-border shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted/60 text-foreground flex items-center justify-center shrink-0 border border-card-border">
                            <StoreIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="text-xs font-bold text-foreground truncate">
                          {item.store_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted/80 text-muted-foreground border border-card-border/50">
                        <Motorbike className="w-3 h-3" />
                        <span>
                          {item.delivery_fee === 0
                            ? "Grátis"
                            : `R$ ${item.delivery_fee.toFixed(2).replace(".", ",")}`}
                        </span>
                      </div>
                    </div>

                    {/* Product Image */}
                    <div className="relative w-full h-44 bg-muted/20 overflow-hidden flex items-center justify-center rounded-xl mt-1.5">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500 rounded-xl"
                        />
                      ) : (
                        <Tag className="w-10 h-10 text-muted-foreground/30" />
                      )}

                      {/* Discount Tag */}
                      <div className="absolute top-2.5 right-2.5 bg-gradient-to-r from-rose-600 to-amber-500 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-full shadow-lg shadow-rose-500/30 flex items-center gap-1 tracking-wide">
                        <span>{discountPct}% OFF</span>
                      </div>
                    </div>

                    {/* Product Details & Prices */}
                    <div className="py-2.5 px-1 flex flex-col justify-start flex-1 gap-1.5">
                      <div>
                        <h3 className="text-sm font-bold text-foreground line-clamp-1 group-hover:opacity-80 transition-opacity">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-end justify-between pt-2 border-t border-card-border/30">
                        <div>
                          <span className="block text-[11px] text-muted-foreground/70 line-through font-medium">
                            {formatProductPrice(item.price, item.sale_type)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                              {formatProductPrice(
                                item.promotional_price,
                                item.sale_type,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PromotionsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center animate-pulse">
          <div className="h-8 w-48 bg-card-border/60 mx-auto rounded mb-4" />
          <div className="h-4 w-64 bg-card-border/60 mx-auto rounded" />
        </div>
      }
    >
      <PromotionsPageContent />
    </Suspense>
  );
}
