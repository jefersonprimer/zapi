import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { listStores } from "@/services/deliveryApi";

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

export interface CategoryItem {
  key: string;
  label: string;
  image: any;
  color: string;
  featured?: boolean;
  group?: "alimentacao" | "compras" | "servicos";
}

export const CATEGORIES: CategoryItem[] = [
  // --- DESTAQUES DO HEADER ---
  {
    key: "restaurante",
    label: "Restaurantes",
    image: require("../assets/categorias-imagens/restaurante.jpeg"),
    color: "#F97316",
    featured: true,
    group: "alimentacao",
  },
  {
    key: "pizza",
    label: "Pizzas",
    image: require("../assets/categorias-imagens/pizza.jpeg"),
    color: "#DC2626",
    featured: true,
    group: "alimentacao",
  },
  {
    key: "fast_food",
    label: "Fast Food",
    image: require("../assets/categorias-imagens/Burger.jpeg"),
    color: "#EF4444",
    featured: true,
    group: "alimentacao",
  },
  {
    key: "lanches",
    label: "Lanches",
    image: require("../assets/categorias-imagens/sandowich.jpeg"),
    color: "#F59E0B",
    featured: true,
    group: "alimentacao",
  },
  {
    key: "lanchonete",
    label: "Lanchonete",
    image: require("../assets/categorias-imagens/sandowich.jpeg"),
    color: "#EAB308",
    featured: true,
    group: "alimentacao",
  },
  {
    key: "acai",
    label: "Açaí",
    image: require("../assets/categorias-imagens/acai.jpeg"),
    color: "#7C3AED",
    featured: true,
    group: "alimentacao",
  },
  {
    key: "confeitaria",
    label: "Confeitaria",
    image: require("../assets/categorias-imagens/bolo.jpeg"),
    color: "#EC4899",
    featured: true,
    group: "alimentacao",
  },
  {
    key: "mercado",
    label: "Mercados",
    image: require("../assets/categorias-imagens/mercado.jpeg"),
    color: "#047857",
    featured: true,
    group: "compras",
  },
  {
    key: "bebidas",
    label: "Bebidas",
    image: require("../assets/categorias-imagens/bebidas.jpeg"),
    color: "#6D28D9",
    featured: true,
    group: "compras",
  },
  {
    key: "farmacia",
    label: "Farmácias",
    image: require("../assets/categorias-imagens/farmacia.jpeg"),
    color: "#0D9488",
    featured: true,
    group: "servicos",
  },
  {
    key: "petshop",
    label: "Pet Shop",
    image: require("../assets/categorias-imagens/petshop.jpeg"),
    color: "#F97316",
    featured: true,
    group: "servicos",
  },
  {
    key: "shopping",
    label: "Shopping",
    image: require("../assets/categorias-imagens/shopping.jpeg"),
    color: "#E11D48",
    featured: true,
    group: "servicos",
  },

  // --- DEMAIS DE ALIMENTAÇÃO ---
  {
    key: "marmita",
    label: "Marmitas & PF",
    image: require("../assets/categorias-imagens/marmita.jpeg"),
    color: "#0284C7",
    group: "alimentacao",
  },
  {
    key: "padaria",
    label: "Padarias",
    image: require("../assets/categorias-imagens/padaria.jpeg"),
    color: "#B45309",
    group: "alimentacao",
  },
  {
    key: "salgados",
    label: "Salgados",
    image: require("../assets/categorias-imagens/salgados.jpeg"),
    color: "#D97706",
    group: "alimentacao",
  },
  {
    key: "pastel",
    label: "Pastéis",
    image: require("../assets/categorias-imagens/pastel.jpeg"),
    color: "#CA8A04",
    group: "alimentacao",
  },
  {
    key: "sorvete",
    label: "Sorvetes",
    image: require("../assets/categorias-imagens/sorvete.jpeg"),
    color: "#3B82F6",
    group: "alimentacao",
  },
  {
    key: "cafe",
    label: "Cafés",
    image: require("../assets/categorias-imagens/cafe.jpeg"),
    color: "#78350F",
    group: "alimentacao",
  },
  {
    key: "comida_japonesa",
    label: "Japonesa",
    image: require("../assets/categorias-imagens/comida-japonesa.jpeg"),
    color: "#E11D48",
    group: "alimentacao",
  },
  {
    key: "comida_italiana",
    label: "Italiana",
    image: require("../assets/categorias-imagens/comida-italiana.jpeg"),
    color: "#059669",
    group: "alimentacao",
  },
  {
    key: "comida_chinesa",
    label: "Chinesa",
    image: require("../assets/categorias-imagens/comida-chinesa.jpeg"),
    color: "#B91C1C",
    group: "alimentacao",
  },
  {
    key: "comida_arabe",
    label: "Árabe",
    image: require("../assets/categorias-imagens/comida-arabe.jpeg"),
    color: "#8B5CF6",
    group: "alimentacao",
  },
  {
    key: "comida_mexicana",
    label: "Mexicana",
    image: require("../assets/categorias-imagens/comida-mexinaca.jpeg"),
    color: "#EA580C",
    group: "alimentacao",
  },
  {
    key: "frango_assado",
    label: "Frango Assado",
    image: require("../assets/categorias-imagens/frango-assado.jpeg"),
    color: "#D97706",
    group: "alimentacao",
  },
  {
    key: "churrascaria",
    label: "Churrascaria",
    image: require("../assets/categorias-imagens/churrascaria.jpeg"),
    color: "#991B1B",
    group: "alimentacao",
  },
  {
    key: "saudavel",
    label: "Saudável",
    image: require("../assets/categorias-imagens/saudavel.jpeg"),
    color: "#10B981",
    group: "alimentacao",
  },
  {
    key: "vegetariana",
    label: "Vegetariana / Vegana",
    image: require("../assets/categorias-imagens/comida-vegetariana.jpeg"),
    color: "#84CC16",
    group: "alimentacao",
  },

  // --- DEMAIS DE COMPRAS ---
  {
    key: "acougue",
    label: "Açougue",
    image: require("../assets/categorias-imagens/carne.jpeg"),
    color: "#991B1B",
    group: "compras",
  },
  {
    key: "hortifruti",
    label: "Hortifruti",
    image: require("../assets/categorias-imagens/hortifruit.jpeg"),
    color: "#65A30D",
    group: "compras",
  },
  {
    key: "conveniencia",
    label: "Conveniência",
    image: require("../assets/categorias-imagens/conveniencia.jpeg"),
    color: "#2563EB",
    group: "compras",
  },
  {
    key: "queijos_frios",
    label: "Queijos & Frios",
    image: require("../assets/categorias-imagens/queijos-e-frios.jpeg"),
    color: "#EAB308",
    group: "compras",
  },
  {
    key: "peixaria",
    label: "Peixaria",
    image: require("../assets/categorias-imagens/peixaria.jpeg"),
    color: "#0284C7",
    group: "compras",
  },

  // --- DEMAIS DE SERVIÇOS ---
  {
    key: "flores",
    label: "Flores",
    image: require("../assets/categorias-imagens/flores.jpeg"),
    color: "#DB2777",
    group: "servicos",
  },
  {
    key: "tabacaria",
    label: "Tabacaria",
    image: require("../assets/categorias-imagens/tabacaria.jpeg"),
    color: "#475569",
    group: "servicos",
  },
];

interface CategoryGridProps {
  selectedCategory: string | null;
  onSelectCategory: (key: string | null) => void;
  city?: string;
  state?: string;
}

export default function CategoryGrid({
  selectedCategory,
  onSelectCategory,
  city,
  state,
}: CategoryGridProps) {
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const [availableCategories, setAvailableCategories] = useState<CategoryItem[]>(CATEGORIES);

  useEffect(() => {
    async function filterCategories() {
      if (!token) return;
      try {
        // Fetch stores in the specific city
        const storeRes = await listStores(token, { city, state });
        const stores = storeRes.stores || [];

        // Get unique categories that exist in the stores for this city
        const existingCategoryKeys = new Set(
          stores.map((s) => s.category.toLowerCase().trim())
        );

        // Filter categories list
        const filteredCats = CATEGORIES.filter((cat) =>
          existingCategoryKeys.has(cat.key.toLowerCase().trim())
        );

        setAvailableCategories(filteredCats);
      } catch (err) {
        console.error("Error filtering categories by city:", err);
        setAvailableCategories(CATEGORIES);
      }
    }

    filterCategories();
  }, [token, city, state]);

  if (availableCategories.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
      {availableCategories.map((cat) => {
        const isSelected = selectedCategory === cat.key;
        return (
          <TouchableOpacity
            key={cat.key}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => onSelectCategory(isSelected ? null : cat.key)}
          >
            <View
              style={[
                styles.iconCircle,
                {
                  borderColor: isSelected ? cat.color : colors.border,
                  borderWidth: isSelected ? 2.5 : 1.5,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <Image
                source={cat.image}
                style={styles.image}
                resizeMode="cover"
              />
            </View>
            <Text
              style={[
                styles.label,
                {
                  color: isSelected ? colors.text : colors.textSecondary,
                  fontWeight: isSelected ? "600" : "400",
                },
              ]}
              numberOfLines={1}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
    gap: 6,
  },
  item: {
    alignItems: "center",
    width: 68,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    marginBottom: 6,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  label: {
    fontSize: 11,
    textAlign: "center",
  },
});
