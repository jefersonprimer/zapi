import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { getChats, type ChatListItem, deleteChat, muteChat, archiveChat, API_URL } from "@/services/api";
import {
  getChatsFromLocal,
  saveChats,
  deleteChatLocal,
  setChatPinnedLocal,
  setChatMuteLocal,
  setChatArchivedLocal,
} from "@/services/database";
import {
  Camera,
  MoreVertical,
  MessageSquarePlus,
  Sun,
  Moon,
  Laptop,
  Check,
  Lock,
  Mic,
  Video,
  FileText,
  Trash2,
  ArrowLeft,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Ban,
  User,
  Pin,
  PinOff,
  Bell,
  BellOff,
  Archive,
} from "lucide-react-native";
import { wsClient } from "@/services/ws";
import { useAppTheme } from "@/context/ThemeContext";

const isChatMuted = (chat: ChatListItem) => {
  if (chat.notification_muted_forever) return true;
  if (chat.notification_muted_until) {
    return new Date(chat.notification_muted_until) > new Date();
  }
  return false;
};

export default function ChatListScreen() {
  const router = useRouter();
  const { signOut, token } = useAuth();
  const { colors, themePreference, setThemePreference } = useAppTheme();

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [muteModalVisible, setMuteModalVisible] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);

  const activeChats = chats.filter((c) => !c.is_archived);
  const archivedChatsCount = chats.filter((c) => c.is_archived).length;

  const handleLongPress = (chatId: string) => {
    setSelectedChatIds((prev) => {
      if (prev.includes(chatId)) {
        return prev.filter((id) => id !== chatId);
      } else {
        return [...prev, chatId];
      }
    });
  };

  const handlePress = (item: ChatListItem) => {
    if (selectedChatIds.length > 0) {
      handleLongPress(item.id);
    } else {
      router.push({
        pathname: "/chat",
        params: {
          chatId: item.id,
          participantId: item.participant_id || "",
          participantUsername:
            item.name ?? item.participant_username ?? "Unknown",
          participantAvatarUrl: item.participant_avatar_url || "",
        },
      });
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

  const handleMutePress = async () => {
    if (selectedChatIds.length === 0) return;

    const selectedChats = chats.filter((c) => selectedChatIds.includes(c.id));
    const allSelectedAreMuted = selectedChats.every(isChatMuted);

    if (allSelectedAreMuted) {
      // Unmute all selected chats immediately
      try {
        for (const chatId of selectedChatIds) {
          if (token) {
            await muteChat(token, chatId, null, false);
          }
          await setChatMuteLocal(chatId, null, false);
        }
        setSelectedChatIds([]);
        const updatedChats = await getChatsFromLocal();
        setChats(updatedChats);
      } catch (err) {
        console.error("Error unmuting chat(s):", err);
        Alert.alert("Erro", "Não foi possível desativar o silenciamento.");
      }
    } else {
      // Show modal to choose mute duration
      setMuteModalVisible(true);
    }
  };

  const handleMuteChats = async (durationHours: number | "always") => {
    if (selectedChatIds.length === 0) return;

    let mutedUntil: string | null = null;
    let mutedForever = false;

    if (durationHours === "always") {
      mutedForever = true;
    } else {
      mutedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
    }

    try {
      for (const chatId of selectedChatIds) {
        if (token) {
          await muteChat(token, chatId, mutedUntil, mutedForever);
        }
        await setChatMuteLocal(chatId, mutedUntil, mutedForever);
      }
      setMuteModalVisible(false);
      setSelectedChatIds([]);
      const updatedChats = await getChatsFromLocal();
      setChats(updatedChats);
    } catch (err) {
      console.error("Error muting chat(s):", err);
      Alert.alert("Erro", "Não foi possível silenciar as conversas.");
    }
  };

  const handleArchiveSelectedChats = async () => {
    if (!token || selectedChatIds.length === 0) return;
    try {
      const selectedChats = chats.filter((c) => selectedChatIds.includes(c.id));
      const shouldArchive = !selectedChats.every((c) => c.is_archived);

      for (const chatId of selectedChatIds) {
        await archiveChat(token, chatId, shouldArchive);
        await setChatArchivedLocal(chatId, shouldArchive);
      }

      setSelectedChatIds([]);
      const updatedChats = await getChatsFromLocal();
      setChats(updatedChats);
    } catch (err) {
      console.error("Error archiving chat(s):", err);
      Alert.alert("Erro", "Não foi possível arquivar as conversas.");
    }
  };

  const loadChats = useCallback(async () => {
    if (!token) return;
    try {
      // 1. Get from local SQLite database immediately
      const localChats = await getChatsFromLocal();
      setChats(localChats);

      if (localChats.length > 0) {
        setLoading(false);
      }

      // 2. Sincroniza em background com a API
      const data = await getChats(token);

      // 3. Salva no SQLite local
      await saveChats(data.chats);

      // 4. Recarrega as informações atualizadas do SQLite
      const updatedChats = await getChatsFromLocal();
      setChats(updatedChats);
    } catch (err: any) {
      console.warn("Offline or sync error loading chats:", err);
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

  function formatTime(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
                  selectedChatIds.includes(c.id)
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
              onPress={handleMutePress}
            >
              {(() => {
                const selectedChats = chats.filter((c) =>
                  selectedChatIds.includes(c.id)
                );
                const allSelectedAreMuted = selectedChats.every(isChatMuted);
                return allSelectedAreMuted ? (
                  <Bell color={colors.headerText} size={22} />
                ) : (
                  <BellOff color={colors.headerText} size={22} />
                );
              })()}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={handleArchiveSelectedChats}
            >
              <Archive color={colors.headerText} size={22} />
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
          <Text style={[styles.title, { color: colors.headerText }]}>Zapi</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() =>
                Alert.alert("Câmera", "Câmera em desenvolvimento.")
              }
            >
              <Camera color={colors.headerText} size={22} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => setMenuVisible(true)}
            >
              <MoreVertical color={colors.headerText} size={22} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Options Menu Dropdown */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View
            style={[
              styles.menuContainer,
              {
                backgroundColor: colors.menuBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setThemeModalVisible(true);
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Alterar Tema
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                router.push("/settings");
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Configurações
              </Text>
            </TouchableOpacity>

            <View
              style={[styles.menuDivider, { backgroundColor: colors.border }]}
            />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                signOut();
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.danger }]}>
                Sair
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Theme Choice Dialog Modal */}
      <Modal
        visible={themeModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <TouchableOpacity
          style={[
            styles.dialogOverlay,
            { backgroundColor: colors.modalOverlay },
          ]}
          activeOpacity={1}
          onPress={() => setThemeModalVisible(false)}
        >
          <View
            style={[
              styles.themeDialog,
              {
                backgroundColor: colors.menuBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.dialogTitle, { color: colors.text }]}>
              Escolher tema
            </Text>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={async () => {
                await setThemePreference("light");
                setThemeModalVisible(false);
              }}
            >
              <View style={styles.dialogOptionLabel}>
                <Sun
                  size={20}
                  color={
                    themePreference === "light"
                      ? colors.tint
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.dialogOptionText,
                    { color: colors.text },
                    themePreference === "light" && {
                      color: colors.tint,
                      fontWeight: "600",
                    },
                  ]}
                >
                  Claro
                </Text>
              </View>
              {themePreference === "light" && (
                <Check size={18} color={colors.tint} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={async () => {
                await setThemePreference("dark");
                setThemeModalVisible(false);
              }}
            >
              <View style={styles.dialogOptionLabel}>
                <Moon
                  size={20}
                  color={
                    themePreference === "dark"
                      ? colors.tint
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.dialogOptionText,
                    { color: colors.text },
                    themePreference === "dark" && {
                      color: colors.tint,
                      fontWeight: "600",
                    },
                  ]}
                >
                  Escuro
                </Text>
              </View>
              {themePreference === "dark" && (
                <Check size={18} color={colors.tint} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={async () => {
                await setThemePreference("system");
                setThemeModalVisible(false);
              }}
            >
              <View style={styles.dialogOptionLabel}>
                <Laptop
                  size={20}
                  color={
                    themePreference === "system"
                      ? colors.tint
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.dialogOptionText,
                    { color: colors.text },
                    themePreference === "system" && {
                      color: colors.tint,
                      fontWeight: "600",
                    },
                  ]}
                >
                  Padrão do sistema
                </Text>
              </View>
              {themePreference === "system" && (
                <Check size={18} color={colors.tint} />
              )}
            </TouchableOpacity>

            <View
              style={[
                styles.menuDivider,
                { backgroundColor: colors.border, marginVertical: 8 },
              ]}
            />

            <TouchableOpacity
              style={styles.dialogCloseButton}
              onPress={() => setThemeModalVisible(false)}
            >
              <Text style={[styles.dialogCloseText, { color: colors.tint }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Mute Chat Dialog Modal */}
      <Modal
        visible={muteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMuteModalVisible(false)}
      >
        <TouchableOpacity
          style={[
            styles.dialogOverlay,
            { backgroundColor: colors.modalOverlay },
          ]}
          activeOpacity={1}
          onPress={() => setMuteModalVisible(false)}
        >
          <View
            style={[
              styles.themeDialog,
              {
                backgroundColor: colors.menuBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.dialogTitle, { color: colors.text }]}>
              Silenciar notificações
            </Text>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={() => handleMuteChats(1)}
            >
              <View style={styles.dialogOptionLabel}>
                <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                  1 hora
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={() => handleMuteChats(8)}
            >
              <View style={styles.dialogOptionLabel}>
                <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                  8 horas
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={() => handleMuteChats(24)}
            >
              <View style={styles.dialogOptionLabel}>
                <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                  24 horas
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={() => handleMuteChats(7 * 24)}
            >
              <View style={styles.dialogOptionLabel}>
                <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                  1 semana
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={() => handleMuteChats(30 * 24)}
            >
              <View style={styles.dialogOptionLabel}>
                <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                  1 mês
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={() => handleMuteChats("always")}
            >
              <View style={styles.dialogOptionLabel}>
                <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                  Sempre
                </Text>
              </View>
            </TouchableOpacity>

            <View
              style={[
                styles.menuDivider,
                { backgroundColor: colors.border, marginVertical: 8 },
              ]}
            />

            <TouchableOpacity
              style={styles.dialogCloseButton}
              onPress={() => setMuteModalVisible(false)}
            >
              <Text style={[styles.dialogCloseText, { color: colors.tint }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.tint}
          style={{ marginTop: 40 }}
        />
      ) : (activeChats.length === 0 && archivedChatsCount === 0) ? (
        <View style={styles.empty}>
          <View style={styles.emptyContent}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Nenhuma conversa ainda
            </Text>
            <Text
              style={[styles.emptySubtext, { color: colors.textSecondary }]}
            >
              Toque no botão abaixo para iniciar
            </Text>
          </View>
          <View style={[styles.footerContainer, { marginBottom: 60 }]}>
            <Lock color={colors.textSecondary} size={13} />
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Suas mensagens estão protegidas por criptografia.
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={activeChats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListFooterComponent={
            <View>
              {archivedChatsCount > 0 && (
                <TouchableOpacity
                  style={[
                    styles.archivedRow,
                    {
                      borderBottomColor: colors.border,
                      borderTopColor: colors.border,
                      backgroundColor: colors.menuBackground,
                    },
                  ]}
                  onPress={() => router.push("/archived" as any)}
                >
                  <View style={styles.archivedLeft}>
                    <Archive color={colors.tint} size={20} />
                    <Text style={[styles.archivedText, { color: colors.text }]}>
                      Conversas arquivadas
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.archivedBadge,
                      { backgroundColor: colors.tint + "22" },
                    ]}
                  >
                    <Text style={[styles.archivedCountText, { color: colors.tint, fontWeight: "bold" }]}>
                      {archivedChatsCount}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              <View style={styles.footerContainer}>
                <Lock color={colors.textSecondary} size={13} />
                <Text
                  style={[styles.footerText, { color: colors.textSecondary }]}
                >
                  Suas mensagens estão protegidas por criptografia.
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.chatItem,
                { borderBottomColor: colors.border },
                selectedChatIds.includes(item.id) && {
                  backgroundColor: colors.tint + "22",
                },
              ]}
              onPress={() => handlePress(item)}
              onLongPress={() => handleLongPress(item.id)}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: colors.tint },
                  item.is_group && styles.groupAvatar,
                  { justifyContent: "center", alignItems: "center", overflow: "hidden" },
                ]}
              >
                {!item.is_group && item.participant_avatar_url ? (
                  <Image
                    source={{
                      uri: item.participant_avatar_url.startsWith("http")
                        ? item.participant_avatar_url
                        : `${API_URL}${item.participant_avatar_url}`,
                    }}
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {item.is_group
                      ? (item.name ?? "G")[0].toUpperCase()
                      : (item.participant_username ?? "?")[0].toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.chatInfo}>
                <Text style={[styles.chatName, { color: colors.text }]}>
                  {item.name ?? item.participant_username ?? "Unknown"}
                </Text>
                {(() => {
                  if (!item.last_message) {
                    return (
                      <Text
                        style={[
                          styles.lastMessage,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        Nenhuma mensagem ainda
                      </Text>
                    );
                  }

                  let iconElement = null;
                  let displayMessage = item.last_message;

                  if (item.last_message.startsWith("Audio") || item.last_message.startsWith("🎵 Áudio")) {
                    let durationStr = "";
                    const parts = item.last_message.split("|duration:");
                    if (parts.length > 1) {
                      const secs = parseInt(parts[1], 10);
                      if (!isNaN(secs)) {
                        const m = Math.floor(secs / 60);
                        const s = secs % 60;
                        durationStr = ` (${m}:${s < 10 ? "0" : ""}${s})`;
                      }
                    }
                    displayMessage = `Mensagem de voz ${durationStr}`;
                    iconElement = (
                      <Mic
                        size={15}
                        color={colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    );
                  } else if (item.last_message === "Photo" || item.last_message === "📷 Foto") {
                    displayMessage = "Foto";
                    iconElement = (
                      <Camera
                        size={15}
                        color={colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    );
                  } else if (item.last_message === "Video" || item.last_message === "🎥 Vídeo") {
                    displayMessage = "Vídeo";
                    iconElement = (
                      <Video
                        size={15}
                        color={colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    );
                  } else if (
                    item.last_message &&
                    (item.last_message === "File" ||
                      item.last_message.startsWith("File|") ||
                      item.last_message === "📁 Arquivo" ||
                      item.last_message.startsWith("📁 Arquivo|") ||
                      item.last_message.startsWith("Arquivo|"))
                  ) {
                    let fileName = "Arquivo";
                    let rawFileName = "";
                    if (item.last_message.startsWith("File|")) {
                      rawFileName = item.last_message.substring(5);
                    } else if (item.last_message.startsWith("📁 Arquivo|")) {
                      rawFileName = item.last_message.substring(11);
                    } else if (item.last_message.startsWith("Arquivo|")) {
                      rawFileName = item.last_message.substring(8);
                    }

                    if (rawFileName) {
                      const match = rawFileName.match(/^[^_]+_[0-9a-fA-F\-]{36}_(.+)$/);
                      if (match) {
                        fileName = match[1];
                      } else {
                        const oldMatch = rawFileName.match(/^[^_]+_([0-9a-fA-F\-]{36}\..+)$/);
                        fileName = oldMatch ? oldMatch[1] : rawFileName;
                      }
                    }

                    displayMessage = fileName;
                    iconElement = (
                      <FileText
                        size={15}
                        color={colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    );
                  } else if (item.last_message === "Message deleted") {
                    displayMessage = "Mensagem apagada";
                    iconElement = (
                      <Ban
                        size={15}
                        color={colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    );
                  } else if (item.last_message === "Chamada efetuada") {
                    displayMessage = "Chamada efetuada";
                    iconElement = (
                      <PhoneOutgoing
                        size={15}
                        color={colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    );
                  } else if (item.last_message === "Chamada recebida") {
                    displayMessage = "Chamada recebida";
                    iconElement = (
                      <PhoneIncoming
                        size={15}
                        color={colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    );
                  } else if (item.last_message === "Chamada perdida") {
                    displayMessage = "Chamada perdida";
                    iconElement = (
                      <PhoneMissed
                        size={15}
                        color={colors.danger}
                        style={{ marginRight: 4 }}
                      />
                    );
                  } else if (item.last_message && item.last_message.startsWith('{"type":"contact_share"')) {
                    try {
                      const parsed = JSON.parse(item.last_message);
                      displayMessage = parsed.username;
                    } catch {
                      displayMessage = "Contato";
                    }
                    iconElement = (
                      <User
                        size={15}
                        color={colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    );
                  }

                  if (iconElement) {
                    return (
                      <View style={styles.lastMessageAudioContainer}>
                        {iconElement}
                        <Text
                          style={[
                            styles.lastMessage,
                            { color: colors.textSecondary, flex: 1 },
                            item.unread_count > 0 && styles.lastMessageUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {displayMessage}
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <Text
                      style={[
                        styles.lastMessage,
                        { color: colors.textSecondary },
                        item.unread_count > 0 && styles.lastMessageUnread,
                      ]}
                      numberOfLines={1}
                    >
                      {item.last_message}
                    </Text>
                  );
                })()}
              </View>
              <View style={styles.rightContainer}>
                <Text
                  style={[
                    styles.time,
                    { color: colors.textSecondary },
                    item.unread_count > 0 && [
                      styles.timeUnread,
                      { color: colors.tint },
                    ],
                  ]}
                >
                  {formatTime(item.last_message_at)}
                </Text>
                 <View style={styles.rightIconsRow}>
                  {isChatMuted(item) && (
                    <BellOff
                      color={colors.textSecondary}
                      size={14}
                    />
                  )}
                  {item.is_pinned && (
                    <Pin
                      color={colors.textSecondary}
                      size={14}
                      style={[styles.pinIcon, { transform: [{ rotate: "45deg" }] }]}
                    />
                  )}
                  {item.unread_count > 0 && (
                    <View
                      style={[styles.badge, { backgroundColor: colors.badge }]}
                    >
                      <Text
                        style={[styles.badgeText, { color: colors.badgeText }]}
                      >
                        {item.unread_count}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.fab }]}
        onPress={() => router.push("/contacts")}
      >
        <MessageSquarePlus color="#fff" size={24} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  title: { fontSize: 22, fontWeight: "bold" },
  headerLeftSelected: { flexDirection: "row", alignItems: "center", gap: 12 },
  selectedCountText: { fontSize: 20, fontWeight: "bold", marginLeft: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerIcon: {
    padding: 4,
  },
  groupAvatar: { backgroundColor: "#34C759" },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  chatInfo: { flex: 1 },
  chatName: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  lastMessage: { fontSize: 14 },
  lastMessageAudioContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  lastMessageUnread: { fontWeight: "700" },
  time: { fontSize: 12 },
  timeUnread: { fontWeight: "700" },
  rightContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 8,
  },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  rightIconsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  pinIcon: {
    marginRight: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  empty: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  emptySubtext: { fontSize: 14, textAlign: "center" },
  footerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 40,
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
    flexShrink: 1,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  dialogOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  menuContainer: {
    position: "absolute",
    top: 60,
    right: 6,
    borderRadius: 12,
    paddingVertical: 6,
    width: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
  },
  menuItem: {
    padding: 14,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "500",
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
  themeDialog: {
    width: "80%",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  dialogOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  dialogOptionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dialogOptionText: {
    fontSize: 16,
  },
  dialogCloseButton: {
    alignItems: "flex-end",
    paddingTop: 8,
    paddingRight: 4,
  },
  dialogCloseText: {
    fontSize: 16,
    fontWeight: "600",
  },
  archivedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  archivedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  archivedText: {
    fontSize: 16,
    fontWeight: "600",
  },
  archivedBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  archivedCountText: {
    fontSize: 12,
  },
});
