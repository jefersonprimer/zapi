"use client";

import { ReactNode, useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ShoppingBag,
  Search,
  MapPin,
  ChevronDown,
  X,
  Plus,
  Minus,
  Trash2,
  Store,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listStores, listAddresses, createAddress, type UserAddress } from "@/lib/api";
import { CartProvider, useCart } from "@/lib/cart-context";
import { slugify, formatPrice } from "@/lib/utils";
import Footer from "@/components/Footer";
import AddressModal, { type AddressData } from "@/components/AddressModal";

const LABEL_TEXT: Record<string, string> = {
  casa: "Casa",
  trabalho: "Trabalho",
  outro: "Outro",
};

function HeaderControls() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { token } = useAuth();
  const {
    cart,
    cartStore,
    addToCart,
    removeFromCart,
    clearCart,
    cartCount,
    cartTotal,
  } = useCart();

  const [cities, setCities] = useState<string[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isCartDropdownOpen, setIsCartDropdownOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const cartDropdownRef = useRef<HTMLDivElement>(null);

  // Get current filters from URL search params
  const searchQuery = searchParams.get("q") || "";
  const selectedCity = searchParams.get("city") || "all";

  // Load stores to extract cities & load user addresses if authenticated
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoadingAddresses(true);
        const storeRes = await listStores();
        const uniqueCities = Array.from(
          new Set(storeRes.stores.map((s) => s.city)),
        ).sort();
        if (isMounted) setCities(uniqueCities);

        let userCity: string | null = null;

        if (token) {
          try {
            const addrRes = await listAddresses(token);
            const addrs = addrRes.addresses || [];
            if (isMounted) setAddresses(addrs);
            const def = addrs.find((a) => a.is_default) || addrs[0];
            if (def) {
              if (isMounted) setSelectedAddressId(def.id);
              userCity = def.cidade;
            }
          } catch (e) {
            console.error("Error fetching user addresses:", e);
          }
        }

        // Check local storage if no DB address city
        if (!userCity && typeof window !== "undefined") {
          const storedCity = localStorage.getItem("zapi_user_city");
          if (storedCity && storedCity !== "all") {
            userCity = storedCity;
          }
        }

        const urlCity = searchParams.get("city");

        // Handle filtering and first-access prompt logic
        if (!urlCity || urlCity === "all") {
          if (userCity) {
            // Automatically set city filter to user's address/saved city
            if (pathname === "/delivery") {
              const params = new URLSearchParams(window.location.search);
              params.set("city", userCity);
              router.replace(`/delivery?${params.toString()}`);
            }
          } else {
            // First time accessing /delivery without address or city saved!
            const promptSeen = typeof window !== "undefined" ? sessionStorage.getItem("zapi_address_prompt_seen") : null;
            if (!promptSeen && pathname === "/delivery") {
              if (isMounted) setIsAddressModalOpen(true);
              if (typeof window !== "undefined") {
                sessionStorage.setItem("zapi_address_prompt_seen", "true");
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to load cities/addresses in header:", err);
      } finally {
        if (isMounted) setLoadingAddresses(false);
      }
    }
    loadData();

    return () => {
      isMounted = false;
    };
  }, [token, pathname, router, searchParams]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        cityDropdownRef.current &&
        !cityDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCityDropdownOpen(false);
      }
      if (
        cartDropdownRef.current &&
        !cartDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCartDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set("q", value);
    } else {
      params.delete("q");
    }

    if (pathname === "/delivery") {
      router.push(`/delivery?${params.toString()}`);
    } else {
      router.push(`/delivery?q=${encodeURIComponent(value)}`);
    }
  };

  const handleAddressSelect = (addr: UserAddress) => {
    setSelectedAddressId(addr.id);
    handleCitySelect(addr.cidade);
  };

  const handleCitySelect = (city: string) => {
    const params = new URLSearchParams(window.location.search);
    if (city && city !== "all") {
      params.set("city", city);
      const matchedAddr = addresses.find(
        (a) => a.cidade.toLowerCase() === city.toLowerCase()
      );
      if (matchedAddr) {
        setSelectedAddressId(matchedAddr.id);
      } else {
        setSelectedAddressId(null);
      }
    } else {
      params.delete("city");
      setSelectedAddressId(null);
    }
    setIsCityDropdownOpen(false);

    if (pathname === "/delivery") {
      router.push(`/delivery?${params.toString()}`);
    } else {
      router.push(`/delivery?city=${encodeURIComponent(city)}`);
    }
  };

  const handleSaveAddress = async (data: AddressData) => {
    if (token) {
      try {
        const res = await createAddress(token, data);
        setAddresses((prev) => [res.address, ...prev]);
        setSelectedAddressId(res.address.id);
      } catch (err) {
        console.error("Failed to save address in database:", err);
      }
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("zapi_user_city", data.cidade);
      localStorage.setItem("zapi_user_address", JSON.stringify(data));
    }
    handleCitySelect(data.cidade);
    setIsAddressModalOpen(false);
  };

  const handleSelectCityModal = (city: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("zapi_user_city", city);
    }
    handleCitySelect(city);
    setIsAddressModalOpen(false);
  };

  const currentAddress =
    addresses.find((a) => a.id === selectedAddressId) ||
    (selectedCity !== "all"
      ? addresses.find(
          (a) => a.cidade.toLowerCase() === selectedCity.toLowerCase()
        )
      : null) ||
    addresses.find((a) => a.is_default) ||
    addresses[0] ||
    null;

  return (
    <div className="flex items-center justify-between flex-grow gap-4 sm:gap-6">
      {/* Search Input (Centered layout) */}
      <div className="relative flex-grow max-w-md mx-auto hidden md:block">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-text/80" />
        </div>
        <input
          type="text"
          placeholder="Buscar restaurantes ou culinária..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 rounded-full border border-card-border/60 bg-surface/50 dark:bg-card-bg/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500/80 transition-all text-sm placeholder:text-muted-text/50 font-sans tracking-wide"
        />
        {searchQuery && (
          <button
            onClick={() => handleSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text hover:text-foreground cursor-pointer transition-colors p-1"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Right side controls: Location & Cart */}
      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-end">
        {/* City/Address Custom Selector (styled like mobile address bar) */}
        <div className="relative" ref={cityDropdownRef}>
          <button
            onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
            className="flex items-center gap-2.5 bg-surface dark:bg-card-bg/60 border border-card-border/60 hover:border-emerald-500/40 rounded-2xl px-3.5 py-1.5 text-left shadow-sm hover:shadow transition-all cursor-pointer max-w-[240px] sm:max-w-[280px]"
          >
            <MapPin className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            <div className="flex flex-col min-w-0 flex-grow leading-tight">
              {token && loadingAddresses ? (
                <span className="text-xs font-medium text-muted-text animate-pulse">
                  Carregando endereço...
                </span>
              ) : currentAddress ? (
                <>
                  <span className="text-xs font-bold text-foreground truncate">
                    {(LABEL_TEXT[currentAddress.label] || currentAddress.label)} · {currentAddress.cidade}/{currentAddress.estado}
                  </span>
                  <span className="text-[10px] text-muted-text truncate font-normal">
                    {currentAddress.rua}, {currentAddress.numero} — {currentAddress.bairro}
                  </span>
                </>
              ) : selectedCity && selectedCity !== "all" ? (
                <>
                  <span className="text-xs font-bold text-foreground truncate">
                    {selectedCity}
                  </span>
                  <span className="text-[10px] text-muted-text truncate font-normal">
                    Cidade selecionada
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs font-bold text-foreground truncate">
                    Informe seu endereço de entrega
                  </span>
                  <span className="text-[10px] text-muted-text truncate font-normal">
                    Todas as Cidades
                  </span>
                </>
              )}
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted-text flex-shrink-0 transition-transform duration-200 ${isCityDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isCityDropdownOpen && (
            <div className="absolute right-0 mt-2.5 w-72 rounded-2xl bg-surface dark:bg-card-bg border border-card-border/70 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3 border-b border-card-border/40 flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-text uppercase tracking-wider">
                  Selecione a Localização
                </span>
                <button
                  onClick={() => {
                    setIsCityDropdownOpen(false);
                    setIsAddressModalOpen(true);
                  }}
                  className="text-[10px] font-bold text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Endereço
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto py-1.5">
                <button
                  onClick={() => {
                    setIsCityDropdownOpen(false);
                    setIsAddressModalOpen(true);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 transition-colors flex items-center gap-2 border-b border-card-border/30"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Cadastrar Novo Endereço</span>
                </button>
                <button
                  onClick={() => handleCitySelect("all")}
                  className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors flex items-center justify-between ${!currentAddress && selectedCity === "all" ? "text-emerald-500 bg-emerald-50/20 font-semibold" : "text-foreground"}`}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">Todas as Cidades</span>
                    <span className="text-[10px] text-muted-text">Ver estabelecimentos de todas as regiões</span>
                  </div>
                  {!currentAddress && selectedCity === "all" && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  )}
                </button>

                {addresses.length > 0 && (
                  <div className="border-t border-card-border/30 my-1 pt-1">
                    <div className="px-4 py-1 text-[9px] font-bold text-muted-text uppercase tracking-wider">
                      Meus Endereços
                    </div>
                    {addresses.map((addr) => {
                      const isSelected = currentAddress?.id === addr.id;
                      return (
                        <button
                          key={addr.id}
                          onClick={() => handleAddressSelect(addr)}
                          className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-900/40 ${isSelected ? "text-emerald-500 bg-emerald-50/20 font-semibold" : "text-foreground"}`}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 flex-grow">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold uppercase text-[10px] tracking-wide text-emerald-600 dark:text-emerald-400">
                                {LABEL_TEXT[addr.label] || addr.label}
                              </span>
                              <span className="text-[10px] text-muted-text">
                                · {addr.cidade}/{addr.estado}
                              </span>
                            </div>
                            <span className="truncate text-xs font-medium text-foreground">
                              {addr.rua}, {addr.numero}
                            </span>
                            <span className="text-[10px] text-muted-text truncate">
                              {addr.bairro}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {cities.length > 0 && (
                  <div className="border-t border-card-border/30 my-1 pt-1">
                    <div className="px-4 py-1 text-[9px] font-bold text-muted-text uppercase tracking-wider">
                      Cidades Disponíveis
                    </div>
                    {cities.map((city) => {
                      const isSelected = !currentAddress && selectedCity === city;
                      return (
                        <button
                          key={city}
                          onClick={() => handleCitySelect(city)}
                          className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors flex items-center justify-between ${isSelected ? "text-emerald-500 bg-emerald-50/20 font-semibold" : "text-foreground"}`}
                        >
                          <span>{city}</span>
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Shopping Cart Custom Selector */}
        <div className="relative" ref={cartDropdownRef}>
          <button
            onClick={() => setIsCartDropdownOpen(!isCartDropdownOpen)}
            className={`relative flex items-center justify-center h-9 w-9 rounded-full border border-card-border/60 bg-surface dark:bg-card-bg/60 hover:border-emerald-500/40 hover:shadow-sm transition-all cursor-pointer ${cartCount > 0 ? "text-emerald-500 border-emerald-500/20 bg-emerald-50/10" : "text-muted-text hover:text-foreground"}`}
          >
            <ShoppingBag className="h-4.5 w-4.5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm animate-pulse">
                {cartCount}
              </span>
            )}
          </button>

          {isCartDropdownOpen && (
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
                    className="text-[10px] font-semibold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" /> Limpar
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto p-4 space-y-3.5">
                {cart.length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center">
                    <div className="h-10 w-10 rounded-full bg-neutral-50 dark:bg-neutral-900/60 flex items-center justify-center mb-2.5">
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
                          {formatPrice(item.product.price)}
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
                    href={`/delivery/${slugify(cartStore.city)}/${slugify(cartStore.name)}`}
                    onClick={() => setIsCartDropdownOpen(false)}
                    className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 hover:shadow-lg transition-all"
                  >
                    <span>Finalizar Pedido</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        onSaveAddress={handleSaveAddress}
        onSelectCity={handleSelectCityModal}
        availableCities={cities}
        initialCity={selectedCity}
      />
    </div>
  );
}

export default function DeliveryLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="h-full overflow-y-auto bg-background text-foreground flex flex-col font-sans">
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-card-border/40 transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6 sm:gap-10">
            {/* Logo Section */}
            <Link
              href="/delivery"
              className="flex items-center space-x-2.5 group flex-shrink-0"
            >
              <span className="text-lg font-black tracking-tight text-foreground/90 font-sans group-hover:text-foreground transition-colors">
                Zapi Food
              </span>
            </Link>

            {/* Middle and Right Controls */}
            <Suspense
              fallback={
                <div className="h-8 w-64 bg-card-border/60 animate-pulse rounded-full" />
              }
            >
              <HeaderControls />
            </Suspense>
          </div>
        </header>

        <main className="flex-grow">{children}</main>

        <Footer />
      </div>
    </CartProvider>
  );
}
