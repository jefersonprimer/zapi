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
  Switch,
  Platform,
  Clipboard,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Phone,
  Video,
  Trash2,
  Shield,
  ShieldAlert,
  ArrowLeft,
  MoreVertical,
  Bell,
  BellOff,
  Star,
  ListPlus,
  Check,
  Pin,
  Search,
  ChevronRight,
  Image as ImageIcon,
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
  setChatPinnedLocal,
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

  const [resolvedChatId, setResolvedChatId] = useState<string | null>(
    chatId || null,
  );
  const [isFavorite, setIsFavorite] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [showHeaderProfile, setShowHeaderProfile] = useState(false);
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
          setIsPinned(!!foundChat.is_pinned);
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
    } catch (err: any) {
      console.error("Error toggling favorite:", err);
      Alert.alert(
        "Erro",
        err.message || "Não foi possível atualizar os favoritos.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePin = async () => {
    setActionLoading(true);
    try {
      const targetChatId = await getOrCreateChatId();
      const nextPin = !isPinned;

      // Update local db
      await setChatPinnedLocal(targetChatId, nextPin);
      setIsPinned(nextPin);
    } catch (err: any) {
      console.error("Error toggling pin status:", err);
      Alert.alert(
        "Erro",
        err.message || "Não foi possível fixar/desafixar a conversa.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleMuteSwitch = () => {
    if (isMuted) {
      handleMuteChats("unmute");
    } else {
      setMuteModalVisible(true);
    }
  };

  const handleCopyEmail = () => {
    if (!displayEmail || displayEmail === "Email indisponível") return;
    Clipboard.setString(displayEmail);
  };

  const handleCopyRecado = () => {
    const recado = contact?.about || "Sem recado";
    Clipboard.setString(recado);
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
      Alert.alert(
        "Erro",
        err.message || "Não foi possível atualizar as listas.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateList = async (
    name: string,
    color: string,
    icon: string,
  ) => {
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

    const { notification_muted_until, notification_muted_forever } =
      chatSettings;

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
            return `Silenciado até hoje às ${untilDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
          } else {
            return `Silenciado até amanhã às ${untilDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
          }
        }

        const options: Intl.DateTimeFormatOptions = {
          day: "numeric",
          month: "long",
        };
        return `Silenciado até ${untilDate.toLocaleDateString("pt-BR", options)}`;
      }
    }

    return "Todos";
  };

  const handleMuteChats = async (
    durationHours: number | "always" | "unmute",
  ) => {
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
      Alert.alert(
        "Erro",
        "Não foi possível encontrar a conversa correspondente.",
      );
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
      mutedUntil = new Date(
        Date.now() + durationHours * 60 * 60 * 1000,
      ).toISOString();
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
      Alert.alert(
        "Erro",
        "Não foi possível alterar as configurações de notificação.",
      );
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

  const displayName =
    contact?.name ||
    participantUsername ||
    contact?.username ||
    "Carregando...";
  const nameInitial = (displayName || "?")[0]?.toUpperCase();
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
          {
            paddingTop: insets.top,
            backgroundColor: colors.headerBackground,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <ArrowLeft size={24} color={colors.headerText} />
          </TouchableOpacity>

          {showHeaderProfile ? (
            <View style={styles.headerProfileContainer}>
              <View
                style={[
                  styles.miniAvatar,
                  {
                    backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7",
                    overflow: "hidden",
                  },
                ]}
              >
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.miniAvatarImage}
                  />
                ) : (
                  <Text
                    style={[
                      styles.miniAvatarText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {nameInitial}
                  </Text>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[styles.headerProfileName, { color: colors.headerText }]}
              >
                {displayName}
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.headerTitle,
                { color: colors.headerText, flex: 1 },
              ]}
            >
              Detalhes do Contato
            </Text>
          )}

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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          onScroll={(event) => {
            const y = event.nativeEvent.contentOffset.y;
            if (y > 100) {
              if (!showHeaderProfile) setShowHeaderProfile(true);
            } else {
              if (showHeaderProfile) setShowHeaderProfile(false);
            }
          }}
          scrollEventThrottle={16}
        >
          {/* Profile Header Block */}
          <View style={styles.profileHeader}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => avatarUri && setIsAvatarFullScreen(true)}
              disabled={!avatarUri}
              style={[
                styles.avatar,
                {
                  backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7",
                  overflow: "hidden",
                },
              ]}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text
                  style={[styles.avatarText, { color: colors.textSecondary }]}
                >
                  {nameInitial}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={[styles.displayName, { color: colors.text }]}>
              {displayName}
            </Text>

            {!!(contact?.username || participantUsername) && (
              <Text
                style={[styles.usernameText, { color: colors.textSecondary }]}
              >
                @{contact?.username || participantUsername}
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

          <View
            style={[styles.sectionDivider, { backgroundColor: colors.border }]}
          />

          {/* Quick Call Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: isDark ? "#1C1C1E" : "#F2F2F7" },
              ]}
              onPress={handleVoiceCall}
            >
              <Phone size={20} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>
                Ligar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: isDark ? "#1C1C1E" : "#F2F2F7" },
              ]}
              onPress={handleVideoCall}
            >
              <Video size={20} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>
                Vídeo
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={[styles.sectionDivider, { backgroundColor: colors.border }]}
          />

          {/* Informações Section (Telegram style: value-first, label-second, copy on press) */}
          <View style={styles.infoSection}>
            {/* Recado Item */}
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={handleCopyRecado}
              style={styles.infoItem}
            >
              <Text style={[styles.infoValueText, { color: colors.text }]}>
                {contact?.about || "Sem recado"}
              </Text>
              <Text
                style={[styles.infoLabelText, { color: colors.textSecondary }]}
              >
                Recado
              </Text>
            </TouchableOpacity>

            {/* Email Item */}
            {!!displayEmail && (
              <>
                <View
                  style={[
                    styles.innerDivider,
                    { backgroundColor: colors.border },
                  ]}
                />
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={handleCopyEmail}
                  style={styles.infoItem}
                >
                  <Text style={[styles.infoValueText, { color: colors.text }]}>
                    {displayEmail}
                  </Text>
                  <Text
                    style={[
                      styles.infoLabelText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    E-mail
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View
            style={[styles.sectionDivider, { backgroundColor: colors.border }]}
          />

          {/* Options Section */}
          <View style={styles.optionsSection}>
            {/* Notificações */}
            <View style={styles.optionRow}>
              <View style={styles.optionLeft}>
                {isMuted ? (
                  <BellOff size={20} color={colors.textSecondary} />
                ) : (
                  <Bell size={20} color={colors.textSecondary} />
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
              </View>
              <Switch
                value={!isMuted}
                onValueChange={handleToggleMuteSwitch}
                trackColor={{ false: "#767577", true: colors.tint }}
                thumbColor={
                  Platform.OS === "android"
                    ? isMuted
                      ? "#f4f3f4"
                      : colors.tint
                    : undefined
                }
              />
            </View>

            {/* Favorito */}
            <View style={styles.optionRow}>
              <View style={styles.optionLeft}>
                <Star
                  size={20}
                  color={isFavorite ? "#FFD700" : colors.textSecondary}
                  fill={isFavorite ? "#FFD700" : "transparent"}
                />
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    Favorito
                  </Text>
                </View>
              </View>
              <Switch
                value={isFavorite}
                onValueChange={handleToggleFavorite}
                trackColor={{ false: "#767577", true: colors.tint }}
                thumbColor={
                  Platform.OS === "android"
                    ? isFavorite
                      ? colors.tint
                      : "#f4f3f4"
                    : undefined
                }
              />
            </View>

            {/* Fixar conversa */}
            <View style={styles.optionRow}>
              <View style={styles.optionLeft}>
                <Pin size={20} color={colors.textSecondary} />
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    Fixar conversa
                  </Text>
                </View>
              </View>
              <Switch
                value={isPinned}
                onValueChange={handleTogglePin}
                trackColor={{ false: "#767577", true: colors.tint }}
                thumbColor={
                  Platform.OS === "android"
                    ? isPinned
                      ? colors.tint
                      : "#f4f3f4"
                    : undefined
                }
              />
            </View>

            {/* Adicionar à lista */}
            <TouchableOpacity
              style={styles.optionRowClickable}
              onPress={handleOpenListSelector}
            >
              <View style={styles.optionLeft}>
                <ListPlus size={20} color={colors.textSecondary} />
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    Adicionar à lista
                  </Text>
                  {selectedListIds.length > 0 && (
                    <Text
                      style={[
                        styles.optionSub,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {getSelectedListsLabel()}
                    </Text>
                  )}
                </View>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Mídias compartilhadas */}
            <TouchableOpacity
              style={styles.optionRowClickable}
              onPress={() =>
                Alert.alert(
                  "Mídias Compartilhadas",
                  "Essa funcionalidade estará disponível em breve!",
                )
              }
            >
              <View style={styles.optionLeft}>
                <ImageIcon size={20} color={colors.textSecondary} />
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    Mídias compartilhadas
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Buscar nesta conversa */}
            <TouchableOpacity
              style={styles.optionRowClickable}
              onPress={() =>
                Alert.alert(
                  "Buscar na conversa",
                  "Essa funcionalidade estará disponível em breve!",
                )
              }
            >
              <View style={styles.optionLeft}>
                <Search size={20} color={colors.textSecondary} />
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    Buscar nesta conversa
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View
            style={[styles.sectionDivider, { backgroundColor: colors.border }]}
          />

          {/* Danger Zone Options */}
          <View style={styles.optionsSection}>
            <TouchableOpacity
              style={styles.optionRowClickable}
              onPress={handleClearChat}
            >
              <View style={styles.optionLeft}>
                <Trash2 size={20} color={colors.danger} />
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, { color: colors.danger }]}>
                    Limpar conversa
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionRowClickable}
              onPress={handleToggleBlock}
            >
              <View style={styles.optionLeft}>
                {isBlocked ? (
                  <>
                    <Shield size={20} color={colors.tint} />
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[styles.optionTitle, { color: colors.tint }]}
                      >
                        Desbloquear contato
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <ShieldAlert size={20} color={colors.danger} />
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[styles.optionTitle, { color: colors.danger }]}
                      >
                        Bloquear contato
                      </Text>
                    </View>
                  </>
                )}
              </View>
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
                  <Text
                    style={[
                      styles.dialogOptionText,
                      { color: colors.tint, fontWeight: "bold" },
                    ]}
                  >
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
            <Text
              style={[
                styles.dialogTitle,
                { color: colors.text, marginBottom: 12 },
              ]}
            >
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
              <TouchableOpacity onPress={() => setListSelectorVisible(false)}>
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
              <TouchableOpacity onPress={handleSaveLists}>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    flex: 1,
  },
  headerProfileContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  miniAvatarImage: {
    width: "100%",
    height: "100%",
  },
  miniAvatarText: {
    fontSize: 14,
    fontWeight: "600",
  },
  headerProfileName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 16,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 44,
    fontWeight: "300",
  },
  displayName: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  usernameText: {
    fontSize: 15,
    marginTop: 4,
    textAlign: "center",
  },
  blockedBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  blockedBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
    marginVertical: 12,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  infoItem: {
    paddingVertical: 10,
  },
  infoValueText: {
    fontSize: 16,
    fontWeight: "400",
  },
  infoLabelText: {
    fontSize: 13,
    marginTop: 4,
  },
  innerDivider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginVertical: 12,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  optionsSection: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  optionRowClickable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "400",
  },
  optionSub: {
    fontSize: 13,
    marginTop: 2,
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
