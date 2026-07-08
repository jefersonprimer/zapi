import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { getChats, type ChatListItem } from "../services/api";

type Props = {
  navigation: any;
};

export default function ChatListScreen({ navigation }: Props) {
  const { signOut, token } = useAuth();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);

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
            onPress={() => navigation.navigate("NewGroup")}
            style={styles.newChatBtn}
          >
            <Text style={styles.newChatBtnText}>G</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("NewChat")}
            style={styles.newChatBtn}
          >
            <Text style={styles.newChatBtnText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut}>
            <Text style={styles.logout}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

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
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.last_message ?? "No messages yet"}
                </Text>
              </View>
              <Text style={styles.time}>{formatTime(item.last_message_at)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
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
  time: { fontSize: 12, color: "#bbb", marginLeft: 8 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 18, color: "#999", marginBottom: 4 },
  emptySubtext: { fontSize: 14, color: "#ccc" },
});
