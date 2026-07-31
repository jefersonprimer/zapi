import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import {
  createGroup,
  searchUsers,
  type UserSearchResult,
} from "@/services/api";
import { UserContactCard } from "@/components/UserContactCard";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

// Helper to get consistent background color for avatars based on user's name
function getAvatarColor(name: string) {
  const colors = [
    "#FF5733",
    "#33FF57",
    "#3357FF",
    "#F3FF33",
    "#FF33F3",
    "#33FFF0",
    "#FFA833",
    "#AF33FF",
    "#33FFA8",
    "#FF3383",
    "#07C160",
    "#10B981",
    "#3B82F6",
    "#8B5CF6",
    "#EC4899",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export default function NewGroupScreen() {
  const router = useRouter();
  const {
    preselectedContactId,
    preselectedUsername,
    preselectedName,
    preselectedEmail,
    preselectedAvatarUrl,
  } = useLocalSearchParams<{
    preselectedContactId?: string;
    preselectedUsername?: string;
    preselectedName?: string;
    preselectedEmail?: string;
    preselectedAvatarUrl?: string;
  }>();

  const { token } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [selected, setSelected] = useState<Map<string, UserSearchResult>>(
    () => {
      const initial = new Map<string, UserSearchResult>();
      if (preselectedContactId && preselectedUsername) {
        initial.set(preselectedContactId, {
          id: preselectedContactId,
          username: preselectedUsername,
          name: preselectedName || undefined,
          email: preselectedEmail || undefined,
          avatar_url: preselectedAvatarUrl || null,
        });
      }
      return initial;
    },
  );
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => setKeyboardVisible(true),
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => setKeyboardVisible(false),
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  async function handleSearch() {
    if (!query.trim() || !token) return;
    setSearching(true);
    try {
      const data = await searchUsers(token, query.trim());
      setUsers(data.users);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Erro ao buscar usuários");
    } finally {
      setSearching(false);
    }
  }

  function toggleUser(user: UserSearchResult) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(user.id)) {
        next.delete(user.id);
      } else {
        next.set(user.id, user);
      }
      return next;
    });
  }

  function removeUser(userId: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  }

  async function handleCreate() {
    if (!name.trim() || selected.size === 0 || !token) return;

    setLoading(true);
    try {
      const data = await createGroup(token, name, Array.from(selected.keys()));
      router.replace({
        pathname: "/chat",
        params: {
          chatId: data.id,
          participantUsername: data.name,
        },
      });
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Erro ao criar grupo");
    } finally {
      setLoading(false);
    }
  }

  const selectedList = Array.from(selected.values());

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : isKeyboardVisible
            ? "height"
            : undefined
      }
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 60 : 0}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.customHeader,
            {
              paddingTop: insets.top,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Novo Grupo
              </Text>
              <Text
                style={[styles.headerSubtitle, { color: colors.textSecondary }]}
              >
                {selected.size === 0
                  ? "Adicione participantes"
                  : `${selected.size} selecionado(s)`}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Group Meta Info Section */}
          <View
            style={[
              styles.metaCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.avatarPickerContainer}>
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: colors.border },
                ]}
              >
                <MaterialCommunityIcons
                  name="account-multiple"
                  size={32}
                  color={colors.textSecondary}
                />
                <View
                  style={[
                    styles.cameraIconContainer,
                    { backgroundColor: colors.brandGreen || "#07C160" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="camera"
                    size={14}
                    color="#FFF"
                  />
                </View>
              </View>
            </View>
            <View style={styles.nameInputContainer}>
              <TextInput
                style={[styles.nameInput, { color: colors.text }]}
                placeholder="Nome do grupo..."
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                maxLength={50}
              />
              <View
                style={[
                  styles.inputUnderline,
                  {
                    backgroundColor: name
                      ? colors.brandGreen || "#07C160"
                      : colors.border,
                  },
                ]}
              />
            </View>
          </View>

          {/* Selected Members Horizontal Chips */}
          {selected.size > 0 && (
            <View style={styles.selectedContainer}>
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }]}
              >
                Membros Selecionados
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {selectedList.map((user) => {
                  const displayName = user.name || user.username;
                  const avatarBg = getAvatarColor(displayName);
                  return (
                    <View key={user.id} style={styles.chipWrapper}>
                      <View style={styles.chipAvatarContainer}>
                        <View
                          style={[
                            styles.chipAvatar,
                            { backgroundColor: avatarBg },
                          ]}
                        >
                          <Text style={styles.chipAvatarText}>
                            {displayName[0].toUpperCase()}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.removeChipBtn,
                            { backgroundColor: colors.textSecondary },
                          ]}
                          onPress={() => removeUser(user.id)}
                        >
                          <MaterialCommunityIcons
                            name="close"
                            size={10}
                            color="#FFF"
                          />
                        </TouchableOpacity>
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[styles.chipName, { color: colors.text }]}
                      >
                        {displayName.split(" ")[0]}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Search Bar Section */}
          <View style={styles.searchSection}>
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              Adicionar participantes
            </Text>
            <View
              style={[
                styles.searchBarContainer,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color={colors.textSecondary}
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Buscar por nome ou username..."
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => setQuery("")}
                  style={styles.clearBtn}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.searchBtn,
                  { backgroundColor: colors.brandGreen || "#07C160" },
                ]}
                onPress={handleSearch}
                disabled={searching}
              >
                {searching ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.searchBtnText}>Buscar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Users List Container */}
          <View style={styles.listContainer}>
            {users.length > 0 ? (
              users.map((item) => {
                const isSelected = selected.has(item.id);
                return (
                  <UserContactCard
                    key={item.id}
                    avatarUrl={item.avatar_url}
                    name={item.name}
                    username={item.username}
                    email={item.email}
                    onPress={() => toggleUser(item)}
                    containerStyle={styles.userItem}
                    leftElement={
                      <View
                        style={[
                          styles.checkbox,
                          { borderColor: colors.border },
                          isSelected && [
                            styles.checked,
                            {
                              backgroundColor: colors.brandGreen || "#07C160",
                              borderColor: colors.brandGreen || "#07C160",
                            },
                          ],
                        ]}
                      >
                        {isSelected && (
                          <MaterialCommunityIcons
                            name="check"
                            size={12}
                            color="#FFF"
                          />
                        )}
                      </View>
                    }
                  />
                );
              })
            ) : query.trim() !== "" && !searching ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="account-multiple"
                  size={48}
                  color={colors.textSecondary}
                  style={{ opacity: 0.5, marginBottom: 12 }}
                />
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  Nenhum usuário encontrado para &quot;{query}&quot;
                </Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="account-multiple"
                  size={48}
                  color={colors.textSecondary}
                  style={{ opacity: 0.3, marginBottom: 12 }}
                />
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  Busque usuários para adicioná-los ao grupo
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Floating Create Button */}
        <View
          style={[
            styles.footer,
            {
              paddingBottom: isKeyboardVisible
                ? 6
                : Math.max(insets.bottom, 16),
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.createBtn,
              { backgroundColor: colors.brandGreen || "#07C160" },
              (!name.trim() || selected.size === 0) && styles.createBtnDisabled,
            ]}
            onPress={handleCreate}
            disabled={!name.trim() || selected.size === 0 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createBtnText}>
                Criar Grupo ({selected.size})
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customHeader: {
    paddingBottom: 6,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  scrollContent: {
    flex: 1,
  },
  metaCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
  },
  avatarPickerContainer: {
    marginRight: 16,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  cameraIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  nameInputContainer: {
    flex: 1,
    justifyContent: "center",
  },
  nameInput: {
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  inputUnderline: {
    height: 2,
    borderRadius: 1,
    marginTop: 2,
  },
  selectedContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipsScroll: {
    paddingVertical: 4,
    gap: 12,
  },
  chipWrapper: {
    alignItems: "center",
    width: 60,
  },
  chipAvatarContainer: {
    position: "relative",
    marginBottom: 4,
  },
  chipAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  chipAvatarText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
  },
  removeChipBtn: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFF",
  },
  chipName: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    width: "100%",
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 12,
    height: 52,
    overflow: "hidden",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: "100%",
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 8,
  },
  searchBtn: {
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  searchBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  listContainer: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checked: {},
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
  },
  userInfo: {
    flex: 1,
    justifyContent: "center",
  },
  username: {
    fontSize: 15,
    fontWeight: "600",
  },
  usernameHandle: {
    fontSize: 12,
    marginTop: 1,
  },
  email: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  createBtn: {
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
