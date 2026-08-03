import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
  Modal,
  Image,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAppTheme } from "@/context/ThemeContext";
import { EmojiKeyboard } from "rn-emoji-keyboard";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "@/services/api";

interface ChatMessageOptionsModalProps {
  visible: boolean;
  onClose: (shouldClearSelection: boolean) => void;
  onReply: () => void;
  onForward: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onSelect: () => void;
  layout?: { x: number; y: number; width: number; height: number } | null;
  isMine?: boolean;
  reaction?: string | null;
  onReact?: (reactionEmoji: string | null) => void;
  currentUserAvatarUrl?: string | null;
  currentUsername?: string;
  participantAvatarUrl?: string | null;
  participantUsername?: string;
  reactionByMe?: boolean;
  onlyReactions?: boolean;
}

const HISTORY_KEY = "zapi_reactions_history";
const DEFAULT_EMOJIS = ["❤️", "👍", "👎", "😂", "😮", "😢"];

let cachedHistory = [...DEFAULT_EMOJIS];

// Background load
SecureStore.getItemAsync(HISTORY_KEY).then((val) => {
  if (val) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedHistory = parsed;
      }
    } catch {}
  }
});

async function getReactionsHistory(): Promise<string[]> {
  try {
    const val = await SecureStore.getItemAsync(HISTORY_KEY);
    if (val) {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_EMOJIS;
}

async function addEmojiToHistory(emoji: string) {
  try {
    const current = await getReactionsHistory();
    const filtered = current.filter((e) => e !== emoji);
    const updated = [emoji, ...filtered].slice(0, 6);
    await SecureStore.setItemAsync(HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_EMOJIS;
  }
}

export function ChatMessageOptionsModal({
  visible,
  onClose,
  onReply,
  onForward,
  onCopy,
  onDelete,
  onSelect,
  layout,
  isMine = false,
  reaction,
  onReact,
  currentUserAvatarUrl,
  currentUsername = "Você",
  participantAvatarUrl,
  participantUsername = "Outro",
  reactionByMe = false,
  onlyReactions = false,
}: ChatMessageOptionsModalProps) {
  const { colors, isDark } = useAppTheme();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const actionsAnimation = useRef(new Animated.Value(0)).current;

  const [reactionsList, setReactionsList] = useState<string[]>(cachedHistory);
  const [isEmojiKeyboardOpen, setIsEmojiKeyboardOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      getReactionsHistory().then((history) => {
        cachedHistory = history;
        setReactionsList(history);
      });

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

  // Calculate coordinates dynamically based on message bubble layout
  const menuHeight = 270;
  const reactionsHeight = 56;
  const detailHeight = 36;

  let menuTop = screenHeight / 2 - 130;
  let menuLeft: number | undefined = screenWidth / 2 - 120;
  let menuRight: number | undefined = undefined;

  let reactionsTop = menuTop - 64;
  let reactionsLeft: number | undefined = menuLeft;
  let reactionsRight: number | undefined = undefined;

  if (layout) {
    const bubbleTop = layout.y;
    const bubbleBottom = layout.y + layout.height;
    const spaceBelow = screenHeight - bubbleBottom;

    if (onlyReactions) {
      // Place reactions above the bubble by default
      reactionsTop = bubbleTop - reactionsHeight - 8;
      
      if (reactionsTop < 60) {
        // Fallback: place reactions below the bubble if there is not enough space above
        reactionsTop = bubbleBottom + 8;
      }
    } else {
      if (spaceBelow > menuHeight + 30) {
        // Place menu below, reactions above
        menuTop = bubbleBottom + 8;
        reactionsTop = bubbleTop - reactionsHeight - 8;
        
        if (reactionsTop < 60) {
          // Fallback: put both below message
          reactionsTop = bubbleBottom + 8;
          menuTop = reactionsTop + reactionsHeight + 8;
        }
      } else {
        // Place menu above, reactions above menu or below bubble
        menuTop = bubbleTop - menuHeight - 8;
        reactionsTop = menuTop - reactionsHeight - 8;

        if (menuTop < 60) {
          // Fallback: menu below
          menuTop = bubbleBottom + 8;
          reactionsTop = bubbleTop - reactionsHeight - 8;
        }
        
        if (reactionsTop < 60) {
          reactionsTop = bubbleBottom + 8;
          menuTop = reactionsTop + reactionsHeight + 8;
        }
      }
    }

    if (isMine) {
      menuRight = 16;
      reactionsRight = 16;
      menuLeft = undefined;
      reactionsLeft = undefined;
    } else {
      menuLeft = 16;
      reactionsLeft = 16;
      menuRight = undefined;
      reactionsRight = undefined;
    }
  }

  // Calculate detail position above reactions bar
  let detailTop = reactionsTop - detailHeight - 8;
  if (detailTop < 40) {
    // If detail top goes too high, place it below reactions bar instead
    detailTop = reactionsTop + reactionsHeight + 8;
  }
  let detailLeft = reactionsLeft;
  let detailRight = reactionsRight;

  const renderAvatar = (avatarUrl: string | null | undefined, name: string) => {
    const avatarUri = avatarUrl
      ? avatarUrl.startsWith("http")
        ? avatarUrl
        : `${API_URL}${avatarUrl.startsWith("/") ? "" : "/"}${avatarUrl}`
      : null;
    const initial = name[0]?.toUpperCase() || "?";

    return (
      <View style={[styles.detailAvatar, { backgroundColor: isDark ? "#2D2D2D" : "#E5E5EA" }]}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.detailAvatarImage} />
        ) : (
          <Text style={[styles.detailAvatarText, { color: colors.text }]}>{initial}</Text>
        )}
      </View>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={[
          StyleSheet.absoluteFillObject,
          styles.modalOverlay,
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

        {/* Reaction Info Card (shows who reacted above the reactions bar - Avatar and Reaction only) */}
        {reaction && (
          <Animated.View
            style={[
              styles.reactionDetailCard,
              {
                backgroundColor: isDark
                  ? "rgba(30, 30, 30, 0.95)"
                  : "rgba(255, 255, 255, 0.95)",
                borderColor: colors.border,
                top: detailTop,
                left: detailLeft,
                right: detailRight,
                opacity: modalOpacity,
                transform: [{ scale: modalScale }],
              },
            ]}
          >
            {renderAvatar(
              reactionByMe ? currentUserAvatarUrl : participantAvatarUrl,
              reactionByMe ? currentUsername : participantUsername
            )}
            <Text style={styles.reactionDetailEmoji}>{reaction}</Text>
          </Animated.View>
        )}

        {/* Reactions Bar */}
        <Animated.View
          style={[
            styles.reactionsBarCard,
            {
              backgroundColor: isDark
                ? "rgba(30, 30, 30, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
              borderColor: colors.border,
              top: reactionsTop,
              left: reactionsLeft,
              right: reactionsRight,
              opacity: modalOpacity,
              transform: [{ scale: modalScale }],
            },
          ]}
        >
          {reactionsList.map((emoji) => {
            const isSelected = reaction === emoji;
            return (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.reactionEmojiButton,
                  isSelected && {
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.05)",
                  },
                ]}
                onPress={() => {
                  addEmojiToHistory(emoji).then((updated) => {
                    cachedHistory = updated;
                    setReactionsList(updated);
                  });
                  if (onReact) onReact(isSelected ? null : emoji);
                  hideModal();
                }}
              >
                <Text style={styles.reactionEmojiText}>{emoji}</Text>
              </TouchableOpacity>
            );
          })}
          {/* Plus Button to open custom emoji selector */}
          <TouchableOpacity
            style={styles.plusButton}
            onPress={() => setIsEmojiKeyboardOpen(true)}
          >
            <MaterialCommunityIcons
              name="plus"
              size={24}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Options Menu */}
        {!onlyReactions && (
          <Animated.View
            style={[
              styles.actionsModalCard,
              {
                backgroundColor: isDark
                  ? "rgba(30, 30, 30, 0.85)"
                  : "rgba(255, 255, 255, 0.85)",
                borderColor: colors.border,
                top: menuTop,
                left: menuLeft,
                right: menuRight,
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
                  { backgroundColor: isDark ? "#2D2D2D" : "#FF3B30" },
                ]}
              >
                <MaterialCommunityIcons
                  name="delete-outline"
                  size={24}
                  color={isDark ? "#FF3B30" : "#FFFFFF"}
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
        )}
      </TouchableOpacity>

      {/* Emoji Keyboard Modal */}
      {isEmojiKeyboardOpen && (
        <Modal
          transparent={true}
          visible={isEmojiKeyboardOpen}
          animationType="slide"
          onRequestClose={() => setIsEmojiKeyboardOpen(false)}
        >
          <TouchableOpacity
            style={styles.emojiModalOverlay}
            activeOpacity={1}
            onPress={() => setIsEmojiKeyboardOpen(false)}
          >
            <View
              style={[
                styles.emojiSheetContainer,
                { backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF" },
              ]}
            >
              <View style={styles.emojiSheetHeader}>
                <Text style={[styles.emojiSheetTitle, { color: colors.text }]}>
                  Reagir com...
                </Text>
                <TouchableOpacity onPress={() => setIsEmojiKeyboardOpen(false)}>
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={colors.text}
                  />
                </TouchableOpacity>
              </View>
              <EmojiKeyboard
                onEmojiSelected={(emojiObj) => {
                  const selectedEmoji = emojiObj.emoji;
                  addEmojiToHistory(selectedEmoji).then((updated) => {
                    cachedHistory = updated;
                    setReactionsList(updated);
                  });
                  if (onReact) onReact(selectedEmoji);
                  setIsEmojiKeyboardOpen(false);
                  hideModal();
                }}
                expandable={false}
                hideHeader={true}
                enableRecentlyUsed={true}
                theme={{
                  backdrop: "transparent",
                  knob: colors.tint,
                  container: isDark ? "#1E1E1E" : "#FFFFFF",
                  header: colors.text,
                  skinTonesContainer: isDark ? "#1E1E1E" : "#FFFFFF",
                }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
  },
  reactionsBarCard: {
    position: "absolute",
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    alignItems: "center",
    zIndex: 1001,
  },
  reactionEmojiButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 16,
  },
  reactionEmojiText: {
    fontSize: 22,
  },
  plusButton: {
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  actionsModalCard: {
    position: "absolute",
    width: 240,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
    zIndex: 1000,
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
  emojiModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  emojiSheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 32,
    height: 420,
    elevation: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  emojiSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  emojiSheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  reactionDetailCard: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 1001,
  },
  detailAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
    overflow: "hidden",
  },
  detailAvatarImage: {
    width: "100%",
    height: "100%",
  },
  detailAvatarText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  reactionDetailEmoji: {
    fontSize: 15,
  },
});
