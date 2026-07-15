import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
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
  const { colors } = useAppTheme();
  const [reorderLists, setReorderLists] = useState<any[]>(orderedFilters);
  const [isDragging, setIsDragging] = useState(false);

  const activeDragIndex = useRef<number | null>(null);
  const startTouchY = useRef<number>(0);
  const currentTouchY = useRef<number>(0);

  useEffect(() => {
    if (visible) {
      setReorderLists([...orderedFilters]);
    }
  }, [visible, orderedFilters]);

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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.modalOverlay,
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.menuBackground,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            height: "60%",
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text
              style={[
                styles.dialogTitle,
                { color: colors.text, marginBottom: 0 },
              ]}
            >
              Reorganizar Listas
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text
                style={{
                  color: colors.tint,
                  fontWeight: "bold",
                  fontSize: 16,
                }}
              >
                Concluir
              </Text>
            </TouchableOpacity>
          </View>

          <Text
            style={{
              color: colors.textSecondary,
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            Arrastar o ícone no lado direito para cima ou para baixo para
            reordenar.
          </Text>

          <ScrollView scrollEnabled={!isDragging}>
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
