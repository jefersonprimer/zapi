"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";

import { useRouter, useSearchParams } from "next/navigation";
import {
  getStore,
  listStores,
  createChat,
  type Store,
  type StoreProduct,
  type StoreProductCategory,
  type StoreHours,
  type StoreDeliverySlot,
  type StoreCoupon,
  createStoreReview,
  listStoreReviews,
  type StoreReviewWithUser,
  listSchedulingServices,
  listProfessionals,
  getAvailableSlots,
  createAppointment,
  type SchedulingService,
  type Professional,
  type AvailableSlot,
} from "@/lib/api";
import {
  getPublisherByUser,
  toggleFollow,
  toggleFollowByUser,
} from "@/lib/updates-api";
import { slugify, getImageUrl } from "@/lib/utils";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import ProductCardVertical from "@/components/ProductCardVertical";
import ProductHorizontalCard from "@/components/ProductHorizontalCard";
import FoodCustomizerModal from "@/components/FoodCustomizerModal";
import ProductDetailMainCard from "@/components/ProductDetailMainCard";
import StoreVerticalSidebar from "@/components/StoreVerticalSidebar";
import {
  ArrowLeft,
  Star,
  AlertCircle,
  Store as StoreIcon,
  Search,
  Loader2,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
} from "lucide-react";

const SERVICE_CATEGORIES = [
  "barbeiro",
  "salao",
  "estetica",
  "tatuagem",
  "clinica",
  "dentista",
  "oficina",
  "personal",
  "fotografo",
];

interface PageProps {
  params: Promise<{
    city: string;
    storeSlug: string;
  }>;
}


function StoreDetailPageContent({ params }: PageProps) {
  const { city, storeSlug } = React.use(params);
  const searchParams = useSearchParams();
  const targetProductId =
    searchParams.get("product") ||
    searchParams.get("productId") ||
    searchParams.get("produto");

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

  const { token, user } = useAuth();
  const router = useRouter();

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [publisherId, setPublisherId] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  // Scheduling states
  const [schedulingServices, setSchedulingServices] = useState<SchedulingService[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedService, setSelectedService] = useState<SchedulingService | null>(null);
  const [selectedProf, setSelectedProf] = useState<Professional | null>(null);
  const [bookingDate, setBookingDate] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingStep, setBookingStep] = useState(1);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Active category navigation helper
  const [activeCategory, setActiveCategory] = useState<string>("");

  // Search input state
  const [searchQuery, setSearchQuery] = useState("");

  // Selected product state for detail view
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(
    null,
  );

  // Customizer modal state for food stores
  const [customizerProduct, setCustomizerProduct] = useState<StoreProduct | null>(null);

  useEffect(() => {
    if (!token || !data?.store?.owner_id) return;
    let active = true;
    const currentToken = token;
    const ownerId = data.store.owner_id;

    async function checkPublisher() {
      try {
        const pub = await getPublisherByUser(currentToken, ownerId);
        if (active && pub) {
          setPublisherId(pub.id);
          setIsFollowing(!!pub.is_following);
          setFollowersCount(pub.followers_count ?? 0);
          setFollowingCount(pub.following_count ?? 0);
        }
      } catch (err) {
        console.error("Error loading store publisher:", err);
      }
    }

    checkPublisher();
    return () => {
      active = false;
    };
  }, [token, data?.store?.owner_id]);

  const handleOpenChat = async () => {
    if (!token) {
      router.push("/login");
      return;
    }
    if (!data?.store?.owner_id || (user?.id && user.id === data.store.owner_id))
      return;

    try {
      setChatLoading(true);
      const chatRes = await createChat(token, data.store.owner_id);
      if (chatRes?.id) {
        router.push(`/?chatId=${chatRes.id}`);
      } else {
        router.push(`/?participantId=${data.store.owner_id}`);
      }
    } catch (err) {
      console.error("Error opening chat with store:", err);
      router.push(`/?participantId=${data.store.owner_id}`);
    } finally {
      setChatLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!token) {
      router.push("/login");
      return;
    }
    if (!data?.store?.owner_id || (user?.id && user.id === data.store.owner_id))
      return;

    try {
      setFollowLoading(true);
      let res;
      if (publisherId) {
        res = await toggleFollow(token, publisherId);
      } else {
        res = await toggleFollowByUser(token, data.store.owner_id);
      }
      setIsFollowing(res.following);
      setFollowersCount((prev) => {
        if (prev === null) return res.following ? 1 : 0;
        return res.following ? prev + 1 : Math.max(0, prev - 1);
      });
    } catch (err) {
      console.error("Error toggling follow store:", err);
    } finally {
      setFollowLoading(false);
    }
  };

  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [reviews, setReviews] = useState<StoreReviewWithUser[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [userComment, setUserComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadStore = useCallback(async () => {
    try {
      setLoading(true);
      const response = await listStores();
      let matched = response.stores.find(
        (s) => slugify(s.city) === city && slugify(s.name) === storeSlug,
      );

      if (!matched) {
        // Fallback check if storeSlug is store ID directly
        matched = response.stores.find((s) => s.id === storeSlug);
      }

      if (!matched) {
        setError("Estabelecimento não encontrado nesta cidade.");
        return;
      }

      const details = await getStore(undefined, matched.id);
      setData(details);

      if (details.categories.length > 0) {
        setActiveCategory(""); // Default to "Todos" (all categories)
      }

      if (targetProductId && details.products) {
        const foundProd = details.products.find(
          (p) => p.id === targetProductId,
        );
        if (foundProd) {
          setSelectedProduct(foundProd);
        }
      }
    } catch (err) {
      console.error("Error loading store details:", err);
      setError("Ocorreu um erro ao carregar os detalhes do estabelecimento.");
    } finally {
      setLoading(false);
    }
  }, [city, storeSlug, targetProductId]);

  const loadReviews = async () => {
    if (!data?.store?.id) return;
    try {
      setReviewsLoading(true);
      const res = await listStoreReviews(token || "", data.store.id);
      setReviews(res.reviews || []);
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      router.push("/login");
      return;
    }
    if (!data?.store?.id) return;
    if (userRating < 1 || userRating > 5) {
      alert("Por favor, selecione uma nota de 1 a 5 estrelas.");
      return;
    }
    try {
      setSubmittingReview(true);
      await createStoreReview(token, data.store.id, userRating, userComment);
      setUserComment("");
      setUserRating(5);

      const res = await listStoreReviews(token, data.store.id);
      setReviews(res.reviews || []);

      const response = await listStores();
      let matched = response.stores.find(
        (s) => slugify(s.city) === city && slugify(s.name) === storeSlug,
      );
      if (!matched) {
        matched = response.stores.find((s) => s.id === storeSlug);
      }
      if (matched) {
        const details = await getStore(undefined, matched.id);
        setData(details);
      }
    } catch (err: unknown) {
      console.error("Failed to submit review:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Não foi possível enviar a avaliação.",
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        loadStore();
      }
    });
    return () => {
      active = false;
    };
  }, [loadStore]);

  // Load services and professionals if the store is a service category
  useEffect(() => {
    if (!data?.store?.id) return;
    const isService = SERVICE_CATEGORIES.includes(data.store.category);
    if (isService) {
      listSchedulingServices(data.store.id)
        .then(setSchedulingServices)
        .catch((err) => console.error("Error listing scheduling services:", err));
      listProfessionals(data.store.id)
        .then(setProfessionals)
        .catch((err) => console.error("Error listing professionals:", err));
    }
  }, [data?.store]);

  // Fetch available slots dynamically when service, professional, or date changes
  useEffect(() => {
    if (!data?.store?.id || !bookingDate || !selectedService || !selectedProf) return;
    let active = true;
    setLoadingSlots(true);
    getAvailableSlots(data.store.id, bookingDate, selectedService.id, selectedProf.id)
      .then((slots) => {
        if (active) setAvailableSlots(slots);
      })
      .catch((err) => console.error("Error loading available slots:", err))
      .finally(() => {
        if (active) setLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, [data?.store?.id, bookingDate, selectedService, selectedProf]);

  const handleBookAppointment = async () => {
    if (!token) {
      alert("Por favor, faça login para agendar.");
      router.push("/login");
      return;
    }
    if (!data?.store?.id || !selectedService || !selectedProf || !bookingDate || !selectedSlot) {
      alert("Por favor, preencha todos os campos.");
      return;
    }
    if (!clientName.trim() || !clientPhone.trim()) {
      alert("Por favor, preencha seu nome e telefone de contato.");
      return;
    }

    try {
      setBookingLoading(true);
      await createAppointment(token, {
        store_id: data.store.id,
        service_id: selectedService.id,
        professional_id: selectedProf.id,
        appointment_date: bookingDate,
        start_time: selectedSlot.start,
        client_name: clientName,
        client_phone: clientPhone,
        notes: bookingNotes || null,
      });
      setBookingSuccess(true);
      setBookingStep(5);
    } catch (err: any) {
      alert(err.message || "Erro ao realizar agendamento");
    } finally {
      setBookingLoading(false);
    }
  };


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
          href="/all"
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-bold shadow-md shadow-emerald-500/20 hover:scale-[1.02] transition-transform"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para o Catálogo
        </Link>
      </div>
    );
  }

  const { store, products, categories, hours, slots, coupons } = data;
  const isOwner = Boolean(
    user?.id && store?.owner_id && user.id === store.owner_id,
  );


  const isFoodStore = [
    "restaurante",
    "fast_food",
    "lanchonete",
    "lanches",
    "pizza",
    "marmita",
    "padaria",
    "salgados",
    "pastel",
    "confeitaria",
    "acai",
    "sorvete",
    "cafe",
    "comida_japonesa",
    "comida_italiana",
    "comida_chinesa",
    "comida_arabe",
    "comida_mexicana",
    "frango_assado",
    "churrascaria",
    "saudavel",
    "vegetariana",
  ].includes(store.category);

  // Cart operations
  const addToCart = (product: StoreProduct) => {
    if (isFoodStore) {
      setCustomizerProduct(product);
    } else {
      globalAddToCart(product, store);
    }
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

  // Filter products on promotion
  const promotionalProducts = filteredProducts.filter(
    (prod) =>
      prod.promotional_price != null &&
      prod.promotional_price > 0 &&
      prod.promotional_price < prod.price,
  );

  // Group products by category (including a virtual "Promoções" category if there are promotional items)
  const promoCategoryGroup =
    promotionalProducts.length > 0
      ? [
          {
            category: {
              id: "promocao",
              store_id: store.id,
              name: "Promoções",
              sort_order: -1,
              created_at: "",
            },
            items: promotionalProducts,
          },
        ]
      : [];

  const standardCategoryGroups = categories
    .map((cat) => ({
      category: cat,
      items: filteredProducts.filter(
        (prod) => prod.category_id === cat.id || prod.category === cat.name,
      ),
    }))
    .filter((group) => group.items.length > 0);

  const productsByCategory = [...promoCategoryGroup, ...standardCategoryGroups];

  // Find products for active category if one is selected
  const displayGroups = activeCategory
    ? productsByCategory.filter((group) => group.category.id === activeCategory)
    : productsByCategory;

  // Same sector / category products helper for selected product detail view
  const selectedCategoryObj = selectedProduct
    ? categories.find(
        (cat) =>
          cat.id === selectedProduct.category_id ||
          cat.name === selectedProduct.category,
      )
    : null;

  const sameCategoryName =
    selectedCategoryObj?.name || selectedProduct?.category || "Mesmo Setor";

  const sameCategoryProducts = selectedProduct
    ? products.filter(
        (prod) =>
          (selectedProduct.category_id &&
            prod.category_id === selectedProduct.category_id) ||
          (selectedProduct.category &&
            prod.category === selectedProduct.category) ||
          (selectedCategoryObj &&
            (prod.category_id === selectedCategoryObj.id ||
              prod.category === selectedCategoryObj.name)),
      )
    : [];



  // Helper to scroll carousel horizontally
  const scrollCarousel = (categoryId: string, direction: "left" | "right") => {
    const container = document.getElementById(`carousel-${categoryId}`);
    if (container) {
      const scrollAmount = direction === "left" ? -350 : 350;
      container.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-24">
      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 items-start">
        {/* Sidebar (Left Side) */}
        <StoreVerticalSidebar
          store={store}
          isOwner={isOwner}
          isFollowing={isFollowing}
          followersCount={followersCount}
          followingCount={followingCount}
          followLoading={followLoading}
          chatLoading={chatLoading}
          hours={hours}
          coupons={coupons}
          slots={slots}
          onOpenChat={handleOpenChat}
          onToggleFollow={handleToggleFollow}
          onOpenReviews={() => {
            setReviewsModalOpen(true);
            loadReviews();
          }}
        />

        {/* Main Content (Right Side) */}
        <main className="lg:col-span-3 space-y-6 py-6 px-4">
          {(() => {
            const isServiceStore = SERVICE_CATEGORIES.includes(store.category);
            if (isServiceStore) {
              return (
                <div className="space-y-6">
                  {/* PORTFOLIO / GALLERY */}
                  {schedulingServices.length > 0 && (
                    <div className="bg-surface border border-card-border rounded-2xl p-6 shadow-sm">
                      <h2 className="text-lg font-bold mb-4">Galeria do Estabelecimento</h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {schedulingServices
                          .filter((s) => s.image_url)
                          .slice(0, 6)
                          .map((s) => (
                            <div key={s.id} className="relative h-32 rounded-xl overflow-hidden group">
                              <Image src={s.image_url!} alt={s.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2.5">
                                <span className="text-[10px] font-bold text-white leading-tight line-clamp-1">{s.name}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* BOOKING WIZARD */}
                  <div className="bg-surface border border-card-border rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-card-border pb-4">
                      <h2 className="text-xl font-bold">Agendamento Online</h2>
                      <span className="text-xs text-muted-text font-semibold">Passo {bookingStep} de 4</span>
                    </div>

                    {bookingStep === 1 && (
                      <div className="space-y-4">
                        <h3 className="font-semibold text-sm">Selecione o serviço:</h3>
                        {schedulingServices.length === 0 ? (
                          <p className="text-sm text-muted-text">Nenhum serviço disponível no momento.</p>
                        ) : (
                          <div className="grid gap-3">
                            {schedulingServices.map((s) => (
                              <div
                                key={s.id}
                                onClick={() => {
                                  setSelectedService(s);
                                  setBookingStep(2);
                                }}
                                className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer hover:border-emerald-500 transition-all ${
                                  selectedService?.id === s.id ? "border-emerald-500 bg-emerald-500/5" : "border-card-border"
                                }`}
                              >
                                <div>
                                  <p className="font-bold text-sm">{s.name}</p>
                                  {s.description && <p className="text-xs text-muted-text mt-1">{s.description}</p>}
                                  <p className="text-xs text-muted-text mt-2 font-medium">{s.duration_minutes} minutos</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-emerald-500">R$ {s.price.toFixed(2)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {bookingStep === 2 && (
                      <div className="space-y-4">
                        <h3 className="font-semibold text-sm">Escolha o profissional:</h3>
                        <div className="grid gap-3">
                          {professionals
                            .filter((p) => !selectedService || p.service_ids.includes(selectedService.id))
                            .map((p) => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setSelectedProf(p);
                                  setBookingStep(3);
                                }}
                                className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer hover:border-emerald-500 transition-all ${
                                  selectedProf?.id === p.id ? "border-emerald-500 bg-emerald-500/5" : "border-card-border"
                                }`}
                              >
                                <div className="relative h-12 w-12 rounded-full overflow-hidden bg-gray-150 flex-shrink-0">
                                  {p.avatar_url ? (
                                    <Image src={p.avatar_url} alt={p.name} fill className="object-cover" />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center bg-emerald-500/10 text-emerald-500 font-bold text-lg">
                                      {p.name.charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-bold text-sm">{p.name}</p>
                                  {p.bio && <p className="text-xs text-muted-text mt-0.5">{p.bio}</p>}
                                </div>
                              </div>
                            ))}
                        </div>
                        <button
                          onClick={() => setBookingStep(1)}
                          className="text-xs font-bold text-muted-text mt-4 flex items-center gap-1 hover:text-foreground cursor-pointer"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Serviços
                        </button>
                      </div>
                    )}

                    {bookingStep === 3 && (
                      <div className="space-y-4">
                        <h3 className="font-semibold text-sm">Escolha a data e hora:</h3>
                        <input
                          type="date"
                          value={bookingDate}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(e) => setBookingDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-card-border rounded-lg bg-surface text-foreground"
                        />

                        {bookingDate && (
                          <div className="space-y-2 mt-4">
                            <p className="text-xs font-semibold text-muted-text">Horários disponíveis:</p>
                            {loadingSlots ? (
                              <div className="flex items-center gap-2 py-4">
                                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                                <span className="text-xs text-muted-text">Calculando horários livres...</span>
                              </div>
                            ) : availableSlots.length === 0 ? (
                              <p className="text-xs text-muted-text italic">Nenhum horário disponível para esta data.</p>
                            ) : (
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {availableSlots.map((slot) => (
                                  <button
                                    key={slot.start}
                                    disabled={!slot.available}
                                    onClick={() => {
                                      if (slot.available) setSelectedSlot(slot);
                                    }}
                                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                                      !slot.available
                                        ? "bg-card-border/30 border-transparent text-muted-text cursor-not-allowed opacity-40"
                                        : selectedSlot?.start === slot.start
                                        ? "bg-emerald-500 text-white border-emerald-500"
                                        : "border-card-border hover:border-emerald-500 text-foreground"
                                    }`}
                                  >
                                    {slot.start}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-4">
                          <button
                            onClick={() => setBookingStep(2)}
                            className="text-xs font-bold text-muted-text flex items-center gap-1 hover:text-foreground cursor-pointer"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Profissional
                          </button>
                          {selectedSlot && (
                            <button
                              onClick={() => setBookingStep(4)}
                              className="px-4 py-2 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition-colors"
                            >
                              Avançar
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {bookingStep === 4 && (
                      <div className="space-y-4">
                        <h3 className="font-semibold text-sm">Confirme seus dados para contato:</h3>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-muted-text block mb-1">Seu Nome *</label>
                            <input
                              type="text"
                              value={clientName}
                              onChange={(e) => setClientName(e.target.value)}
                              placeholder="Ex: João Silva"
                              className="w-full px-3.5 py-2 border border-card-border rounded-lg bg-surface text-foreground text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-text block mb-1">Telefone / WhatsApp *</label>
                            <input
                              type="text"
                              value={clientPhone}
                              onChange={(e) => setClientPhone(e.target.value)}
                              placeholder="Ex: (11) 99999-9999"
                              className="w-full px-3.5 py-2 border border-card-border rounded-lg bg-surface text-foreground text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-text block mb-1">Observações (Opcional)</label>
                            <textarea
                              value={bookingNotes}
                              onChange={(e) => setBookingNotes(e.target.value)}
                              placeholder="Alguma observação para o profissional?"
                              className="w-full px-3.5 py-2 border border-card-border rounded-lg bg-surface text-foreground text-sm resize-none"
                              rows={2}
                            />
                          </div>
                        </div>

                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 space-y-2 mt-4">
                          <p className="text-xs font-bold text-emerald-500">Resumo do Agendamento:</p>
                          <div className="text-xs text-muted-text space-y-1">
                            <p>Serviço: <span className="font-semibold text-foreground">{selectedService?.name}</span> (R$ {selectedService?.price.toFixed(2)})</p>
                            <p>Profissional: <span className="font-semibold text-foreground">{selectedProf?.name}</span></p>
                            <p>Data: <span className="font-semibold text-foreground">{bookingDate}</span></p>
                            <p>Horário: <span className="font-semibold text-foreground">{selectedSlot?.start}</span></p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-4">
                          <button
                            onClick={() => setBookingStep(3)}
                            className="text-xs font-bold text-muted-text flex items-center gap-1 hover:text-foreground cursor-pointer"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Data
                          </button>
                          <button
                            onClick={handleBookAppointment}
                            disabled={bookingLoading}
                            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                          >
                            {bookingLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Confirmar Agendamento
                          </button>
                        </div>
                      </div>
                    )}

                    {bookingStep === 5 && bookingSuccess && (
                      <div className="text-center py-6 space-y-4">
                        <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-950/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                          <Check className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">Agendamento Solicitado!</h3>
                          <p className="text-xs text-muted-text mt-1.5 px-4 max-w-sm mx-auto">
                            Seu agendamento foi encaminhado e está pendente de confirmação. Você receberá atualizações diretamente no chat do Zapi!
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedService(null);
                            setSelectedProf(null);
                            setBookingDate("");
                            setSelectedSlot(null);
                            setBookingStep(1);
                            setBookingSuccess(false);
                          }}
                          className="px-4 py-2 border border-card-border rounded-lg text-xs font-semibold hover:bg-card-border/10 transition-colors"
                        >
                          Realizar Novo Agendamento
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <>
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
              className="w-full pl-12 pr-10 py-3.5 bg-surface border border-card-border rounded-full text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-sm"
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
          {!selectedProduct && productsByCategory.length > 0 && (
            <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-md py-3 border-b border-card-border overflow-x-auto flex gap-2 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <button
                onClick={() => {
                  setActiveCategory("");
                  setSelectedProduct(null);
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === "" && !selectedProduct
                    ? "bg-foreground text-background"
                    : "bg-surface border border-card-border text-muted-text hover:text-foreground"
                }`}
              >
                Todos
              </button>
              {productsByCategory.map((group) => (
                <button
                  key={group.category.id}
                  onClick={() => {
                    setActiveCategory(group.category.id);
                    setSelectedProduct(null);
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeCategory === group.category.id && !selectedProduct
                      ? "bg-foreground text-background"
                      : "bg-surface border border-card-border text-muted-text hover:text-foreground"
                  }`}
                >
                  {group.category.name}
                </button>
              ))}
            </div>
          )}

          {/* Empty Catalog / Search Results State OR Product Detail View */}
          {selectedProduct ? (
            <div className="space-y-2 animate-in fade-in duration-300">
              {/* Back & Breadcrumb Bar */}
              <div className="flex items-center gap-2 text-sm text-muted-text font-medium">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="flex items-center gap-1 font-bold transition-colors cursor-pointer"
                >
                  Loja
                </button>
                <ChevronRight size={20} />
                <span className="text-foreground font-bold">
                  {sameCategoryName}
                </span>
              </div>

              {/* Product Detail Main Card */}
              <ProductDetailMainCard
                product={selectedProduct}
                quantity={getProductQuantity(selectedProduct.id)}
                onAddToCart={addToCart}
                onRemoveFromCart={removeFromCart}
              />

              {/* Products in the Same Sector / Category */}
              <div className="space-y-4 pt-6 border-t border-card-border">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-medium text-foreground flex items-center gap-2">
                    <span className="h-5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                    Produtos do setor de {sameCategoryName}
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const catId =
                          selectedCategoryObj?.id ||
                          selectedProduct.category_id ||
                          "";
                        setSelectedProduct(null);
                        if (catId) {
                          setActiveCategory(catId);
                        }
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="text-xs font-bold text-emerald-500 hover:text-emerald-600 flex items-center gap-1 cursor-pointer transition-colors group/link"
                    >
                      Ver mais{" "}
                      <ChevronRight className="h-4 w-4 transition-transform group-hover/link:translate-x-0.5" />
                    </button>
                  </div>
                </div>

                {isFoodStore ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sameCategoryProducts.map((product) => {
                      const quantity = getProductQuantity(product.id);

                      return (
                        <ProductHorizontalCard
                          key={product.id}
                          product={product}
                          quantity={quantity}
                          onSelect={(prod) => {
                            setSelectedProduct(prod);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          onAddToCart={addToCart}
                          onRemoveFromCart={removeFromCart}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 items-start">
                    {sameCategoryProducts.map((product) => {
                      const quantity = getProductQuantity(product.id);

                      return (
                        <ProductCardVertical
                          key={product.id}
                          product={product}
                          quantity={quantity}
                          onSelect={(prod) => {
                            setSelectedProduct(prod);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          onAddToCart={addToCart}
                          onRemoveFromCart={removeFromCart}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : displayGroups.length === 0 ? (
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
              {displayGroups.map((group) => {
                const isSingleCategoryMode = activeCategory !== "";

                return (
                  <div
                    key={group.category.id}
                    id={`cat-${group.category.id}`}
                    className="scroll-mt-36"
                  >
                    {/* Category Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <span className="h-5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                          {group.category.name}
                        </h2>
                      </div>

                      {isSingleCategoryMode && (
                        <button
                          onClick={() => setActiveCategory("")}
                          className="text-xs font-bold text-muted-text hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" /> Ver todas as
                          categorias
                        </button>
                      )}
                    </div>

                    {/* Products View: Grid of ProductHorizontalCard when isFoodStore, otherwise Carousel / Grid layout */}
                    {isFoodStore ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {group.items.map((product) => {
                          const quantity = getProductQuantity(product.id);

                          return (
                            <ProductHorizontalCard
                              key={product.id}
                              product={product}
                              quantity={quantity}
                              onSelect={(prod) => {
                                setSelectedProduct(prod);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              onAddToCart={addToCart}
                              onRemoveFromCart={removeFromCart}
                            />
                          );
                        })}
                      </div>
                    ) : isSingleCategoryMode ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 items-start">
                        {group.items.map((product) => {
                          const quantity = getProductQuantity(product.id);

                          return (
                            <ProductCardVertical
                              key={product.id}
                              product={product}
                              quantity={quantity}
                              onSelect={(prod) => {
                                setSelectedProduct(prod);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              onAddToCart={addToCart}
                              onRemoveFromCart={removeFromCart}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="relative group/carousel">
                        {/* Left Navigation Arrow */}
                        {group.items.length > 3 && (
                          <button
                            onClick={() =>
                              scrollCarousel(group.category.id, "left")
                            }
                            className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-surface/95 backdrop-blur-md border border-card-border shadow-lg text-foreground items-center justify-center hover:bg-surface hover:scale-110 active:scale-95 transition-all cursor-pointer opacity-0 group-hover/carousel:opacity-100 focus:opacity-100"
                            title="Rolar para esquerda"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                        )}

                        <div
                          id={`carousel-${group.category.id}`}
                          className="flex gap-4 overflow-x-auto pb-4 scroll-smooth scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x"
                        >
                          {group.items.map((product) => {
                            const quantity = getProductQuantity(product.id);

                            return (
                              <div
                                key={product.id}
                                className="w-[130px] sm:w-[145px] md:w-[160px] flex-shrink-0 snap-start"
                              >
                                <ProductCardVertical
                                  product={product}
                                  quantity={quantity}
                                  onSelect={(prod) => {
                                    setSelectedProduct(prod);
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }}
                                  onAddToCart={addToCart}
                                  onRemoveFromCart={removeFromCart}
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Right Navigation Arrow */}
                        {group.items.length > 3 && (
                          <button
                            onClick={() =>
                              scrollCarousel(group.category.id, "right")
                            }
                            className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-surface/95 backdrop-blur-md border border-card-border shadow-lg text-foreground items-center justify-center hover:bg-surface hover:scale-110 active:scale-95 transition-all cursor-pointer opacity-0 group-hover/carousel:opacity-100 focus:opacity-100"
                            title="Rolar para direita"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
              </>
            );
          })()}
        </main>
      </div>

      {/* Reviews Modal */}
      {reviewsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setReviewsModalOpen(false)}
          />
          <div className="relative bg-surface dark:bg-card-bg border border-card-border rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Avaliações
                </h3>
                <p className="text-xs text-muted-text">{store.name}</p>
              </div>
              <button
                onClick={() => setReviewsModalOpen(false)}
                className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted-text hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary Card */}
              <div className="bg-background border border-card-border rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <div className="text-4xl font-extrabold text-foreground font-sans">
                    {store.score != null && Number(store.ratings_count) > 0
                      ? store.score.toFixed(1)
                      : "Novo"}
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-1 my-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={16}
                        className={
                          store.score && star <= Math.round(Number(store.score))
                            ? "text-amber-500 fill-amber-500"
                            : "text-neutral-300 dark:text-neutral-700"
                        }
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-text">
                    {store.ratings_count || 0}{" "}
                    {store.ratings_count === 1 ? "avaliação" : "avaliações"}
                  </p>
                </div>
                <div className="text-center sm:text-right max-w-xs">
                  <p className="text-sm font-semibold text-foreground">
                    Sua opinião importa!
                  </p>
                  <p className="text-xs text-muted-text mt-1">
                    Avalie o estabelecimento para ajudar outros clientes e
                    contribuir para a melhoria dos serviços.
                  </p>
                </div>
              </div>

              {/* Leave a review section */}
              <div className="bg-background border border-card-border rounded-2xl p-5">
                <h4 className="font-bold text-foreground text-sm mb-3">
                  Deixe sua avaliação
                </h4>

                {token ? (
                  <form onSubmit={handleSubmitReview} className="space-y-4">
                    {/* Star selector */}
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setUserRating(star)}
                          className="p-1 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                        >
                          <Star
                            size={32}
                            className={
                              star <= userRating
                                ? "text-amber-500 fill-amber-500"
                                : "text-neutral-300 dark:text-neutral-700"
                            }
                          />
                        </button>
                      ))}
                      <span className="text-xs font-semibold text-muted-text ml-2">
                        {userRating === 1
                          ? "Muito ruim"
                          : userRating === 2
                            ? "Ruim"
                            : userRating === 3
                              ? "Regular"
                              : userRating === 4
                                ? "Muito bom"
                                : "Excelente"}
                      </span>
                    </div>

                    {/* Text comment */}
                    <div>
                      <textarea
                        value={userComment}
                        onChange={(e) => setUserComment(e.target.value)}
                        placeholder="Escreva um comentário sobre a sua experiência..."
                        maxLength={500}
                        rows={3}
                        className="w-full p-3 bg-surface border border-card-border rounded-xl text-xs text-foreground placeholder:text-muted-text focus:outline-none focus:border-emerald-500 transition-all resize-none"
                      />
                    </div>

                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/10 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {submittingReview ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <span>Enviar Avaliação</span>
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-xs text-muted-text">
                      Você precisa estar logado para deixar uma avaliação.
                    </p>
                    <Link
                      href="/login"
                      className="inline-block px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Fazer Login
                    </Link>
                  </div>
                )}
              </div>

              {/* Reviews List */}
              <div className="space-y-4">
                <h4 className="font-bold text-foreground text-sm">
                  O que dizem os clientes
                </h4>

                {reviewsLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="animate-spin text-emerald-500 h-8 w-8" />
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="text-xs text-muted-text text-center py-6">
                    Nenhuma avaliação ainda. Seja o primeiro a avaliar!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-4 bg-background border border-card-border rounded-2xl space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            {/* Avatar */}
                            <div className="h-8 w-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-emerald-600 text-xs uppercase overflow-hidden relative">
                              {rev.user_avatar ? (
                                <Image
                                  src={getImageUrl(rev.user_avatar)}
                                  alt={rev.user_name}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <span>{rev.user_name.slice(0, 2)}</span>
                              )}
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-foreground">
                                {rev.user_name}
                              </h5>
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={10}
                                    className={
                                      star <= rev.rating
                                        ? "text-amber-500 fill-amber-500"
                                        : "text-neutral-300 dark:text-neutral-700"
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-text font-sans">
                            {new Date(rev.created_at).toLocaleDateString(
                              "pt-BR",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </div>
                        {rev.comment && (
                          <p className="text-xs text-foreground/90 pl-10 leading-relaxed break-words">
                            {rev.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Food Customizer Modal */}
      <FoodCustomizerModal
        isOpen={customizerProduct !== null}
        onClose={() => setCustomizerProduct(null)}
        product={customizerProduct}
        onConfirm={(customProduct) => {
          globalAddToCart(customProduct, store);
        }}
      />
    </div>
  );
}

export default function StoreDetailPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
          <div className="h-6 w-24 bg-card-border rounded mb-6" />
          <div className="h-64 bg-card-border rounded-3xl mb-8" />
        </div>
      }
    >
      <StoreDetailPageContent {...props} />
    </Suspense>
  );
}
