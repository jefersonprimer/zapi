import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  StatusBar,
  Keyboard,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import {
  searchUsers,
  createChat,
  getContacts,
  type UserSearchResult,
  type Contact,
  type ChatListItem,
} from "@/services/api";
import {
  getChatsFromLocal,
  addSearchHistoryLocal,
  getSearchHistoryLocal,
  removeSearchHistoryLocal,
  clearSearchHistoryLocal,
  type SearchHistoryItem,
} from "@/services/database";
import { useAppTheme } from "@/context/ThemeContext";
import { UserContactCard } from "@/components/UserContactCard";
import { Ionicons } from "@expo/vector-icons";

export default function SearchScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [globalResults, setGlobalResults] = useState<UserSearchResult[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  // Local data lists
  const [localChats, setLocalChats] = useState<ChatListItem[]>([]);
  const [localContacts, setLocalContacts] = useState<Contact[]>([]);

  // Filtered lists
  const [filteredChats, setFilteredChats] = useState<ChatListItem[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);

  // Search History
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

  // Load search history and local data
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const history = await getSearchHistoryLocal(10);
      setSearchHistory(history || []);
    } catch (err) {
      console.error("Failed to load search history:", err);
    }
  };

  // Load local chats & contacts once on mount or token update
  useEffect(() => {
    async function loadLocalData() {
      try {
        const chats = await getChatsFromLocal();
        setLocalChats(chats || []);
      } catch (err) {
        console.error("Failed to load local chats:", err);
      }

      if (token) {
        try {
          const contacts = await getContacts(token);
          setLocalContacts(contacts || []);
        } catch (err) {
          console.error("Failed to load contacts:", err);
        }
      }
    }
    loadLocalData();
  }, [token]);

  // Filter local chats and contacts on query changes
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      setFilteredChats([]);
      setFilteredContacts([]);
      return;
    }

    const matchedChats = localChats.filter((c) => {
      const chatName = (
        c.name ??
        c.participant_name ??
        c.participant_username ??
        ""
      ).toLowerCase();
      return chatName.includes(query);
    });

    const matchedContacts = localContacts.filter((c) => {
      const name = (c.name ?? c.username ?? "").toLowerCase();
      const email = (c.email ?? "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });

    setFilteredChats(matchedChats);
    setFilteredContacts(matchedContacts);
  }, [searchQuery, localChats, localContacts]);

  // Global user search (API debounced)
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query || !token) {
      setGlobalResults([]);
      setLoadingGlobal(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoadingGlobal(true);
      try {
        const response = await searchUsers(token, query);
        const apiUsers = response.users || [];
        const filteredApiUsers = apiUsers.filter((u: UserSearchResult) => {
          const hasChat = localChats.some((c) => c.participant_id === u.id);
          const hasContact = localContacts.some((c) => c.contact_id === u.id);
          return !hasChat && !hasContact;
        });
        setGlobalResults(filteredApiUsers);
      } catch (err) {
        console.error("Failed to search global users:", err);
      } finally {
        setLoadingGlobal(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, token, localChats, localContacts]);

  const handleWebSearch = () => {
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim();
    addSearchHistoryLocal(query).then(() => loadHistory());
    Keyboard.dismiss();
    setSearchQuery("");
    router.push({
      pathname: "/browser",
      params: { search: query },
    });
  };

  const handleSelectHistoryItem = (item: SearchHistoryItem) => {
    setSearchQuery(item.query);
  };

  const handleRemoveHistoryItem = async (id: string) => {
    try {
      await removeSearchHistoryLocal(id);
      loadHistory();
    } catch (err) {
      console.error("Failed to remove search history item:", err);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearSearchHistoryLocal();
      setSearchHistory([]);
    } catch (err) {
      console.error("Failed to clear search history:", err);
    }
  };

  const handleSelectChat = (chat: ChatListItem) => {
    if (searchQuery.trim()) {
      addSearchHistoryLocal(searchQuery.trim()).then(() => loadHistory());
    }
    router.push({
      pathname: "/chat",
      params: {
        chatId: chat.id,
        participantId: chat.participant_id || "",
        participantUsername:
          chat.name ??
          chat.participant_name ??
          chat.participant_username ??
          "Conversa",
        participantAvatarUrl:
          (chat.is_group ? chat.avatar_url : chat.participant_avatar_url) || "",
      },
    });
  };

  const handleSelectContact = async (contact: Contact) => {
    if (searchQuery.trim()) {
      addSearchHistoryLocal(searchQuery.trim()).then(() => loadHistory());
    }
    const existingChat = localChats.find(
      (c) => c.participant_id === contact.contact_id,
    );
    if (existingChat) {
      handleSelectChat(existingChat);
      return;
    }

    if (!token || chatLoading) return;
    setChatLoading(true);
    try {
      const data = await createChat(token, contact.contact_id);
      router.push({
        pathname: "/chat",
        params: {
          chatId: data.id,
          participantId: contact.contact_id,
          participantUsername: contact.name ?? contact.username,
          participantAvatarUrl: contact.avatar_url || "",
        },
      });
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.message || "Não foi possível iniciar a conversa.",
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleSelectGlobalUser = async (userResult: UserSearchResult) => {
    if (searchQuery.trim()) {
      addSearchHistoryLocal(searchQuery.trim()).then(() => loadHistory());
    }
    if (!token || chatLoading) return;
    setChatLoading(true);
    try {
      const data = await createChat(token, userResult.id);
      router.push({
        pathname: "/chat",
        params: {
          chatId: data.id,
          participantId: userResult.id,
          participantUsername: userResult.username,
          participantAvatarUrl: userResult.avatar_url || "",
        },
      });
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.message || "Não foi possível iniciar a conversa.",
      );
    } finally {
      setChatLoading(false);
    }
  };

  const isQueryEmpty = searchQuery.trim().length === 0;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* HEADER WITH UNIFIED SEARCH INPUT */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back-outline" size={24} color={colors.text} />
        </TouchableOpacity>

        <View
          style={[
            styles.searchInputContainer,
            { backgroundColor: isDark ? "#2A2A2F" : "#F1F5F9" },
          ]}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={18}
            color={colors.textSecondary}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar conversas, contatos ou web..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleWebSearch}
            returnKeyType="search"
            autoFocus
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={{ padding: 4 }}
            >
              <MaterialCommunityIcons
                name="close"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {!isQueryEmpty && (
          <TouchableOpacity
            onPress={handleWebSearch}
            style={styles.webSearchButton}
          >
            <MaterialCommunityIcons name="earth" size={20} color="#07C160" />
          </TouchableOpacity>
        )}
      </View>

      {chatLoading && (
        <View style={styles.topLoadingBar}>
          <ActivityIndicator size="small" color="#07C160" />
        </View>
      )}

      {/* SEARCH HUB CONTENT */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {isQueryEmpty ? (
          <>
            {/* SEARCH HISTORY BY DEFAULT */}
            {searchHistory.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.historyHeaderRow}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <MaterialCommunityIcons
                      name="history"
                      size={18}
                      color={colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Histórico de buscas
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleClearHistory}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.brandGreen || "#07C160",
                      }}
                    >
                      Limpar
                    </Text>
                  </TouchableOpacity>
                </View>

                {searchHistory.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.historyItem,
                      { borderBottomColor: colors.border },
                    ]}
                    onPress={() => handleSelectHistoryItem(item)}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="magnify"
                        size={18}
                        color={colors.textSecondary}
                        style={{ marginRight: 12 }}
                      />
                      <Text
                        style={[styles.historyText, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {item.query}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveHistoryItem(item.id)}
                      style={{ padding: 6 }}
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={16}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.centerContainer}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={48}
                  color={colors.textSecondary}
                  style={{ marginBottom: 16, opacity: 0.3 }}
                />
                <Text
                  style={[styles.introText, { color: colors.textSecondary }]}
                >
                  Digite acima para buscar conversas, contatos ou pesquisar na
                  Web.
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* FILTERED RESULTS USING UserContactCard */}

            {/* 1. LOCAL CHATS */}
            {filteredChats.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="message-outline"
                    size={16}
                    color={colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Conversas Encontradas
                  </Text>
                </View>
                {filteredChats.map((chat) => {
                  const displayName =
                    chat.name ??
                    chat.participant_name ??
                    chat.participant_username ??
                    "Grupo";
                  const avatarUrl = chat.is_group
                    ? chat.avatar_url
                    : chat.participant_avatar_url;
                  const username = chat.participant_username ?? "";

                  return (
                    <UserContactCard
                      key={chat.id}
                      name={displayName}
                      username={username}
                      email={chat.last_message || undefined}
                      avatarUrl={avatarUrl}
                      onPress={() => handleSelectChat(chat)}
                    />
                  );
                })}
              </View>
            )}

            {/* 2. LOCAL CONTACTS */}
            {filteredContacts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="account-multiple"
                    size={16}
                    color={colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Contatos Correspondentes
                  </Text>
                </View>
                {filteredContacts.map((contact) => (
                  <UserContactCard
                    key={contact.contact_id}
                    name={contact.name ?? contact.username}
                    username={contact.username}
                    email={contact.email}
                    avatarUrl={contact.avatar_url}
                    onPress={() => handleSelectContact(contact)}
                  />
                ))}
              </View>
            )}

            {/* 3. GLOBAL USERS */}
            {loadingGlobal ? (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <ActivityIndicator size="small" color="#07C160" />
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: colors.textSecondary,
                  }}
                >
                  Buscando globalmente no Zapi...
                </Text>
              </View>
            ) : (
              globalResults.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <MaterialCommunityIcons
                      name="magnify"
                      size={16}
                      color={colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Outros usuários no Zapi
                    </Text>
                  </View>
                  {globalResults.map((user) => (
                    <UserContactCard
                      key={user.id}
                      name={user.username}
                      username={user.username}
                      email={user.email || "Usuário Zapi"}
                      avatarUrl={user.avatar_url}
                      onPress={() => handleSelectGlobalUser(user)}
                    />
                  ))}
                </View>
              )
            )}

            {/* WEB SEARCH ROW AT THE END */}
            <View style={{ marginTop: 12, marginBottom: 30 }}>
              <TouchableOpacity
                onPress={handleWebSearch}
                style={[
                  styles.webSearchPrompt,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="earth"
                  size={20}
                  color="#07C160"
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={[
                    styles.webSearchPromptText,
                    { color: colors.brandGreen || "#07C160" },
                  ]}
                >
                  {`Pesquisar na Web por "${searchQuery}"`}
                </Text>
              </TouchableOpacity>
            </View>

            {filteredChats.length === 0 &&
              filteredContacts.length === 0 &&
              globalResults.length === 0 &&
              !loadingGlobal && (
                <View style={[styles.centerContainer, { marginVertical: 40 }]}>
                  <Text
                    style={[
                      styles.introText,
                      { color: colors.textSecondary, marginBottom: 20 },
                    ]}
                  >
                    {`Nenhum resultado local ou global encontrado para "${searchQuery}"`}
                  </Text>
                </View>
              )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0,
  },
  header: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  searchInputContainer: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginHorizontal: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  webSearchButton: {
    padding: 8,
  },
  topLoadingBar: {
    height: 2,
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    zIndex: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  historyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyText: {
    fontSize: 15,
  },
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  introText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  webSearchPrompt: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
  },
  webSearchPromptText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
