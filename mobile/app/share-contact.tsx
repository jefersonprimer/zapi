import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getContacts, createChat, type Contact, API_URL } from "@/services/api";
import { insertMessageLocal } from "@/services/database";
import { syncWorker } from "@/services/syncWorker";
import { generateUUIDv7 } from "@/services/uuidv7";
import {
  buildForwardContent,
  type ForwardedMessageData,
} from "@/utils/forwardMessage";

export default function ShareContactScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const {
    contactId,
    contactUsername,
    contactAvatarUrl,
    mode,
    forwardMessages,
  } = useLocalSearchParams<{
    contactId?: string;
    contactUsername?: string;
    contactAvatarUrl?: string;
    mode?: string;
    forwardMessages?: string;
  }>();

  const isForwardMode = mode === "forward";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Map<string, Contact>>(new Map());

  const fetchContacts = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await getContacts(token);
      setContacts(data);
    } catch (err: any) {
      console.error("Failed to fetch contacts:", err);
      Alert.alert("Erro", "Não foi possível carregar os contatos.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  function toggleContact(contact: Contact) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(contact.contact_id)) {
        next.delete(contact.contact_id);
      } else {
        next.set(contact.contact_id, contact);
      }
      return next;
    });
  }

  async function handleSend() {
    if (!token || selected.size === 0) return;

    if (isForwardMode) {
      if (!forwardMessages) return;
      setActionLoading(true);
      try {
        let messagesToForward: ForwardedMessageData[] = [];
        try {
          messagesToForward = JSON.parse(forwardMessages);
        } catch {
          Alert.alert("Erro", "Dados da mensagem inválidos.");
          return;
        }

        if (!Array.isArray(messagesToForward) || messagesToForward.length === 0) {
          Alert.alert("Erro", "Nenhuma mensagem para encaminhar.");
          return;
        }

        const selectedContacts = Array.from(selected.values());

        for (const recipient of selectedContacts) {
          const chatData = await createChat(token, recipient.contact_id);
          const chatId = chatData.id;

          for (const forwarded of messagesToForward) {
            const localId = generateUUIDv7();
            const content = buildForwardContent(forwarded);

            await insertMessageLocal({
              id: localId,
              chat_id: chatId,
              sender_id: user?.user_id || "",
              sender_username: user?.username || "",
              content,
              image_url: null,
              created_at: new Date().toISOString(),
              status: "pending",
            });

            syncWorker.notifyMessagesChanged(chatId);
            syncWorker.triggerSync(chatId);
          }
        }

        Alert.alert("Sucesso", "Mensagem encaminhada com sucesso!", [
          {
            text: "OK",
            onPress: () => {
              router.back();
            },
          },
        ]);
      } catch (err: any) {
        console.error("Failed to forward message:", err);
        Alert.alert(
          "Erro",
          err.message || "Não foi possível encaminhar a mensagem.",
        );
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (!contactId || !contactUsername) return;
    setActionLoading(true);

    try {
      const selectedContacts = Array.from(selected.values());
      const shareContent = JSON.stringify({
        type: "contact_share",
        contact_id: contactId,
        username: contactUsername,
        avatar_url: contactAvatarUrl || null,
      });

      for (const recipient of selectedContacts) {
        const chatData = await createChat(token, recipient.contact_id);
        const chatId = chatData.id;

        const localId = generateUUIDv7();

        const newLocalMsg = {
          id: localId,
          chat_id: chatId,
          sender_id: user?.user_id || "",
          sender_username: user?.username || "",
          content: shareContent,
          image_url: null,
          created_at: new Date().toISOString(),
          status: "pending" as const,
        };

        await insertMessageLocal(newLocalMsg);

        syncWorker.notifyMessagesChanged(chatId);
        syncWorker.triggerSync(chatId);
      }

      Alert.alert("Sucesso", "Contato compartilhado com sucesso!", [
        {
          text: "OK",
          onPress: () => {
            router.back();
          },
        },
      ]);
    } catch (err: any) {
      console.error("Failed to share contact:", err);
      Alert.alert("Erro", err.message || "Não foi possível compartilhar o contato.");
    } finally {
      setActionLoading(false);
    }
  }

  const filteredContacts = contacts.filter(
    (c) =>
      c.username.toLowerCase().includes(query.toLowerCase()) ||
      c.email.toLowerCase().includes(query.toLowerCase()),
  );

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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color={colors.headerText} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: colors.headerText }]}>
              {isForwardMode ? "Encaminhar para..." : "Enviar para ..."}
            </Text>
          </View>
        </View>
      </View>

      {actionLoading && (
        <View
          style={[styles.overlayLoading, { backgroundColor: colors.modalOverlay }]}
        >
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      )}

      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
          placeholder="Pesquisar contatos..."
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.contact_id}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.contact_id);
            const nameInitial = item.username[0]?.toUpperCase() ?? "?";
            const avatarUri = item.avatar_url
              ? item.avatar_url.startsWith("http")
                ? item.avatar_url
                : `${API_URL}${item.avatar_url.startsWith("/") ? "" : "/"}${item.avatar_url}`
              : null;

            return (
              <TouchableOpacity
                style={[styles.contactRow, { borderBottomColor: colors.border }]}
                onPress={() => toggleContact(item)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: isDark ? "#2C2C2E" : "#e5e5ea" },
                  ]}
                >
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                  ) : (
                    <Text style={[styles.avatarText, { color: colors.text }]}>
                      {nameInitial}
                    </Text>
                  )}
                </View>

                <View style={styles.textContainer}>
                  <Text style={[styles.username, { color: colors.text }]}>
                    {item.username}
                  </Text>
                  <Text style={[styles.email, { color: colors.textSecondary }]}>
                    {item.email}
                  </Text>
                </View>

                <View
                  style={[
                    styles.checkbox,
                    { borderColor: colors.border },
                    isSelected && [
                      styles.checked,
                      { backgroundColor: colors.tint, borderColor: colors.tint },
                    ],
                  ]}
                >
                  {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {query
                  ? "Nenhum contato encontrado."
                  : "Nenhum contato adicionado ainda."}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {/* FAB Button */}
      {selected.size > 0 && !loading && (
        <TouchableOpacity
          style={[
            styles.fab,
            { backgroundColor: colors.tint, bottom: insets.bottom + 24 },
          ]}
          onPress={handleSend}
          activeOpacity={0.8}
        >
          <ArrowRight size={24} color={isDark ? "#121212" : "#FFFFFF"} />
        </TouchableOpacity>
      )}
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
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  searchContainer: {
    padding: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  username: {
    fontSize: 16,
    fontWeight: "600",
  },
  email: {
    fontSize: 14,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  checked: {},
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
});
