import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Modal,
} from "react-native";
import { Check } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { ChatListItem, API_URL } from "@/services/api";

interface ChatSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  activeChats: ChatListItem[];
  initialSelectedChatIds: string[];
  onSave: (selectedChatIds: string[]) => void;
}

export default function ChatSelectorModal({
  visible,
  onClose,
  activeChats,
  initialSelectedChatIds,
  onSave,
}: ChatSelectorModalProps) {
  const { colors, isDark } = useAppTheme();
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialSelectedChatIds,
  );

  const bottomSheetAnimation = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setSelectedIds(initialSelectedChatIds);
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
  }, [visible, initialSelectedChatIds, bottomSheetAnimation]);

  const handleClose = () => {
    Animated.timing(bottomSheetAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const handleToggleChat = (chatId: string) => {
    setSelectedIds((prev) =>
      prev.includes(chatId)
        ? prev.filter((id) => id !== chatId)
        : [...prev, chatId],
    );
  };

  const handleSave = () => {
    onSave(selectedIds);
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
            Escolher conversas para a Lista
          </Text>

          <FlatList
            data={activeChats}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            renderItem={({ item }) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 12,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  }}
                  onPress={() => handleToggleChat(item.id)}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View
                      style={[
                        styles.avatar,
                        {
                          backgroundColor: colors.tint,
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          justifyContent: "center",
                          alignItems: "center",
                          overflow: "hidden",
                        },
                      ]}
                    >
                      {item.is_group && item.avatar_url ? (
                        <Image
                          source={{
                            uri: item.avatar_url.startsWith("http")
                              ? item.avatar_url
                              : `${API_URL}${item.avatar_url}`,
                          }}
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: 18,
                          }}
                        />
                      ) : !item.is_group && item.participant_avatar_url ? (
                        <Image
                          source={{
                            uri: item.participant_avatar_url.startsWith("http")
                              ? item.participant_avatar_url
                              : `${API_URL}${item.participant_avatar_url}`,
                          }}
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: 18,
                          }}
                        />
                      ) : (
                        <Text style={[styles.avatarText, { fontSize: 14 }]}>
                          {item.is_group
                            ? (item.name ?? "G")[0].toUpperCase()
                            : (item.participant_name ??
                                item.participant_username ??
                                "?")[0].toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text style={{ color: colors.text, fontSize: 16 }}>
                      {item.name ??
                        item.participant_name ??
                        item.participant_username ??
                        "Unknown"}
                    </Text>
                  </View>
                  <View
                    style={[
                      {
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: colors.textSecondary,
                        justifyContent: "center",
                        alignItems: "center",
                      },
                      isSelected && {
                        backgroundColor: colors.tint,
                        borderColor: colors.tint,
                      },
                    ]}
                  >
                    {isSelected && <Check size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 12,
              paddingTop: 16,
            }}
          >
            <TouchableOpacity onPress={handleClose}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 16,
                  padding: 8,
                }}
              >
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave}>
              <Text
                style={{
                  color: colors.tint,
                  fontSize: 16,
                  padding: 8,
                }}
              >
                Salvar
              </Text>
            </TouchableOpacity>
          </View>
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
    height: "70%",
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
  avatar: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
