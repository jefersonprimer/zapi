import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Animated,
  PanResponder,
  LayoutAnimation,
  Platform,
  UIManager,
  ScrollView,
} from "react-native";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "@/context/ThemeContext";
import { getStorageItem, setStorageItem } from "@/context/AuthContext";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ChatActionsModalProps {
  visible: boolean;
  onClose: () => void;
  onEmojiPress: () => void;
  onGifPress: () => void;
  onStickerPress: () => void;
  onFotosPress: () => void;
  onCameraPress: () => void;
  onDocumentosPress: () => void;
  onDrawPress: () => void;
  onSearchWebPress: () => void;
  onLocationPress: () => void;
  onSendLaterPress: () => void;
}

const ITEM_HEIGHT = 58;
const DEFAULT_ORDER = [
  "emoji",
  "gif",
  "sticker",
  "fotos",
  "camera",
  "draw",
  "documentos",
  "location",
  "searchWeb",
  "sendLater",
];

export function ChatActionsModal({
  visible,
  onClose,
  onEmojiPress,
  onGifPress,
  onStickerPress,
  onFotosPress,
  onCameraPress,
  onDocumentosPress,
  onDrawPress,
  onSearchWebPress,
  onLocationPress,
  onSendLaterPress,
}: ChatActionsModalProps) {
  const { colors, isDark } = useAppTheme();
  const actionsAnimation = useRef(new Animated.Value(0)).current;

  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;

  const orderRef = useRef(order);
  const activeIdRef = useRef<string | null>(null);
  const currentDragIndex = useRef<number>(-1);
  const dragStartIndex = useRef<number>(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressed = useRef<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const scrollStartVal = useRef(0);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  // Load saved order on mount
  useEffect(() => {
    const loadOrder = async () => {
      const saved = await getStorageItem("chat_actions_order");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const normalized = [
              ...parsed.filter((item) => DEFAULT_ORDER.includes(item)),
              ...DEFAULT_ORDER.filter((item) => !parsed.includes(item)),
            ];
            if (normalized.length === DEFAULT_ORDER.length) {
              setOrder(normalized);
            }
          }
        } catch (e) {
          console.error("Failed to load chat actions order:", e);
        }
      }
    };
    loadOrder();
  }, []);

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

  const actionsMap: Record<
    string,
    {
      label: string;
      icon: string;
      library: "Ionicons" | "MaterialCommunityIcons";
      onPress: () => void;
    }
  > = {
    emoji: {
      label: "Emoji",
      icon: "happy-outline",
      library: "Ionicons",
      onPress: () => {
        Keyboard.dismiss();
        hideActionsModal(onEmojiPress);
      },
    },
    gif: {
      label: "GIF",
      icon: "gif",
      library: "MaterialCommunityIcons",
      onPress: () => {
        Keyboard.dismiss();
        hideActionsModal(onGifPress);
      },
    },
    sticker: {
      label: "Sticker",
      icon: "sticker-outline",
      library: "MaterialCommunityIcons",
      onPress: () => {
        Keyboard.dismiss();
        hideActionsModal(onStickerPress);
      },
    },
    fotos: {
      label: "Fotos",
      icon: "image-outline",
      library: "Ionicons",
      onPress: () => hideActionsModal(onFotosPress),
    },
    camera: {
      label: "Câmera",
      icon: "camera-outline",
      library: "Ionicons",
      onPress: () => hideActionsModal(onCameraPress),
    },
    documentos: {
      label: "Documentos",
      icon: "document-text-outline",
      library: "Ionicons",
      onPress: () => hideActionsModal(onDocumentosPress),
    },
    draw: {
      label: "Desenhar",
      icon: "brush-outline",
      library: "Ionicons",
      onPress: () => hideActionsModal(onDrawPress),
    },
    location: {
      label: "Localização",
      icon: "location-outline",
      library: "Ionicons",
      onPress: () => hideActionsModal(onLocationPress),
    },
    searchWeb: {
      label: "Pesquisar na Web",
      icon: "globe-outline",
      library: "Ionicons",
      onPress: () => hideActionsModal(onSearchWebPress),
    },
    sendLater: {
      label: "Agendar Mensagem",
      icon: "time-outline",
      library: "Ionicons",
      onPress: () => hideActionsModal(onSendLaterPress),
    },
  };

  const panResponders = useRef<Record<string, any>>({});

  const getPanResponder = (key: string) => {
    if (!panResponders.current[key]) {
      panResponders.current[key] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt, gestureState) => {
          const index = orderRef.current.indexOf(key);
          if (index === -1) return;

          activeIdRef.current = key;
          isLongPressed.current = false;
          scrollStartVal.current = scrollY.current;

          // Start long press timer (300ms)
          timerRef.current = setTimeout(() => {
            isLongPressed.current = true;
            setDraggingId(key);
            dragStartIndex.current = index;
            currentDragIndex.current = index;
            dragY.setValue(0); // translateY starts at 0
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }, 300);
        },
        onPanResponderMove: (evt, gestureState) => {
          if (activeIdRef.current !== key) return;

          if (!isLongPressed.current) {
            const dy = gestureState.dy;
            const dx = gestureState.dx;
            if (Math.abs(dy) > 8 || Math.abs(dx) > 8) {
              if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
              }
              const targetScrollY = scrollStartVal.current - dy;
              scrollViewRef.current?.scrollTo({
                y: targetScrollY,
                animated: false,
              });
            }
            return;
          }

          if (dragStartIndex.current === -1 || currentDragIndex.current === -1)
            return;

          // Update translateY translation directly with dy
          dragY.setValue(gestureState.dy);

          // Calculate current visual Y position relative to container
          const currentY =
            dragStartIndex.current * ITEM_HEIGHT + gestureState.dy;

          const targetIndex = Math.max(
            0,
            Math.min(
              orderRef.current.length - 1,
              Math.round(currentY / ITEM_HEIGHT),
            ),
          );

          if (targetIndex !== currentDragIndex.current) {
            const newOrder = [...orderRef.current];
            const [removed] = newOrder.splice(currentDragIndex.current, 1);
            newOrder.splice(targetIndex, 0, removed);

            orderRef.current = newOrder;
            currentDragIndex.current = targetIndex;

            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut,
            );
            setOrder(newOrder);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },
        onPanResponderRelease: (evt, gestureState) => {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }

          if (!isLongPressed.current) {
            const isTap =
              Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10;
            if (isTap) {
              const action = actionsMap[key];
              if (action) {
                action.onPress();
              }
            }
            setDraggingId(null);
            activeIdRef.current = null;
            dragStartIndex.current = -1;
            currentDragIndex.current = -1;
            return;
          }

          if (
            dragStartIndex.current === -1 ||
            currentDragIndex.current === -1
          ) {
            setDraggingId(null);
            activeIdRef.current = null;
            dragStartIndex.current = -1;
            currentDragIndex.current = -1;
            return;
          }

          // Target translation relative to the drag start position
          const targetTranslation =
            (currentDragIndex.current - dragStartIndex.current) * ITEM_HEIGHT;

          Animated.spring(dragY, {
            toValue: targetTranslation,
            useNativeDriver: true, // Now we can use native driver!
            tension: 80,
            friction: 8,
          }).start(() => {
            setDraggingId(null);
            activeIdRef.current = null;
            dragStartIndex.current = -1;
            currentDragIndex.current = -1;
            setStorageItem(
              "chat_actions_order",
              JSON.stringify(orderRef.current),
            );
          });
        },
        onPanResponderTerminationRequest: () => !isLongPressed.current,
        onPanResponderTerminate: () => {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          setDraggingId(null);
          activeIdRef.current = null;
          dragStartIndex.current = -1;
          currentDragIndex.current = -1;
        },
      });
    }
    return panResponders.current[key];
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
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(0, 0, 0, 0.08)",
            opacity: modalOpacity,
            transform: [{ scale: modalScale }, { translateY: modalTranslateY }],
          },
        ]}
      >
        <ScrollView
          ref={scrollViewRef}
          scrollEnabled={draggingId === null}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.listContainer,
            { height: order.length * ITEM_HEIGHT },
          ]}
          showsVerticalScrollIndicator={true}
          onScroll={(event) => {
            scrollY.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          {order.map((key, index) => {
            const action = actionsMap[key];
            if (!action) return null;

            const isDragging = draggingId === key;
            const topPosition = isDragging
              ? dragStartIndex.current * ITEM_HEIGHT
              : index * ITEM_HEIGHT;
            const responder = getPanResponder(key);

            return (
              <Animated.View
                key={key}
                {...responder.panHandlers}
                style={[
                  styles.modalRowOption,
                  {
                    top: topPosition,
                    zIndex: isDragging ? 100 : 1,
                    backgroundColor: "transparent",
                    transform: [
                      { scale: isDragging ? 1.02 : 1 },
                      { translateY: isDragging ? dragY : 0 },
                    ],
                  },
                ]}
              >
                <View style={styles.modalRowClickable}>
                  <View
                    style={[
                      styles.modalRowIconContainer,
                      { backgroundColor: isDark ? "#2D2D2D" : "#F3F4F6" },
                    ]}
                  >
                    {action.library === "Ionicons" ? (
                      <Ionicons
                        name={action.icon as any}
                        size={24}
                        color={colors.text}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name={action.icon as any}
                        size={24}
                        color={colors.text}
                      />
                    )}
                  </View>
                  <Text style={[styles.modalRowText, { color: colors.text }]}>
                    {action.label}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </ScrollView>
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
    width: "70%",
    height: 400,
    borderRadius: 32,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  scrollView: {
    width: "100%",
  },
  listContainer: {
    width: "100%",
    position: "relative",
  },
  modalRowOption: {
    position: "absolute",
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 50,
    overflow: "hidden",
  },
  modalRowClickable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
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
  dragHandle: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
});
