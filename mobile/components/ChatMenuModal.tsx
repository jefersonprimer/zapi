import React, { useEffect, useRef, useState } from "react";
import { TouchableOpacity, Animated, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface ChatMenuModalProps {
  visible: boolean;
  onClose: () => void;
  isContact: boolean;
  onToggleContact: () => void;
  onViewContact?: () => void;
  isGroup?: boolean;
  isBlocked?: boolean;
  onMutePress?: () => void;
  onBlockPress?: () => void;
  onClearChatPress?: () => void;
  onAddToListPress?: () => void;
}

export const ChatMenuModal: React.FC<ChatMenuModalProps> = ({
  visible,
  onClose,
  isContact,
  onToggleContact,
  onViewContact,
  isGroup = false,
  isBlocked = false,
  onMutePress,
  onBlockPress,
  onClearChatPress,
  onAddToListPress,
}) => {
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
        {onViewContact && (
          <TouchableOpacity
            style={[
              styles.menuItem,
              {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              },
            ]}
            onPress={() => {
              hideMenu(onViewContact);
            }}
          >
            <Text style={[styles.menuItemText, { color: colors.text }]}>
              {isGroup ? "Dados do Grupo" : "Ver Contato"}
            </Text>
          </TouchableOpacity>
        )}

        {onMutePress && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              hideMenu(onMutePress);
            }}
          >
            <Text style={[styles.menuItemText, { color: colors.text }]}>
              Silenciar Notificações
            </Text>
          </TouchableOpacity>
        )}

        {onAddToListPress && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              hideMenu(onAddToListPress);
            }}
          >
            <Text style={[styles.menuItemText, { color: colors.text }]}>
              Adicionar à Lista
            </Text>
          </TouchableOpacity>
        )}

        {onClearChatPress && (
          <TouchableOpacity
            style={[
              styles.menuItem,
              onViewContact && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              },
            ]}
            onPress={() => {
              hideMenu(onClearChatPress);
            }}
          >
            <Text style={[styles.menuItemText, { color: colors.text }]}>
              Limpar Conversa
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.menuItem,
            {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            },
          ]}
          onPress={() => {
            hideMenu(onToggleContact);
          }}
        >
          <Text
            style={[
              styles.menuItemText,
              !isContact
                ? [styles.addText, { color: colors.tint }]
                : { color: colors.text },
            ]}
          >
            {isContact ? (isGroup ? "Sair do Grupo" : "Remover dos Contatos") : "Adicionar aos Contatos"}
          </Text>
        </TouchableOpacity>

        {!isGroup && onBlockPress && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              hideMenu(onBlockPress);
            }}
          >
            <Text style={[styles.menuItemText, { color: colors.text }]}>
              {isBlocked ? "Desbloquear" : "Bloquear"}
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  menuContainer: {
    position: "absolute",
    top: 90,
    right: 6,
    borderRadius: 24,
    paddingVertical: 6,
    width: "50%",
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
  },
  menuItemText: {
    fontSize: 16,
  },
  addText: {},
  removeText: {},
});
