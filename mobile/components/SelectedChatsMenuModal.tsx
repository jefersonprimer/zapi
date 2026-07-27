import React, { useEffect, useRef, useState } from "react";
import {
  TouchableOpacity,
  Animated,
  Text,
  StyleSheet,
  View,
} from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface Chat {
  id: string;
  is_favorite?: boolean;
  is_group: boolean;
  is_blocked_by_me?: boolean;
}

interface SelectedChatsMenuModalProps {
  visible: boolean;
  onClose: () => void;
  selectedChatIds: string[];
  chats: Chat[];
  onViewContact: () => void;
  onSelectAll: () => void;
  onToggleFavorite: () => void;
  onAddToList: () => void;
  onClearChats: () => void;
  onBlockChats: () => void;
}

export function SelectedChatsMenuModal({
  visible,
  onClose,
  selectedChatIds,
  chats,
  onViewContact,
  onSelectAll,
  onToggleFavorite,
  onAddToList,
  onClearChats,
  onBlockChats,
}: SelectedChatsMenuModalProps) {
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

  const selectedChats = chats.filter((c) => selectedChatIds.includes(c.id));
  const allFavorited =
    selectedChats.length > 0 && selectedChats.every((c) => c.is_favorite);
  const nonGroupChats = selectedChats.filter((c) => !c.is_group);
  const allBlocked =
    nonGroupChats.length > 0 && nonGroupChats.every((c) => c.is_blocked_by_me);

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
            borderColor: colors.border,
            opacity: menuOpacity,
            transform: [{ scale: menuScale }, { translateY: menuTranslateY }],
          },
        ]}
      >
        {selectedChatIds.length === 1 && (
          <>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => hideMenu(onViewContact)}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Ver contato
              </Text>
            </TouchableOpacity>
            <View
              style={[styles.menuDivider, { backgroundColor: colors.border }]}
            />
          </>
        )}

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => hideMenu(onSelectAll)}
        >
          <Text style={[styles.menuItemText, { color: colors.text }]}>
            Selecionar tudo
          </Text>
        </TouchableOpacity>

        <View
          style={[styles.menuDivider, { backgroundColor: colors.border }]}
        />

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => hideMenu(onToggleFavorite)}
        >
          <Text style={[styles.menuItemText, { color: colors.text }]}>
            {allFavorited ? "Remover dos favoritos" : "Favoritar"}
          </Text>
        </TouchableOpacity>

        <View
          style={[styles.menuDivider, { backgroundColor: colors.border }]}
        />

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => hideMenu(onAddToList)}
        >
          <Text style={[styles.menuItemText, { color: colors.text }]}>
            Adicionar à lista
          </Text>
        </TouchableOpacity>

        <View
          style={[styles.menuDivider, { backgroundColor: colors.border }]}
        />

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => hideMenu(onClearChats)}
        >
          <Text style={[styles.menuItemText, { color: colors.text }]}>
            Limpar conversa
          </Text>
        </TouchableOpacity>

        {nonGroupChats.length > 0 && (
          <>
            <View
              style={[styles.menuDivider, { backgroundColor: colors.border }]}
            />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => hideMenu(onBlockChats)}
            >
              <Text style={[styles.menuItemText, { color: colors.danger }]}>
                {allBlocked ? "Desbloquear" : "Bloquear"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  menuContainer: {
    position: "absolute",
    top: 90,
    right: 6,
    borderRadius: 16,
    paddingVertical: 6,
    width: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  menuItem: {
    padding: 14,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "500",
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
});
