"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { listStores, type Store } from "@/lib/api";
import { slugify } from "@/lib/utils";
import {
  Store as StoreIcon,
  AlertCircle,
  ArrowUpDown,
  ChevronDown,
  Clock,
  Bike,
  Tag,
  ChevronRight,
} from "lucide-react";
import StoreCard, { StoreCardSkeleton } from "@/components/StoreCard";
import { CATEGORIES } from "@/components/CategoryGrid";

function isStoreOpenNow(store: Store): boolean {
  if (!store.is_open) return false;
  if (!store.hours || store.hours.length === 0) {
    return store.is_open;
  }

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const todayKey = now.getDay();
  const todayH = store.hours.find((h) => h.day_of_week === todayKey);

  if (todayH && !todayH.is_closed) {
    try {
      const [oh, om] = todayH.open_time.split(":").map(Number);
      const [ch, cm] = todayH.close_time.split(":").map(Number);
      const openMins = oh * 60 + om;
      const closeMins = ch * 60 + cm;

      return currentMins >= openMins && currentMins < closeMins;
    } catch {
      return store.is_open;
    }
  }

  return false;
}

function CategoryPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const categoryParam =
    typeof params.category === "string"
      ? params.category
      : Array.isArray(params.category)
        ? params.category[0]
        : "all";

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & City filters from URL
  const searchQuery = searchParams.get("q") || "";
  const selectedCity = searchParams.get("city") || "all";

  // Dropdowns & Checkboxes states
  const [activeDropdown, setActiveDropdown] = useState<
    "sort" | "delivery" | "payment" | null
  >(null);
  const [sortBy, setSortBy] = useState<string>("default");
  const [deliveryMode, setDeliveryMode] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [openNow, setOpenNow] = useState<boolean>(false);
  const [freeDelivery, setFreeDelivery] = useState<boolean>(false);
  const [promotionOnly, setPromotionOnly] = useState<boolean>(false);

  useEffect(() => {
    async function loadStores() {
      try {
        setLoading(true);
        const response = await listStores();
        setStores(response.stores || []);
      } catch (err) {
        console.error("Error loading stores for category:", err);
        setError(
          "Não foi possível carregar os estabelecimentos. Tente novamente mais tarde.",
        );
      } finally {
        setLoading(false);
      }
    }
    loadStores();
  }, []);

  // Category details
  const categoryInfo = CATEGORIES.find((c) => c.key === categoryParam);
  const categoryTitle =
    categoryInfo?.label ||
    categoryParam.charAt(0).toUpperCase() + categoryParam.slice(1);
  const CategoryIcon = StoreIcon;

  // Filter and sort stores
  const processedStores = stores
    .filter((store) => {
      const matchesCity =
        selectedCity === "all" || slugify(store.city) === slugify(selectedCity);

      // Strict category matching
      const matchesCategory =
        categoryParam === "all" || store.category === categoryParam;

      const matchesSearch =
        store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (store.description &&
          store.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDeliveryMode =
        deliveryMode === "all" ||
        (deliveryMode === "delivery" && store.accepts_delivery !== false) ||
        (deliveryMode === "pickup" && store.accepts_pickup !== false);

      const matchesPayment =
        paymentFilter === "all" ||
        (paymentFilter === "online" && !!store.pix_key);

      const matchesFreeDelivery = !freeDelivery || store.delivery_fee === 0;
      const matchesOpenNow = !openNow || isStoreOpenNow(store);
      const matchesPromotion = !promotionOnly || store.has_coupons === true;

      return (
        matchesCity &&
        matchesCategory &&
        matchesSearch &&
        matchesDeliveryMode &&
        matchesPayment &&
        matchesFreeDelivery &&
        matchesOpenNow &&
        matchesPromotion
      );
    })
    .sort((a, b) => {
      if (sortBy === "rating") {
        return (b.score || 0) - (a.score || 0);
      } else if (sortBy === "delivery_time") {
        return (
          (a.eta_min ?? a.prep_time_minutes ?? 999) -
          (b.eta_min ?? b.prep_time_minutes ?? 999)
        );
      } else if (sortBy === "delivery_fee") {
        return a.delivery_fee - b.delivery_fee;
      } else if (sortBy === "distance") {
        return (a.distance_km ?? 999) - (b.distance_km ?? 999);
      } else if (sortBy === "price") {
        return a.minimum_order - b.minimum_order;
      }
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Header & Breadcrumbs for Category */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-muted-text mb-3">
          <Link
            href="/delivery"
            className="hover:text-foreground transition-colors"
          >
            Delivery
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-semibold text-foreground">{categoryTitle}</span>
        </div>

        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center shadow-md flex-shrink-0 bg-surface dark:bg-card-bg"
            style={{
              border: `2px solid ${categoryInfo ? categoryInfo.color : "#10B981"}`,
            }}
          >
            {categoryInfo?.image ? (
              <Image
                src={categoryInfo.image}
                alt={categoryTitle}
                width={48}
                height={48}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <StoreIcon className="h-6 w-6 text-emerald-500" />
            )}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              {categoryTitle}
            </h1>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="relative mb-8 flex flex-wrap gap-2.5 items-center">
        {/* Backdrop for closing dropdowns */}
        {activeDropdown && (
          <div
            className="fixed inset-0 z-30"
            onClick={() => setActiveDropdown(null)}
          />
        )}

        {/* 1. Ordenar por Dropdown */}
        <div className="relative z-40">
          <button
            onClick={() =>
              setActiveDropdown(activeDropdown === "sort" ? null : "sort")
            }
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer shadow-sm ${
              sortBy !== "default"
                ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/10"
                : "bg-surface dark:bg-card-bg border-card-border/60 hover:border-foreground/30 text-foreground"
            }`}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>
              {sortBy === "default"
                ? "Ordenar"
                : sortBy === "price"
                  ? "Menor pedido"
                  : sortBy === "rating"
                    ? "Melhor avaliação"
                    : sortBy === "delivery_time"
                      ? "Mais rápido"
                      : sortBy === "delivery_fee"
                        ? "Menor taxa"
                        : "Mais próximo"}
            </span>
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${
                activeDropdown === "sort" ? "rotate-180" : ""
              }`}
            />
          </button>

          {activeDropdown === "sort" && (
            <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-surface dark:bg-card-bg border border-card-border/70 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 py-1.5">
              {[
                { key: "default", label: "Padrão / Relevância" },
                { key: "price", label: "Preço (Menor pedido mínimo)" },
                { key: "rating", label: "Avaliação (Melhores notas)" },
                {
                  key: "delivery_time",
                  label: "Tempo de entrega (Mais rápidos)",
                },
                {
                  key: "delivery_fee",
                  label: "Taxa de entrega (Mais baratas)",
                },
                { key: "distance", label: "Distância (Mais próximos)" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setSortBy(opt.key);
                    setActiveDropdown(null);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors flex items-center justify-between cursor-pointer ${
                    sortBy === opt.key
                      ? "text-emerald-500 bg-emerald-50/20 font-semibold"
                      : "text-foreground"
                  }`}
                >
                  <span>{opt.label}</span>
                  {sortBy === opt.key && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. Forma de entrega Dropdown */}
        <div className="relative z-40">
          <button
            onClick={() =>
              setActiveDropdown(
                activeDropdown === "delivery" ? null : "delivery",
              )
            }
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer shadow-sm ${
              deliveryMode !== "all"
                ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/10"
                : "bg-surface dark:bg-card-bg border-card-border/60 hover:border-foreground/30 text-foreground"
            }`}
          >
            <span>
              {deliveryMode === "all"
                ? "Forma de entrega"
                : deliveryMode === "delivery"
                  ? "Entregar (Delivery)"
                  : "Retirar"}
            </span>
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${
                activeDropdown === "delivery" ? "rotate-180" : ""
              }`}
            />
          </button>

          {activeDropdown === "delivery" && (
            <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-surface dark:bg-card-bg border border-card-border/70 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 py-1.5">
              {[
                { key: "all", label: "Todas" },
                { key: "delivery", label: "Entregar (Delivery)" },
                { key: "pickup", label: "Retirar" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setDeliveryMode(opt.key);
                    setActiveDropdown(null);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors flex items-center justify-between cursor-pointer ${
                    deliveryMode === opt.key
                      ? "text-emerald-500 bg-emerald-50/20 font-semibold"
                      : "text-foreground"
                  }`}
                >
                  <span>{opt.label}</span>
                  {deliveryMode === opt.key && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Forma de pagamento Dropdown */}
        <div className="relative z-40">
          <button
            onClick={() =>
              setActiveDropdown(activeDropdown === "payment" ? null : "payment")
            }
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer shadow-sm ${
              paymentFilter !== "all"
                ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/10"
                : "bg-surface dark:bg-card-bg border-card-border/60 hover:border-foreground/30 text-foreground"
            }`}
          >
            <span>
              {paymentFilter === "all"
                ? "Forma de pagamento"
                : paymentFilter === "card"
                  ? "Máquina de cartão"
                  : "Online (Pix)"}
            </span>
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${
                activeDropdown === "payment" ? "rotate-180" : ""
              }`}
            />
          </button>

          {activeDropdown === "payment" && (
            <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-surface dark:bg-card-bg border border-card-border/70 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 py-1.5">
              {[
                { key: "all", label: "Todas" },
                { key: "card", label: "Máquina de cartão" },
                { key: "online", label: "Online (Pix)" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setPaymentFilter(opt.key);
                    setActiveDropdown(null);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors flex items-center justify-between cursor-pointer ${
                    paymentFilter === opt.key
                      ? "text-emerald-500 bg-emerald-50/20 font-semibold"
                      : "text-foreground"
                  }`}
                >
                  <span>{opt.label}</span>
                  {paymentFilter === opt.key && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Separator on desktop */}
        <div className="hidden sm:block h-5 w-[1px] bg-card-border/60 mx-1" />

        {/* 4. Abertos agora Toggle */}
        <button
          onClick={() => setOpenNow(!openNow)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer shadow-sm ${
            openNow
              ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/10"
              : "bg-surface dark:bg-card-bg border-card-border/60 hover:border-foreground/30 text-foreground"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Abertos agora</span>
        </button>

        {/* 5. Entrega grátis Toggle */}
        <button
          onClick={() => setFreeDelivery(!freeDelivery)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer shadow-sm ${
            freeDelivery
              ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/10"
              : "bg-surface dark:bg-card-bg border-card-border/60 hover:border-foreground/30 text-foreground"
          }`}
        >
          <Bike className="h-3.5 w-3.5" />
          <span>Entrega grátis</span>
        </button>

        {/* 6. Promoções Toggle */}
        <button
          onClick={() => setPromotionOnly(!promotionOnly)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer shadow-sm ${
            promotionOnly
              ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/10"
              : "bg-surface dark:bg-card-bg border-card-border/60 hover:border-foreground/30 text-foreground"
          }`}
        >
          <Tag className="h-3.5 w-3.5" />
          <span>Promoções</span>
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-surface dark:bg-card-bg border border-card-border rounded-2xl">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-foreground">
            Ops, algo deu errado
          </h3>
          <p className="text-xs text-muted-text mt-2 max-w-xs">{error}</p>
        </div>
      )}

      {/* Loading Skeleton Grid */}
      {loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <StoreCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Catalog Grid */}
      {!loading && !error && (
        <>
          {processedStores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-surface dark:bg-card-bg border border-card-border rounded-2xl shadow-sm">
              <div className="h-14 w-14 rounded-full bg-neutral-50 dark:bg-neutral-900/60 flex items-center justify-center mb-4">
                <CategoryIcon className="h-6 w-6 text-muted-text/80" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Nenhum estabelecimento em {categoryTitle}
              </h3>
              <p className="text-xs text-muted-text mt-2 max-w-xs">
                Não encontramos nenhuma loja correspondente aos seus filtros
                nesta categoria.
              </p>
              <button
                onClick={() => router.push("/delivery")}
                className="mt-4 px-4 py-2 text-xs font-semibold text-emerald-500 border border-emerald-500/30 hover:border-emerald-500 rounded-full transition-colors cursor-pointer"
              >
                Ver todos os estabelecimentos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {processedStores.map((store) => (
                <StoreCard key={store.id} item={store} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CategoryDeliveryPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center animate-pulse">
          <div className="h-8 w-48 bg-card-border/60 mx-auto rounded mb-4" />
          <div className="h-4 w-64 bg-card-border/60 mx-auto rounded" />
        </div>
      }
    >
      <CategoryPageContent />
    </Suspense>
  );
}
