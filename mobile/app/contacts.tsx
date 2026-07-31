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
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import {
  getContacts,
  removeContact,
  createChat,
  type Contact,
} from "@/services/api";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserContactCard } from "@/components/UserContactCard";
import { UserContactModal } from "@/components/UserContactModal";

export default function ContactsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

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
    }, [fetchContacts]),
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
          participantAvatarUrl: contact.avatar_url || "",
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
              setContacts((prev) =>
                prev.filter((c) => c.contact_id !== contact.contact_id),
              );
            } catch (err: any) {
              Alert.alert(
                "Erro",
                err.message || "Não foi possível remover o contato.",
              );
            }
          },
        },
      ],
    );
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <TouchableOpacity
        style={[styles.actionItem, { borderBottomColor: colors.border }]}
        onPress={() => router.push("/new-group")}
      >
        <View style={[styles.iconContainer, styles.groupBg]}>
          <MaterialCommunityIcons name="account-group" color="#fff" size={24} />
        </View>
        <Text style={[styles.actionText, { color: colors.text }]}>
          Conversas em Grupo
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionItem, { borderBottomColor: colors.border }]}
        onPress={() => router.push("/new-chat")}
      >
        <View
          style={[
            styles.iconContainer,
            styles.userBg,
            { backgroundColor: "#FA9E3B" },
          ]}
        >
          <MaterialCommunityIcons name="account-plus" color="#fff" size={24} />
        </View>
        <Text style={[styles.actionText, { color: colors.text }]}>
          Novos Amigos
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionItem, { borderBottomColor: colors.border }]}
        onPress={() => router.push("/link-device?mode=scan")}
      >
        <View style={[styles.iconContainer, { backgroundColor: "#FF9500" }]}>
          <MaterialCommunityIcons name="qrcode-scan" color="#fff" size={24} />
        </View>
        <Text style={[styles.actionText, { color: colors.text }]}>
          Escanear QR Code
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionItem, { borderBottomColor: colors.border }]}
        onPress={() => router.push("/my-qr")}
      >
        <View style={[styles.iconContainer, { backgroundColor: "#5856D6" }]}>
          <MaterialCommunityIcons name="qrcode" color="#fff" size={24} />
        </View>
        <Text style={[styles.actionText, { color: colors.text }]}>
          Meu QR Code
        </Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        Amigos adicionados
      </Text>
    </View>
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.headerText}
            />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: colors.headerText }]}>
              Contatos
            </Text>
            {!loading && (
              <Text
                style={[styles.headerSubtitle, { color: colors.headerText }]}
              >
                {contacts.length} contato{contacts.length === 1 ? "" : "s"}
              </Text>
            )}
          </View>
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
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.contact_id}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => (
            <UserContactCard
              avatarUrl={item.avatar_url}
              username={item.username}
              email={item.email}
              onPress={() => handleStartChat(item)}
              onLongPress={() => {
                setSelectedContact(item);
                setModalVisible(true);
              }}
              containerStyle={styles.contactRow}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Nenhum contato adicionado ainda.
              </Text>
              <Text
                style={[styles.emptySubtext, { color: colors.textSecondary }]}
              >
                Busque usuários no botão &quot;Novo contato&quot; acima.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      <UserContactModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onStartChat={() => {
          if (selectedContact) handleStartChat(selectedContact);
        }}
        onCreateGroup={() => {
          if (selectedContact) {
            router.push({
              pathname: "/new-group",
              params: {
                preselectedContactId: selectedContact.contact_id,
                preselectedUsername: selectedContact.username,
                preselectedName: selectedContact.name || "",
                preselectedEmail: selectedContact.email || "",
                preselectedAvatarUrl: selectedContact.avatar_url || "",
              },
            });
          } else {
            router.push("/new-group");
          }
        }}
        onRemoveContact={() => {
          if (selectedContact) handleConfirmRemove(selectedContact);
        }}
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
    padding: 4,
    marginRight: 16,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
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
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  groupBg: {
    backgroundColor: "#07C160",
  },
  userBg: {
    backgroundColor: "#FA9E3B",
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 24,
    marginBottom: 10,
  },
  contactRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
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
