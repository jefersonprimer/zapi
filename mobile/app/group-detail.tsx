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
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import ImagePickerModal from "@/components/ImagePickerModal";
import { AddGroupMemberModal } from "@/components/AddGroupMemberModal";
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
import { updateLocalGroupDetails } from "@/services/database";
import { Ionicons } from "@expo/vector-icons";

export default function GroupDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const { colors, isDark } = useAppTheme();

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
  const [actionLoadingUserId, setActionLoadingUserId] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [groupAvatarModalVisible, setGroupAvatarModalVisible] = useState(false);
  const [startingChatWithId, setStartingChatWithId] = useState<string | null>(
    null,
  );

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
      Alert.alert("Erro", err.message || "Falha ao atualizar foto do grupo.");
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
      Alert.alert("Erro", err.message || "Falha ao remover foto do grupo.");
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
        paddingTop: insets.top,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.headerBackground,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: 4, marginRight: 16 }}
        >
          <Ionicons
            name="chevron-back-outline"
            size={24}
            color={colors.headerText}
          />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: colors.headerText,
            flex: 1,
          }}
          numberOfLines={1}
        >
          Informações do Grupo
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Group Logo / Name */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
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
            ) : groupDetails?.avatar_url ? (
              <Image
                source={{
                  uri: groupDetails.avatar_url.startsWith("http")
                    ? groupDetails.avatar_url
                    : `${API_URL}${groupDetails.avatar_url}`,
                }}
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

          {groupDetails?.created_by === user?.user_id ? (
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
            {/* Manage Members Modal trigger (Only for Creator) */}
            {groupDetails && groupDetails.created_by === user?.user_id && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "bold",
                      color: colors.text,
                    }}
                  >
                    Adicionar Membro
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    Busque e gerencie participantes
                  </Text>
                </View>

                <TouchableOpacity
                  style={{
                    backgroundColor: colors.tint,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                  onPress={() => setAddMemberModalVisible(true)}
                >
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "600" }}>
                    Adicionar
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Members List */}
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "bold",
                  color: colors.text,
                  marginBottom: 12,
                }}
              >
                Membros
              </Text>
              {groupDetails?.participants.map((member) => {
                const isCreator = groupDetails.created_by === member.id;
                const isMe = member.id === user?.user_id;
                const showRemoveButton =
                  groupDetails.created_by === user?.user_id &&
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
                        style={{ flexDirection: "row", alignItems: "center" }}
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
                            <ActivityIndicator size="small" color="#fff" />
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
                            <Text style={{ color: "#fff", fontWeight: "bold" }}>
                              {(member.name ||
                                member.username)[0].toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View>
                          <Text
                            style={{ color: colors.text, fontWeight: "600" }}
                          >
                            {member.name || member.username} {isMe && "(Você)"}
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
                          handleRemoveParticipant(member.id, member.username)
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
            </View>

            {/* Leave Group Button */}
            {groupDetails && groupDetails.created_by !== user?.user_id && (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.danger || "#FF3B30",
                  padding: 16,
                  borderRadius: 12,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 10,
                }}
                onPress={handleLeaveGroup}
              >
                <MaterialCommunityIcons name="logout" size={20} color="#fff" />
                <Text
                  style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}
                >
                  Sair do Grupo
                </Text>
              </TouchableOpacity>
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
        title="Foto do grupo"
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
    </View>
  );
}
