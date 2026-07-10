import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Users as GroupIcon,
  UserPlus as UserIcon,
  Trash2 as TrashIcon,
  MessageCircle,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { getContacts, removeContact, createChat, type Contact } from "@/services/api";
import { useAppTheme } from "@/context/ThemeContext";

export default function ContactsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchContacts = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getContacts(token);
      setContacts(data);
    } catch (err: any) {
      console.error("Failed to fetch contacts:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchContacts();
    }, [fetchContacts])
  );

  async function handleStartChat(contact: Contact) {
    if (!token) return;
    setActionLoading(true);
    try {
      const data = await createChat(token, contact.contact_id);
      router.push({
        pathname: "/chat",
        params: {
          chatId: data.id,
          participantId: contact.contact_id,
          participantUsername: contact.username,
        },
      });
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Não foi possível abrir o chat.");
    } finally {
      setActionLoading(false);
    }
  }

  function handleConfirmRemove(contact: Contact) {
    Alert.alert(
      "Remover Contato",
      `Deseja realmente remover ${contact.username} dos seus contatos?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            try {
              await removeContact(token, contact.contact_id);
              setContacts((prev) => prev.filter((c) => c.contact_id !== contact.contact_id));
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Não foi possível remover o contato.");
            }
          },
        },
      ]
    );
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <TouchableOpacity
        style={[styles.actionItem, { borderBottomColor: colors.border }]}
        onPress={() => router.push("/new-group")}
      >
        <View style={[styles.iconContainer, styles.groupBg]}>
          <GroupIcon color="#fff" size={22} />
        </View>
        <Text style={[styles.actionText, { color: colors.text }]}>Novo grupo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionItem, { borderBottomColor: colors.border }]}
        onPress={() => router.push("/new-chat")}
      >
        <View style={[styles.iconContainer, styles.userBg, { backgroundColor: colors.tint }]}>
          <UserIcon color="#fff" size={22} />
        </View>
        <Text style={[styles.actionText, { color: colors.text }]}>Novo contato</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Contatos adicionados</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {actionLoading && (
        <View style={[styles.overlayLoading, { backgroundColor: colors.modalOverlay }]}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      )}

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.contact_id}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <View style={[styles.contactRow, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={styles.contactInfo}
              onPress={() => handleStartChat(item)}
            >
              <View style={[styles.avatar, { backgroundColor: isDark ? "#2C2C2E" : "#e5e5ea" }]}>
                <Text style={[styles.avatarText, { color: colors.text }]}>
                  {item.username[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.username, { color: colors.text }]}>{item.username}</Text>
                <Text style={[styles.email, { color: colors.textSecondary }]}>{item.email}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.rowActions}>
              <TouchableOpacity
                style={[styles.chatIconBtn, { backgroundColor: colors.surface }]}
                onPress={() => handleStartChat(item)}
              >
                <MessageCircle size={20} color={colors.tint} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.removeBtn, { backgroundColor: isDark ? "rgba(255, 69, 58, 0.15)" : "#ffeaea" }]}
                onPress={() => handleConfirmRemove(item)}
              >
                <TrashIcon size={20} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum contato adicionado ainda.</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Busque usuários no botão &quot;Novo contato&quot; acima.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
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
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  groupBg: {
    backgroundColor: "#34C759",
  },
  userBg: {
    backgroundColor: "#007AFF",
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 24,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contactInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  textContainer: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: "600",
  },
  email: {
    fontSize: 14,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  chatIconBtn: {
    padding: 8,
    borderRadius: 18,
    marginRight: 8,
  },
  removeBtn: {
    padding: 8,
    borderRadius: 18,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
});
