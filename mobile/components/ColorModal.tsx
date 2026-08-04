import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export const DRAWING_COLORS = [
  // Neutros / Escuros
  "#000000",
  "#111827",
  "#4B5563",
  "#9CA3AF",
  "#D1D5DB",
  "#FFFFFF",
  // Vermelhos / Rosas
  "#E11D48",
  "#EF4444",
  "#F43F5E",
  "#FDA4AF",
  "#F472B6",
  "#EC4899",
  // Laranjas / Amarelos
  "#D97706",
  "#F59E0B",
  "#F97316",
  "#FDBA74",
  "#EAB308",
  "#FEF08A",
  // Verdes
  "#15803D",
  "#22C55E",
  "#4ADE80",
  "#059669",
  "#10B981",
  "#6EE7B7",
  // Azuis / Cianos
  "#1D4ED8",
  "#3B82F6",
  "#60A5FA",
  "#0891B2",
  "#06B6D4",
  "#67E8F9",
  // Roxos
  "#6D28D9",
  "#8B5CF6",
  "#C084FC",
  "#4F46E5",
  "#6366F1",
  "#A5B4FC",
];

export interface ColorModalProps {
  visible: boolean;
  selectedColor: string;
  onSelectColor: (color: string) => void;
  onClose: () => void;
  colorsList?: string[];
  title?: string;
}

export default function ColorModal({
  visible,
  selectedColor,
  onSelectColor,
  onClose,
  colorsList = DRAWING_COLORS,
  title = "Escolher Cor",
}: ColorModalProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 70,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(SCREEN_HEIGHT);
      overlayOpacity.setValue(0);
    }
  }, [visible, overlayOpacity, translateY]);

  const handleClose = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      callback?.();
    });
  };

  const handleSelectColor = (color: string) => {
    handleClose(() => onSelectColor(color));
  };

  if (!visible) return null;

  const sheetBottomPadding = Math.max(insets.bottom, 20);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => handleClose()}
    >
      <View style={styles.container}>
        <TouchableWithoutFeedback onPress={() => handleClose()}>
          <Animated.View
            style={[
              styles.overlay,
              {
                opacity: overlayOpacity,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark
                ? "rgba(30, 30, 30, 0.98)"
                : "rgba(255, 255, 255, 0.98)",
              borderColor: colors.border,
              paddingBottom: sheetBottomPadding,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity
              onPress={() => handleClose()}
              hitSlop={8}
              style={[styles.closeButton, { backgroundColor: colors.border }]}
            >
              <MaterialCommunityIcons
                name="close"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.grid}>
              {colorsList.map((colorItem) => {
                const isActive =
                  selectedColor.toLowerCase() === colorItem.toLowerCase();
                const isWhite =
                  colorItem.toUpperCase() === "#FFFFFF" ||
                  colorItem.toUpperCase() === "#FFF";

                return (
                  <TouchableOpacity
                    key={colorItem}
                    activeOpacity={0.7}
                    onPress={() => handleSelectColor(colorItem)}
                    style={[
                      styles.colorChip,
                      {
                        backgroundColor: colorItem,
                        borderColor: isWhite ? colors.border : colorItem,
                      },
                      isActive && styles.colorChipActive,
                    ]}
                  >
                    {isActive && (
                      <MaterialCommunityIcons
                        name="check"
                        size={16}
                        color={isWhite ? "#111827" : "#FFFFFF"}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128, 128, 128, 0.4)",
    alignSelf: "center",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollArea: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "flex-start",
  },
  colorChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  colorChipActive: {
    borderWidth: 3.5,
    borderColor: "#34C759",
    transform: [{ scale: 1.08 }],
  },
});
