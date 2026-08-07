import React, { useEffect, useRef, useState } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";

interface ListMenuModalProps {
  visible: boolean;
  onClose: () => void;
  list: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    isSystem: boolean;
  } | null;
  onMuteChats: () => void;
  onEditList: () => void;
  onReorderLists: () => void;
  onDeleteList: () => void;
}

export default function ListMenuModal({
  visible,
  onClose,
  list,
  onMuteChats,
  onEditList,
  onReorderLists,
  onDeleteList,
}: ListMenuModalProps) {
  const { colors, isDark } = useAppTheme();
  const dialogAnimation = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      dialogAnimation.setValue(0);
      Animated.spring(dialogAnimation, {
        toValue: 1,
        tension: 90,
        friction: 9,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(dialogAnimation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible, dialogAnimation]);

  const handleClose = (callback?: () => void) => {
    Animated.timing(dialogAnimation, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      if (callback) callback();
    });
  };

  if (!shouldRender) return null;

  const dialogScale = dialogAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.93, 1],
  });

  const dialogTranslateY = dialogAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
  });

  const dialogOpacity = dialogAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <TouchableOpacity
      style={[
        StyleSheet.absoluteFillObject,
        styles.dialogOverlay,
        { zIndex: 1000 },
      ]}
      activeOpacity={1}
      onPress={() => handleClose()}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: colors.modalOverlay,
            opacity: dialogOpacity,
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
            opacity: dialogOpacity,
            transform: [
              { scale: dialogScale },
              { translateY: dialogTranslateY },
            ],
          },
        ]}
        onStartShouldSetResponder={() => true}
      >
        <TouchableOpacity
          style={styles.dialogOption}
          onPress={() => handleClose(onMuteChats)}
        >
          <View style={styles.dialogOptionLabel}>
            <Ionicons
              name="notifications-outline"
              size={24}
              color={colors.textSecondary}
            />
            <Text style={[styles.dialogOptionText, { color: colors.text }]}>
              Silenciar conversas
            </Text>
          </View>
        </TouchableOpacity>

        {!list?.isSystem && (
          <TouchableOpacity
            style={styles.dialogOption}
            onPress={() => handleClose(onEditList)}
          >
            <View style={styles.dialogOptionLabel}>
              <Ionicons
                name="pencil-outline"
                size={24}
                color={colors.textSecondary}
              />
              <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                Editar lista
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.dialogOption}
          onPress={() => handleClose(onReorderLists)}
        >
          <View style={styles.dialogOptionLabel}>
            <MaterialCommunityIcons
              name="drag-vertical"
              size={24}
              color={colors.textSecondary}
            />
            <Text style={[styles.dialogOptionText, { color: colors.text }]}>
              Reorganizar listas
            </Text>
          </View>
        </TouchableOpacity>

        {!list?.isSystem && (
          <>
            <View
              style={[
                styles.menuDivider,
                { backgroundColor: colors.border, marginVertical: 4 },
              ]}
            />
            <TouchableOpacity
              style={styles.dialogOption}
              onPress={() => handleClose(onDeleteList)}
            >
              <View style={styles.dialogOptionLabel}>
                <Ionicons
                  name="trash-outline"
                  size={24}
                  color={colors.danger}
                />
                <Text
                  style={[styles.dialogOptionText, { color: colors.danger }]}
                >
                  Apagar lista
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  dialogOverlay: {
    flex: 1,
  },
  menuContainer: {
    position: "absolute",
    top: 200,
    left: "50%",
    marginLeft: -110,
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
  dialogOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dialogOptionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dialogOptionText: {
    fontSize: 16,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
  },
});
