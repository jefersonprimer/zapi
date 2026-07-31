import { Tabs, useRouter, usePathname } from "expo-router";
import React from "react";
import { View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

const TABS_ORDER = ["index", "updates", "communities", "calls", "explore"];

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();

  const getActiveTabIndex = (path: string) => {
    const cleaned = path.replace(/^\/\(tabs\)\//, "/").replace(/^\//, "");
    if (cleaned === "" || cleaned === "index") return 0;
    const idx = TABS_ORDER.indexOf(cleaned);
    return idx !== -1 ? idx : 0;
  };

  const handleSwipeLeft = () => {
    const currentIndex = getActiveTabIndex(pathname);
    if (currentIndex < TABS_ORDER.length - 1) {
      const nextTab = TABS_ORDER[currentIndex + 1];
      router.push(nextTab === "index" ? "/" : `/${nextTab}`);
    }
  };

  const handleSwipeRight = () => {
    const currentIndex = getActiveTabIndex(pathname);
    if (currentIndex > 0) {
      const prevTab = TABS_ORDER[currentIndex - 1];
      router.push(prevTab === "index" ? "/" : `/${prevTab}`);
    }
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .failOffsetY([-30, 30])
    .onEnd((event) => {
      if (event.translationX < -50) {
        runOnJS(handleSwipeLeft)();
      } else if (event.translationX > 50) {
        runOnJS(handleSwipeRight)();
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View style={{ flex: 1 }} collapsable={false}>
        <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.tabIconSelected,
          tabBarInactiveTintColor: colors.tabIconDefault,
          headerShown: false,
          tabBarLabelStyle: { fontSize: 12, fontWeight: "500", paddingBottom: 4 },
          tabBarStyle: {
            height: 60 + insets.bottom,
            borderTopColor: colors.border,
            backgroundColor: colors.tabBarBackground,
            paddingTop: 4,
            paddingBottom: insets.bottom,
          },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: "Conversas",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "message-text" : "message-text-outline"}
              color={color}
              size={size ?? 24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="updates"
        options={{
          title: "Atualizações",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "circle-slice-8" : "circle-outline"}
              color={color}
              size={size ?? 24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: "Comunidades",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "account-group" : "account-group-outline"}
              color={color}
              size={size ?? 24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: "Ligações",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "phone" : "phone-outline"}
              color={color}
              size={size ?? 24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explorar",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "compass" : "compass-outline"}
              color={color}
              size={size ?? 24}
            />
          ),
        }}
      />
    </Tabs>
      </View>
    </GestureDetector>
  );
}
