"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listStores, type Store } from "@/lib/api";
import { slugify } from "@/lib/utils";

export interface CategoryItem {
  key: string;
  label: string;
  image: string;
  color: string;
  featured?: boolean;
  group?: "alimentacao" | "compras" | "servicos";
}

export const CATEGORIES: CategoryItem[] = [
  // --- DESTAQUES DO HEADER ---
  {
    key: "restaurante",
    label: "Restaurantes",
    image: "/categorias-imagens/restaurante.jpeg",
    color: "#F97316",
    featured: true,
    group: "alimentacao",
  },
  {
    key: "pizza",
    label: "Pizzas",
    image: "/categorias-imagens/pizza.jpeg",
    color: "#DC2626",
    featured: true,
    group: "alimentacao",
  },
  {
    key: "fast_food",
    label: "Fast Food",
    image: "/categorias-imagens/Burger.jpeg",
    color: "#EF4444",
    featured: true,
    group: "alimentacao",
  },
  {
    key: "lanches",
    label: "Lanches",
    image: "/categorias-imagens/sandowich.jpeg",
    color: "#F59E0B",
    featured: true,
    group: "alimentacao",
  },
  {
    key: "acai",
    label: "Açaí",
    image: "/categorias-imagens/acai.jpeg",
    color: "#7C3AED",
    featured: true,
    group: "alimentacao",
  },
  {
    key: "confeitaria",
    label: "Confeitaria",
    image: "/categorias-imagens/bolo.jpeg",
    color: "#EC4899",
    featured: true,
    group: "alimentacao",
  },
  {
    key: "mercado",
    label: "Mercados",
    image: "/categorias-imagens/mercado.jpeg",
    color: "#047857",
    featured: true,
    group: "compras",
  },
  {
    key: "bebidas",
    label: "Bebidas",
    image: "/categorias-imagens/bebidas.jpeg",
    color: "#6D28D9",
    featured: true,
    group: "compras",
  },
  {
    key: "farmacia",
    label: "Farmácias",
    image: "/categorias-imagens/farmacia.jpeg",
    color: "#0D9488",
    featured: true,
    group: "servicos",
  },
  {
    key: "petshop",
    label: "Pet Shop",
    image: "/categorias-imagens/petshop.jpeg",
    color: "#F97316",
    featured: true,
    group: "servicos",
  },
  {
    key: "shopping",
    label: "Shopping",
    image: "/categorias-imagens/shopping.jpeg",
    color: "#E11D48",
    featured: true,
    group: "servicos",
  },

  // --- DEMAIS DE ALIMENTAÇÃO ---
  {
    key: "marmita",
    label: "Marmitas & PF",
    image: "/categorias-imagens/marmita.jpeg",
    color: "#0284C7",
    group: "alimentacao",
  },
  {
    key: "padaria",
    label: "Padarias",
    image: "/categorias-imagens/padaria.jpeg",
    color: "#B45309",
    group: "alimentacao",
  },
  {
    key: "salgados",
    label: "Salgados",
    image: "/categorias-imagens/salgados.jpeg",
    color: "#D97706",
    group: "alimentacao",
  },
  {
    key: "pastel",
    label: "Pastéis",
    image: "/categorias-imagens/pastel.jpeg",
    color: "#CA8A04",
    group: "alimentacao",
  },
  {
    key: "sorvete",
    label: "Sorvetes",
    image: "/categorias-imagens/sorvete.jpeg",
    color: "#3B82F6",
    group: "alimentacao",
  },
  {
    key: "cafe",
    label: "Cafés",
    image: "/categorias-imagens/cafe.jpeg",
    color: "#78350F",
    group: "alimentacao",
  },
  {
    key: "comida_japonesa",
    label: "Japonesa",
    image: "/categorias-imagens/comida-japonesa.jpeg",
    color: "#E11D48",
    group: "alimentacao",
  },
  {
    key: "comida_italiana",
    label: "Italiana",
    image: "/categorias-imagens/comida-italiana.jpeg",
    color: "#059669",
    group: "alimentacao",
  },
  {
    key: "comida_chinesa",
    label: "Chinesa",
    image: "/categorias-imagens/comida-chinesa.jpeg",
    color: "#B91C1C",
    group: "alimentacao",
  },
  {
    key: "comida_arabe",
    label: "Árabe",
    image: "/categorias-imagens/comida-arabe.jpeg",
    color: "#8B5CF6",
    group: "alimentacao",
  },
  {
    key: "comida_mexicana",
    label: "Mexicana",
    image: "/categorias-imagens/comida-mexinaca.jpeg",
    color: "#EA580C",
    group: "alimentacao",
  },
  {
    key: "frango_assado",
    label: "Frango Assado",
    image: "/categorias-imagens/frango-assado.jpeg",
    color: "#D97706",
    group: "alimentacao",
  },
  {
    key: "churrascaria",
    label: "Churrascaria",
    image: "/categorias-imagens/churrascaria.jpeg",
    color: "#991B1B",
    group: "alimentacao",
  },
  {
    key: "saudavel",
    label: "Saudável",
    image: "/categorias-imagens/saudavel.jpeg",
    color: "#10B981",
    group: "alimentacao",
  },
  {
    key: "vegetariana",
    label: "Vegetariana / Vegana",
    image: "/categorias-imagens/comida-vegetariana.jpeg",
    color: "#84CC16",
    group: "alimentacao",
  },

  // --- DEMAIS DE COMPRAS ---
  {
    key: "acougue",
    label: "Açougue",
    image: "/categorias-imagens/carne.jpeg",
    color: "#991B1B",
    group: "compras",
  },
  {
    key: "hortifruti",
    label: "Hortifruti",
    image: "/categorias-imagens/hortifruit.jpeg",
    color: "#65A30D",
    group: "compras",
  },
  {
    key: "conveniencia",
    label: "Conveniência",
    image: "/categorias-imagens/conveniencia.jpeg",
    color: "#2563EB",
    group: "compras",
  },
  {
    key: "queijos_frios",
    label: "Queijos & Frios",
    image: "/categorias-imagens/queijos-e-frios.jpeg",
    color: "#EAB308",
    group: "compras",
  },
  {
    key: "peixaria",
    label: "Peixaria",
    image: "/categorias-imagens/peixaria.jpeg",
    color: "#0284C7",
    group: "compras",
  },

  // --- DEMAIS DE SERVIÇOS ---
  {
    key: "flores",
    label: "Flores",
    image: "/categorias-imagens/flores.jpeg",
    color: "#DB2777",
    group: "servicos",
  },
  {
    key: "tabacaria",
    label: "Tabacaria",
    image: "/categorias-imagens/tabacaria.jpeg",
    color: "#475569",
    group: "servicos",
  },
];

export interface CategoryGridProps {
  selectedCategory: string;
  onSelectCategory?: (categoryKey: string) => void;
}

export default function CategoryGrid({
  selectedCategory,
  onSelectCategory,
}: CategoryGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCity = searchParams?.get("city") || "all";

  const [availableCategories, setAvailableCategories] = useState<CategoryItem[]>(CATEGORIES);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  useEffect(() => {
    async function filterCategories() {
      try {
        const storeRes = await listStores();
        const stores = storeRes.stores || [];

        // Filter stores by selected city if selectedCity is not "all"
        const filteredStores = stores.filter((store: Store) => {
          return selectedCity === "all" || slugify(store.city) === slugify(selectedCity);
        });

        // Get unique categories that exist in the filtered stores
        const existingCategoryKeys = new Set(filteredStores.map((s: Store) => s.category));

        // Filter categories list
        const filteredCats = CATEGORIES.filter((cat) => existingCategoryKeys.has(cat.key));

        setAvailableCategories(filteredCats);
      } catch (err) {
        console.error("Error filtering categories by city:", err);
        // Fallback to all categories on error
        setAvailableCategories(CATEGORIES);
      }
    }

    filterCategories();
  }, [selectedCity]);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftArrow(scrollLeft > 5);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, []);

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = direction === "left" ? -320 : 320;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  const handleCategoryClick = (catKey: string) => {
    if (onSelectCategory) {
      onSelectCategory(catKey);
    } else {
      if (catKey === selectedCategory) {
        router.push("/delivery");
      } else {
        router.push(`/categoria/${catKey}`);
      }
    }
  };

  return (
    <div className="relative group mb-10 select-none">
      {/* Left Scroll Button */}
      {showLeftArrow && (
        <button
          onClick={() => handleScroll("left")}
          aria-label="Rolar para esquerda"
          className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-surface/90 dark:bg-card-bg/90 backdrop-blur-md border border-card-border/80 shadow-lg flex items-center justify-center text-foreground hover:bg-surface hover:scale-110 active:scale-95 transition-all cursor-pointer hidden md:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Right Scroll Button */}
      {showRightArrow && (
        <button
          onClick={() => handleScroll("right")}
          aria-label="Rolar para direita"
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-surface/90 dark:bg-card-bg/90 backdrop-blur-md border border-card-border/80 shadow-lg flex items-center justify-center text-foreground hover:bg-surface hover:scale-110 active:scale-95 transition-all cursor-pointer hidden md:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Horizontal Scrollable Track */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex items-start gap-4 sm:gap-5 overflow-x-auto py-2 px-1 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {availableCategories.map((cat) => {
          const isSelected = selectedCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => handleCategoryClick(cat.key)}
              className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer group/item transition-transform duration-200 w-20 sm:w-22"
            >
              {/* Circle Image Container */}
              <div
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden flex items-center justify-center transition-all duration-300 shadow-sm group-hover/item:scale-105 group-hover/item:shadow-md active:scale-95 bg-neutral-100 dark:bg-neutral-800 flex-shrink-0"
                style={{
                  border: isSelected
                    ? `2.5px solid ${cat.color}`
                    : "1.5px solid var(--card-border)",
                  boxShadow: isSelected ? `0 4px 14px ${cat.color}45` : "none",
                }}
              >
                <Image
                  src={cat.image}
                  alt={cat.label}
                  width={72}
                  height={72}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover/item:scale-110"
                  unoptimized
                />
              </div>

              {/* Label */}
              <span
                className={`text-[11px] sm:text-xs text-center w-full truncate transition-colors duration-200 px-0.5 leading-tight ${
                  isSelected
                    ? "font-bold text-foreground"
                    : "font-medium text-muted-text group-hover/item:text-foreground"
                }`}
              >
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
