import React, { useEffect, useRef, useState } from "react";
import {
  TouchableOpacity,
  Animated,
  Text,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";

interface MainMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function MainMenuModal({
  visible,
  onClose,
}: MainMenuModalProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const { colors, isDark } = useAppTheme();
  const menuAnimation = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      menuAnimation.setValue(0);
      Animated.spring(menuAnimation, {
        toValue: 1,
        tension: 90,
        friction: 9,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(menuAnimation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible, menuAnimation]);

  const hideMenu = (callback?: () => void) => {
    Animated.timing(menuAnimation, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      if (callback) callback();
    });
  };

  if (!shouldRender) return null;

  const menuScale = menuAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.93, 1],
  });

  const menuTranslateY = menuAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
  });

  const menuOpacity = menuAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <TouchableOpacity
      style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}
      activeOpacity={1}
      onPress={() => hideMenu()}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: colors.modalOverlay,
            opacity: menuOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.menuContainer,
          {
            backgroundColor: isDark
              ? "rgba(30, 30, 30, 0.85)"
              : "rgba(255, 255, 255, 0.85)",
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(0, 0, 0, 0.08)",
            opacity: menuOpacity,
            transform: [{ scale: menuScale }, { translateY: menuTranslateY }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            hideMenu(() => router.push("/link-device"));
          }}
        >
          <Ionicons
            name="camera-outline"
            size={24}
            color={colors.text}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuItemText, { color: colors.text }]}>
            Câmera
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            hideMenu(() => router.push("/new-group"));
          }}
        >
          <Ionicons
            name="people-outline"
            size={24}
            color={colors.text}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuItemText, { color: colors.text }]}>
            Conversas em grupo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            hideMenu(() => router.push("/payments"));
          }}
        >
          <Ionicons
            name="card-outline"
            size={24}
            color={colors.text}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuItemText, { color: colors.text }]}>
            Pagamentos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            hideMenu(() => router.push("/settings"));
          }}
        >
          <Ionicons
            name="settings-outline"
            size={24}
            color={colors.text}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuItemText, { color: colors.text }]}>
            Configurações
          </Text>
        </TouchableOpacity>

        <View
          style={[styles.menuDivider, { backgroundColor: colors.border }]}
        />

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            hideMenu(() => signOut());
          }}
        >
          <Text style={[styles.menuItemText, { color: colors.danger }]}>
            Sair
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  menuContainer: {
    position: "absolute",
    top: 90,
    right: 6,
    borderRadius: 24,
    paddingVertical: 6,
    width: "60%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    marginRight: 12,
    width: 20,
    textAlign: "center",
  },
  menuItemText: {
    fontSize: 16,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
});
