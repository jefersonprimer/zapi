import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import {
  createChat,
  searchUsers,
  type UserSearchResult,
} from "../services/api";

type Props = {
  navigation: any;
};

export default function NewChatScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  async function handleSearch() {
    if (!query.trim() || !token) return;
    setSearching(true);
    try {
      const data = await searchUsers(token, query.trim());
      setUsers(data.users);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSearching(false);
    }
  }

  async function handleSelectUser(userId: string) {
    if (!token) return;
    setLoading(true);
    try {
      const data = await createChat(token, userId);
      const chosenUser = users.find((u) => u.id === userId);
      navigation.replace("Chat", {
        chatId: data.id,
        participantId: userId,
        participantUsername: chosenUser?.username ?? "Unknown",
      });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Conversation</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search by username or email..."
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          {searching ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.searchBtnText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        style={{ marginTop: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userItem}
            onPress={() => handleSelectUser(item.id)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.username[0].toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.username}>{item.username}</Text>
              <Text style={styles.email}>{item.email}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          query.trim() && !searching ? (
            <Text style={styles.empty}>No users found</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 24 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 24,
  },
  searchRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
  },
  searchBtn: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  searchBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  username: { fontSize: 16, fontWeight: "600", color: "#333" },
  email: { fontSize: 14, color: "#666", marginTop: 2 },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
});
