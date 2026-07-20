import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";

interface CategoryConfig {
  key: string;
  label: string;
  iconActive: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  iconInactive: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color: string;
}

const CATEGORY_CONFIG: CategoryConfig[] = [
  {
    key: "restaurante",
    label: "Restaurante",
    iconActive: "food",
    iconInactive: "food-outline",
    color: "#F97316",
  },
  {
    key: "fast_food",
    label: "Fast Food",
    iconActive: "hamburger",
    iconInactive: "hamburger", // No outline icon exists for hamburger in MaterialCommunityIcons
    color: "#EF4444",
  },
  {
    key: "lanchonete",
    label: "Lanchonete",
    iconActive: "coffee",
    iconInactive: "coffee-outline",
    color: "#EAB308",
  },
  {
    key: "padaria",
    label: "Padaria",
    iconActive: "bread-slice",
    iconInactive: "bread-slice-outline",
    color: "#D97706",
  },
  {
    key: "confeitaria",
    label: "Confeitaria",
    iconActive: "cake-variant",
    iconInactive: "cake-variant-outline",
    color: "#EC4899",
  },
  {
    key: "acougue",
    label: "Açougue",
    iconActive: "food-drumstick",
    iconInactive: "food-drumstick-outline",
    color: "#DC2626",
  },
  {
    key: "mercado",
    label: "Mercado",
    iconActive: "basket",
    iconInactive: "basket-outline",
    color: "#16A34A",
  },
  {
    key: "bebidas",
    label: "Bebidas",
    iconActive: "bottle-wine",
    iconInactive: "bottle-wine-outline",
    color: "#7C3AED",
  },
  {
    key: "farmacia",
    label: "Farmácia",
    iconActive: "hospital-box",
    iconInactive: "hospital-box-outline",
    color: "#059669",
  },
  {
    key: "outro",
    label: "Outro",
    iconActive: "store",
    iconInactive: "store-outline",
    color: "#6B7280",
  },
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
        const iconName = isSelected ? cat.iconActive : cat.iconInactive;
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
              <MaterialCommunityIcons
                name={iconName}
                size={22}
                color={isSelected ? "#FFFFFF" : cat.color}
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
