import { Platform } from "react-native";

const tintColorLight = "#111827";
const tintColorDark = "#8E8E93";

export const Colors = {
  light: {
    text: "#111827",
    textSecondary: "#6B7280",

    background: "#FAFAFA", // fundo principal
    surface: "#FFFFFF", // cards
    cardBackground: "#FFFFFF",

    border: "#ECECEC",

    tint: tintColorLight,
    icon: "#6B7280",

    tabIconDefault: "#9CA3AF",
    tabIconSelected: tintColorLight,

    headerBackground: "#FAFAFA",
    headerText: "#111827",

    tabBarBackground: "#FAFAFA",

    badge: "#10B981",
    badgeText: "#FFFFFF",

    brandGreen: "#07C160",
    listBgGreen: "#e6f9ee",

    fab: "#07C160",

    menuBackground: "#FFFFFF",

    modalOverlay: "rgba(0,0,0,0.30)",

    shadow: "#000000",

    danger: "#EF4444",
  },
  dark: {
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",

    background: "#121212", // fundo principal
    surface: "#1A1A1A", // AppBar
    cardBackground: "#1E1E1E",

    border: "#222222",

    tint: tintColorDark,
    icon: "#9CA3AF",

    tabIconDefault: "#6B7280",
    tabIconSelected: "#FFFFFF",

    headerBackground: "#121212",
    headerText: "#FFFFFF",

    tabBarBackground: "#121212",

    badge: "#10B981",
    badgeText: "#FFFFFF",

    brandGreen: "#047c3c",
    listBgGreen: "#033b1e",

    fab: "#07C160",

    menuBackground: "#242424",

    modalOverlay: "rgba(0,0,0,0.60)",

    shadow: "#000000",

    danger: "#F87171",
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
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
