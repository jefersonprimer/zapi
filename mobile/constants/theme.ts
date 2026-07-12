import { Platform } from "react-native";

const tintColorLight = "#007AFF";
const tintColorDark = "#0A84FF";

export const Colors = {
  light: {
    text: "#1E293B", // slate 800
    textSecondary: "#64748B", // slate 500
    background: "#F8FAFC", // slate 50
    surface: "#FFFFFF",
    cardBackground: "#FFFFFF",
    border: "#E2E8F0", // slate 200
    tint: tintColorLight,
    icon: "#64748B", // slate 500
    tabIconDefault: "#94A3B8", // slate 400
    tabIconSelected: tintColorLight,
    headerBackground: "#007AFF", // Brand blue header
    headerText: "#FFFFFF",
    tabBarBackground: "#FFFFFF",
    badge: "#10B981", // Emerald 500
    badgeText: "#FFFFFF",
    fab: "#007AFF",
    menuBackground: "#FFFFFF",
    modalOverlay: "rgba(0,0,0,0.3)",
    shadow: "#0F172A",
    danger: "#EF4444", // red 500
  },
  dark: {
    text: "#F8FAFC", // slate 50
    textSecondary: "#94A3B8", // slate 400
    background: "#0F172A", // slate 900
    surface: "#1E293B", // slate 800
    cardBackground: "#1E293B",
    border: "#334155", // slate 700
    tint: tintColorDark,
    icon: "#94A3B8", // slate 400
    tabIconDefault: "#64748B", // slate 500
    tabIconSelected: tintColorDark,
    headerBackground: "#1E293B", // slate 800 header in dark mode
    headerText: "#F8FAFC",
    tabBarBackground: "#0F172A",
    badge: "#10B981", // Emerald 500
    badgeText: "#FFFFFF",
    fab: "#0A84FF",
    menuBackground: "#1E293B",
    modalOverlay: "rgba(0,0,0,0.6)",
    shadow: "#000000",
    danger: "#EF4444",
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
