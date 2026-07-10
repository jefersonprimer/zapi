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
  createGroup,
  searchUsers,
  type UserSearchResult,
} from "@/services/api";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

export default function NewGroupScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
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
      Alert.alert("Erro", err.message);
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
      router.replace({
        pathname: "/chat",
        params: {
          chatId: data.id,
          participantUsername: data.name,
        },
      });
    } catch (err: any) {
      Alert.alert("Erro", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: 0 }]}>
      {/* Custom Header */}
      <View style={[styles.customHeader, { paddingTop: insets.top, backgroundColor: colors.headerBackground }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color={colors.headerText} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: colors.headerText }]}>Novo Grupo</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Nome do grupo"
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Adicionar membros</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            placeholder="Buscar usuários..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
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

        {selected.size > 0 && (
          <View style={[styles.selectedRow, { backgroundColor: isDark ? "rgba(10, 132, 255, 0.15)" : "#e8f0fe" }]}>
            <Text style={[styles.selectedText, { color: colors.text }]}>
              Selecionados: {Array.from(selected.values()).join(", ")}
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
                style={[styles.userItem, { borderBottomColor: colors.border }]}
                onPress={() => toggleUser(item)}
              >
                <View style={[styles.checkbox, { borderColor: colors.border }, isSelected && [styles.checked, { backgroundColor: colors.tint, borderColor: colors.tint }]]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={[styles.avatar, { backgroundColor: colors.tint }]}>
                  <Text style={styles.avatarText}>
                    {item.username[0].toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.username, { color: colors.text }]}>{item.username}</Text>
                  <Text style={[styles.email, { color: colors.textSecondary }]}>{item.email}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        <TouchableOpacity
          style={[
            styles.createBtn,
            { backgroundColor: colors.tint, marginBottom: Math.max(insets.bottom, 24) },
            (!name.trim() || selected.size === 0) && styles.createBtnDisabled,
          ]}
          onPress={handleCreate}
          disabled={!name.trim() || selected.size === 0 || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>Criar Grupo</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
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
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
  },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  searchBtn: {
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  searchBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  selectedRow: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  selectedText: { fontSize: 14 },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checked: {},
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "bold" },
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
  email: { fontSize: 14, marginTop: 2 },
  createBtn: {
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
