import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useColorScheme as useDeviceColorScheme } from "react-native";
import { getStorageItem, setStorageItem } from "./AuthContext";
import { Colors } from "@/constants/theme";

export type ThemePreference = "light" | "dark" | "system";
export type ThemeMode = "light" | "dark";

interface ThemeContextType {
  theme: ThemeMode;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
  colors: typeof Colors.light;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceColorScheme = useDeviceColorScheme();
  const [themePreference, setThemePrefState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ThemeMode>("light");

  // Load saved preference
  useEffect(() => {
    (async () => {
      try {
        const savedPref = await getStorageItem("theme_preference");
        if (savedPref === "light" || savedPref === "dark" || savedPref === "system") {
          setThemePrefState(savedPref);
        }
      } catch (e) {
        console.warn("Error loading theme preference:", e);
      }
    })();
  }, []);

  // Update resolved theme when preference or device color scheme changes
  useEffect(() => {
    if (themePreference === "system") {
      setResolvedTheme(deviceColorScheme === "dark" ? "dark" : "light");
    } else {
      setResolvedTheme(themePreference);
    }
  }, [themePreference, deviceColorScheme]);

  const setThemePreference = useCallback(async (pref: ThemePreference) => {
    try {
      await setStorageItem("theme_preference", pref);
      setThemePrefState(pref);
    } catch (e) {
      console.error("Failed to save theme preference:", e);
    }
  }, []);

  const value: ThemeContextType = {
    theme: resolvedTheme,
    themePreference,
    setThemePreference,
    colors: Colors[resolvedTheme],
    isDark: resolvedTheme === "dark",
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }
  return ctx;
}
