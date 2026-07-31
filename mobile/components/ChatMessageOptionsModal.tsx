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

interface ChatMessageOptionsModalProps {
  visible: boolean;
  onClose: (shouldClearSelection: boolean) => void;
  onReply: () => void;
  onForward: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onSelect: () => void;
}

export function ChatMessageOptionsModal({
  visible,
  onClose,
  onReply,
  onForward,
  onCopy,
  onDelete,
  onSelect,
}: ChatMessageOptionsModalProps) {
  const { colors, isDark } = useAppTheme();
  const actionsAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      actionsAnimation.setValue(0);
      Animated.spring(actionsAnimation, {
        toValue: 1,
        tension: 90,
        friction: 9,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, actionsAnimation]);

  const hideModal = (callback?: () => void) => {
    Animated.timing(actionsAnimation, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onClose(callback === undefined);
      if (callback) callback();
    });
  };

  if (!visible) return null;

  const modalScale = actionsAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.93, 1],
  });

  const modalTranslateY = actionsAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const modalOpacity = actionsAnimation.interpolate({
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
              ? "rgba(30, 30, 30, 0.85)"
              : "rgba(255, 255, 255, 0.85)",
            borderColor: colors.border,
            opacity: modalOpacity,
            transform: [{ scale: modalScale }, { translateY: modalTranslateY }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.modalRowOption}
          onPress={() => hideModal(onReply)}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: isDark ? "#2D2D2D" : "#F3F4F6" },
            ]}
          >
            <MaterialCommunityIcons
              name="reply-outline"
              size={24}
              color={colors.text}
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Responder
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modalRowOption}
          onPress={() => hideModal(onForward)}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: isDark ? "#2D2D2D" : "#F3F4F6" },
            ]}
          >
            <MaterialCommunityIcons
              name="share-all-outline"
              size={24}
              color={colors.text}
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Encaminhar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modalRowOption}
          onPress={() => hideModal(onCopy)}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: isDark ? "#2D2D2D" : "#F3F4F6" },
            ]}
          >
            <MaterialCommunityIcons
              name="content-copy"
              size={24}
              color={colors.text}
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Copiar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modalRowOption}
          onPress={() => hideModal(onSelect)}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: isDark ? "#2D2D2D" : "#F3F4F6" },
            ]}
          >
            <MaterialCommunityIcons
              name="checkbox-multiple-marked-outline"
              size={24}
              color={colors.text}
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Selecionar mais
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modalRowOption}
          onPress={() => hideModal(onDelete)}
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
              color="#FF3B30"
            />
          </View>
          <Text
            style={[
              styles.modalRowText,
              { color: "#FF3B30", fontWeight: "600" },
            ]}
          >
            Apagar
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
    paddingBottom: 54,
  },
  actionsModalCard: {
    width: "60%",
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
  },
  modalRowOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  modalRowIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  modalRowText: {
    fontSize: 16,
  },
});
