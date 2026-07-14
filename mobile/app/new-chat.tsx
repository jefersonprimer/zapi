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
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import {
  createChat,
  searchUsers,
  type UserSearchResult,
} from "@/services/api";
import { useAppTheme } from "@/context/ThemeContext";
import { ArrowLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function NewChatScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
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
      Alert.alert("Erro", err.message);
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
      router.replace({
        pathname: "/chat",
        params: {
          chatId: data.id,
          participantId: userId,
          participantUsername: chosenUser?.username ?? "Unknown",
          participantAvatarUrl: chosenUser?.avatar_url ?? "",
        },
      });
    } catch (err: any) {
      Alert.alert("Erro", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Custom Header */}
      <View style={[styles.customHeader, { paddingTop: insets.top, backgroundColor: colors.headerBackground }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color={colors.headerText} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: colors.headerText }]}>Nova Conversa</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            placeholder="Buscar por usuário ou email..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={[styles.searchBtn, { backgroundColor: colors.tint }]} onPress={handleSearch}>
            {searching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.searchBtnText}>Buscar</Text>
            )}
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator style={{ marginTop: 20 }} color={colors.tint} />}

        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          style={{ marginTop: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.userItem, { borderBottomColor: colors.border }]}
              onPress={() => handleSelectUser(item.id)}
            >
              <View style={[styles.avatar, { backgroundColor: colors.tint }]}>
                <Text style={styles.avatarText}>
                  {(item.name || item.username)[0].toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={[styles.username, { color: colors.text }]}>
                  {item.name || item.username}
                </Text>
                <Text style={[styles.usernameHandle, { color: colors.textSecondary }]}>
                  @{item.username}
                </Text>
                <Text style={[styles.email, { color: colors.textSecondary }]}>{item.email}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            query.trim() && !searching ? (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>Nenhum usuário encontrado</Text>
            ) : null
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24 },
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
  searchRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
  },
  searchBtn: {
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
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  username: { fontSize: 16, fontWeight: "600" },
  usernameHandle: { fontSize: 13, marginTop: 1 },
  email: { fontSize: 14, marginTop: 2 },
  empty: { textAlign: "center", marginTop: 40 },
});
