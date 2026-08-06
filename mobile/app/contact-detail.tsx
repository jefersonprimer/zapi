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

import FeedPost from "@/components/FeedPost";

const GAP = 2;






export default function ContactDetailScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const { participantId, participantUsername, chatId, avatarUrl, storeId: paramStoreId } =
    useLocalSearchParams<{
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

  // Publisher and updates state
  const [posts, setPosts] = useState<updatesApi.FeedPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<updatesApi.FeedPost | null>(
    null,
  );
  const [postsLoading, setPostsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const activeTab: "contato" | "atualizacoes" = "contato";

  const loadPublisherPosts = useCallback(
    async (id: string, pageNum: number, replace: boolean) => {
      if (!token || !id) return;
      if (pageNum === 1) {
        setPostsLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const PAGE_SIZE = 12;
        const data = await updatesApi.getPublisherPosts(
          token,
          id,
          pageNum,
          PAGE_SIZE,
        );
        setPosts((prev) => (replace ? data : [...prev, ...data]));
        setHasMore(data.length === PAGE_SIZE);
        setPage(pageNum);
      } catch (err) {
        console.error("Failed to load publisher posts:", err);
      } finally {
        setPostsLoading(false);
        setLoadingMore(false);
      }
    },
    [token],
  );

  const handleLoadMorePosts = useCallback(() => {
    if (loadingMore || !hasMore || postsLoading || !publisherId) return;
    loadPublisherPosts(publisherId, page + 1, false);
  }, [
    loadingMore,
    hasMore,
    postsLoading,
    page,
    publisherId,
    loadPublisherPosts,
  ]);

  const handlePostLike = async (postId: string) => {
    if (!token) return;
    const prev = posts.find((p) => p.id === postId);
    if (!prev) return;
    const nextLiked = !prev.liked_by_me;
    setPosts((list) =>
      list.map((p) =>
        p.id === postId
          ? {
              ...p,
              liked_by_me: nextLiked,
              likes_count: p.likes_count + (nextLiked ? 1 : -1),
            }
          : p,
      ),
    );
    if (selectedPost?.id === postId) {
      setSelectedPost((p) =>
        p
          ? {
              ...p,
              liked_by_me: nextLiked,
              likes_count: p.likes_count + (nextLiked ? 1 : -1),
            }
          : p,
      );
    }
    try {
      await updatesApi.toggleLike(token, postId);
    } catch {
      setPosts((list) => list.map((p) => (p.id === postId ? prev : p)));
      if (selectedPost?.id === postId) setSelectedPost(prev);
    }
  };

  const handlePostSave = async (postId: string) => {
    if (!token) return;
    const prev = posts.find((p) => p.id === postId);
    if (!prev) return;
    const nextSaved = !prev.saved_by_me;
    setPosts((list) =>
      list.map((p) => (p.id === postId ? { ...p, saved_by_me: nextSaved } : p)),
    );
    if (selectedPost?.id === postId) {
      setSelectedPost((p) => (p ? { ...p, saved_by_me: nextSaved } : p));
    }
    try {
      await updatesApi.toggleSave(token, postId);
    } catch {
      setPosts((list) => list.map((p) => (p.id === postId ? prev : p)));
      if (selectedPost?.id === postId) setSelectedPost(prev);
    }
  };

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
        loadPublisherPosts(publisherData.id, 1, true);
      } catch (err) {
        console.error("Error fetching publisher follow state:", err);
      }
    } catch (err: any) {
      console.error("Error fetching contact details:", err);
    } finally {
      setLoading(false);
    }
  }, [token, participantId, loadPublisherPosts]);

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
            >
              Detalhes do Contato
            </Text>
          )}

          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            style={styles.headerMenuBtn}
          >
            <MaterialCommunityIcons
              name="dots-vertical"
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
            const { layoutMeasurement, contentOffset, contentSize } =
              event.nativeEvent;
            const y = contentOffset.y;

            // Header animation
            if (y > 100) {
              if (!showHeaderProfile) setShowHeaderProfile(true);
            } else {
              if (showHeaderProfile) setShowHeaderProfile(false);
            }

            // Infinite scroll check for updates tab
            if ((activeTab as string) === "atualizacoes") {
              const isCloseToBottom =
                layoutMeasurement.height + y >= contentSize.height - 100;
              if (isCloseToBottom) {
                handleLoadMorePosts();
              }
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
                <Ionicons
                  name="call-outline"
                  size={22}
                  color={colors.text}
                />
              </View>
              <Text
                style={[styles.actionButtonText, { color: colors.text }]}
              >
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
                  <MaterialCommunityIcons
                    name="shopping-outline"
                    size={22}
                    color={colors.tint}
                  />
                </View>
                <Text
                  style={[styles.actionButtonText, { color: colors.text }]}
                >
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
                    size={22}
                    color={colors.text}
                  />
                </View>
                <Text
                  style={[styles.actionButtonText, { color: colors.text }]}
                >
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
                <Text
                  style={[styles.actionButtonText, { color: colors.text }]}
                >
                  Pix
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View
            style={[
              styles.sectionDivider,
              { backgroundColor: colors.border },
            ]}
          />

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
                  <MaterialCommunityIcons
                    name="account-box-outline"
                    size={20}
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
                      {isFollowing ? "Seguindo · " : ""}Ver publicações e clips
                    </Text>
                  </View>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}

            {/* Notificações */}
            <View style={styles.optionRow}>
              <View style={styles.optionLeft}>
                {isMuted ? (
                  <MaterialCommunityIcons
                    name="bell-off"
                    size={20}
                    color={colors.textSecondary}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="bell"
                    size={20}
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
                  <MaterialCommunityIcons
                    name="heart-off"
                    size={20}
                    color={colors.textSecondary}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="heart"
                    size={20}
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
                <MaterialCommunityIcons
                  name="playlist-plus"
                  size={20}
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
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
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
                <MaterialCommunityIcons
                  name="image"
                  size={20}
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
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
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
                <MaterialCommunityIcons
                  name="magnify"
                  size={20}
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
              <MaterialCommunityIcons
                name="chevron-right"
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
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={20}
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
                    <MaterialCommunityIcons
                      name="shield-check"
                      size={20}
                      color={colors.tint}
                    />
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
                    <MaterialCommunityIcons
                      name="block-helper"
                      size={20}
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
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={24}
                  color="#fff"
                />
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

      {/* Selected Post Detail Modal */}
      <Modal
        visible={!!selectedPost}
        animationType="slide"
        onRequestClose={() => setSelectedPost(null)}
      >
        <View
          style={[
            styles.postModalContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[
              styles.postModalHeader,
              {
                paddingTop: insets.top + 8,
                backgroundColor: colors.headerBackground,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity onPress={() => setSelectedPost(null)}>
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <Text style={[styles.postModalTitle, { color: colors.text }]}>
              Publicação
            </Text>
            <View style={{ width: 24 }} />
          </View>
          {selectedPost && (
            <FeedPost
              post={selectedPost}
              onHeaderPress={() => {}}
              onMenuPress={() => {}}
              onLike={() => handlePostLike(selectedPost.id)}
              onComment={() =>
                router.push({
                  pathname: "/comments-modal",
                  params: { postId: selectedPost.id },
                })
              }
              onShare={() => {}}
              onSave={() => handlePostSave(selectedPost.id)}
              onVote={() => {}}
            />
          )}
        </View>
      </Modal>
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
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 12,
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
  updatesContainer: {
    flex: 1,
  },
  publisherStatsSection: {
    alignItems: "center",
    paddingVertical: 8,
  },
  followersCountText: {
    fontSize: 14,
    fontWeight: "500",
  },
  loaderContainer: {
    paddingVertical: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    paddingHorizontal: GAP,
    marginTop: 8,
  },
  gridItem: {
    overflow: "hidden",
    backgroundColor: "#000",
    borderRadius: 8,
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  videoBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    padding: 4,
  },
  multiBadge: {
    position: "absolute",
    top: 8,
    right: 32,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  multiBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  textPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
    gap: 6,
  },
  textPlaceholderLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  emptyPosts: {
    textAlign: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  footerLoader: {
    paddingVertical: 20,
  },
  postModalContainer: {
    flex: 1,
  },
  postModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  postModalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
});
