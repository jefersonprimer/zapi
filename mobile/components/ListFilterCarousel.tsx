import React from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";

const getListColorHex = (colorEmoji: string | null | undefined): string | null => {
  if (!colorEmoji) return null;
  if (colorEmoji.startsWith("#")) return colorEmoji;
  if (colorEmoji === "🔴") return "#ef4444";
  if (colorEmoji === "🟠") return "#f97316";
  if (colorEmoji === "🟡") return "#eab308";
  if (colorEmoji === "🟢") return "#22c55e";
  if (colorEmoji === "🔵") return "#3b82f6";
  if (colorEmoji === "🟣") return "#a855f7";
  return null;
};

const renderListIcon = (
  iconName: string | null,
  colorColor: string | null,
  tintColor: string,
  size: number = 20,
) => {
  const hexColor = getListColorHex(colorColor) ?? tintColor;

  switch (iconName) {
    case "❤️":
      return <Ionicons name="heart" size={size} color={hexColor} />;
    case "⭐":
      return <Ionicons name="star" size={size} color={hexColor} />;
    case "💼":
      return <Ionicons name="briefcase" size={size} color={hexColor} />;
    case "🏠":
      return <Ionicons name="home" size={size} color={hexColor} />;
    case "🎮":
      return <Ionicons name="game-controller" size={size} color={hexColor} />;
    case "📚":
      return <Ionicons name="book" size={size} color={hexColor} />;
    default:
      if (iconName) {
        return <Text style={{ fontSize: size }}>{iconName}</Text>;
      }
      return <Ionicons name="folder" size={size} color={hexColor} />;
  }
};

interface ListFilterCarouselProps {
  orderedFilters: any[];
  activeFilterId: string;
  onSelectFilter: (id: string) => void;
  onLongPressFilter: (item: any) => void;
  onCreateListPress: () => void;
  colors: any;
}

export default function ListFilterCarousel({
  orderedFilters,
  activeFilterId,
  onSelectFilter,
  onLongPressFilter,
  onCreateListPress,
  colors,
}: ListFilterCarouselProps) {
  const { isDark } = useAppTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
    >
      {orderedFilters.map((item) => {
        const isActive = activeFilterId === item.id;
        const listColorHex = getListColorHex(item.color);
        const hasCustomColor = !!listColorHex && !item.isSystem;

        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.filterChip,
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderWidth: 1,
                backgroundColor: hasCustomColor
                  ? listColorHex + (isActive ? "55" : "30")
                  : "transparent",
                borderColor: hasCustomColor
                  ? listColorHex
                  : colors.border,
              },
              isActive &&
                !hasCustomColor && {
                  backgroundColor: colors.brandGreen + "46",
                  borderColor: colors.brandGreen,
                  elevation: 2,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.15,
                  shadowRadius: 2,
                },
              isActive &&
                hasCustomColor && {
                  elevation: 2,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.15,
                  shadowRadius: 2,
                },
            ]}
            onPress={() => onSelectFilter(item.id)}
            onLongPress={() => onLongPressFilter(item)}
            delayLongPress={600}
          >
            {item.icon &&
              renderListIcon(
                item.icon,
                item.color,
                isActive ? (isDark ? "#fff" : colors.text) : colors.textSecondary,
                14,
              )}
            <Text
              style={[
                styles.filterChipText,
                { color: colors.textSecondary, fontSize: 14 },
                isActive && {
                  color: isDark ? "#fff" : colors.text,
                  fontWeight: "600",
                },
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={[
          styles.filterChip,
          {
            backgroundColor: "transparent",
            borderColor: colors.border,
            borderWidth: 1,
          },
        ]}
        onPress={onCreateListPress}
      >
        <Text
          style={[
            styles.filterChipText,
            { color: colors.textSecondary, fontWeight: "bold" },
          ]}
        >
          ＋
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  filterChip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  filterChipText: {
    fontSize: 14,
  },
});
