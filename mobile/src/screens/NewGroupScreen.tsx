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
  createGroup,
  searchUsers,
  type UserSearchResult,
} from "../services/api";

type Props = {
  navigation: any;
};

export default function NewGroupScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
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

  function toggleUser(user: UserSearchResult) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(user.id)) {
        next.delete(user.id);
      } else {
        next.set(user.id, user.username);
      }
      return next;
    });
  }

  async function handleCreate() {
    if (!name.trim() || selected.size === 0 || !token) return;

    setLoading(true);
    try {
      const data = await createGroup(token, name, Array.from(selected.keys()));
      navigation.replace("Chat", {
        chatId: data.id,
        participantUsername: data.name,
      });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Group</Text>

      <TextInput
        style={styles.input}
        placeholder="Group name"
        placeholderTextColor="#999"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.sectionTitle}>Add members</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search users..."
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
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

      {selected.size > 0 && (
        <View style={styles.selectedRow}>
          <Text style={styles.selectedText}>
            Selected: {Array.from(selected.values()).join(", ")}
          </Text>
        </View>
      )}

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              style={styles.userItem}
              onPress={() => toggleUser(item)}
            >
              <View style={[styles.checkbox, isSelected && styles.checked]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
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
          );
        }}
      />

      <TouchableOpacity
        style={[
          styles.createBtn,
          (!name.trim() || selected.size === 0) && styles.createBtnDisabled,
        ]}
        onPress={handleCreate}
        disabled={!name.trim() || selected.size === 0 || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createBtnText}>Create Group</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 24 },
  title: { fontSize: 24, fontWeight: "bold", color: "#333", marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#666", marginBottom: 12, marginTop: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
  },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  searchBtn: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  searchBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  selectedRow: {
    backgroundColor: "#e8f0fe",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  selectedText: { color: "#333", fontSize: 14 },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checked: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "bold" },
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
  createBtn: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
