import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import {
  Utensils,
  Croissant,
  ShoppingBasket,
  Pill,
  Hamburger,
  Coffee,
  CakeSlice,
  Beef,
  Wine,
  Store,
  type LucideIcon,
} from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface CategoryConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

const CATEGORY_CONFIG: CategoryConfig[] = [
  {
    key: "restaurante",
    label: "Restaurante",
    icon: Utensils,
    color: "#F97316",
  },
  { key: "fast_food", label: "Fast Food", icon: Hamburger, color: "#EF4444" },
  { key: "lanchonete", label: "Lanchonete", icon: Coffee, color: "#EAB308" },
  { key: "padaria", label: "Padaria", icon: Croissant, color: "#D97706" },
  {
    key: "confeitaria",
    label: "Confeitaria",
    icon: CakeSlice,
    color: "#EC4899",
  },
  { key: "acougue", label: "Açougue", icon: Beef, color: "#DC2626" },
  { key: "mercado", label: "Mercado", icon: ShoppingBasket, color: "#16A34A" },
  { key: "bebidas", label: "Bebidas", icon: Wine, color: "#7C3AED" },
  { key: "farmacia", label: "Farmácia", icon: Pill, color: "#059669" },
  { key: "outro", label: "Outro", icon: Store, color: "#6B7280" },
];

interface CategoryGridProps {
  selectedCategory: string | null;
  onSelectCategory: (key: string | null) => void;
}

export default function CategoryGrid({
  selectedCategory,
  onSelectCategory,
}: CategoryGridProps) {
  const { colors } = useAppTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
      {CATEGORY_CONFIG.map((cat) => {
        const isSelected = selectedCategory === cat.key;
        const Icon = cat.icon;
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
                  backgroundColor: isSelected ? cat.color : colors.surface,
                  borderColor: isSelected ? cat.color : colors.border,
                },
              ]}
            >
              <Icon
                size={22}
                color={isSelected ? "#FFFFFF" : cat.color}
                strokeWidth={2}
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
  },
  label: {
    fontSize: 11,
    textAlign: "center",
  },
});
