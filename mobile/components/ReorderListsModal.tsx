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
import { GripVertical, Trash2 } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface ReorderListsModalProps {
  visible: boolean;
  onClose: () => void;
  orderedFilters: any[];
  onReorderEnd: (updatedLists: any[]) => Promise<void>;
  onDeleteList?: (listId: string) => void;
}

export default function ReorderListsModal({
  visible,
  onClose,
  orderedFilters,
  onReorderEnd,
  onDeleteList,
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
        style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}
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
            <View
              style={[styles.dragHandle, { backgroundColor: colors.border }]}
            />
          </View>

          <Text style={[styles.dialogTitle, { color: colors.text }]}>
            Reorganizar Tags
          </Text>

          <Text
            style={[styles.dialogDescription, { color: colors.textSecondary }]}
          >
            Arrastar o ícone no lado direito para cima ou para baixo para
            reordenar.
          </Text>

          <ScrollView
            scrollEnabled={!isDragging}
            showsVerticalScrollIndicator={false}
          >
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
                    height: 60,
                    backgroundColor: isItemDragging
                      ? colors.border + "66"
                      : "transparent",
                  }}
                >
                  <View style={styles.reorderListLeading}>
                    <Text
                      style={[styles.reorderListName, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </View>

                  <View style={styles.reorderListActions}>
                    {!item.isSystem && onDeleteList ? (
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => onDeleteList(item.id)}
                        hitSlop={8}
                      >
                        <Trash2 size={18} color={colors.danger} />
                      </TouchableOpacity>
                    ) : null}

                    <View
                      style={styles.reorderDragHandle}
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
  dialogTitle: {
    fontSize: 20,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
  },
  dialogDescription: {
    textAlign: "center",
    marginBottom: 12,
    fontSize: 14,
  },
  reorderListLeading: {
    flex: 1,
    paddingRight: 8,
  },
  reorderListName: {
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 20,
    includeFontPadding: false,
  },
  reorderListActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  deleteButton: {
    padding: 8,
  },
  reorderDragHandle: {
    padding: 12,
  },
});
