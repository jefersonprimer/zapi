"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import {
  getStore,
  listStores,
  type Store,
  type StoreProduct,
  type StoreProductCategory,
  type StoreHours,
  type StoreDeliverySlot,
  type StoreCoupon,
} from "@/lib/api";
import { slugify, formatPrice, getImageUrl } from "@/lib/utils";
import { useCart } from "@/lib/cart-context";
import {
  ArrowLeft,
  Star,
  Clock,
  DollarSign,
  Plus,
  Minus,
  Percent,
  Calendar,
  AlertCircle,
  MapPin,
  Store as StoreIcon,
  Search,
} from "lucide-react";

interface PageProps {
  params: Promise<{
    city: string;
    storeSlug: string;
  }>;
}

const CATEGORY_MAP: Record<string, { label: string; emoji: string }> = {
  restaurante: { label: "Restaurante", emoji: "🍔" },
  padaria: { label: "Padaria", emoji: "🍞" },
  mercado: { label: "Mercado", emoji: "🛒" },
  farmacia: { label: "Farmácia", emoji: "💊" },
  fast_food: { label: "Fast Food", emoji: "🍕" },
  lanchonete: { label: "Lanchonete", emoji: "🥪" },
  confeitaria: { label: "Doces & Bolos", emoji: "🍰" },
  acougue: { label: "Açougue", emoji: "🥩" },
  bebidas: { label: "Bebidas", emoji: "🍺" },
  outro: { label: "Outros", emoji: "✨" },
};

const DAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export default function StoreDetailPage({ params }: PageProps) {
  const { city, storeSlug } = React.use(params);

  const {
    cart,
    addToCart: globalAddToCart,
    removeFromCart: globalRemoveFromCart,
  } = useCart();

  const [data, setData] = useState<{
    store: Store;
    products: StoreProduct[];
    categories: StoreProductCategory[];
    hours: StoreHours[];
    slots: StoreDeliverySlot[];
    coupons?: StoreCoupon[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active category navigation helper
  const [activeCategory, setActiveCategory] = useState<string>("");

  // Search input state
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadStore() {
      try {
        setLoading(true);
        const response = await listStores();
        const matched = response.stores.find(
          (s) => slugify(s.city) === city && slugify(s.name) === storeSlug,
        );

        if (!matched) {
          setError("Estabelecimento não encontrado nesta cidade.");
          return;
        }

        const details = await getStore(undefined, matched.id);
        setData(details);

        if (details.categories.length > 0) {
          setActiveCategory(""); // Default to "Todos" (all categories)
        }
      } catch (err) {
        console.error("Error loading store details:", err);
        setError("Ocorreu um erro ao carregar os detalhes do estabelecimento.");
      } finally {
        setLoading(false);
      }
    }
    loadStore();
  }, [city, storeSlug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
        <div className="h-6 w-24 bg-card-border rounded mb-6" />
        <div className="h-64 bg-card-border rounded-3xl mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-10 bg-card-border w-1/3 rounded" />
            <div className="h-4 bg-card-border w-full rounded" />
            <div className="h-4 bg-card-border w-2/3 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-card-border rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="h-40 bg-card-border rounded-2xl" />
            <div className="h-40 bg-card-border rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center flex flex-col items-center">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold">Lugar não encontrado</h2>
        <p className="text-muted-text mt-2 mb-6">
          {error || "Não conseguimos localizar a loja solicitada."}
        </p>
        <Link
          href="/delivery"
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-bold shadow-md shadow-emerald-500/20 hover:scale-[1.02] transition-transform"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para o Catálogo
        </Link>
      </div>
    );
  }

  const { store, products, categories, hours, slots, coupons } = data;
  const categoryInfo = CATEGORY_MAP[store.category] || {
    label: "Outros",
    emoji: "✨",
  };

  // Cart operations
  const addToCart = (product: StoreProduct) => {
    globalAddToCart(product, store);
  };

  const removeFromCart = (productId: string) => {
    globalRemoveFromCart(productId);
  };

  const getProductQuantity = (productId: string) => {
    return cart.find((item) => item.product.id === productId)?.quantity || 0;
  };

  // Filter products by search query
  const filteredProducts = products.filter(
    (prod) =>
      prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (prod.description &&
        prod.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  // Group products by category
  const productsByCategory = categories
    .map((cat) => ({
      category: cat,
      items: filteredProducts.filter(
        (prod) => prod.category_id === cat.id || prod.category === cat.name,
      ),
    }))
    .filter((group) => group.items.length > 0);

  // Find products for active category if one is selected
  const displayGroups = activeCategory
    ? productsByCategory.filter((group) => group.category.id === activeCategory)
    : productsByCategory;

  // Helper to format days of week
  const formatDayOfWeek = (day: number) => {
    return DAY_NAMES[day] || `Dia ${day}`;
  };

  return (
    <div className="max-w-7xl mx-auto pb-24">
      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 items-start">
        {/* Sidebar (Left Side) */}
        <aside className="lg:col-span-1 lg:sticky">
          {/* Store Info Card */}
          <div className="bg-surface border border-card-border overflow-hidden shadow-sm">
            {/* Store Banner */}
            <div className="relative h-32 w-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
              {store.image_banner ? (
                <Image
                  src={getImageUrl(store.image_banner)}
                  alt={`${store.name} banner`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-emerald-500/20">
                  <StoreIcon className="h-12 w-12" />
                </div>
              )}
              {/* Status badge */}
              <div className="absolute top-3 right-3">
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md backdrop-blur-md ${
                    store.is_open
                      ? "bg-emerald-500/90 text-white"
                      : "bg-red-500/90 text-white"
                  }`}
                >
                  {store.is_open ? "Aberto Agora" : "Fechado"}
                </span>
              </div>
            </div>

            {/* Store details */}
            <div className="p-5 relative pt-10">
              {/* Avatar overlapping banner */}
              <div className="absolute top-0 left-5 -translate-y-1/2 h-16 w-16 rounded-2xl border-4 border-surface overflow-hidden bg-background shadow-md flex items-center justify-center">
                {store.avatar ? (
                  <Image
                    src={getImageUrl(store.avatar)}
                    alt={`${store.name} logo`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-2xl">{categoryInfo.emoji}</span>
                )}
              </div>

              {/* Name */}
              <h1 className="text-xl font-extrabold text-foreground">
                {store.name}
              </h1>

              {/* Description */}
              {store.description && (
                <p className="text-xs text-muted-text mt-1.5 leading-relaxed">
                  {store.description}
                </p>
              )}

              {/* Address */}
              {store.street && (
                <div className="flex items-start gap-1.5 text-xs text-muted-text mt-3 pt-3 border-t border-card-border">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-emerald-500" />
                  <span className="line-clamp-2">
                    {store.street}, {store.number} - {store.neighborhood},{" "}
                    {store.city} - {store.state}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stats Box */}
          <div className="bg-surface border border-card-border p-4 grid grid-cols-2 gap-3 shadow-sm">
            {/* Rating */}
            <div className="flex flex-col items-center justify-center p-2 bg-background rounded-xl border border-card-border">
              <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                <Star className="h-3.5 w-3.5 fill-amber-500" />
                <span>
                  {store.score != null ? store.score.toFixed(1) : "5.0"}
                </span>
              </div>
              <span className="text-[9px] text-muted-text uppercase font-semibold mt-1">
                {store.ratings_count || 0} avaliações
              </span>
            </div>

            {/* Prep Time */}
            <div className="flex flex-col items-center justify-center p-2 bg-background rounded-xl border border-card-border">
              <div className="flex items-center gap-1 text-foreground font-bold text-sm font-sans">
                <Clock className="h-3.5 w-3.5 text-emerald-500" />
                <span>{store.prep_time_minutes || 35} min</span>
              </div>
              <span className="text-[9px] text-muted-text uppercase font-semibold mt-1">
                Entrega
              </span>
            </div>

            {/* Delivery Fee */}
            <div className="flex flex-col items-center justify-center p-2 bg-background rounded-xl border border-card-border">
              <div className="flex items-center gap-0.5 text-foreground font-bold text-sm font-sans">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                <span>
                  {store.delivery_fee === 0 ? "Grátis" : store.delivery_fee}
                </span>
              </div>
              <span className="text-[9px] text-muted-text uppercase font-semibold mt-1">
                Taxa
              </span>
            </div>

            {/* Minimum Order */}
            <div className="flex flex-col items-center justify-center p-2 bg-background rounded-xl border border-card-border">
              <div className="flex items-center gap-0.5 text-foreground font-bold text-sm font-sans">
                <span className="text-xs font-semibold text-emerald-500">
                  R$
                </span>
                <span>{Number(store.minimum_order).toFixed(0)}</span>
              </div>
              <span className="text-[9px] text-muted-text uppercase font-semibold mt-1">
                Mínimo
              </span>
            </div>
          </div>

          {/* Operating Hours */}
          {hours && hours.length > 0 && (
            <div className="bg-surface border border-card-border p-4 shadow-sm">
              <h3 className="font-bold text-foreground text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-emerald-500" />
                Horários
              </h3>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {hours
                  .sort((a, b) => a.day_of_week - b.day_of_week)
                  .map((hr) => (
                    <div
                      key={hr.id}
                      className="flex justify-between items-center text-[11px] border-b border-card-border/50 pb-1 last:border-b-0 last:pb-0"
                    >
                      <span className="font-semibold text-foreground/80">
                        {formatDayOfWeek(hr.day_of_week)}
                      </span>
                      {hr.is_closed ? (
                        <span className="text-red-500 font-medium">
                          Fechado
                        </span>
                      ) : (
                        <span className="text-muted-text font-sans">
                          {hr.open_time.slice(0, 5)} -{" "}
                          {hr.close_time.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Active Coupons widget */}
          {coupons && coupons.length > 0 && (
            <div className="bg-surface border border-card-border p-4 shadow-sm">
              <h3 className="font-bold text-foreground text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                <Percent className="h-3.5 w-3.5 text-emerald-500" />
                Cupons
              </h3>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {coupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className="border border-dashed border-emerald-500/40 bg-emerald-500/5 rounded-xl p-2.5 flex justify-between items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-emerald-500 text-xs tracking-wide truncate">
                        {coupon.code}
                      </div>
                      <div className="text-[9px] text-muted-text mt-0.5">
                        {coupon.discount_type === "percentage"
                          ? `${coupon.discount_value}% desc.`
                          : `${formatPrice(coupon.discount_value)} desc.`}
                      </div>
                      {coupon.min_order > 0 && (
                        <div className="text-[8px] text-muted-text font-sans">
                          Min: {formatPrice(coupon.min_order)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(coupon.code);
                        alert("Cupom copiado!");
                      }}
                      className="text-[9px] font-bold bg-emerald-500 text-white rounded-lg px-2 py-1 cursor-pointer hover:bg-emerald-600 transition-colors flex-shrink-0 ml-2"
                    >
                      Copiar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delivery & Agendamento Slots */}
          {slots && slots.length > 0 && (
            <div className="bg-surface border border-card-border p-4 shadow-sm">
              <h3 className="font-bold text-foreground text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                Agendamentos
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {slots
                  .filter((s) => s.is_active)
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((slot) => (
                    <div
                      key={slot.id}
                      className="bg-background border border-card-border rounded-xl p-2 flex justify-between items-center text-[10px]"
                    >
                      <div>
                        <div className="font-bold text-foreground/80 font-sans">
                          {slot.start_time.slice(0, 5)} às{" "}
                          {slot.end_time.slice(0, 5)}
                        </div>
                        <div className="text-[8px] text-muted-text uppercase font-semibold mt-0.5">
                          {slot.fulfillment_type === "entrega"
                            ? "Apenas Entrega"
                            : slot.fulfillment_type === "retirada"
                              ? "Apenas Retirada"
                              : "Entrega e Retirada"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-emerald-500 font-sans">
                          {slot.fee === 0 ? "Grátis" : formatPrice(slot.fee)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Content (Right Side) */}
        <main className="lg:col-span-3 space-y-6 py-6 px-4">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-text">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              placeholder="Buscar produtos no estabelecimento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3.5 bg-surface border border-card-border rounded-2xl text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-4 flex items-center text-xs text-muted-text hover:text-foreground cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Category Pill Anchors */}
          {productsByCategory.length > 0 && (
            <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-md py-3 border-b border-card-border overflow-x-auto flex gap-2 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <button
                onClick={() => setActiveCategory("")}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === ""
                    ? "bg-emerald-500 text-white"
                    : "bg-surface border border-card-border text-muted-text hover:text-foreground"
                }`}
              >
                Todos
              </button>
              {productsByCategory.map((group) => (
                <button
                  key={group.category.id}
                  onClick={() => setActiveCategory(group.category.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeCategory === group.category.id
                      ? "bg-emerald-500 text-white"
                      : "bg-surface border border-card-border text-muted-text hover:text-foreground"
                  }`}
                >
                  {group.category.name}
                </button>
              ))}
            </div>
          )}

          {/* Empty Catalog / Search Results State */}
          {displayGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-surface border border-card-border rounded-3xl shadow-sm">
              {searchQuery ? (
                <>
                  <Search className="h-16 w-16 text-muted-text mb-4 opacity-50 animate-pulse" />
                  <h3 className="text-2xl font-bold text-foreground">
                    Nenhum produto encontrado
                  </h3>
                  <p className="text-muted-text mt-2 max-w-sm">
                    Não encontramos produtos correspondentes a &quot;
                    {searchQuery}&quot; nesta categoria.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setActiveCategory("");
                    }}
                    className="mt-4 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-bold shadow-md shadow-emerald-500/20 hover:scale-[1.02] transition-transform cursor-pointer"
                  >
                    Ver Todos os Produtos
                  </button>
                </>
              ) : (
                <>
                  <StoreIcon className="h-16 w-16 text-muted-text mb-4" />
                  <h3 className="text-2xl font-bold text-foreground">
                    Cardápio em construção
                  </h3>
                  <p className="text-muted-text mt-2 max-w-sm">
                    Nenhum produto cadastrado para esta categoria no momento.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-10">
              {displayGroups.map((group) => (
                <div
                  key={group.category.id}
                  id={`cat-${group.category.id}`}
                  className="scroll-mt-36"
                >
                  <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                    <span className="h-5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                    {group.category.name}
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 items-start">
                    {group.items.map((product) => {
                      const quantity = getProductQuantity(product.id);

                      return (
                        <div
                          key={product.id}
                          className="bg-surface border border-card-border rounded-xl overflow-hidden hover:shadow-lg hover:border-emerald-500/30 transition-all duration-300 group flex flex-col justify-between relative"
                        >
                          {/* Product Image at Top */}
                          <div className="relative h-38 w-full bg-background border-card-border overflow-hidden">
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

                            {/* Floating Quick Add Button */}
                            <div className="absolute bottom-2 right-2 z-10">
                              {quantity > 0 ? (
                                <div className="flex items-center gap-2 bg-emerald-500 text-white rounded-lg p-1.5 shadow-md">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeFromCart(product.id);
                                    }}
                                    className="p-1 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="font-bold text-xs min-w-4 text-center font-sans">
                                    {quantity}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addToCart(product);
                                    }}
                                    className="p-1 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToCart(product);
                                  }}
                                  className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface border border-card-border text-muted-text hover:text-emerald-500 hover:border-emerald-500 hover:bg-emerald-500/5 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                  title="Adicionar à sacola"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Product Details (Below Image) */}
                          <div className="py-3 px-2 flex-grow flex flex-col justify-between">
                            <div>
                              {/* Product Name */}
                              <h4 className="font-bold text-foreground text-sm group-hover:text-emerald-500 transition-colors line-clamp-1">
                                {product.name}
                              </h4>

                              {/* Price below image/name */}
                              <div className="mt-1 font-extrabold text-emerald-500 text-base font-sans">
                                {formatPrice(product.price)}
                                {product.sale_type === "weight" && (
                                  <span className="text-[10px] text-muted-text font-normal">
                                    {" "}
                                    /kg
                                  </span>
                                )}
                              </div>

                              {/* Description below price */}
                              {product.description && (
                                <p className="text-xs text-muted-text mt-2 line-clamp-3 leading-relaxed">
                                  {product.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
