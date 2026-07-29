import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import {
  type ChatListItem as ChatListItemType,
  deleteChat,
  archiveChat,
} from "@/services/api";
import {
  getChatsFromLocal,
  deleteChatLocal,
  setChatPinnedLocal,
  setChatArchivedLocal,
} from "@/services/database";
import {
  ArrowLeft,
  Trash2,
  Pin,
  PinOff,
  Archive,
  PanelTopClose,
} from "lucide-react-native";
import { wsClient } from "@/services/ws";
import { useAppTheme } from "@/context/ThemeContext";
import ChatListItem from "@/components/ChatListItem";

export default function ArchivedScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors } = useAppTheme();

  const [chats, setChats] = useState<ChatListItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);

  const archivedChats = chats.filter((c) => c.is_archived);

  const loadChats = useCallback(async () => {
    if (!token) return;
    try {
      const localChats = await getChatsFromLocal();
      setChats(localChats);
      setLoading(false);
    } catch (err: any) {
      console.warn("Error loading archived chats:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadChats();
      setSelectedChatIds([]);
    }, [loadChats]),
  );

  useEffect(() => {
    if (!token) return;
    const unsub = wsClient.on("chat_list_update", () => {
      loadChats();
    });
    return unsub;
  }, [token, loadChats]);

  const handleLongPress = (chatId: string) => {
    setSelectedChatIds((prev) => {
      if (prev.includes(chatId)) {
        return prev.filter((id) => id !== chatId);
      } else {
        return [...prev, chatId];
      }
    });
  };

  const handlePress = (item: ChatListItemType) => {
    if (selectedChatIds.length > 0) {
      handleLongPress(item.id);
    } else {
      router.push({
        pathname: "/chat",
        params: {
          chatId: item.id,
          participantId: item.participant_id || "",
          participantUsername:
            item.name ??
            item.participant_name ??
            item.participant_username ??
            "Unknown",
          participantAvatarUrl:
            (item.is_group ? item.avatar_url : item.participant_avatar_url) ||
            "",
        },
      });
    }
  };

  const handleUnarchiveSelectedChats = async () => {
    if (!token || selectedChatIds.length === 0) return;
    try {
      for (const chatId of selectedChatIds) {
        await archiveChat(token, chatId, false);
        await setChatArchivedLocal(chatId, false);
      }
      setSelectedChatIds([]);
      const updatedChats = await getChatsFromLocal();
      setChats(updatedChats);
    } catch (err) {
      console.error("Error unarchiving chat(s):", err);
      Alert.alert("Erro", "Não foi possível desarquivar as conversas.");
    }
  };

  const handleDeleteSelectedChats = () => {
    if (selectedChatIds.length === 0) return;
    const message =
      selectedChatIds.length === 1
        ? "Deseja apagar esta conversa?"
        : `Deseja apagar as ${selectedChatIds.length} conversas selecionadas?`;

    Alert.alert("Apagar conversa", message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          try {
            for (const chatId of selectedChatIds) {
              await deleteChat(token, chatId);
              await deleteChatLocal(chatId);
            }
            setSelectedChatIds([]);
            const updatedChats = await getChatsFromLocal();
            setChats(updatedChats);
          } catch (err: any) {
            console.error("Error deleting chat(s):", err);
            Alert.alert("Erro", "Não foi possível apagar a conversa.");
          }
        },
      },
    ]);
  };

  const handlePinSelectedChats = async () => {
    if (selectedChatIds.length === 0) return;
    const selectedChats = chats.filter((c) => selectedChatIds.includes(c.id));
    const isAllPinned = selectedChats.every((c) => c.is_pinned);
    const newPinState = !isAllPinned;

    try {
      for (const chatId of selectedChatIds) {
        await setChatPinnedLocal(chatId, newPinState);
      }
      setSelectedChatIds([]);
      const updatedChats = await getChatsFromLocal();
      setChats(updatedChats);
    } catch (err) {
      console.error("Error toggling pin status:", err);
      Alert.alert("Erro", "Não foi possível alterar o status de fixação.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      {selectedChatIds.length > 0 ? (
        <View
          style={[styles.header, { backgroundColor: colors.headerBackground }]}
        >
          <View style={styles.headerLeftSelected}>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => setSelectedChatIds([])}
            >
              <ArrowLeft color={colors.headerText} size={22} />
            </TouchableOpacity>
            <Text
              style={[styles.selectedCountText, { color: colors.headerText }]}
            >
              {selectedChatIds.length}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={handlePinSelectedChats}
            >
              {(() => {
                const selectedChats = chats.filter((c) =>
                  selectedChatIds.includes(c.id),
                );
                const isAllPinned = selectedChats.every((c) => c.is_pinned);
                return isAllPinned ? (
                  <PinOff color={colors.headerText} size={22} />
                ) : (
                  <Pin color={colors.headerText} size={22} />
                );
              })()}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={handleUnarchiveSelectedChats}
            >
              <PanelTopClose color={colors.headerText} size={22} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={handleDeleteSelectedChats}
            >
              <Trash2 color={colors.headerText} size={22} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View
          style={[styles.header, { backgroundColor: colors.headerBackground }]}
        >
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => router.back()}
            >
              <ArrowLeft color={colors.headerText} size={22} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.headerText }]}>
              Arquivadas
            </Text>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.tint}
          style={{ marginTop: 40 }}
        />
      ) : archivedChats.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyContent}>
            <Archive
              color={colors.textSecondary}
              size={48}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Nenhuma conversa arquivada
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={archivedChats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <ChatListItem
              item={item}
              isSelected={selectedChatIds.includes(item.id)}
              onPress={handlePress}
              onLongPress={handleLongPress}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerLeftSelected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerIcon: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "500",
  },
  selectedCountText: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 8,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
  },
});
