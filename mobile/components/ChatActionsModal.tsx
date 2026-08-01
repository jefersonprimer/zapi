import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Animated,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAppTheme } from "@/context/ThemeContext";

interface ChatActionsModalProps {
  visible: boolean;
  onClose: () => void;
  onEmojiPress: () => void;
  onFotosPress: () => void;
  onCameraPress: () => void;
  onDocumentosPress: () => void;
  onSearchWebPress: () => void;
  onLocationPress: () => void;
}

export function ChatActionsModal({
  visible,
  onClose,
  onEmojiPress,
  onFotosPress,
  onCameraPress,
  onDocumentosPress,
  onSearchWebPress,
  onLocationPress,
}: ChatActionsModalProps) {
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

  const hideActionsModal = (callback?: () => void) => {
    Animated.timing(actionsAnimation, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onClose();
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
      onPress={() => hideActionsModal()}
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
          onPress={() => {
            Keyboard.dismiss();
            hideActionsModal(onEmojiPress);
          }}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: isDark ? "#2D2D2D" : "#F3F4F6" },
            ]}
          >
            <MaterialCommunityIcons
              name="emoticon-happy-outline"
              size={24}
              color={colors.text}
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Emoji
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modalRowOption}
          onPress={() => {
            hideActionsModal(onFotosPress);
          }}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: isDark ? "#2D2D2D" : "#F3F4F6" },
            ]}
          >
            <MaterialCommunityIcons
              name="image-outline"
              size={24}
              color={colors.text}
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Fotos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modalRowOption}
          onPress={() => {
            hideActionsModal(onCameraPress);
          }}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: isDark ? "#2D2D2D" : "#F3F4F6" },
            ]}
          >
            <MaterialCommunityIcons
              name="camera-outline"
              size={24}
              color={colors.text}
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Câmera
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modalRowOption}
          onPress={() => {
            hideActionsModal(onDocumentosPress);
          }}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: isDark ? "#2D2D2D" : "#F3F4F6" },
            ]}
          >
            <MaterialCommunityIcons
              name="file-document-outline"
              size={24}
              color={colors.text}
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Documentos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modalRowOption}
          onPress={() => {
            hideActionsModal(onLocationPress);
          }}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: isDark ? "#2D2D2D" : "#F3F4F6" },
            ]}
          >
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={24}
              color={colors.text}
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Localização
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modalRowOption}
          onPress={() => {
            hideActionsModal(onSearchWebPress);
          }}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: isDark ? "#2D2D2D" : "#F3F4F6" },
            ]}
          >
            <MaterialCommunityIcons
              name="earth"
              size={24}
              color={colors.text}
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Pesquisar na Web
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  modalOverlayCentered: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "flex-start",
    paddingLeft: 24,
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
