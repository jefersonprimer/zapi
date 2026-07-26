"use client";

import { ReactNode, useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, MapPin, ChevronDown, X, Plus, ClipboardList } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listStores,
  listAddresses,
  createAddress,
  type UserAddress,
  type Store,
} from "@/lib/api";
import { CartProvider } from "@/lib/cart-context";
import Footer from "@/components/Footer";
import AddressModal, { type AddressData } from "@/components/AddressModal";
import ShoppingCartSelector from "@/components/ShoppingCartSelector";
import { slugify } from "@/lib/utils";

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

  const [cities, setCities] = useState<string[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  
  // Track mapped slugs for lookup
  const [citySlugMap, setCitySlugMap] = useState<Record<string, string>>({});
  const [storesForLookup, setStoresForLookup] = useState<Store[]>([]);

  const cityDropdownRef = useRef<HTMLDivElement>(null);

  // Get current filters from URL search params and pathname
  const searchQuery = searchParams.get("q") || "";

  // Determine selected city from URL path, query params, or localStorage
  const getSelectedCity = () => {
    const pathParts = pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      let segmentToEvaluate = decodeURIComponent(pathParts[0]);
      if (segmentToEvaluate === "delivery" && pathParts.length > 1) {
        segmentToEvaluate = decodeURIComponent(pathParts[1]);
      } else if (segmentToEvaluate === "delivery") {
        segmentToEvaluate = "";
      }

      if (segmentToEvaluate) {
        // Skip static page names
        const staticPages = [
          "checkout",
          "orders",
          "categoria",
          "promocoes",
          "atualizacoes",
          "comunidades",
          "cadastrar-loja",
          "all",
        ];
        if (!staticPages.includes(segmentToEvaluate)) {
          let city = segmentToEvaluate;
          if (city.startsWith("city=")) {
            city = city.substring(5);
          }
          return city.replace(/\+/g, " ");
        }
      }
    }
    const queryCity = searchParams.get("city");
    if (queryCity) return queryCity;
    if (typeof window !== "undefined") {
      const storedCity = localStorage.getItem("zapi_user_city");
      if (storedCity) return storedCity;
    }
    return "all";
  };

  const selectedCity = getSelectedCity();

  const getCitySlug = (cityName: string) => {
    const lower = cityName.toLowerCase();
    return citySlugMap[lower] || slugify(cityName);
  };

  const getFormattedCityName = (citySlug: string) => {
    if (citySlug === "all") return "Todas as Cidades";
    const entry = Object.entries(citySlugMap).find(
      ([name, slug]) => slug === citySlug || slugify(name) === citySlug,
    );
    if (entry) {
      const matchedStore = storesForLookup.find(
        (s) => s.city.toLowerCase() === entry[0].toLowerCase(),
      );
      if (matchedStore) {
        return `${matchedStore.city} - ${matchedStore.state.toUpperCase()}`;
      }
      return entry[0].replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return citySlug
      .replace(/-([a-z]{2})$/i, (_, state) => ` - ${state.toUpperCase()}`)
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Load stores to extract cities & load user addresses if authenticated
  // 1. Load data on mount or when token changes
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoadingAddresses(true);
        const storeRes = await listStores();
        const uniqueCities = Array.from(
          new Set(storeRes.stores.map((s) => s.city)),
        ).sort();
        if (isMounted) {
          setCities(uniqueCities);
          setStoresForLookup(storeRes.stores);
          
          const slugMap: Record<string, string> = {};
          storeRes.stores.forEach((s) => {
            const cityLower = s.city.toLowerCase();
            if (!slugMap[cityLower]) {
              slugMap[cityLower] = `${slugify(s.city)}-${slugify(s.state)}`;
            }
          });
          setCitySlugMap(slugMap);
        }

        if (token) {
          try {
            const addrRes = await listAddresses(token);
            const addrs = addrRes.addresses || [];
            if (isMounted) {
              setAddresses(addrs);
              const def = addrs.find((a) => a.is_default) || addrs[0];
              if (def) {
                setSelectedAddressId(def.id);
              }
            }
          } catch (e) {
            console.error("Error fetching user addresses:", e);
          }
        }
      } catch (err) {
        console.error("Failed to load cities/addresses in header:", err);
      } finally {
        if (isMounted) {
          setLoadingAddresses(false);
        }
      }
    }
    loadData();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // 2. Routing/modal side effects
  useEffect(() => {
    if (loadingAddresses) return;

    const storedCity = typeof window !== "undefined" ? localStorage.getItem("zapi_user_city") : null;
    let userCity: string | null = null;

    if (storedCity === "all") {
      userCity = "all";
    } else {
      const currentAddress =
        addresses.find((a) => a.id === selectedAddressId) ||
        (selectedCity !== "all"
          ? addresses.find(
              (a) =>
                a.cidade.toLowerCase() === selectedCity.toLowerCase() ||
                slugify(a.cidade) === slugify(selectedCity) ||
                `${slugify(a.cidade)}-${slugify(a.estado)}` === slugify(selectedCity),
            )
          : null) ||
        addresses.find((a) => a.is_default) ||
        addresses[0] ||
        null;
      
      if (currentAddress) {
        userCity = currentAddress.cidade;
      } else if (storedCity && storedCity !== "all") {
        userCity = storedCity;
      }
    }

    if (pathname === "/delivery" || (pathname === "/delivery/all" && storedCity !== "all")) {
      if (userCity && userCity !== "all") {
        const targetCityLower = userCity.toLowerCase();
        const knownSlug = citySlugMap[targetCityLower] || slugify(userCity);
        router.replace(`/delivery/${knownSlug}`);
      } else if (pathname === "/delivery") {
        router.replace("/delivery/all");
      }
    }

    if (pathname === "/delivery/all" && storedCity !== "all" && !userCity) {
      setTimeout(() => setIsAddressModalOpen(true), 0);
    }
  }, [pathname, router, loadingAddresses, addresses, selectedAddressId, selectedCity, citySlugMap]);

  // Listen to external requests to open address modal
  useEffect(() => {
    const handleOpenModal = () => setIsAddressModalOpen(true);
    window.addEventListener("zapi:open-address-modal", handleOpenModal);
    return () => window.removeEventListener("zapi:open-address-modal", handleOpenModal);
  }, []);

  // Handle click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        cityDropdownRef.current &&
        !cityDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCityDropdownOpen(false);
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

    const currentCitySlug =
      selectedCity === "all" ? "all" : getCitySlug(selectedCity);
    router.push(`/delivery/${currentCitySlug}?${params.toString()}`);
  };

  const handleAddressSelect = (addr: UserAddress) => {
    setSelectedAddressId(addr.id);
    handleCitySelect(addr.cidade);
  };

  const handleCitySelect = (city: string) => {
    setIsCityDropdownOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("zapi_user_city", city);
    }
    if (city && city !== "all") {
      const matchedAddr = addresses.find(
        (a) => a.cidade.toLowerCase() === city.toLowerCase(),
      );
      if (matchedAddr) {
        setSelectedAddressId(matchedAddr.id);
      } else {
        setSelectedAddressId(null);
      }
      router.push(`/delivery/${getCitySlug(city)}`);
    } else {
      setSelectedAddressId(null);
      router.push("/delivery/all");
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
          (a) =>
            a.cidade.toLowerCase() === selectedCity.toLowerCase() ||
            slugify(a.cidade) === slugify(selectedCity) ||
            `${slugify(a.cidade)}-${slugify(a.estado)}` === slugify(selectedCity),
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
          className="w-full pl-10 pr-10 py-2.5 rounded-full border border-card-border/60 bg-surface/50 dark:bg-card-bg/40 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/80 transition-all text-sm placeholder:text-muted-text/50 font-sans tracking-wide"
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
            className="flex items-center gap-2.5 bg-surface dark:bg-card-bg/60 border border-card-border/60 rounded-2xl px-3.5 py-1.5 text-left shadow-sm hover:shadow transition-all cursor-pointer max-w-[240px] sm:max-w-[280px]"
          >
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <div className="flex flex-col min-w-0 flex-grow leading-tight">
              {token && loadingAddresses ? (
                <span className="text-xs font-medium text-muted-text animate-pulse">
                  Carregando endereço...
                </span>
              ) : currentAddress ? (
                <>
                  <span className="text-xs font-bold text-foreground truncate">
                    {LABEL_TEXT[currentAddress.label] || currentAddress.label} ·{" "}
                    {currentAddress.cidade}/{currentAddress.estado}
                  </span>
                  <span className="text-[10px] text-muted-text truncate font-normal">
                    {currentAddress.rua}, {currentAddress.numero} —{" "}
                    {currentAddress.bairro}
                  </span>
                </>
              ) : selectedCity && selectedCity !== "all" ? (
                <>
                  <span className="text-xs font-bold text-foreground truncate">
                    {getFormattedCityName(selectedCity)}
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
                  className="text-[10px] font-bold text-foreground hover:underline flex items-center gap-1 cursor-pointer"
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
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-foreground bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2 border-b border-card-border/30"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Cadastrar Novo Endereço</span>
                </button>
                <button
                  onClick={() => handleCitySelect("all")}
                  className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors flex items-center justify-between ${!currentAddress && selectedCity === "all" ? "text-foreground bg-neutral-100 dark:bg-neutral-800/60 font-semibold" : "text-foreground"}`}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">Todas as Cidades</span>
                    <span className="text-[10px] text-muted-text">
                      Ver estabelecimentos de todas as regiões
                    </span>
                  </div>
                  {!currentAddress && selectedCity === "all" && (
                    <span className="h-2 w-2 rounded-full bg-black dark:bg-white flex-shrink-0" />
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
                          className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-900/40 ${isSelected ? "text-foreground bg-neutral-100 dark:bg-neutral-800/60 font-semibold" : "text-foreground"}`}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 flex-grow">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold uppercase text-[10px] tracking-wide text-foreground">
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
                            <span className="h-2 w-2 rounded-full bg-black dark:bg-white flex-shrink-0" />
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
                      const isSelected =
                        !currentAddress && selectedCity === city;
                      return (
                        <button
                          key={city}
                          onClick={() => handleCitySelect(city)}
                          className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors flex items-center justify-between ${isSelected ? "text-foreground bg-neutral-100 dark:bg-neutral-800/60 font-semibold" : "text-foreground"}`}
                        >
                          <span>{city}</span>
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-black dark:bg-white flex-shrink-0" />
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

        {token && (
          <Link
            href="/delivery/orders"
            title="Meus Pedidos"
            aria-label="Meus Pedidos"
            className="p-2 text-muted-text hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800/50 rounded-full transition-colors flex items-center justify-center mr-1"
          >
            <ClipboardList className="h-5 w-5" />
          </Link>
        )}

        {/* Shopping Cart Custom Selector Component */}
        <ShoppingCartSelector />
      </div>

      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        onSaveAddress={handleSaveAddress}
        onSelectCity={handleSelectCityModal}
        availableCities={cities}
        initialCity={selectedCity}
        closable={selectedCity !== "all"}
      />
    </div>
  );
}

function LogoLink() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getSelectedCity = () => {
    const pathParts = pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      let segmentToEvaluate = decodeURIComponent(pathParts[0]);
      if (segmentToEvaluate === "delivery" && pathParts.length > 1) {
        segmentToEvaluate = decodeURIComponent(pathParts[1]);
      } else if (segmentToEvaluate === "delivery") {
        segmentToEvaluate = "";
      }

      if (segmentToEvaluate) {
        // Skip static page names
        const staticPages = [
          "checkout",
          "orders",
          "categoria",
          "promocoes",
          "atualizacoes",
          "comunidades",
          "cadastrar-loja",
          "all",
        ];
        if (!staticPages.includes(segmentToEvaluate)) {
          let city = segmentToEvaluate;
          if (city.startsWith("city=")) {
            city = city.substring(5);
          }
          return city.replace(/\+/g, " ");
        }
      }
    }
    const queryCity = searchParams.get("city");
    if (queryCity) return queryCity;
    if (typeof window !== "undefined") {
      const storedCity = localStorage.getItem("zapi_user_city");
      if (storedCity) return storedCity;
    }
    return "all";
  };

  const selectedCity = getSelectedCity();

  return (
    <Link
      href={selectedCity === "all" ? "/delivery/all" : `/delivery/${slugify(selectedCity)}`}
      className="flex items-center space-x-2.5 group flex-shrink-0"
    >
      <span className="text-lg font-black tracking-tight text-foreground/90 font-sans group-hover:text-foreground transition-colors">
        Zapi Food
      </span>
    </Link>
  );
}

export default function DeliveryLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="h-full overflow-y-auto bg-background text-foreground flex flex-col font-sans">
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6 sm:gap-10">
            {/* Logo Section */}
            <Suspense
              fallback={
                <div className="flex items-center space-x-2.5 group flex-shrink-0">
                  <span className="text-lg font-black tracking-tight text-foreground/90 font-sans">
                    Zapi Food
                  </span>
                </div>
              }
            >
              <LogoLink />
            </Suspense>

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
