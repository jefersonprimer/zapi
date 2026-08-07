import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAppTheme } from "@/context/ThemeContext";

interface UserContactModalProps {
  visible: boolean;
  onClose: () => void;
  onStartChat: () => void;
  onCreateGroup?: () => void;
  onRemoveContact: () => void;
}

export function UserContactModal({
  visible,
  onClose,
  onStartChat,
  onCreateGroup,
  onRemoveContact,
}: UserContactModalProps) {
  const { colors, isDark } = useAppTheme();
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      animation.setValue(0);
      Animated.spring(animation, {
        toValue: 1,
        tension: 90,
        friction: 9,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, animation]);

  const hideModal = (callback?: () => void) => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      if (callback) callback();
    });
  };

  if (!visible) return null;

  const modalScale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.93, 1],
  });

  const modalTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const modalOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <TouchableOpacity
      style={[
        StyleSheet.absoluteFillObject,
        styles.modalOverlayCentered,
        { zIndex: 1000 },
      ]}
      activeOpacity={1}
      onPress={() => hideModal()}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: colors.modalOverlay,
            opacity: modalOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.actionsModalCard,
          {
            backgroundColor: isDark
              ? "rgba(30, 30, 30, 0.9)"
              : "rgba(255, 255, 255, 0.9)",
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(0, 0, 0, 0.08)",
            opacity: modalOpacity,
            transform: [{ scale: modalScale }, { translateY: modalTranslateY }],
          },
        ]}
      >

        <TouchableOpacity
          style={styles.modalRowOption}
          onPress={() => hideModal(onStartChat)}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: isDark ? "#2D2D2D" : "#F3F4F6" },
            ]}
          >
            <MaterialCommunityIcons
              name="message-text-outline"
              size={24}
              color={colors.text}
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Iniciar Conversa
          </Text>
        </TouchableOpacity>

        {onCreateGroup && (
          <TouchableOpacity
            style={styles.modalRowOption}
            onPress={() => hideModal(onCreateGroup)}
          >
            <View
              style={[
                styles.modalRowIconContainer,
                { backgroundColor: isDark ? "#2D2D2D" : "#F3F4F6" },
              ]}
            >
              <MaterialCommunityIcons
                name="account-group-outline"
                size={24}
                color={colors.text}
              />
            </View>
            <Text style={[styles.modalRowText, { color: colors.text }]}>
              Criar Grupo
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.modalRowOption, styles.destructiveBorder]}
          onPress={() => hideModal(onRemoveContact)}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: isDark ? "#2D2D2D" : "#F3F4F6" },
            ]}
          >
            <MaterialCommunityIcons
              name="delete-outline"
              size={24}
              color={colors.text}
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Remover Contato
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  modalOverlayCentered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  actionsModalCard: {
    width: "60%",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
  },
  modalHeader: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  modalRowOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  modalRowIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  modalRowText: {
    fontSize: 16,
  },
  destructiveBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
});
