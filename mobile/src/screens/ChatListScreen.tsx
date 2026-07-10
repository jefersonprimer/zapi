import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { getChats, type ChatListItem } from "../services/api";
import { MessageSquare, Camera, MoreVertical } from "lucide-react-native";
import { wsClient } from "../services/ws";

type Props = {
  navigation: any;
};

export default function ChatListScreen({ navigation }: Props) {
  const { signOut, token } = useAuth();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);

  const loadChats = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getChats(token);
      setChats(data.chats);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadChats);
    return unsubscribe;
  }, [navigation, loadChats]);

  useEffect(() => {
    if (!token) return;
    const unsub = wsClient.on("chat_list_update", () => {
      loadChats();
    });
    return unsub;
  }, [token, loadChats]);

  function formatTime(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Primer Chat</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => Alert.alert("Câmera", "Câmera em desenvolvimento.")}
          >
            <Camera color="#fff" size={22} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => setMenuVisible(true)}
          >
            <MoreVertical color="#fff" size={22} />
          </TouchableOpacity>
        </View>
      </View>

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
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                Alert.alert("Configurações", "Configurações em desenvolvimento.");
              }}
            >
              <Text style={styles.menuItemText}>Configurações</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                signOut();
              }}
            >
              <Text style={[styles.menuItemText, styles.logoutText]}>Sair</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      ) : chats.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No chats yet</Text>
          <Text style={styles.emptySubtext}>
            Tap + to start a new conversation
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatItem}
              onPress={() =>
                navigation.navigate("Chat", {
                  chatId: item.id,
                  participantId: item.participant_id,
                  participantUsername: item.name ?? item.participant_username ?? "Unknown",
                })
              }
            >
              <View style={[styles.avatar, item.is_group && styles.groupAvatar]}>
                <Text style={styles.avatarText}>
                  {item.is_group
                    ? (item.name ?? "G")[0].toUpperCase()
                    : (item.participant_username ?? "?")[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.chatInfo}>
                <Text style={styles.chatName}>
                  {item.name ?? item.participant_username ?? "Unknown"}
                </Text>
                <Text
                  style={[
                    styles.lastMessage,
                    item.unread_count > 0 && styles.lastMessageUnread,
                  ]}
                  numberOfLines={1}
                >
                  {item.last_message ?? "No messages yet"}
                </Text>
              </View>
              <View style={styles.rightContainer}>
                <Text style={[styles.time, item.unread_count > 0 && styles.timeUnread]}>
                  {formatTime(item.last_message_at)}
                </Text>
                {item.unread_count > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unread_count}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("Contacts")}
      >
        <MessageSquare color="#fff" size={24} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: "#007AFF",
  },
  title: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  newChatBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  newChatBtnText: { color: "#fff", fontSize: 20, fontWeight: "bold", marginTop: -2 },
  logout: { color: "#fff", fontSize: 14 },
  groupAvatar: { backgroundColor: "#34C759" },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  chatInfo: { flex: 1 },
  chatName: { fontSize: 16, fontWeight: "600", color: "#333", marginBottom: 2 },
  lastMessage: { fontSize: 14, color: "#999" },
  lastMessageUnread: { color: "#111", fontWeight: "700" },
  time: { fontSize: 12, color: "#bbb" },
  timeUnread: { color: "#007AFF", fontWeight: "700" },
  rightContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 8,
  },
  badge: {
    backgroundColor: "#34C759",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    marginTop: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 18, color: "#999", marginBottom: 4 },
  emptySubtext: { fontSize: 14, color: "#ccc" },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  headerIcon: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  menuContainer: {
    position: "absolute",
    top: 90,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 6,
    width: 170,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  menuItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  logoutText: {
    color: "#ff3b30",
  },
});
