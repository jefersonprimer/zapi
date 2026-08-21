"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  listPromotions,
  PromotionalProduct,
  formatProductPrice,
} from "@/lib/api";
import { slugify } from "@/lib/utils";
import {
  Store as StoreIcon,
  Tag,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

export default function PromotionsSection() {
  const [promotions, setPromotions] = useState<PromotionalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    async function loadPromotions() {
      try {
        setLoading(true);
        const data = await listPromotions();
        setPromotions(data.promotions || []);
      } catch (err) {
        console.error("Error loading promotions:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPromotions();
  }, []);

  const updateScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
    }
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      updateScrollButtons();
      container.addEventListener("scroll", updateScrollButtons);
      window.addEventListener("resize", updateScrollButtons);
      return () => {
        container.removeEventListener("scroll", updateScrollButtons);
        window.removeEventListener("resize", updateScrollButtons);
      };
    }
  }, [promotions, loading]);

  const handleScroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const scrollAmount = container.clientWidth * 0.75;
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (!loading && promotions.length === 0) {
    return null;
  }

  const MAX_PROMOTIONS = 12;
  const displayedPromotions = promotions.slice(0, MAX_PROMOTIONS);
  const hasMore = promotions.length > MAX_PROMOTIONS;

  return (
    <section className="mb-10 relative">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2.5">
          <div>
            <div className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
              <span>Ofertas Imperdíveis</span>
              <span className="text-xs sm:text-sm font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-0.5 rounded-full border border-rose-500/20 flex items-center gap-1">
                Até 50% OFF
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Os melhores descontos da sua região reunidos aqui
            </p>
          </div>
        </div>

        {/* View All Button in Header */}
        <Link href="/delivery/promocoes">Ver mais</Link>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-64 rounded-2xl bg-card-bg/60 border border-card-border/40 animate-pulse p-4 flex flex-col justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted/60" />
                <div className="h-4 w-24 bg-muted/60 rounded" />
              </div>
              <div className="h-28 w-full bg-muted/50 rounded-xl my-2" />
              <div className="space-y-2">
                <div className="h-4 w-3/4 bg-muted/60 rounded" />
                <div className="h-5 w-1/2 bg-muted/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Carousel Container with Side Navigation Arrows */
        <div className="relative group/carousel px-1">
          {/* Left Side Navigation Arrow */}
          {canScrollLeft && (
            <button
              onClick={() => handleScroll("left")}
              aria-label="Promoção anterior"
              className="absolute -left-2 sm:-left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full border border-card-border/80 bg-surface/90 dark:bg-card-bg/90 backdrop-blur-md hover:bg-surface dark:hover:bg-card-bg text-foreground shadow-lg hover:scale-110 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
          )}

          {/* Right Side Navigation Arrow */}
          {canScrollRight && (
            <button
              onClick={() => handleScroll("right")}
              aria-label="Próxima promoção"
              className="absolute -right-2 sm:-right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full border border-card-border/80 bg-surface/90 dark:bg-card-bg/90 backdrop-blur-md hover:bg-surface dark:hover:bg-card-bg text-foreground shadow-lg hover:scale-110 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          )}

          {/* Items Track - No horizontal scrollbar */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto pb-4 pt-1 scroll-smooth select-none scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {displayedPromotions.map((item) => {
              const discountPct = Math.round(
                ((item.price - item.promotional_price) / item.price) * 100,
              );

              return (
                <Link
                  href={`/delivery/${slugify(item.store_city || "loja")}/${slugify(item.store_name)}?product=${item.id}`}
                  key={item.id}
                  className="shrink-0 w-[160px] sm:w-[210px] group/card rounded-2xl p-2 bg-surface dark:bg-card-bg border border-card-border/60 hover:border-neutral-400 dark:hover:border-neutral-500 shadow-sm hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 transition-all duration-300 flex flex-col overflow-hidden relative"
                >
                  {/* 1. Above Image: Store Logo / Name & Delivery Fee */}
                  <div className="py-1.5 px-0.5 bg-muted/20 border-b border-card-border/30 flex items-center justify-between gap-1.5">
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
                  </div>

                  {/* 2. Middle: Product Image with Discount Overlay Tag */}
                  <div className="relative w-full h-50 bg-muted/20 overflow-hidden flex items-center justify-center rounded-xl mt-1">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover group-hover/card:scale-105 transition-transform duration-500 rounded-xl"
                      />
                    ) : (
                      <Tag className="w-10 h-10 text-muted-foreground/30" />
                    )}

                    {/* Discount Percentage Badge on Image */}
                    <div className="absolute top-2.5 right-2.5 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                      <span>{discountPct}% OFF</span>
                    </div>
                  </div>

                  {/* 3. Below Image: Product Name & Prices */}
                  <div className="py-2.5 px-1 flex flex-col justify-start flex-1 gap-1.5">
                    <div>
                      <h3 className="text-sm font-medium text-foreground line-clamp-2 group-hover/card:opacity-80 transition-opacity">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Pricing row */}
                    <div className="flex items-end justify-between pt-1 border-t border-card-border/30">
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

            {/* Extra Card at the end if there are more than 12 promotions */}
            {hasMore && (
              <Link
                href="/delivery/promocoes"
                className="shrink-0 w-[160px] sm:w-[210px] group/more rounded-2xl p-4 bg-surface dark:bg-card-bg border border-card-border hover:border-neutral-400 dark:hover:border-neutral-500 transition-all duration-300 flex flex-col items-center justify-center text-center gap-3 shadow-sm hover:shadow-md"
              >
                <div className="w-12 h-12 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shadow-md group-hover/more:scale-110 transition-transform">
                  <ArrowRight className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-foreground group-hover/more:text-neutral-700 dark:group-hover/more:text-neutral-300 transition-colors">
                    Ver mais promoções
                  </span>
                  <span className="text-xs text-muted-foreground mt-1 block font-medium">
                    +{promotions.length - MAX_PROMOTIONS} ofertas disponíveis
                  </span>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
