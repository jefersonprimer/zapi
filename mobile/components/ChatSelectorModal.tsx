import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
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
  const { colors } = useAppTheme();
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedChatIds);

  useEffect(() => {
    if (visible) {
      setSelectedIds(initialSelectedChatIds);
    }
  }, [visible, initialSelectedChatIds]);

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
            height: "70%",
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={[
              styles.dialogTitle,
              { color: colors.text, marginBottom: 12 },
            ]}
          >
            Escolher conversas para a lista
          </Text>

          <FlatList
            data={activeChats}
            keyExtractor={(item) => item.id}
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
                            : (item.participant_name ?? item.participant_username ?? "?")[0].toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text style={{ color: colors.text, fontSize: 16 }}>
                      {item.name ?? item.participant_name ?? item.participant_username ?? "Unknown"}
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
              marginTop: 16,
            }}
          >
            <TouchableOpacity onPress={onClose}>
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
                  fontWeight: "bold",
                  padding: 8,
                }}
              >
                Salvar
              </Text>
            </TouchableOpacity>
          </View>
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
  avatar: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
