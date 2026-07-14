import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Modal,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Phone,
  Video,
  Trash2,
  Shield,
  ShieldAlert,
  ArrowLeft,
  User,
  Mail,
  MoreVertical,
  Bell,
  BellOff,
  MessageSquareText,
  Star,
  ListPlus,
  Check,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getContacts,
  blockContact,
  unblockContact,
  clearChatMessages,
  type Contact,
  API_URL,
  muteChat,
  favoriteChat,
  createChat,
  getChats,
  getChatLists,
  updateChatLists,
  createChatList,
} from "@/services/api";
import {
  getChatsFromLocal,
  setChatMuteLocal,
  getDatabase,
  setChatFavoriteLocal,
  getLocalChatLists,
  saveLocalChatLists,
  saveChats,
  type LocalChatList,
} from "@/services/database";
import { voiceCallManager } from "@/services/voiceCallManager";
import CreateListModal from "@/components/CreateListModal";

export default function ContactDetailScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const { participantId, participantUsername, chatId, avatarUrl } =
    useLocalSearchParams<{
      participantId: string;
      participantUsername: string;
      chatId?: string;
      avatarUrl?: string;
    }>();

  const [contact, setContact] = useState<Contact | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isAvatarFullScreen, setIsAvatarFullScreen] = useState(false);

  const [muteModalVisible, setMuteModalVisible] = useState(false);
  const [chatSettings, setChatSettings] = useState<{
    notification_muted_until?: string | null;
    notification_muted_forever?: boolean;
  } | null>(null);

  const [resolvedChatId, setResolvedChatId] = useState<string | null>(chatId || null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [allLists, setAllLists] = useState<LocalChatList[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [listSelectorVisible, setListSelectorVisible] = useState(false);
  const [createListModalVisible, setCreateListModalVisible] = useState(false);
  const [tempSelectedListIds, setTempSelectedListIds] = useState<string[]>([]);

  // Load local chat settings when chatId or participantId changes
  useEffect(() => {
    const loadLocalChatSettings = async () => {
      try {
        const chats = await getChatsFromLocal();
        let foundChat = null;
        if (chatId) {
          foundChat = chats.find((c) => c.id === chatId);
        } else if (participantId) {
          foundChat = chats.find((c) => c.participant_id === participantId);
        }
        if (foundChat) {
          setResolvedChatId(foundChat.id);
          setIsFavorite(!!foundChat.is_favorite);
          setChatSettings({
            notification_muted_until: foundChat.notification_muted_until,
            notification_muted_forever: foundChat.notification_muted_forever,
          });
        }
      } catch (err) {
        console.error("Error loading chat settings from SQLite:", err);
      }
    };
    loadLocalChatSettings();
  }, [chatId, participantId]);

  const getOrCreateChatId = async (): Promise<string> => {
    if (resolvedChatId) return resolvedChatId;
    if (!token || !participantId) {
      throw new Error("Sessão inválida ou contato não especificado.");
    }
    
    // Create/get chat on server
    const response = await createChat(token, participantId);
    const newChatId = response.id;
    setResolvedChatId(newChatId);
    
    // Upsert into local database so we have it locally
    try {
      const chatsResponse = await getChats(token, newChatId);
      if (chatsResponse.chats && chatsResponse.chats.length > 0) {
        await saveChats(chatsResponse.chats);
      }
    } catch (err) {
      console.error("Error fetching/saving new chat locally:", err);
    }
    
    return newChatId;
  };

  const handleToggleFavorite = async () => {
    if (!token || !participantId) return;
    setActionLoading(true);
    try {
      const targetChatId = await getOrCreateChatId();
      const nextFavorite = !isFavorite;
      
      // Update local db
      await setChatFavoriteLocal(targetChatId, nextFavorite);
      
      // Update server db
      if (token) {
        await favoriteChat(token, targetChatId, nextFavorite);
      }
      
      setIsFavorite(nextFavorite);
      Alert.alert(
        "Sucesso", 
        nextFavorite ? "Adicionado aos favoritos com sucesso." : "Removido dos favoritos com sucesso."
      );
    } catch (err: any) {
      console.error("Error toggling favorite:", err);
      Alert.alert("Erro", err.message || "Não foi possível atualizar os favoritos.");
    } finally {
      setActionLoading(false);
    }
  };

  const syncLists = async () => {
    if (!token) return;
    try {
      const response = await getChatLists(token);
      if (response && response.lists) {
        const mappedLists: LocalChatList[] = response.lists.map((l) => ({
          id: l.id,
          user_id: l.user_id,
          name: l.name,
          color: l.color,
          icon: l.icon,
          position: l.position,
          created_at: l.created_at,
          updated_at: l.updated_at,
          chat_ids: l.chat_ids,
        }));
        await saveLocalChatLists(mappedLists);
        setAllLists(mappedLists);
        if (resolvedChatId) {
          const selected = mappedLists
            .filter((l) => l.chat_ids.includes(resolvedChatId))
            .map((l) => l.id);
          setSelectedListIds(selected);
        }
      }
    } catch (err) {
      console.warn("Offline or sync error syncing lists:", err);
    }
  };

  const loadListsAndSelection = useCallback(async () => {
    try {
      const lists = await getLocalChatLists();
      setAllLists(lists);
      if (resolvedChatId) {
        const selected = lists
          .filter((l) => l.chat_ids.includes(resolvedChatId))
          .map((l) => l.id);
        setSelectedListIds(selected);
      } else {
        setSelectedListIds([]);
      }
    } catch (err) {
      console.error("Error loading chat lists in detail:", err);
    }
  }, [resolvedChatId]);

  useEffect(() => {
    loadListsAndSelection();
  }, [loadListsAndSelection]);

  const handleOpenListSelector = async () => {
    setActionLoading(true);
    try {
      await syncLists();
      setTempSelectedListIds([...selectedListIds]);
      setListSelectorVisible(true);
    } catch (err) {
      console.error("Error fetching lists:", err);
      setTempSelectedListIds([...selectedListIds]);
      setListSelectorVisible(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateChatLists = async (
    chatId: string,
    selectedListIds: string[],
  ) => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        "DELETE FROM chat_list_items WHERE chat_id = ? AND list_id IN (SELECT id FROM chat_lists)",
        [chatId],
      );
      for (const lid of selectedListIds) {
        await db.runAsync(
          "INSERT INTO chat_list_items (list_id, chat_id, created_at) VALUES (?, ?, ?)",
          [lid, chatId, new Date().toISOString()],
        );
      }

      if (token) {
        await updateChatLists(token, chatId, selectedListIds);
      }
    } catch (err) {
      console.error("Error updating chat lists:", err);
      throw err;
    }
  };

  const handleSaveLists = async () => {
    setActionLoading(true);
    try {
      const targetChatId = await getOrCreateChatId();
      await handleUpdateChatLists(targetChatId, tempSelectedListIds);
      setSelectedListIds(tempSelectedListIds);
      setListSelectorVisible(false);
      Alert.alert("Sucesso", "Listas atualizadas com sucesso.");
    } catch (err: any) {
      console.error("Error saving lists:", err);
      Alert.alert("Erro", err.message || "Não foi possível atualizar as listas.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateList = async (name: string, color: string, icon: string) => {
    if (!token) return;
    setActionLoading(true);
    try {
      const response = await createChatList(token, name, color, icon);
      if (response && response.list) {
        await syncLists();
        setTempSelectedListIds((prev) => [...prev, response.list.id]);
        setCreateListModalVisible(false);
        setListSelectorVisible(true);
      }
    } catch (err: any) {
      console.error("Error creating list:", err);
      Alert.alert("Erro", "Não foi possível criar a lista.");
    } finally {
      setActionLoading(false);
    }
  };

  const getSelectedListsLabel = () => {
    if (selectedListIds.length === 0) return "Nenhuma lista";
    const names = allLists
      .filter((l) => selectedListIds.includes(l.id))
      .map((l) => (l.icon ? `${l.icon} ${l.name}` : l.name));
    return names.join(", ");
  };

  const isMuted = (() => {
    if (!chatSettings) return false;
    if (chatSettings.notification_muted_forever) return true;
    if (chatSettings.notification_muted_until) {
      return new Date(chatSettings.notification_muted_until) > new Date();
    }
    return false;
  })();

  const getMuteStatusLabel = () => {
    if (!chatSettings) return "Todos";

    const { notification_muted_until, notification_muted_forever } = chatSettings;

    if (notification_muted_forever) {
      return "Silenciado para sempre";
    }

    if (notification_muted_until) {
      const untilDate = new Date(notification_muted_until);
      const now = new Date();
      if (untilDate > now) {
        const diffMs = untilDate.getTime() - now.getTime();
        const diffHours = Math.round(diffMs / (60 * 60 * 1000));

        if (diffHours <= 1) {
          return "Silenciado por 1 hora";
        }
        if (diffHours <= 8) {
          return "Silenciado por 8 horas";
        }
        if (diffHours <= 24) {
          if (untilDate.getDate() === now.getDate()) {
            return `Silenciado até hoje às ${untilDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          } else {
            return `Silenciado até amanhã às ${untilDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          }
        }

        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
        return `Silenciado até ${untilDate.toLocaleDateString('pt-BR', options)}`;
      }
    }

    return "Todos";
  };

  const handleMuteChats = async (durationHours: number | "always" | "unmute") => {
    let targetChatId = chatId;
    if (!targetChatId) {
      try {
        const chats = await getChatsFromLocal();
        const found = chats.find((c) => c.participant_id === participantId);
        if (found) {
          targetChatId = found.id;
        }
      } catch (err) {
        console.error("Error finding chat id:", err);
      }
    }

    if (!targetChatId) {
      Alert.alert("Erro", "Não foi possível encontrar a conversa correspondente.");
      return;
    }

    let mutedUntil: string | null = null;
    let mutedForever = false;

    if (durationHours === "always") {
      mutedForever = true;
    } else if (durationHours === "unmute") {
      mutedForever = false;
      mutedUntil = null;
    } else {
      mutedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
    }

    try {
      if (token) {
        await muteChat(token, targetChatId, mutedUntil, mutedForever);
      }
      await setChatMuteLocal(targetChatId, mutedUntil, mutedForever);
      setChatSettings({
        notification_muted_until: mutedUntil,
        notification_muted_forever: mutedForever,
      });
      setMuteModalVisible(false);
    } catch (err) {
      console.error("Error updating mute settings:", err);
      Alert.alert("Erro", "Não foi possível alterar as configurações de notificação.");
    }
  };

  const fetchContactDetails = useCallback(async () => {
    if (!token || !participantId) return;
    try {
      setLoading(true);
      const contactsList = await getContacts(token);
      const found = contactsList.find((c) => c.contact_id === participantId);
      if (found) {
        setContact(found);
        setIsBlocked(found.is_blocked);
      }
    } catch (err: any) {
      console.error("Error fetching contact details:", err);
    } finally {
      setLoading(false);
    }
  }, [token, participantId]);

  useEffect(() => {
    fetchContactDetails();
  }, [fetchContactDetails]);

  const handleVoiceCall = () => {
    if (!participantId) return;
    voiceCallManager.startCall(
      participantId,
      participantUsername || contact?.username || "Contato",
    );
  };

  const handleVideoCall = () => {
    if (!participantId) return;
    voiceCallManager.startCall(
      participantId,
      participantUsername || contact?.username || "Contato",
      true,
    );
  };

  const handleToggleBlock = async () => {
    if (!token || !participantId) return;
    setActionLoading(true);
    try {
      if (isBlocked) {
        await unblockContact(token, participantId);
        setIsBlocked(false);
        Alert.alert("Sucesso", "Contato desbloqueado com sucesso.");
      } else {
        await blockContact(token, participantId);
        setIsBlocked(true);
        Alert.alert("Sucesso", "Contato bloqueado com sucesso.");
      }
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.message || "Não foi possível alterar o status de bloqueio.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearChat = () => {
    if (!token || !chatId) {
      Alert.alert("Info", "Não há histórico de conversas para limpar.");
      return;
    }

    Alert.alert(
      "Limpar Conversa",
      "Deseja realmente apagar todo o histórico de mensagens deste chat? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpar",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await clearChatMessages(token, chatId);
              Alert.alert("Sucesso", "Histórico de conversa apagado.");
            } catch (err: any) {
              Alert.alert(
                "Erro",
                err.message || "Não foi possível limpar a conversa.",
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const nameInitial = (participantUsername ||
    contact?.username ||
    "?")[0]?.toUpperCase();
  const displayName =
    participantUsername || contact?.username || "Carregando...";
  const displayEmail = contact?.email || "Email indisponível";

  const currentAvatarUrl = contact?.avatar_url || avatarUrl;
  const avatarUri = currentAvatarUrl
    ? currentAvatarUrl.startsWith("http")
      ? currentAvatarUrl
      : `${API_URL}${currentAvatarUrl}`
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Custom Header */}
      <View
        style={[
          styles.customHeader,
          { paddingTop: insets.top, backgroundColor: colors.headerBackground },
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <ArrowLeft size={24} color={colors.headerText} />
          </TouchableOpacity>
          <Text
            style={[styles.headerTitle, { color: colors.headerText, flex: 1 }]}
          >
            Detalhes do Contato
          </Text>
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            style={styles.headerMenuBtn}
          >
            <MoreVertical size={24} color={colors.headerText} />
          </TouchableOpacity>
        </View>
      </View>

      {actionLoading && (
        <View
          style={[
            styles.overlayLoading,
            { backgroundColor: colors.modalOverlay },
          ]}
        >
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => avatarUri && setIsAvatarFullScreen(true)}
              disabled={!avatarUri}
              style={[
                styles.avatar,
                {
                  backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA",
                  overflow: "hidden",
                },
              ]}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarText, { color: colors.text }]}>
                  {nameInitial}
                </Text>
              )}
            </TouchableOpacity>
            <Text style={[styles.displayName, { color: colors.text }]}>
              {displayName}
            </Text>
            {!!contact?.about && (
              <Text
                style={[styles.aboutText, { color: colors.textSecondary }]}
                numberOfLines={3}
              >
                {contact.about}
              </Text>
            )}
            {isBlocked && (
              <View
                style={[
                  styles.blockedBadge,
                  { backgroundColor: colors.danger },
                ]}
              >
                <Text style={styles.blockedBadgeText}>BLOQUEADO</Text>
              </View>
            )}
          </View>

          {/* Quick Call Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface }]}
              onPress={handleVoiceCall}
            >
              <Phone size={24} color={colors.tint} />
              <Text style={[styles.actionButtonText, { color: colors.tint }]}>
                Ligar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface }]}
              onPress={handleVideoCall}
            >
              <Video size={24} color={colors.tint} />
              <Text style={[styles.actionButtonText, { color: colors.tint }]}>
                Vídeo
              </Text>
            </TouchableOpacity>
          </View>

          {/* Details Section */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>
              Informações
            </Text>

            <View style={styles.infoRow}>
              <User
                size={20}
                color={colors.textSecondary}
                style={styles.infoIcon}
              />
              <View>
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  Nome
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {displayName}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.infoRow,
                styles.borderTop,
                { borderTopColor: colors.border },
              ]}
            >
              <Mail
                size={20}
                color={colors.textSecondary}
                style={styles.infoIcon}
              />
              <View>
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  E-mail
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {displayEmail}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.infoRow,
                styles.borderTop,
                { borderTopColor: colors.border },
              ]}
            >
              <MessageSquareText
                size={20}
                color={colors.textSecondary}
                style={styles.infoIcon}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  Recado
                </Text>
                <Text
                  style={[
                    styles.infoValue,
                    {
                      color: contact?.about
                        ? colors.text
                        : colors.textSecondary,
                      fontStyle: contact?.about ? "normal" : "italic",
                    },
                  ]}
                >
                  {contact?.about || "Sem recado"}
                </Text>
              </View>
            </View>
          </View>

          {/* Chat Settings */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.tint }]}>
              Configurações
            </Text>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setMuteModalVisible(true)}
            >
              {isMuted ? (
                <BellOff size={20} color={colors.textSecondary} style={styles.infoIcon} />
              ) : (
                <Bell size={20} color={colors.tint} style={styles.infoIcon} />
              )}
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  Notificações
                </Text>
                <Text
                  style={[styles.optionSub, { color: colors.textSecondary }]}
                >
                  {getMuteStatusLabel()}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionRow,
                styles.borderTop,
                { borderTopColor: colors.border },
              ]}
              onPress={handleToggleFavorite}
            >
              <Star
                size={20}
                color={isFavorite ? "#FFD700" : colors.textSecondary}
                fill={isFavorite ? "#FFD700" : "transparent"}
                style={styles.infoIcon}
              />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  {isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                </Text>
                <Text
                  style={[styles.optionSub, { color: colors.textSecondary }]}
                >
                  {isFavorite
                    ? "Esta conversa está marcada como favorita."
                    : "Marque esta conversa como favorita para acesso rápido."}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionRow,
                styles.borderTop,
                { borderTopColor: colors.border },
              ]}
              onPress={handleOpenListSelector}
            >
              <ListPlus size={20} color={colors.tint} style={styles.infoIcon} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  Adicionar à lista
                </Text>
                <Text
                  style={[styles.optionSub, { color: colors.textSecondary }]}
                >
                  {getSelectedListsLabel()}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Danger Zone Options */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.danger }]}>
              Opções
            </Text>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={handleClearChat}
            >
              <Trash2 size={20} color={colors.danger} style={styles.infoIcon} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.danger }]}>
                  Limpar conversa
                </Text>
                <Text
                  style={[styles.optionSub, { color: colors.textSecondary }]}
                >
                  Apaga todas as mensagens e histórico deste chat.
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionRow,
                styles.borderTop,
                { borderTopColor: colors.border },
              ]}
              onPress={handleToggleBlock}
            >
              {isBlocked ? (
                <>
                  <Shield
                    size={20}
                    color={colors.tint}
                    style={styles.infoIcon}
                  />
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, { color: colors.tint }]}>
                      Desbloquear contato
                    </Text>
                    <Text
                      style={[
                        styles.optionSub,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Permite que este usuário envie mensagens para você
                      novamente.
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <ShieldAlert
                    size={20}
                    color={colors.danger}
                    style={styles.infoIcon}
                  />
                  <View style={styles.optionTextContainer}>
                    <Text
                      style={[styles.optionTitle, { color: colors.danger }]}
                    >
                      Bloquear contato
                    </Text>
                    <Text
                      style={[
                        styles.optionSub,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Impede que este usuário envie mensagens para você.
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Dropdown Menu Modal */}
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
                backgroundColor: colors.menuBackground || colors.surface,
                borderColor: colors.border,
                top: insets.top + 10,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                router.push({
                  pathname: "/share-contact",
                  params: {
                    contactId: participantId,
                    contactUsername:
                      participantUsername || contact?.username || "",
                    contactAvatarUrl: currentAvatarUrl || "",
                  },
                });
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Compartilhar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full Screen Avatar Modal */}
      {avatarUri && (
        <Modal
          visible={isAvatarFullScreen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsAvatarFullScreen(false)}
        >
          <View style={styles.fullScreenBg}>
            <View style={[styles.fullScreenHeader, { paddingTop: insets.top }]}>
              <TouchableOpacity
                onPress={() => setIsAvatarFullScreen(false)}
                style={styles.fullScreenBackBtn}
              >
                <ArrowLeft size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.fullScreenImageContainer}>
              <Image
                source={{ uri: avatarUri }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </Modal>
      )}

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

            {isMuted && (
              <TouchableOpacity
                style={styles.dialogOption}
                onPress={() => handleMuteChats("unmute")}
              >
                <View style={styles.dialogOptionLabel}>
                  <Text style={[styles.dialogOptionText, { color: colors.tint, fontWeight: "bold" }]}>
                    Ativar notificações (Desilenciar)
                  </Text>
                </View>
              </TouchableOpacity>
            )}

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

      {/* List Selector Modal */}
      <Modal
        visible={listSelectorVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setListSelectorVisible(false)}
      >
        <TouchableOpacity
          style={[
            styles.dialogOverlay,
            { backgroundColor: colors.modalOverlay },
          ]}
          activeOpacity={1}
          onPress={() => setListSelectorVisible(false)}
        >
          <View
            style={[
              styles.themeDialog,
              {
                backgroundColor: colors.menuBackground || colors.surface,
                borderColor: colors.border,
                maxHeight: "70%",
              },
            ]}
          >
            <Text style={[styles.dialogTitle, { color: colors.text, marginBottom: 12 }]}>
              Marcar Listas
            </Text>

            {allLists.length === 0 ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  marginVertical: 12,
                  textAlign: "center",
                }}
              >
                Nenhuma lista personalizada criada.
              </Text>
            ) : (
              <FlatList
                data={allLists}
                keyExtractor={(item) => item.id}
                style={{ marginBottom: 12 }}
                renderItem={({ item }) => {
                  const isChecked = tempSelectedListIds.includes(item.id);
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
                      onPress={() => {
                        setTempSelectedListIds((prev) =>
                          prev.includes(item.id)
                            ? prev.filter((id) => id !== item.id)
                            : [...prev, item.id],
                        );
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 16 }}>
                        {item.icon ? `${item.icon} ` : ""}
                        {item.name}
                      </Text>
                      <View
                        style={[
                          {
                            width: 22,
                            height: 22,
                            borderRadius: 4,
                            borderWidth: 2,
                            borderColor: colors.textSecondary,
                            justifyContent: "center",
                            alignItems: "center",
                          },
                          isChecked && {
                            backgroundColor: colors.tint,
                            borderColor: colors.tint,
                          },
                        ]}
                      >
                        {isChecked && <Check size={14} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 12,
                marginTop: 8,
              }}
              onPress={() => {
                setListSelectorVisible(false);
                setCreateListModalVisible(true);
              }}
            >
              <Text
                style={{ color: colors.tint, fontSize: 16, fontWeight: "bold" }}
              >
                ＋ Nova lista
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.menuDivider,
                { backgroundColor: colors.border, marginVertical: 8 },
              ]}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 12,
                marginTop: 8,
              }}
            >
              <TouchableOpacity
                onPress={() => setListSelectorVisible(false)}
              >
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
              <TouchableOpacity
                onPress={handleSaveLists}
              >
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
        </TouchableOpacity>
      </Modal>

      {/* Create List Modal */}
      <CreateListModal
        visible={createListModalVisible}
        onClose={() => {
          setCreateListModalVisible(false);
          setListSelectorVisible(true);
        }}
        onCreate={handleCreateList}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayLoading: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  customHeader: {
    paddingBottom: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  backBtn: {
    padding: 4,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: "center",
    marginVertical: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 40,
    fontWeight: "bold",
  },
  displayName: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  aboutText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  blockedBadge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  blockedBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 20,
  },
  actionButton: {
    width: "42%",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  infoIcon: {
    marginRight: 16,
  },
  infoLabel: {
    fontSize: 12,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 2,
  },
  borderTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    paddingTop: 20,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  optionSub: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  headerMenuBtn: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  menuContainer: {
    position: "absolute",
    right: 6,
    borderRadius: 8,
    paddingVertical: 4,
    width: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 8,
    borderWidth: 1,
  },
  menuItem: {
    padding: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "500",
  },
  fullScreenBg: {
    flex: 1,
    backgroundColor: "#000",
  },
  fullScreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  fullScreenBackBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  fullScreenImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: {
    width: "100%",
    height: "100%",
  },
  dialogOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
});
