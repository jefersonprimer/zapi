import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { ArrowLeft, LogOut } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  getGroupDetails,
  addParticipant,
  removeParticipant,
  searchUsers,
  type UserSearchResult,
  type GroupDetails,
} from "@/services/api";

interface GroupDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  participantUsername: string;
}

export function GroupDetailsModal({
  visible,
  onClose,
  chatId,
  participantUsername,
}: GroupDetailsModalProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const { colors, isDark } = useAppTheme();

  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
  const [loadingGroupDetails, setLoadingGroupDetails] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState("");
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [searchedUsers, setSearchedUsers] = useState<UserSearchResult[]>([]);

  const fetchGroupInfo = useCallback(async () => {
    if (!token || !chatId) return;
    setLoadingGroupDetails(true);
    try {
      const details = await getGroupDetails(token, chatId);
      setGroupDetails(details);
    } catch (err) {
      console.error("Failed to fetch group details:", err);
    } finally {
      setLoadingGroupDetails(false);
    }
  }, [token, chatId]);

  useEffect(() => {
    if (visible) {
      fetchGroupInfo();
      // Clean up search on open
      setSearchMemberQuery("");
      setSearchedUsers([]);
    }
  }, [visible, fetchGroupInfo]);

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
    try {
      await addParticipant(token, chatId, userId);
      Alert.alert("Sucesso", "Membro adicionado com sucesso!");
      setSearchMemberQuery("");
      setSearchedUsers([]);
      fetchGroupInfo();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Não foi possível adicionar o membro.");
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
              Alert.alert("Erro", err.message || "Não foi possível remover o membro.");
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = async () => {
    Alert.alert(
      "Sair do Grupo",
      "Tem certeza que deseja sair deste grupo?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            if (!token || !chatId || !user) return;
            try {
              await removeParticipant(token, chatId, user.user_id);
              onClose();
              router.replace("/(tabs)");
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Não foi possível sair do grupo.");
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        {/* Header */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.headerBackground,
        }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4, marginRight: 16 }}>
            <ArrowLeft size={24} color={colors.headerText} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.headerText, flex: 1 }} numberOfLines={1}>
            Informações do Grupo
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* Group Logo / Name */}
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#34C759", // Group green
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 12,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}>
              <Text style={{ color: "#fff", fontSize: 32, fontWeight: "bold" }}>
                {participantUsername[0]?.toUpperCase()}
              </Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.text, textAlign: "center" }}>
              {participantUsername}
            </Text>
            {groupDetails && (
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
                {groupDetails.participants.length} membros
              </Text>
            )}
          </View>

          {loadingGroupDetails ? (
            <ActivityIndicator size="large" color={colors.tint} style={{ marginVertical: 20 }} />
          ) : (
            <>
              {/* Manage Members (Only for Creator) */}
              {groupDetails && groupDetails.created_by === user?.user_id && (
                <View style={{
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}>
                  <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.text, marginBottom: 12 }}>
                    Adicionar Membro
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        color: colors.text,
                        backgroundColor: colors.background,
                      }}
                      placeholder="Nome de usuário..."
                      placeholderTextColor={colors.textSecondary}
                      value={searchMemberQuery}
                      onChangeText={setSearchMemberQuery}
                      onSubmitEditing={handleSearchMembers}
                    />
                    <TouchableOpacity
                      style={{
                        backgroundColor: colors.tint,
                        paddingHorizontal: 16,
                        borderRadius: 8,
                        justifyContent: "center",
                      }}
                      onPress={handleSearchMembers}
                      disabled={searchingMembers}
                    >
                      {searchingMembers ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={{ color: "#fff", fontWeight: "600" }}>Buscar</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Search Results */}
                  {searchedUsers.length > 0 && (
                    <View style={{ marginTop: 12 }}>
                      {searchedUsers.map((item) => {
                        const isAlreadyMember = groupDetails.participants.some(p => p.id === item.id);
                        return (
                          <View key={item.id} style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 8,
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: colors.border,
                            justifyContent: "space-between",
                          }}>
                            <Text style={{ color: colors.text, fontWeight: "500" }}>{item.username}</Text>
                            {isAlreadyMember ? (
                              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Já é membro</Text>
                            ) : (
                              <TouchableOpacity
                                style={{
                                  backgroundColor: colors.tint,
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  borderRadius: 6,
                                }}
                                onPress={() => handleAddParticipant(item.id)}
                              >
                                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Adicionar</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Members List */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.text, marginBottom: 12 }}>
                  Membros
                </Text>
                {groupDetails?.participants.map((member) => {
                  const isCreator = groupDetails.created_by === member.id;
                  const isMe = member.id === user?.user_id;
                  const showRemoveButton = groupDetails.created_by === user?.user_id && !isCreator && !isMe;

                  return (
                    <View key={member.id} style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                      justifyContent: "space-between",
                    }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: colors.tint,
                          justifyContent: "center",
                          alignItems: "center",
                          marginRight: 12,
                        }}>
                          <Text style={{ color: "#fff", fontWeight: "bold" }}>
                            {member.username[0].toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={{ color: colors.text, fontWeight: "600" }}>
                            {member.username} {isMe && "(Você)"}
                          </Text>
                          {isCreator && (
                            <Text style={{ fontSize: 11, color: colors.tint, fontWeight: "500" }}>
                              Dono do grupo
                            </Text>
                          )}
                        </View>
                      </View>

                      {showRemoveButton && (
                        <TouchableOpacity
                          style={{
                            backgroundColor: colors.danger || "#FF3B30",
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 6,
                          }}
                          onPress={() => handleRemoveParticipant(member.id, member.username)}
                        >
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Remover</Text>
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
                  <LogOut size={20} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>Sair do Grupo</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
