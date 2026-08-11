import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
  Modal,
  Switch,
  Platform,
  Linking,
  Dimensions,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import ImagePickerModal from "@/components/ImagePickerModal";
import { AddGroupMemberModal } from "@/components/AddGroupMemberModal";
import MuteModal from "@/components/MuteModal";
import {
  getGroupDetails,
  addParticipant,
  removeParticipant,
  searchUsers,
  type UserSearchResult,
  type GroupDetails,
  API_URL,
  updateGroupDetails,
  uploadImage,
  createChat,
} from "@/services/api";
import { toggleMuteChat } from "@/services/chatActions";
import {
  updateLocalGroupDetails,
  getChatsFromLocal,
} from "@/services/database";
import { Ionicons } from "@expo/vector-icons";
import { voiceCallManager } from "@/services/voiceCallManager";
import { chatRepository } from "@/services/ChatRepository";

export default function GroupDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const { colors, isDark } = useAppTheme();

  const handleGroupVoiceCall = () => {
    Alert.alert(
      "Chamada de Voz em Grupo",
      "Deseja iniciar uma chamada de voz com todos os participantes deste grupo?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Iniciar",
          onPress: () => {
            Alert.alert(
              "Chamada Iniciada",
              "Conectando chamada de voz em grupo...",
            );
          },
        },
      ],
    );
  };

  const handleGroupVideoCall = () => {
    Alert.alert(
      "Chamada de Vídeo em Grupo",
      "Deseja iniciar uma chamada de vídeo com todos os participantes deste grupo?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Iniciar",
          onPress: () => {
            Alert.alert(
              "Chamada Iniciada",
              "Conectando chamada de vídeo em grupo...",
            );
          },
        },
      ],
    );
  };

  const { chatId, participantUsername } = useLocalSearchParams<{
    chatId: string;
    participantUsername: string;
  }>();

  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
  const [loadingGroupDetails, setLoadingGroupDetails] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState("");
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [searchedUsers, setSearchedUsers] = useState<UserSearchResult[]>([]);
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [actionLoadingUserId, setActionLoadingUserId] = useState<string | null>(
    null,
  );

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [groupAvatarModalVisible, setGroupAvatarModalVisible] = useState(false);
  const [startingChatWithId, setStartingChatWithId] = useState<string | null>(
    null,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [showHeaderProfile, setShowHeaderProfile] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "info" | "media" | "links" | "docs" | "location"
  >("info");

  const [messages, setMessages] = useState<any[]>([]);
  const [selectedFullScreenImage, setSelectedFullScreenImage] = useState<
    string | null
  >(null);

  const [muteModalVisible, setMuteModalVisible] = useState(false);
  const [chatSettings, setChatSettings] = useState<{
    notification_muted_until?: string | null;
    notification_muted_forever?: boolean;
  }>({});

  useEffect(() => {
    if (!chatId || !token) return;
    const fetchMessages = async () => {
      try {
        const msgs = await chatRepository.getMessages(chatId, token);
        setMessages(msgs || []);
      } catch (err) {
        console.error("Error fetching messages for group media tab:", err);
      }
    };
    fetchMessages();
  }, [chatId, token]);

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
      return payload.latitude !== undefined && payload.longitude !== undefined;
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

  useEffect(() => {
    const loadLocalChatSettings = async () => {
      try {
        if (!chatId) return;
        const chats = await getChatsFromLocal();
        const foundChat = chats.find((c) => c.id === chatId);
        if (foundChat) {
          setChatSettings({
            notification_muted_until: foundChat.notification_muted_until,
            notification_muted_forever: foundChat.notification_muted_forever,
          });
        }
      } catch (err) {
        console.error(
          "Error loading chat settings from SQLite in group-detail:",
          err,
        );
      }
    };
    loadLocalChatSettings();
  }, [chatId]);

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
          return "Silenciado por 8 hours";
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

  const handleToggleMuteSwitch = () => {
    if (isMuted) {
      handleMuteChats("unmute");
    } else {
      setMuteModalVisible(true);
    }
  };

  const handleMuteChats = async (
    durationHours: number | "always" | "unmute",
  ) => {
    if (!token || !chatId) return;
    try {
      const result = await toggleMuteChat(token, chatId, durationHours);
      if (result) {
        setChatSettings({
          notification_muted_until: result.mutedUntil,
          notification_muted_forever: result.mutedForever,
        });
      }
      setMuteModalVisible(false);
    } catch (err: any) {
      console.error("Error updating mute settings in group-detail:", err);
      Alert.alert("Erro", err.message || "Não foi possível silenciar o chat.");
    }
  };

  const avatarUri = groupDetails?.avatar_url
    ? groupDetails.avatar_url.startsWith("http")
      ? groupDetails.avatar_url
      : `${API_URL}${groupDetails.avatar_url}`
    : null;

  const fetchGroupInfo = useCallback(async () => {
    if (!token || !chatId) return;
    setLoadingGroupDetails(true);
    try {
      const details = await getGroupDetails(token, chatId);
      setGroupDetails(details);
      setEditName(details.name || "");
      setEditDescription(details.description || "");
    } catch (err) {
      console.error("Failed to fetch group details:", err);
    } finally {
      setLoadingGroupDetails(false);
    }
  }, [token, chatId]);

  const uploadAndUpdateGroupAvatar = async (uri: string) => {
    if (!token || !chatId) return;
    setIsUpdatingAvatar(true);
    try {
      const uploadRes = await uploadImage(token, uri);
      const updated = await updateGroupDetails(token, chatId, {
        avatar_url: uploadRes.url,
      });
      await updateLocalGroupDetails(
        chatId,
        updated.name,
        updated.avatar_url,
        updated.description,
      );
      fetchGroupInfo();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao atualizar foto do Grupo.");
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!token || !chatId) return;
    setIsUpdatingAvatar(true);
    try {
      const updated = await updateGroupDetails(token, chatId, {
        avatar_url: "",
      });
      await updateLocalGroupDetails(
        chatId,
        updated.name,
        updated.avatar_url,
        updated.description,
      );
      fetchGroupInfo();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao remover foto do Grupo.");
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!token || !chatId) return;
    setIsSaving(true);
    try {
      const updated = await updateGroupDetails(token, chatId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      await updateLocalGroupDetails(
        chatId,
        updated.name,
        updated.avatar_url,
        updated.description,
      );
      Alert.alert("Sucesso", "Informações do grupo atualizadas!");
      fetchGroupInfo();
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.message || "Não foi possível atualizar as informações.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchGroupInfo();
    setSearchMemberQuery("");
    setSearchedUsers([]);
  }, [chatId, fetchGroupInfo]);

  const handleSearchMembers = async () => {
    if (!searchMemberQuery.trim() || !token) return;
    setSearchingMembers(true);
    try {
      const data = await searchUsers(token, searchMemberQuery.trim());
      setSearchedUsers(data.users);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Erro ao buscar usuários.");
    } finally {
      setSearchingMembers(false);
    }
  };

  const handleAddParticipant = async (userId: string) => {
    if (!token || !chatId) return;
    setActionLoadingUserId(userId);
    try {
      await addParticipant(token, chatId, userId);
      await fetchGroupInfo();
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.message || "Não foi possível adicionar o membro.",
      );
    } finally {
      setActionLoadingUserId(null);
    }
  };

  const handleRemoveParticipant = async (userId: string, username: string) => {
    Alert.alert(
      "Remover Membro",
      `Tem certeza que deseja remover ${username} do grupo?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            if (!token || !chatId) return;
            try {
              await removeParticipant(token, chatId, userId);
              fetchGroupInfo();
            } catch (err: any) {
              Alert.alert(
                "Erro",
                err.message || "Não foi possível remover o membro.",
              );
            }
          },
        },
      ],
    );
  };

  const handleLeaveGroup = async () => {
    Alert.alert("Sair do Grupo", "Tem certeza que deseja sair deste grupo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          if (!token || !chatId || !user) return;
          try {
            await removeParticipant(token, chatId, user.user_id);
            router.replace("/(tabs)");
          } catch (err: any) {
            Alert.alert(
              "Erro",
              err.message || "Não foi possível sair do grupo.",
            );
          }
        },
      },
    ]);
  };

  const handleStartChat = async (member: {
    id: string;
    username: string;
    avatar_url?: string | null;
    name?: string | null;
  }) => {
    if (!token) return;
    setStartingChatWithId(member.id);
    try {
      const data = await createChat(token, member.id);
      router.push({
        pathname: "/chat",
        params: {
          chatId: data.id,
          participantId: member.id,
          participantUsername: member.username,
          participantAvatarUrl: member.avatar_url ?? "",
        },
      });
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.message || "Não foi possível iniciar a conversa.",
      );
    } finally {
      setStartingChatWithId(null);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      {/* Custom Header (Absolute Overlay, matches contact-detail.tsx style) */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingBottom: 12,
          paddingTop: insets.top + 8,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          backgroundColor: showHeaderProfile
            ? colors.headerBackground
            : "transparent",
        }}
      >
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

        {/* Group name and mini avatar on scroll, like in contact-detail */}
        <View style={styles.headerCenter}>
          {showHeaderProfile && (
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
                  <Ionicons
                    name="people"
                    size={20}
                    color={colors.textSecondary}
                  />
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[styles.headerProfileName, { color: colors.headerText }]}
              >
                {groupDetails?.name ?? participantUsername}
              </Text>
            </View>
          )}
        </View>

        {/* Ellipsis Menu Button on the right */}
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
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
            name="ellipsis-horizontal"
            size={24}
            color={colors.headerText}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 8 }}
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset.y;
          if (y > 80) {
            if (!showHeaderProfile) setShowHeaderProfile(true);
          } else {
            if (showHeaderProfile) setShowHeaderProfile(false);
          }
        }}
        scrollEventThrottle={16}
      >
        {/* Group Info Body */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          {/* Main Centered Group Avatar */}
          <TouchableOpacity
            onPress={
              groupDetails?.created_by === user?.user_id
                ? () => setGroupAvatarModalVisible(true)
                : undefined
            }
            disabled={
              groupDetails?.created_by !== user?.user_id || isUpdatingAvatar
            }
            style={{
              width: 110,
              height: 110,
              borderRadius: 55,
              backgroundColor: "#34C759",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 12,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {isUpdatingAvatar ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <Text style={{ color: "#fff", fontSize: 32, fontWeight: "bold" }}>
                {(groupDetails?.name ??
                  participantUsername ??
                  "G")[0]?.toUpperCase()}
              </Text>
            )}
            {groupDetails?.created_by === user?.user_id &&
              !isUpdatingAvatar && (
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    paddingVertical: 2,
                    alignItems: "center",
                  }}
                >
                  <MaterialCommunityIcons
                    name="camera"
                    size={12}
                    color="#fff"
                  />
                </View>
              )}
          </TouchableOpacity>

          {groupDetails?.created_by === user?.user_id && isEditing ? (
            <View style={{ width: "100%", gap: 12, marginTop: 8 }}>
              <View>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginBottom: 4,
                  }}
                >
                  Nome do Grupo
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    color: colors.text,
                    backgroundColor: colors.background,
                    fontSize: 16,
                  }}
                  placeholder="Nome do grupo..."
                  placeholderTextColor={colors.textSecondary}
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginBottom: 4,
                  }}
                >
                  Descrição
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    color: colors.text,
                    backgroundColor: colors.background,
                    fontSize: 16,
                    minHeight: 60,
                    textAlignVertical: "top",
                  }}
                  placeholder="Adicionar descrição do grupo..."
                  placeholderTextColor={colors.textSecondary}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                />
              </View>
              {(editName.trim() !== (groupDetails?.name ?? "") ||
                editDescription.trim() !==
                  (groupDetails?.description ?? "")) && (
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.tint,
                    padding: 12,
                    borderRadius: 8,
                    alignItems: "center",
                    marginTop: 8,
                  }}
                  onPress={handleSaveChanges}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>
                      Salvar Alterações
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={{ width: "100%", alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "bold",
                  color: colors.text,
                  textAlign: "center",
                }}
              >
                {groupDetails?.name ?? participantUsername}
              </Text>
              {groupDetails?.description ? (
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginTop: 8,
                    textAlign: "center",
                    fontStyle: "italic",
                    paddingHorizontal: 16,
                  }}
                >
                  {groupDetails.description}
                </Text>
              ) : (
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginTop: 8,
                    textAlign: "center",
                    fontStyle: "italic",
                    paddingHorizontal: 16,
                  }}
                >
                  Sem descrição.
                </Text>
              )}
            </View>
          )}

          {groupDetails && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleGroupVoiceCall}
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

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleGroupVideoCall}
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
            </View>
          )}

          {groupDetails && (
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                marginTop: 12,
              }}
            >
              {groupDetails.participants.length} membros
            </Text>
          )}
        </View>

        {loadingGroupDetails ? (
          <ActivityIndicator
            size="large"
            color={colors.tint}
            style={{ marginVertical: 20 }}
          />
        ) : (
          <>
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
                      backgroundColor: isDark
                        ? "rgba(30, 30, 30, 0.85)"
                        : "rgba(255, 255, 255, 0.85)",
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
                      backgroundColor: isDark
                        ? "rgba(30, 30, 30, 0.85)"
                        : "rgba(255, 255, 255, 0.85)",
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
                      backgroundColor: isDark
                        ? "rgba(30, 30, 30, 0.85)"
                        : "rgba(255, 255, 255, 0.85)",
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
                      backgroundColor: isDark
                        ? "rgba(30, 30, 30, 0.85)"
                        : "rgba(255, 255, 255, 0.85)",
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
                      backgroundColor: isDark
                        ? "rgba(30, 30, 30, 0.85)"
                        : "rgba(255, 255, 255, 0.85)",
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
                    Localização
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Tab Contents */}
            {activeTab === "info" && (
              <>
                <View style={{ marginBottom: 24 }}>
                  {groupDetails && groupDetails.participants.length <= 9 ? (
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        marginHorizontal: -8,
                      }}
                    >
                      {groupDetails.participants.map((member) => {
                        const isCreator =
                          groupDetails?.created_by === member.id;
                        const isMe = member.id === user?.user_id;
                        const showRemoveButton =
                          groupDetails?.created_by === user?.user_id &&
                          !isCreator &&
                          !isMe;

                        return (
                          <View
                            key={member.id}
                            style={{
                              width: "33.33%",
                              alignItems: "center",
                              paddingVertical: 12,
                              paddingHorizontal: 4,
                            }}
                          >
                            <View
                              style={{
                                width: 100,
                                height: 100,
                                position: "relative",
                              }}
                            >
                              <TouchableOpacity
                                onPress={() => handleStartChat(member)}
                                disabled={isMe || startingChatWithId !== null}
                                style={{
                                  width: 100,
                                  height: 100,
                                  borderRadius: 50,
                                  backgroundColor: colors.tint,
                                  justifyContent: "center",
                                  alignItems: "center",
                                  overflow: "hidden",
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                }}
                              >
                                {startingChatWithId === member.id ? (
                                  <ActivityIndicator
                                    size="small"
                                    color="#fff"
                                  />
                                ) : member.avatar_url ? (
                                  <Image
                                    source={{
                                      uri: member.avatar_url.startsWith("http")
                                        ? member.avatar_url
                                        : `${API_URL}${member.avatar_url}`,
                                    }}
                                    style={{ width: "100%", height: "100%" }}
                                  />
                                ) : (
                                  <Text
                                    style={{
                                      color: "#fff",
                                      fontWeight: "500",
                                      fontSize: 24,
                                    }}
                                  >
                                    {(member.name ||
                                      member.username)[0].toUpperCase()}
                                  </Text>
                                )}
                              </TouchableOpacity>

                              {isCreator && (
                                <View
                                  style={{
                                    position: "absolute",
                                    bottom: 2,
                                    right: 2,
                                    backgroundColor: colors.tint,
                                    borderRadius: 6,
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderWidth: 1.5,
                                    borderColor: colors.background || "#1E293B",
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: "#fff",
                                      fontSize: 8,
                                      fontWeight: "bold",
                                    }}
                                  >
                                    Dono
                                  </Text>
                                </View>
                              )}

                              {showRemoveButton && (
                                <TouchableOpacity
                                  onPress={() =>
                                    handleRemoveParticipant(
                                      member.id,
                                      member.username,
                                    )
                                  }
                                  style={{
                                    position: "absolute",
                                    top: 2,
                                    right: 2,
                                    backgroundColor: colors.danger || "#FF3B30",
                                    width: 22,
                                    height: 22,
                                    borderRadius: 11,
                                    justifyContent: "center",
                                    alignItems: "center",
                                    borderWidth: 1.5,
                                    borderColor: colors.background || "#1E293B",
                                  }}
                                >
                                  <Ionicons
                                    name="close"
                                    size={12}
                                    color="#fff"
                                  />
                                </TouchableOpacity>
                              )}
                            </View>
                            <Text
                              numberOfLines={1}
                              style={{
                                color: colors.text,
                                fontSize: 12,
                                fontWeight: "500",
                                marginTop: 8,
                                textAlign: "center",
                                maxWidth: 100,
                                width: "100%",
                                paddingHorizontal: 2,
                              }}
                            >
                              {isMe
                                ? "Você"
                                : (member.name || member.username).split(
                                    " ",
                                  )[0]}
                            </Text>
                          </View>
                        );
                      })}

                      {groupDetails.created_by === user?.user_id && (
                        <View
                          style={{
                            width: "33.33%",
                            alignItems: "center",
                            paddingVertical: 12,
                            paddingHorizontal: 4,
                          }}
                        >
                          <TouchableOpacity
                            onPress={() => setAddMemberModalVisible(true)}
                            style={{
                              width: 100,
                              height: 100,
                              borderRadius: 50,
                              backgroundColor: isDark ? "#2A3744" : "#E2E8F0",
                              justifyContent: "center",
                              alignItems: "center",
                              borderWidth: 1.5,
                              borderColor: colors.border,
                              borderStyle: "dashed",
                            }}
                          >
                            <Ionicons
                              name="add"
                              size={32}
                              color={colors.textSecondary}
                            />
                          </TouchableOpacity>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: colors.textSecondary,
                              fontSize: 12,
                              fontWeight: "500",
                              marginTop: 8,
                              textAlign: "center",
                              maxWidth: 100,
                              width: "100%",
                            }}
                          >
                            Adicionar
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <>
                      {groupDetails?.created_by === user?.user_id && (
                        <TouchableOpacity
                          onPress={() => setAddMemberModalVisible(true)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 12,
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: colors.border,
                          }}
                        >
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: colors.tint,
                              justifyContent: "center",
                              alignItems: "center",
                              marginRight: 12,
                            }}
                          >
                            <Ionicons
                              name="person-add"
                              size={18}
                              color="#fff"
                            />
                          </View>
                          <Text
                            style={{ color: colors.text, fontWeight: "600" }}
                          >
                            Adicionar participante...
                          </Text>
                        </TouchableOpacity>
                      )}
                      {groupDetails?.participants.map((member) => {
                        const isCreator =
                          groupDetails?.created_by === member.id;
                        const isMe = member.id === user?.user_id;
                        const showRemoveButton =
                          groupDetails?.created_by === user?.user_id &&
                          !isCreator &&
                          !isMe;

                        return (
                          <View
                            key={member.id}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingVertical: 12,
                              borderBottomWidth: StyleSheet.hairlineWidth,
                              borderBottomColor: colors.border,
                              justifyContent: "space-between",
                            }}
                          >
                            <TouchableOpacity
                              onPress={() => handleStartChat(member)}
                              disabled={isMe || startingChatWithId !== null}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                flex: 1,
                                justifyContent: "space-between",
                                marginRight: showRemoveButton ? 12 : 0,
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                }}
                              >
                                <View
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: colors.tint,
                                    justifyContent: "center",
                                    alignItems: "center",
                                    marginRight: 12,
                                    overflow: "hidden",
                                  }}
                                >
                                  {startingChatWithId === member.id ? (
                                    <ActivityIndicator
                                      size="small"
                                      color="#fff"
                                    />
                                  ) : member.avatar_url ? (
                                    <Image
                                      source={{
                                        uri: member.avatar_url.startsWith(
                                          "http",
                                        )
                                          ? member.avatar_url
                                          : `${API_URL}${member.avatar_url}`,
                                      }}
                                      style={{ width: "100%", height: "100%" }}
                                    />
                                  ) : (
                                    <Text
                                      style={{
                                        color: "#fff",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {(member.name ||
                                        member.username)[0].toUpperCase()}
                                    </Text>
                                  )}
                                </View>
                                <View>
                                  <Text
                                    style={{
                                      color: colors.text,
                                      fontWeight: "600",
                                    }}
                                  >
                                    {member.name || member.username}{" "}
                                    {isMe && "(Você)"}
                                  </Text>

                                  {isCreator && (
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        color: colors.tint,
                                        fontWeight: "500",
                                      }}
                                    >
                                      Dono do grupo
                                    </Text>
                                  )}
                                </View>
                              </View>

                              {!isMe && !showRemoveButton && (
                                <MaterialCommunityIcons
                                  name="message-outline"
                                  size={20}
                                  color={colors.tint}
                                  style={{ marginRight: 4 }}
                                />
                              )}
                            </TouchableOpacity>

                            {showRemoveButton && (
                              <TouchableOpacity
                                style={{
                                  backgroundColor: colors.danger || "#FF3B30",
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 6,
                                }}
                                onPress={() =>
                                  handleRemoveParticipant(
                                    member.id,
                                    member.username,
                                  )
                                }
                              >
                                <Text
                                  style={{
                                    color: "#fff",
                                    fontSize: 12,
                                    fontWeight: "600",
                                  }}
                                >
                                  Remover
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                    </>
                  )}
                </View>

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
                      const isSticker =
                        url.toLowerCase().includes("sticker") ||
                        url.toLowerCase().includes(".webp") ||
                        url.toLowerCase().includes(".gif") ||
                        url.toLowerCase().includes("giphy") ||
                        url.toLowerCase().includes("tenor") ||
                        (item.attachments && item.attachments[0]?.type === "sticker") ||
                        (item.attachments && item.attachments[0]?.mime_type === "image/webp") ||
                        (item.attachments && item.attachments[0]?.mime_type === "image/gif") ||
                        item.type === "sticker";
                      return (
                        <TouchableOpacity
                          key={item.id || index}
                          style={styles.mediaGridItem}
                          onPress={() => setSelectedFullScreenImage(url)}
                        >
                          <Image
                            source={{ uri: url }}
                            style={styles.mediaImage}
                            resizeMode={isSticker ? "contain" : "cover"}
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
          </>
        )}
      </ScrollView>

      <ImagePickerModal
        visible={groupAvatarModalVisible}
        onClose={() => setGroupAvatarModalVisible(false)}
        onImageSelected={uploadAndUpdateGroupAvatar}
        onRemoveImage={handleRemoveAvatar}
        hasImage={!!groupDetails?.avatar_url}
        title="Foto do Grupo"
      />

      <AddGroupMemberModal
        visible={addMemberModalVisible}
        onClose={() => setAddMemberModalVisible(false)}
        searchQuery={searchMemberQuery}
        onSearchQueryChange={setSearchMemberQuery}
        onSearch={handleSearchMembers}
        searching={searchingMembers}
        searchResults={searchedUsers}
        groupParticipants={groupDetails?.participants || []}
        onAddMember={handleAddParticipant}
        onRemoveMember={handleRemoveParticipant}
        actionLoadingUserId={actionLoadingUserId}
      />

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
                  ? "rgba(30, 30, 30, 0.95)"
                  : "rgba(255, 255, 255, 0.95)",
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.12)"
                  : "rgba(0, 0, 0, 0.08)",
                top: insets.top + 14,
              },
            ]}
          >
            {groupDetails?.created_by === user?.user_id && (
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
                  setIsEditing(!isEditing);
                }}
              >
                <Text style={[styles.menuItemText, { color: colors.text }]}>
                  {isEditing ? "Cancelar Edição" : "Editar"}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                handleLeaveGroup();
              }}
            >
              <Text
                style={[
                  styles.menuItemText,
                  { color: colors.danger || "#FF3B30" },
                ]}
              >
                Sair do Grupo
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  miniAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  miniAvatarImage: {
    width: "100%",
    height: "100%",
  },
  miniAvatarText: {
    fontSize: 16,
    fontWeight: "bold",
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
    width: 200,
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
  headerProfileContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
    marginLeft: 10,
  },
  headerProfileName: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
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
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
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
    fontSize: 13,
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
});
