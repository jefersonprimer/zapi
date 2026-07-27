import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Modal,
} from "react-native";
import {
  GripVertical,
  Folder,
  Bell,
  Star,
  Users,
  Heart,
  Briefcase,
  Home,
  Gamepad2,
  BookOpen,
} from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface ReorderListsModalProps {
  visible: boolean;
  onClose: () => void;
  orderedFilters: any[];
  onReorderEnd: (updatedLists: any[]) => Promise<void>;
}

const renderListIcon = (
  iconName: string | null,
  colorColor: string | null,
  tintColor: string,
  size: number = 20,
) => {
  let hexColor = tintColor;
  if (colorColor === "🔴") hexColor = "#ef4444";
  else if (colorColor === "🟠") hexColor = "#f97316";
  else if (colorColor === "🟡") hexColor = "#eab308";
  else if (colorColor === "🟢") hexColor = "#22c55e";
  else if (colorColor === "🔵") hexColor = "#3b82f6";
  else if (colorColor === "🟣") hexColor = "#a855f7";

  switch (iconName) {
    case "❤️":
      return <Heart size={size} color={hexColor} fill={hexColor + "22"} />;
    case "⭐":
      return <Star size={size} color={hexColor} fill={hexColor + "22"} />;
    case "💼":
      return <Briefcase size={size} color={hexColor} fill={hexColor + "22"} />;
    case "🏠":
      return <Home size={size} color={hexColor} fill={hexColor + "22"} />;
    case "🎮":
      return <Gamepad2 size={size} color={hexColor} fill={hexColor + "22"} />;
    case "📚":
      return <BookOpen size={size} color={hexColor} fill={hexColor + "22"} />;
    default:
      return <Folder size={size} color={hexColor} fill={hexColor + "22"} />;
  }
};

const renderReorderListLeading = (
  item: {
    id: string;
    icon: string | null;
    color: string | null;
    isSystem: boolean;
  },
  tintColor: string,
  secondaryColor: string,
) => {
  const size = 20;
  let icon = null;

  if (item.isSystem) {
    switch (item.id) {
      case "all":
        icon = <Folder size={size} color={secondaryColor} />;
        break;
      case "unread":
        icon = <Bell size={size} color={secondaryColor} />;
        break;
      case "favorites":
        icon = <Star size={size} color={secondaryColor} />;
        break;
      case "groups":
        icon = <Users size={size} color={secondaryColor} />;
        break;
    }
  } else {
    icon = renderListIcon(item.icon, item.color, tintColor, size);
  }

  return <View style={styles.reorderListIconSlot}>{icon}</View>;
};

export default function ReorderListsModal({
  visible,
  onClose,
  orderedFilters,
  onReorderEnd,
}: ReorderListsModalProps) {
  const { colors, isDark } = useAppTheme();
  const [reorderLists, setReorderLists] = useState<any[]>(orderedFilters);
  const [isDragging, setIsDragging] = useState(false);

  const activeDragIndex = useRef<number | null>(null);
  const startTouchY = useRef<number>(0);
  const currentTouchY = useRef<number>(0);

  const bottomSheetAnimation = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    setReorderLists(orderedFilters);
  }, [orderedFilters]);

  useEffect(() => {
    if (visible) {
      setReorderLists(orderedFilters);
      setShouldRender(true);
      bottomSheetAnimation.setValue(0);
      Animated.spring(bottomSheetAnimation, {
        toValue: 1,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(bottomSheetAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible, orderedFilters, bottomSheetAnimation]);

  const handleClose = () => {
    Animated.timing(bottomSheetAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const handleTouchStart = (index: number, pageY: number) => {
    activeDragIndex.current = index;
    startTouchY.current = pageY;
    currentTouchY.current = pageY;
    setIsDragging(true);
  };

  const handleTouchMove = (pageY: number) => {
    if (activeDragIndex.current === null) return;
    currentTouchY.current = pageY;

    const diffY = currentTouchY.current - startTouchY.current;
    const itemHeight = 60; // height of each list row
    const indexShift = Math.round(diffY / itemHeight);

    if (indexShift !== 0) {
      const fromIndex = activeDragIndex.current;
      const toIndex = fromIndex + indexShift;

      if (toIndex >= 0 && toIndex < reorderLists.length) {
        const updated = [...reorderLists];
        const [movedItem] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, movedItem);

        setReorderLists(updated);
        activeDragIndex.current = toIndex;
        startTouchY.current = currentTouchY.current;
      }
    }
  };

  const handleTouchEnd = async () => {
    activeDragIndex.current = null;
    setIsDragging(false);
    await onReorderEnd(reorderLists);
  };

  if (!shouldRender) return null;

  const translateY = bottomSheetAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const overlayOpacity = bottomSheetAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Modal
      visible={shouldRender}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={[
          StyleSheet.absoluteFillObject,
          { zIndex: 1000 },
        ]}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: colors.modalOverlay,
              opacity: overlayOpacity,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.bottomSheetContainer,
            {
              backgroundColor: isDark
                ? "rgba(30, 30, 30, 0.85)"
                : "rgba(255, 255, 255, 0.85)",
              borderColor: colors.border,
              transform: [{ translateY }],
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.header}>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>
              Reorganizar Listas
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={{ color: colors.tint, fontWeight: "bold", fontSize: 16 }}>
                Concluir
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: colors.textSecondary, marginBottom: 12, fontSize: 13 }}>
            Arrastar o ícone no lado direito para cima ou para baixo para reordenar.
          </Text>

          <ScrollView scrollEnabled={!isDragging} showsVerticalScrollIndicator={false}>
            {reorderLists.map((item, index) => {
              const isItemDragging =
                isDragging && activeDragIndex.current === index;
              return (
                <View
                  key={item.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 8,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                    height: 60,
                    backgroundColor: isItemDragging
                      ? colors.border + "66"
                      : "transparent",
                  }}
                >
                  <View style={styles.reorderListLeading}>
                    {renderReorderListLeading(
                      item,
                      colors.tint,
                      colors.textSecondary,
                    )}
                    <Text
                      style={[
                        styles.reorderListName,
                        { color: colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </View>

                  <View
                    style={{ padding: 12 }}
                    onStartShouldSetResponder={() => true}
                    onResponderGrant={(e) =>
                      handleTouchStart(index, e.nativeEvent.pageY)
                    }
                    onResponderMove={(e) =>
                      handleTouchMove(e.nativeEvent.pageY)
                    }
                    onResponderRelease={handleTouchEnd}
                  >
                    <GripVertical size={20} color={colors.textSecondary} />
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bottomSheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "60%",
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 24,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingVertical: 10,
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  reorderListLeading: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 8,
  },
  reorderListIconSlot: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  reorderListName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 20,
    includeFontPadding: false,
  },
});
