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
  Switch,
  Platform,
  Clipboard,
  Linking,
  Dimensions,
} from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Svg, Path } from "react-native-svg";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getContacts,
  type Contact,
  API_URL,
  createChat,
  getChats,
  updateContactName,
} from "@/services/api";
import {
  toggleBlockContact,
  toggleFavoriteChat,
  toggleMuteChat,
  clearChatHistory,
} from "@/services/chatActions";
import { getChatsFromLocal, saveChats } from "@/services/database";
import { useChatLists } from "@/hooks/useChatLists";
import { voiceCallManager } from "@/services/voiceCallManager";
import { getUserPixKey, type PixKeyData } from "@/services/pixApi";
import * as updatesApi from "@/services/updatesApi";
import CreateListModal from "@/components/CreateListModal";
import MuteModal from "@/components/MuteModal";
import ListSelectorModal from "@/components/ListSelectorModal";
import RenameContactModal from "@/components/RenameContactModal";
import { chatRepository } from "@/services/ChatRepository";

export default function ContactDetailScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const {
    participantId,
    participantUsername,
    chatId,
    avatarUrl,
    storeId: paramStoreId,
  } = useLocalSearchParams<{
    participantId: string;
    participantUsername: string;
    chatId?: string;
    avatarUrl?: string;
    storeId?: string;
  }>();

  const [contact, setContact] = useState<Contact | null>(null);
  const activeStoreId = paramStoreId || contact?.store_id || null;
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [isAvatarFullScreen, setIsAvatarFullScreen] = useState(false);

  const [muteModalVisible, setMuteModalVisible] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [publisherId, setPublisherId] = useState<string | null>(null);

  const [chatSettings, setChatSettings] = useState<{
    notification_muted_until?: string | null;
    notification_muted_forever?: boolean;
  } | null>(null);

  const [resolvedChatId, setResolvedChatId] = useState<string | null>(
    chatId || null,
  );
  const [isFavorite, setIsFavorite] = useState(false);
  const [showHeaderProfile, setShowHeaderProfile] = useState(false);
  const [pixKey, setPixKey] = useState<PixKeyData | null>(null);

  const [activeTab, setActiveTab] = useState<
    "info" | "media" | "links" | "docs" | "location"
  >("info");
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedFullScreenImage, setSelectedFullScreenImage] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!resolvedChatId || !token) return;
    const fetchMessages = async () => {
      try {
        const msgs = await chatRepository.getMessages(resolvedChatId, token);
        setMessages(msgs || []);
      } catch (err) {
        console.error("Error fetching messages for media tab:", err);
      }
    };
    fetchMessages();
  }, [resolvedChatId, token]);

  const {
    listSelectorVisible,
    setListSelectorVisible,
    createListModalVisible,
    setCreateListModalVisible,
    allLists,
    selectedListIds,
    handleOpenListSelector,
    handleSaveLists: handleSaveListsHook,
    handleCreateList,
  } = useChatLists(resolvedChatId);

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
          setIsBlocked(!!foundChat.is_blocked_by_me);
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

      if (token) {
        await toggleFavoriteChat(token, targetChatId, nextFavorite);
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

  const handleSaveName = async (newName: string | null) => {
    if (!token || !participantId) return;
    try {
      setActionLoading(true);
      await updateContactName(token, participantId, newName);
      setContact((prev) => (prev ? { ...prev, custom_name: newName } : null));
      setRenameModalVisible(false);
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.message || "Não foi possível atualizar o apelido do contato.",
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

  const handleSaveLists = async (selectedIds: string[]) => {
    try {
      const targetChatId = await getOrCreateChatId();
      await handleSaveListsHook(selectedIds, targetChatId);
    } catch (err) {
      console.error(err);
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

    try {
      if (token) {
        const result = await toggleMuteChat(token, targetChatId, durationHours);
        setChatSettings({
          notification_muted_until: result.mutedUntil,
          notification_muted_forever: result.mutedForever,
        });
      }
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

      try {
        const pixRes = await getUserPixKey(token, participantId);
        setPixKey(pixRes.pix_key);
      } catch {
        setPixKey(null);
      }

      try {
        const publisherData = await updatesApi.getPublisherByUser(
          token,
          participantId,
        );
        setPublisherId(publisherData.id);
        setIsFollowing(!!publisherData.is_following);
      } catch (err) {
        console.error("Error fetching publisher follow state:", err);
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
    voiceCallManager.startCall(
      participantId,
      participantUsername || contact?.username,
      false,
      contact?.avatar_url || avatarUrl,
    );
  };

  const handleVideoCall = () => {
    voiceCallManager.startCall(
      participantId,
      participantUsername || contact?.username,
      true,
      contact?.avatar_url || avatarUrl,
    );
  };

  const handleToggleBlock = async () => {
    if (!token || !participantId) return;

    const title = isBlocked ? "Desbloquear contato" : "Bloquear contato";
    const message = isBlocked
      ? "Deseja realmente desbloquear este contato?"
      : "Deseja realmente bloquear este contato?";

    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: isBlocked ? "Desbloquear" : "Bloquear",
        style: "destructive",
        onPress: async () => {
          setActionLoading(true);
          try {
            let targetChatId = resolvedChatId;
            if (!targetChatId) {
              try {
                const chats = await getChatsFromLocal();
                const found = chats.find(
                  (c) => c.participant_id === participantId,
                );
                if (found) {
                  targetChatId = found.id;
                  setResolvedChatId(found.id);
                }
              } catch (err) {
                console.error("Error finding chat id for block:", err);
              }
            }

            const nextBlockState = !isBlocked;
            await toggleBlockContact(
              token,
              participantId,
              targetChatId,
              nextBlockState,
            );
            setIsBlocked(nextBlockState);
            Alert.alert(
              "Sucesso",
              `Contato ${nextBlockState ? "bloqueado" : "desbloqueado"} com sucesso.`,
            );
          } catch (err: any) {
            Alert.alert(
              "Erro",
              err.message || "Não foi possível alterar o status de bloqueio.",
            );
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
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
              await clearChatHistory(token, chatId);
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
    contact?.custom_name ||
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

  const mediaMessages = messages.filter((m) => {
    if (m.deleted_for_everyone) return false;
    const hasImage = !!m.image_url;
    const hasLocalFile = !!m.local_file_path;
    const hasAttachments = m.attachments && m.attachments.length > 0;
    const attachmentType = hasAttachments ? m.attachments[0].type : null;
    return (
      hasImage ||
      hasLocalFile ||
      (hasAttachments &&
        (attachmentType === "image" || attachmentType === "video"))
    );
  });

  const linkMessages = messages.filter((m) => {
    if (m.deleted_for_everyone || !m.content) return false;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return urlRegex.test(m.content);
  });

  const docMessages = messages.filter((m) => {
    if (m.deleted_for_everyone) return false;
    const hasAttachments = m.attachments && m.attachments.length > 0;
    const attachmentType = hasAttachments ? m.attachments[0].type : null;
    return attachmentType === "document";
  });

  const locationMessages = messages.filter((m) => {
    if (m.deleted_for_everyone || !m.content) return false;
    try {
      const payload = JSON.parse(m.content);
      return payload && payload.type === "location";
    } catch {
      return false;
    }
  });

  const getMediaUrl = (item: any) => {
    const mediaUrl =
      item.local_file_path ||
      item.image_url ||
      (item.attachments && item.attachments[0]?.local_path) ||
      (item.attachments && item.attachments[0]?.remote_url);
    if (!mediaUrl) return null;
    if (mediaUrl.startsWith("http") || mediaUrl.startsWith("file://"))
      return mediaUrl;
    return `${API_URL}${mediaUrl.startsWith("/") ? "" : "/"}${mediaUrl}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Custom Header */}
      <View
        style={[
          styles.customHeader,
          {
            paddingTop: insets.top,
            backgroundColor: showHeaderProfile
              ? colors.headerBackground
              : "transparent",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backBtn,
              {
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.12)"
                  : "rgba(0, 0, 0, 0.08)",
                backgroundColor: isDark
                  ? "rgba(30, 30, 30, 0.98)"
                  : "rgba(255, 255, 255, 0.98)",
              },
            ]}
          >
            <Ionicons
              name="chevron-back-outline"
              size={24}
              color={colors.headerText}
            />
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
            />
          )}

          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            style={[
              styles.headerMenuBtn,
              {
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.12)"
                  : "rgba(0, 0, 0, 0.08)",
                backgroundColor: isDark
                  ? "rgba(30, 30, 30, 0.98)"
                  : "rgba(255, 255, 255, 0.98)",
              },
            ]}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={24}
              color={colors.headerText}
            />
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

            // Header animation
            if (y > 100) {
              if (!showHeaderProfile) setShowHeaderProfile(true);
            } else {
              if (showHeaderProfile) setShowHeaderProfile(false);
            }
          }}
          scrollEventThrottle={16}
        >
          {/* Profile Header Block */}
          <View style={[styles.profileHeader, { paddingTop: insets.top + 8 }]}>
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
              style={styles.actionButton}
              onPress={handleVoiceCall}
            >
              <View
                style={[
                  styles.actionIconContainer,
                  { backgroundColor: isDark ? "#1C1C1E" : "#F2F2F7" },
                ]}
              >
                <Ionicons name="call-outline" size={24} color={colors.text} />
              </View>
              <Text style={[styles.actionButtonText, { color: colors.text }]}>
                Ligar
              </Text>
            </TouchableOpacity>

            {activeStoreId ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  router.push({
                    pathname: "/delivery/[storeId]",
                    params: { storeId: activeStoreId },
                  })
                }
              >
                <View
                  style={[
                    styles.actionIconContainer,
                    { backgroundColor: isDark ? "#1C1C1E" : "#F2F2F7" },
                  ]}
                >
                  <Ionicons
                    name="storefront-outline"
                    size={24}
                    color={colors.tint}
                  />
                </View>
                <Text style={[styles.actionButtonText, { color: colors.text }]}>
                  Loja
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleVideoCall}
              >
                <View
                  style={[
                    styles.actionIconContainer,
                    { backgroundColor: isDark ? "#1C1C1E" : "#F2F2F7" },
                  ]}
                >
                  <Ionicons
                    name="videocam-outline"
                    size={24}
                    color={colors.text}
                  />
                </View>
                <Text style={[styles.actionButtonText, { color: colors.text }]}>
                  Vídeo
                </Text>
              </TouchableOpacity>
            )}

            {pixKey && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  Clipboard.setString(pixKey.pix_value);
                  Alert.alert("Copiado", "Chave Pix copiada com sucesso!");
                }}
              >
                <View
                  style={[
                    styles.actionIconContainer,
                    { backgroundColor: isDark ? "#1C1C1E" : "#F2F2F7" },
                  ]}
                >
                  <Svg
                    width={20}
                    height={20}
                    viewBox="0 0 24 24"
                    fill={colors.text}
                  >
                    <Path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156" />
                  </Svg>
                </View>
                <Text style={[styles.actionButtonText, { color: colors.text }]}>
                  Pix
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Tabs Selector */}
          <View style={styles.tabBarContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsScroll}
            >
              <TouchableOpacity
                style={[
                  styles.tabItem,
                  activeTab === "info" && styles.activeTabItem,
                  activeTab === "info" && {
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255, 255, 255, 0.12)"
                      : "rgba(0, 0, 0, 0.08)",
                  },
                ]}
                onPress={() => setActiveTab("info")}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={
                    activeTab === "info" ? colors.tint : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color:
                        activeTab === "info"
                          ? colors.tint
                          : colors.textSecondary,
                    },
                    activeTab === "info" && styles.activeTabLabel,
                  ]}
                >
                  Info
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabItem,
                  activeTab === "media" && styles.activeTabItem,
                  activeTab === "media" && {
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255, 255, 255, 0.12)"
                      : "rgba(0, 0, 0, 0.08)",
                  },
                ]}
                onPress={() => setActiveTab("media")}
              >
                <Ionicons
                  name="images-outline"
                  size={20}
                  color={
                    activeTab === "media" ? colors.tint : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color:
                        activeTab === "media"
                          ? colors.tint
                          : colors.textSecondary,
                    },
                    activeTab === "media" && styles.activeTabLabel,
                  ]}
                >
                  Mídias
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabItem,
                  activeTab === "links" && styles.activeTabItem,
                  activeTab === "links" && {
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255, 255, 255, 0.12)"
                      : "rgba(0, 0, 0, 0.08)",
                  },
                ]}
                onPress={() => setActiveTab("links")}
              >
                <Ionicons
                  name="link-outline"
                  size={20}
                  color={
                    activeTab === "links" ? colors.tint : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color:
                        activeTab === "links"
                          ? colors.tint
                          : colors.textSecondary,
                    },
                    activeTab === "links" && styles.activeTabLabel,
                  ]}
                >
                  Links
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabItem,
                  activeTab === "docs" && styles.activeTabItem,
                  activeTab === "docs" && {
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255, 255, 255, 0.12)"
                      : "rgba(0, 0, 0, 0.08)",
                  },
                ]}
                onPress={() => setActiveTab("docs")}
              >
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={
                    activeTab === "docs" ? colors.tint : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color:
                        activeTab === "docs"
                          ? colors.tint
                          : colors.textSecondary,
                    },
                    activeTab === "docs" && styles.activeTabLabel,
                  ]}
                >
                  Docs
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabItem,
                  activeTab === "location" && styles.activeTabItem,
                  activeTab === "location" && {
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255, 255, 255, 0.12)"
                      : "rgba(0, 0, 0, 0.08)",
                  },
                ]}
                onPress={() => setActiveTab("location")}
              >
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={
                    activeTab === "location"
                      ? colors.tint
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color:
                        activeTab === "location"
                          ? colors.tint
                          : colors.textSecondary,
                    },
                    activeTab === "location" && styles.activeTabLabel,
                  ]}
                >
                  Locais
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {activeTab === "info" && (
            <>
              {/* Informações Section */}
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
                    style={[
                      styles.infoLabelText,
                      { color: colors.textSecondary },
                    ]}
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
                      <Text
                        style={[styles.infoValueText, { color: colors.text }]}
                      >
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
                style={[
                  styles.sectionDivider,
                  { backgroundColor: colors.border },
                ]}
              />

              {/* Options Section */}
              <View style={styles.optionsSection}>
                {/* Perfil de Atualizações / Canal */}
                {publisherId && (
                  <TouchableOpacity
                    style={styles.optionRowClickable}
                    onPress={() =>
                      router.push({
                        pathname: "/publisher-profile",
                        params: { publisherId },
                      })
                    }
                  >
                    <View style={styles.optionLeft}>
                      <Ionicons
                        name="person-circle-outline"
                        size={24}
                        color={colors.textSecondary}
                      />
                      <View style={styles.optionTextContainer}>
                        <Text
                          style={[styles.optionTitle, { color: colors.text }]}
                        >
                          Perfil de Atualizações
                        </Text>
                        <Text
                          style={[
                            styles.optionSub,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {isFollowing ? "Seguindo · " : ""}Ver publicações e
                          clips
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name="chevron-forward-outline"
                      size={24}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                )}

                {/* Notificações */}
                <View style={styles.optionRow}>
                  <View style={styles.optionLeft}>
                    {isMuted ? (
                      <Ionicons
                        name="notifications-off-outline"
                        size={24}
                        color={colors.textSecondary}
                      />
                    ) : (
                      <Ionicons
                        name="notifications-outline"
                        size={24}
                        color={colors.textSecondary}
                      />
                    )}
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[styles.optionTitle, { color: colors.text }]}
                      >
                        Notificações
                      </Text>
                      <Text
                        style={[
                          styles.optionSub,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {getMuteStatusLabel()}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={!isMuted}
                    onValueChange={handleToggleMuteSwitch}
                    trackColor={{
                      false: isDark ? "#2C2C2E" : "#E5E5EA",
                      true: isDark ? "#48484A" : "#C7C7CC",
                    }}
                    thumbColor={
                      Platform.OS === "android"
                        ? !isMuted
                          ? isDark
                            ? "#D1D1D6"
                            : "#FFFFFF"
                          : "#F4F3F4"
                        : undefined
                    }
                  />
                </View>

                {/* Favorito */}
                <TouchableOpacity
                  style={styles.optionRowClickable}
                  onPress={handleToggleFavorite}
                >
                  <View style={styles.optionLeft}>
                    {isFavorite ? (
                      <Ionicons
                        name="heart-dislike-outline"
                        size={24}
                        color={colors.textSecondary}
                      />
                    ) : (
                      <Ionicons
                        name="heart-outline"
                        size={24}
                        color={colors.textSecondary}
                      />
                    )}
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[styles.optionTitle, { color: colors.text }]}
                      >
                        {isFavorite
                          ? "Remover dos favoritos"
                          : "Adicionar aos favoritos"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Adicionar à lista */}
                <TouchableOpacity
                  style={styles.optionRowClickable}
                  onPress={handleOpenListSelector}
                >
                  <View style={styles.optionLeft}>
                    <Ionicons
                      name="list-circle-outline"
                      size={24}
                      color={colors.textSecondary}
                    />
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[styles.optionTitle, { color: colors.text }]}
                      >
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
                  <Ionicons
                    name="chevron-forward-outline"
                    size={24}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                {/* Mídias compartilhadas */}
                <TouchableOpacity
                  style={styles.optionRowClickable}
                  onPress={() => setActiveTab("media")}
                >
                  <View style={styles.optionLeft}>
                    <Ionicons
                      name="image-outline"
                      size={24}
                      color={colors.textSecondary}
                    />
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[styles.optionTitle, { color: colors.text }]}
                      >
                        Mídias compartilhadas
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name="chevron-forward-outline"
                    size={24}
                    color={colors.textSecondary}
                  />
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
                    <Ionicons
                      name="search-outline"
                      size={24}
                      color={colors.textSecondary}
                    />
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[styles.optionTitle, { color: colors.text }]}
                      >
                        Buscar nesta conversa
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name="chevron-forward-outline"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.sectionDivider,
                  { backgroundColor: colors.border },
                ]}
              />

              {/* Danger Zone Options */}
              <View style={styles.optionsSection}>
                <TouchableOpacity
                  style={styles.optionRowClickable}
                  onPress={handleClearChat}
                >
                  <View style={styles.optionLeft}>
                    <Ionicons
                      name="trash-outline"
                      size={24}
                      color={colors.danger}
                    />
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[styles.optionTitle, { color: colors.danger }]}
                      >
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
                        <Ionicons
                          name="ban-outline"
                          size={24}
                          color={colors.textSecondary}
                        />
                        <View style={styles.optionTextContainer}>
                          <Text
                            style={[
                              styles.optionTitle,
                              { color: colors.textSecondary },
                            ]}
                          >
                            Desbloquear contato
                          </Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Ionicons
                          name="ban-outline"
                          size={24}
                          color={colors.danger}
                        />
                        <View style={styles.optionTextContainer}>
                          <Text
                            style={[
                              styles.optionTitle,
                              { color: colors.danger },
                            ]}
                          >
                            Bloquear contato
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}

          {activeTab === "media" && (
            <View style={styles.tabContentContainer}>
              {mediaMessages.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons
                    name="images-outline"
                    size={48}
                    color={colors.textSecondary}
                    style={{ marginBottom: 8 }}
                  />
                  <Text
                    style={[
                      styles.emptyStateText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Nenhuma mídia compartilhada
                  </Text>
                </View>
              ) : (
                <View style={styles.mediaGrid}>
                  {mediaMessages.map((item, index) => {
                    const url = getMediaUrl(item);
                    if (!url) return null;
                    const isVideo =
                      item.attachments && item.attachments[0]?.type === "video";
                    return (
                      <TouchableOpacity
                        key={item.id || index}
                        style={styles.mediaGridItem}
                        onPress={() => setSelectedFullScreenImage(url)}
                      >
                        <Image
                          source={{ uri: url }}
                          style={styles.mediaImage}
                        />
                        {isVideo && (
                          <View style={styles.playIconContainer}>
                            <Ionicons name="play" size={20} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {activeTab === "links" && (
            <View style={styles.tabContentContainer}>
              {linkMessages.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons
                    name="link-outline"
                    size={48}
                    color={colors.textSecondary}
                    style={{ marginBottom: 8 }}
                  />
                  <Text
                    style={[
                      styles.emptyStateText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Nenhum link compartilhado
                  </Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {linkMessages.map((item, index) => {
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const urls = item.content.match(urlRegex) || [];
                    const mainUrl = urls[0] || item.content;
                    return (
                      <TouchableOpacity
                        key={item.id || index}
                        style={[
                          styles.listItem,
                          { borderBottomColor: colors.border },
                        ]}
                        onPress={() => Linking.openURL(mainUrl)}
                      >
                        <View
                          style={[
                            styles.listIconBg,
                            { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" },
                          ]}
                        >
                          <Ionicons
                            name="link-outline"
                            size={20}
                            color={colors.tint}
                          />
                        </View>
                        <View style={styles.listItemTextContainer}>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.listItemTitle,
                              { color: colors.text },
                            ]}
                          >
                            {mainUrl}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.listItemSub,
                              { color: colors.textSecondary },
                            ]}
                          >
                            por @{item.sender_username} em{" "}
                            {new Date(item.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {activeTab === "docs" && (
            <View style={styles.tabContentContainer}>
              {docMessages.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons
                    name="document-text-outline"
                    size={48}
                    color={colors.textSecondary}
                    style={{ marginBottom: 8 }}
                  />
                  <Text
                    style={[
                      styles.emptyStateText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Nenhum documento compartilhado
                  </Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {docMessages.map((item, index) => {
                    const att = item.attachments[0];
                    const url = att.local_path || att.remote_url;
                    const fullUrl = url.startsWith("http")
                      ? url
                      : `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
                    return (
                      <TouchableOpacity
                        key={item.id || index}
                        style={[
                          styles.listItem,
                          { borderBottomColor: colors.border },
                        ]}
                        onPress={() => Linking.openURL(fullUrl)}
                      >
                        <View
                          style={[
                            styles.listIconBg,
                            { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" },
                          ]}
                        >
                          <Ionicons
                            name="document-text-outline"
                            size={20}
                            color={colors.tint}
                          />
                        </View>
                        <View style={styles.listItemTextContainer}>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.listItemTitle,
                              { color: colors.text },
                            ]}
                          >
                            {att.local_path?.split("/").pop() || "Documento"}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.listItemSub,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {att.size
                              ? `${(att.size / 1024 / 1024).toFixed(2)} MB · `
                              : ""}
                            por @{item.sender_username}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {activeTab === "location" && (
            <View style={styles.tabContentContainer}>
              {locationMessages.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons
                    name="location-outline"
                    size={48}
                    color={colors.textSecondary}
                    style={{ marginBottom: 8 }}
                  />
                  <Text
                    style={[
                      styles.emptyStateText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Nenhuma localização compartilhada
                  </Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {locationMessages.map((item, index) => {
                    let locData: any = {};
                    try {
                      locData = JSON.parse(item.content);
                    } catch {}
                    const mapsUrl =
                      Platform.select({
                        ios: `maps://app?saddr=&daddr=${locData.latitude},${locData.longitude}`,
                        android: `google.navigation:q=${locData.latitude},${locData.longitude}`,
                      }) ||
                      `https://www.google.com/maps/search/?api=1&query=${locData.latitude},${locData.longitude}`;

                    return (
                      <TouchableOpacity
                        key={item.id || index}
                        style={[
                          styles.listItem,
                          { borderBottomColor: colors.border },
                        ]}
                        onPress={() => Linking.openURL(mapsUrl)}
                      >
                        <View
                          style={[
                            styles.listIconBg,
                            { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" },
                          ]}
                        >
                          <Ionicons
                            name="location-outline"
                            size={20}
                            color={colors.tint}
                          />
                        </View>
                        <View style={styles.listItemTextContainer}>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.listItemTitle,
                              { color: colors.text },
                            ]}
                          >
                            {locData.name || locData.address || "Localização"}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.listItemSub,
                              { color: colors.textSecondary },
                            ]}
                          >
                            Lat: {locData.latitude?.toFixed(4)}, Lng:{" "}
                            {locData.longitude?.toFixed(4)} · por @
                            {item.sender_username}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}
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
                backgroundColor: isDark
                  ? "rgba(30, 30, 30, 0.85)"
                  : "rgba(255, 255, 255, 0.85)",
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.12)"
                  : "rgba(0, 0, 0, 0.08)",
                top: insets.top + 10,
              },
            ]}
          >
            {contact && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
                onPress={() => {
                  setMenuVisible(false);
                  setRenameModalVisible(true);
                }}
              >
                <Text style={[styles.menuItemText, { color: colors.text }]}>
                  Editar
                </Text>
              </TouchableOpacity>
            )}

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
                <Ionicons name="arrow-back-outline" size={24} color="#fff" />
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

      {/* Full Screen Media Modal */}
      {selectedFullScreenImage && (
        <Modal
          visible={!!selectedFullScreenImage}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedFullScreenImage(null)}
        >
          <View style={styles.fullScreenBg}>
            <View style={[styles.fullScreenHeader, { paddingTop: insets.top }]}>
              <TouchableOpacity
                onPress={() => setSelectedFullScreenImage(null)}
                style={styles.fullScreenBackBtn}
              >
                <Ionicons name="arrow-back-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.fullScreenImageContainer}>
              <Image
                source={{ uri: selectedFullScreenImage }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Mute Chat Dialog Modal */}
      <MuteModal
        visible={muteModalVisible}
        onClose={() => setMuteModalVisible(false)}
        onMute={handleMuteChats}
      />

      {/* List Selector Modal */}
      <ListSelectorModal
        visible={listSelectorVisible}
        onClose={() => setListSelectorVisible(false)}
        userLists={allLists}
        initialSelectedListIds={selectedListIds}
        onSave={handleSaveLists}
        onCreateNewList={() => {
          setListSelectorVisible(false);
          setCreateListModalVisible(true);
        }}
      />

      {/* Create List Modal */}
      <CreateListModal
        visible={createListModalVisible}
        onClose={() => {
          setCreateListModalVisible(false);
          setListSelectorVisible(true);
        }}
        onSubmit={handleCreateList}
      />

      <RenameContactModal
        visible={renameModalVisible}
        initialName={contact?.custom_name || ""}
        onClose={() => setRenameModalVisible(false)}
        onSubmit={handleSaveName}
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
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "500",
  },
  headerProfileName: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 6,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
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
    fontWeight: "500",
    textAlign: "center",
  },
  usernameText: {
    fontSize: 16,
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
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 14,
    gap: 28,
  },
  actionButton: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 64,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "500",
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
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  menuContainer: {
    position: "absolute",
    right: 6,
    borderRadius: 16,
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
  mainTabBar: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 10,
    padding: 4,
  },
  mainTabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  mainTabText: {
    fontSize: 15,
    fontWeight: "600",
  },

  subTabBar: {
    flexDirection: "row",
    width: "100%",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    marginBottom: 8,
  },
  subTabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  activeSubTabItem: {
    borderBottomWidth: 2,
    borderBottomColor: "#07C160",
  },
  subTabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabBarContainer: {
    marginVertical: 12,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 8,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  activeTabItem: {
    backgroundColor: "rgba(7, 193, 96, 0.1)",
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  activeTabLabel: {
    fontWeight: "600",
  },
  tabContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 15,
    textAlign: "center",
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mediaGridItem: {
    width: (Dimensions.get("window").width - 48) / 3,
    height: (Dimensions.get("window").width - 48) / 3,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  playIconContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -15 }, { translateY: -15 }],
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  listContainer: {
    gap: 12,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  listIconBg: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  listItemTextContainer: {
    flex: 1,
    gap: 2,
  },
  listItemTitle: {
    fontSize: 15,
    fontWeight: "500",
  },
  listItemSub: {
    fontSize: 12,
  },
});
