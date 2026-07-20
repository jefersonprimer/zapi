import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, Plus, Trash2, Edit3, Check, X, FolderOpen } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  getVendorStore,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  StoreProductCategory,
  SUGGESTED_PRODUCT_CATEGORIES,
} from "@/services/deliveryApi";

export default function VendorCategoriesScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();

  const [storeId, setStoreId] = useState<string | null>(null);
  const [categories, setCategories] = useState<StoreProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const storeData = await getVendorStore(token);
      if (storeData.store) {
        setStoreId(storeData.store.id);
        const data = await listCategories(token, storeData.store.id);
        setCategories(data.categories);
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleCreate = async (name?: string) => {
    if (!token || !storeId) return;
    const trimmed = (name ?? newName).trim();
    if (!trimmed) {
      Alert.alert("Erro", "Nome da categoria é obrigatório");
      return;
    }
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert("Erro", "Essa categoria já existe");
      return;
    }
    setSaving(true);
    try {
      await createCategory(token, storeId, { name: trimmed });
      setNewName("");
      loadData();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao criar categoria");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!token || !editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert("Erro", "Nome da categoria é obrigatório");
      return;
    }
    setSaving(true);
    try {
      await updateCategory(token, editingId, { name: trimmed });
      setEditingId(null);
      setEditName("");
      loadData();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao atualizar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (cat: StoreProductCategory) => {
    Alert.alert(
      "Excluir categoria?",
      `"${cat.name}" será removida. Produtos desta categoria ficarão sem categoria.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            try {
              await deleteCategory(token, cat.id);
              loadData();
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Falha ao excluir");
            }
          },
        },
      ]
    );
  };

  const unusedSuggestions = SUGGESTED_PRODUCT_CATEGORIES.filter(
    (s) => !categories.some((c) => c.name.toLowerCase() === s.toLowerCase())
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Categorias</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor={colors.tint}
            />
          }
          ListHeaderComponent={
            <>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                Organize o cardápio em seções como Frutas, Legumes e Perecíveis — ideal para mercados e mercearias.
              </Text>

              <View style={[styles.createRow, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Nova categoria"
                  placeholderTextColor={colors.textSecondary}
                  onSubmitEditing={() => handleCreate()}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: colors.tint, opacity: saving ? 0.6 : 1 }]}
                  onPress={() => handleCreate()}
                  disabled={saving}
                >
                  {saving && !editingId ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Plus color="#fff" size={20} />
                  )}
                </TouchableOpacity>
              </View>

              {unusedSuggestions.length > 0 && (
                <View style={styles.suggestions}>
                  <Text style={[styles.suggestionsTitle, { color: colors.textSecondary }]}>Sugestões</Text>
                  <View style={styles.suggestionWrap}>
                    {unusedSuggestions.map((name) => (
                      <TouchableOpacity
                        key={name}
                        style={[styles.suggestionChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={() => handleCreate(name)}
                      >
                        <Plus color={colors.tint} size={12} />
                        <Text style={{ color: colors.text, fontSize: 13 }}>{name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Suas categorias ({categories.length})
              </Text>
            </>
          }
          renderItem={({ item }) => {
            const isEditing = editingId === item.id;
            return (
              <View style={[styles.catCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                {isEditing ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10 }]}
                      value={editName}
                      onChangeText={setEditName}
                      autoFocus
                    />
                    <TouchableOpacity onPress={handleUpdate} disabled={saving}>
                      <Check color={colors.tint} size={22} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditingId(null); setEditName(""); }}>
                      <X color={colors.textSecondary} size={22} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.catInfo}>
                      <FolderOpen color={colors.tint} size={18} />
                      <Text style={[styles.catName, { color: colors.text }]}>{item.name}</Text>
                    </View>
                    <View style={styles.catActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingId(item.id);
                          setEditName(item.name);
                        }}
                      >
                        <Edit3 color={colors.tint} size={18} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(item)}>
                        <Trash2 color={colors.danger} size={18} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <FolderOpen color={colors.icon} size={48} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Nenhuma categoria ainda. Use as sugestões ou crie a sua.
              </Text>
            </View>
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 50,
    paddingBottom: 12,
  },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "600", marginHorizontal: 8, textAlign: "center" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 12 },
  addBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestions: { marginBottom: 20 },
  suggestionsTitle: { fontSize: 12, fontWeight: "600", marginBottom: 8, textTransform: "uppercase" },
  suggestionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 10 },
  catCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  catInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  catName: { fontSize: 15, fontWeight: "500" },
  catActions: { flexDirection: "row", gap: 14 },
  editRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  empty: { alignItems: "center", paddingTop: 40, gap: 12 },
  emptyText: { fontSize: 14, textAlign: "center", paddingHorizontal: 24 },
});
