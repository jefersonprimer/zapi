import React from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import {
  Heart,
  Star,
  Briefcase,
  Home,
  Gamepad2,
  BookOpen,
  Folder,
} from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

const renderListIcon = (
  iconName: string | null,
  colorColor: string | null,
  tintColor: string,
  size: number = 20,
) => {
  let hexColor = tintColor;
  if (colorColor === "🔴") hexColor = "#ef4444";
  else if (colorColor === "🟠") hexColor = "#f97316";
  else if (colorColor === "🟡") hexColor = "#eab308";
  else if (colorColor === "🟢") hexColor = "#22c55e";
  else if (colorColor === "🔵") hexColor = "#3b82f6";
  else if (colorColor === "🟣") hexColor = "#a855f7";

  switch (iconName) {
    case "❤️":
      return <Heart size={size} color={hexColor} fill={hexColor + "22"} />;
    case "⭐":
      return <Star size={size} color={hexColor} fill={hexColor + "22"} />;
    case "💼":
      return <Briefcase size={size} color={hexColor} fill={hexColor + "22"} />;
    case "🏠":
      return <Home size={size} color={hexColor} fill={hexColor + "22"} />;
    case "🎮":
      return <Gamepad2 size={size} color={hexColor} fill={hexColor + "22"} />;
    case "📚":
      return <BookOpen size={size} color={hexColor} fill={hexColor + "22"} />;
    default:
      return <Folder size={size} color={hexColor} fill={hexColor + "22"} />;
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
        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.filterChip,
              {
                backgroundColor: "transparent",
                borderColor: colors.border,
                borderWidth: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              },
              isActive && {
                backgroundColor: colors.brandGreen + "46",
                borderColor: colors.brandGreen,
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
