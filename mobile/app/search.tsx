import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Keyboard,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Search, Globe, User, MessageSquare, Users } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import {
  searchUsers,
  createChat,
  getContacts,
  type UserSearchResult,
  type Contact,
  type ChatListItem,
  API_URL,
} from "@/services/api";
import { getChatsFromLocal } from "@/services/database";
import { useAppTheme } from "@/context/ThemeContext";

const getAvatarUri = (url?: string | null) => {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${API_URL}${url}`;
};

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

  // Load initial local data
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
        // Exclude users we already have as active chats or contacts to keep global search clean
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
    Keyboard.dismiss();
    const query = searchQuery;
    setSearchQuery("");
    router.push({
      pathname: "/browser",
      params: { search: query },
    });
  };

  const handleSelectChat = (chat: ChatListItem) => {
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
    // If a chat already exists with this contact, navigate directly
    const existingChat = localChats.find((c) => c.participant_id === contact.contact_id);
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
      Alert.alert("Erro", err.message || "Não foi possível iniciar a conversa.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleSelectGlobalUser = async (userResult: UserSearchResult) => {
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
      Alert.alert("Erro", err.message || "Não foi possível iniciar a conversa.");
    } finally {
      setChatLoading(false);
    }
  };

  const isQueryEmpty = searchQuery.trim().length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER WITH UNIFIED SEARCH INPUT */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={[styles.searchInputContainer, { backgroundColor: isDark ? "#2A2A2F" : "#F1F5F9" }]}>
          <Search size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
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
        </View>

        {!isQueryEmpty && (
          <TouchableOpacity onPress={handleWebSearch} style={styles.webSearchButton}>
            <Globe size={20} color="#07C160" />
          </TouchableOpacity>
        )}
      </View>

      {chatLoading && (
        <View style={styles.topLoadingBar}>
          <ActivityIndicator size="small" color="#07C160" />
        </View>
      )}

      {/* SEARCH HUB CONTENT */}
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {isQueryEmpty ? (
          <>
            {/* INITIAL STATE: RECENT CHATS & CONTACTS */}
            {localChats.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MessageSquare size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Conversas Recentes</Text>
                </View>
                {localChats.slice(0, 5).map((chat) => (
                  <TouchableOpacity
                    key={chat.id}
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => handleSelectChat(chat)}
                  >
                    {chat.participant_avatar_url || (chat.is_group && chat.avatar_url) ? (
                      <Image
                        source={{ uri: getAvatarUri(chat.participant_avatar_url || chat.avatar_url) }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? "#2A2A2F" : "#E2E8F0" }]}>
                        {chat.is_group ? (
                          <Users size={20} color={colors.textSecondary} />
                        ) : (
                          <User size={20} color={colors.textSecondary} />
                        )}
                      </View>
                    )}
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                        {chat.name ?? chat.participant_name ?? chat.participant_username ?? "Grupo"}
                      </Text>
                      {chat.last_message_preview && (
                        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                          {chat.last_message_preview}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {localContacts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Users size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Meus Contatos</Text>
                </View>
                {localContacts.map((contact) => (
                  <TouchableOpacity
                    key={contact.contact_id}
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => handleSelectContact(contact)}
                  >
                    {contact.avatar_url ? (
                      <Image source={{ uri: getAvatarUri(contact.avatar_url) }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? "#2A2A2F" : "#E2E8F0" }]}>
                        <User size={20} color={colors.textSecondary} />
                      </View>
                    )}
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardName, { color: colors.text }]}>
                        {contact.name ?? contact.username}
                      </Text>
                      <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                        @{contact.username}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {localChats.length === 0 && localContacts.length === 0 && (
              <View style={styles.centerContainer}>
                <Search size={48} color={colors.textSecondary} style={{ marginBottom: 16, opacity: 0.3 }} />
                <Text style={[styles.introText, { color: colors.textSecondary }]}>
                  Digite acima para buscar contatos ou pesquisar na Web.
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* FILTERED RESULTS */}
            
            {/* 1. LOCAL CHATS */}
            {filteredChats.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MessageSquare size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Conversas Encontradas</Text>
                </View>
                {filteredChats.map((chat) => (
                  <TouchableOpacity
                    key={chat.id}
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => handleSelectChat(chat)}
                  >
                    {chat.participant_avatar_url || (chat.is_group && chat.avatar_url) ? (
                      <Image
                        source={{ uri: getAvatarUri(chat.participant_avatar_url || chat.avatar_url) }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? "#2A2A2F" : "#E2E8F0" }]}>
                        {chat.is_group ? (
                          <Users size={20} color={colors.textSecondary} />
                        ) : (
                          <User size={20} color={colors.textSecondary} />
                        )}
                      </View>
                    )}
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                        {chat.name ?? chat.participant_name ?? chat.participant_username ?? "Grupo"}
                      </Text>
                      {chat.last_message_preview && (
                        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                          {chat.last_message_preview}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* 2. LOCAL CONTACTS */}
            {filteredContacts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Users size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Contatos Correspondentes</Text>
                </View>
                {filteredContacts.map((contact) => (
                  <TouchableOpacity
                    key={contact.contact_id}
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => handleSelectContact(contact)}
                  >
                    {contact.avatar_url ? (
                      <Image source={{ uri: getAvatarUri(contact.avatar_url) }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? "#2A2A2F" : "#E2E8F0" }]}>
                        <User size={20} color={colors.textSecondary} />
                      </View>
                    )}
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardName, { color: colors.text }]}>
                        {contact.name ?? contact.username}
                      </Text>
                      <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                        @{contact.username}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* 3. GLOBAL USERS (Zapi Search API) */}
            {loadingGlobal ? (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <ActivityIndicator size="small" color="#07C160" />
                <Text style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>
                  Buscando globalmente no Zapi...
                </Text>
              </View>
            ) : (
              globalResults.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Search size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Outros usuários no Zapi</Text>
                  </View>
                  {globalResults.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => handleSelectGlobalUser(user)}
                    >
                      {user.avatar_url ? (
                        <Image source={{ uri: getAvatarUri(user.avatar_url) }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? "#2A2A2F" : "#E2E8F0" }]}>
                          <User size={20} color={colors.textSecondary} />
                        </View>
                      )}
                      <View style={styles.cardInfo}>
                        <Text style={[styles.cardName, { color: colors.text }]}>{user.username}</Text>
                        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                          {user.email || "Usuário Zapi"}
                        </Text>
                      </View>
                    </TouchableOpacity>
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
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Globe size={20} color="#07C160" style={{ marginRight: 10 }} />
                <Text style={[styles.webSearchPromptText, { color: colors.brandGreen || "#07C160" }]}>
                  Pesquisar na Web por "{searchQuery}"
                </Text>
              </TouchableOpacity>
            </View>

            {filteredChats.length === 0 &&
              filteredContacts.length === 0 &&
              globalResults.length === 0 &&
              !loadingGlobal && (
                <View style={[styles.centerContainer, { marginVertical: 40 }]}>
                  <Text style={[styles.introText, { color: colors.textSecondary, marginBottom: 20 }]}>
                    Nenhum resultado local ou global encontrado para "{searchQuery}"
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
    paddingTop: Platform.OS === "android" ? 30 : 0,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
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
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
    justifyContent: "center",
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600",
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
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
