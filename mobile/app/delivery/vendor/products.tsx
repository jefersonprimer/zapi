import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  X,
  Check,
  Camera,
  Puzzle,
  FolderOpen,
  Scale,
  Search,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import ImagePickerModal from "@/components/ImagePickerModal";
import { uploadImage } from "@/services/api";
import { getFullRemoteUrl } from "@/services/mediaCache";
import {
  getVendorStore,
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  listProductAddons,
  createProductAddon,
  updateProductAddon,
  deleteProductAddon,
  createCategory,
  StoreProduct,
  StoreProductCategory,
  ProductAddon,
  SaleType,
  formatProductPrice,
  PRODUCT_CATEGORIES,
} from "@/services/deliveryApi";

function isLocalImageUri(uri: string): boolean {
  return (
    uri.startsWith("file://") ||
    uri.startsWith("content://") ||
    uri.startsWith("ph://") ||
    uri.startsWith("assets-library://")
  );
}

function categoryLabel(name: string): string {
  return PRODUCT_CATEGORIES[name] || name;
}

export default function VendorProductsScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreProductCategory[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState(24);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formImage, setFormImage] = useState<string | null>(null);
  const [formCategoryId, setFormCategoryId] = useState<string | null>(null);
  const [formSaleType, setFormSaleType] = useState<SaleType>("unit");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [imageRemoved, setImageRemoved] = useState(false);

  const [addonModalVisible, setAddonModalVisible] = useState(false);
  const [addonProduct, setAddonProduct] = useState<StoreProduct | null>(null);
  const [addons, setAddons] = useState<ProductAddon[]>([]);
  const [addonName, setAddonName] = useState("");
  const [addonPrice, setAddonPrice] = useState("");
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null);
  const [loadingAddons, setLoadingAddons] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLimit(24);
    try {
      const storeData = await getVendorStore(token);
      if (storeData.store) {
        setStoreId(storeData.store.id);
        const prodData = await listProducts(token, storeData.store.id);
        setProducts(prodData.products);
        setCategories(prodData.categories || []);
      }
    } catch (err) {
      console.error("Failed to load products:", err);
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

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const name = p.name.toLowerCase();
      const desc = (p.description || "").toLowerCase();
      const category = categoryLabel(p.category || "").toLowerCase();
      return name.includes(q) || desc.includes(q) || category.includes(q);
    });
  }, [products, searchQuery]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, limit);
  }, [filteredProducts, limit]);

  useEffect(() => {
    setLimit(24);
  }, [searchQuery]);

  const openForm = (product?: StoreProduct) => {
    if (product) {
      setEditingId(product.id);
      setFormName(product.name);
      setFormDesc(product.description || "");
      setFormPrice(product.price.toString());
      setFormImage(product.image);
      setFormCategoryId(product.category_id);
      setFormSaleType(product.sale_type || "unit");
      setImageRemoved(false);
    } else {
      setEditingId(null);
      setFormName("");
      setFormDesc("");
      setFormPrice("");
      setFormImage(null);
      setFormCategoryId(categories[0]?.id ?? null);
      setFormSaleType("unit");
      setImageRemoved(false);
    }
    setNewCategoryName("");
    setShowForm(true);
  };

  const resolveImageForSave = async (): Promise<string | undefined> => {
    if (!token) return undefined;
    if (formImage && isLocalImageUri(formImage)) {
      const uploaded = await uploadImage(token, formImage);
      return uploaded.url;
    }
    if (imageRemoved) return "";
    if (formImage) return formImage;
    return undefined;
  };

  const handleCreateCategoryInline = async () => {
    if (!token || !storeId) return;
    const name = newCategoryName.trim();
    if (!name) {
      Alert.alert("Erro", "Nome da categoria é obrigatório");
      return;
    }
    setCreatingCategory(true);
    try {
      const res = await createCategory(token, storeId, { name });
      setCategories((prev) => [...prev, res.category].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
      setFormCategoryId(res.category.id);
      setNewCategoryName("");
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao criar categoria");
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSave = async () => {
    if (!token || !storeId) return;
    if (!formName.trim()) {
      Alert.alert("Erro", "Nome do produto é obrigatório");
      return;
    }
    const price = parseFloat(formPrice.replace(",", "."));
    if (isNaN(price) || price <= 0) {
      Alert.alert("Erro", "Preço deve ser maior que 0");
      return;
    }

    setSaving(true);
    try {
      const image = await resolveImageForSave();
      const payload = {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        price,
        category_id: formCategoryId || undefined,
        sale_type: formSaleType,
        ...(image !== undefined ? { image } : {}),
      };
      if (editingId) {
        await updateProduct(token, editingId, {
          ...payload,
          category_id: formCategoryId,
        });
      } else {
        await createProduct(token, storeId, payload);
      }
      setShowForm(false);
      loadData();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao salvar produto");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailable = async (product: StoreProduct) => {
    if (!token) return;
    try {
      await updateProduct(token, product.id, { is_available: !product.is_available });
      loadData();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao atualizar");
    }
  };

  const handleDelete = (product: StoreProduct) => {
    Alert.alert("Deletar produto?", `"${product.name}" será removido permanentemente.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Deletar",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          try {
            await deleteProduct(token, product.id);
            loadData();
          } catch (err: any) {
            Alert.alert("Erro", err.message || "Falha ao deletar");
          }
        },
      },
    ]);
  };

  const openAddons = async (product: StoreProduct) => {
    setAddonProduct(product);
    setAddonName("");
    setAddonPrice("");
    setEditingAddonId(null);
    setAddonModalVisible(true);
    setLoadingAddons(true);
    try {
      const data = await listProductAddons(token!, product.id);
      setAddons(data.addons);
    } catch {
      setAddons([]);
    } finally {
      setLoadingAddons(false);
    }
  };

  const handleSaveAddon = async () => {
    if (!token || !addonProduct) return;
    if (!addonName.trim()) {
      Alert.alert("Erro", "Nome do adicional é obrigatório");
      return;
    }
    const price = parseFloat(addonPrice.replace(",", "."));
    if (isNaN(price) || price < 0) {
      Alert.alert("Erro", "Preço deve ser maior ou igual a 0");
      return;
    }
    try {
      if (editingAddonId) {
        await updateProductAddon(token, editingAddonId, { name: addonName.trim(), price });
      } else {
        await createProductAddon(token, addonProduct.id, { name: addonName.trim(), price });
      }
      setAddonName("");
      setAddonPrice("");
      setEditingAddonId(null);
      const data = await listProductAddons(token!, addonProduct.id);
      setAddons(data.addons);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao salvar adicional");
    }
  };

  const handleDeleteAddon = (addon: ProductAddon) => {
    Alert.alert("Deletar adicional?", `"${addon.name}" será removido.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Deletar",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          try {
            await deleteProductAddon(token, addon.id);
            setAddons((prev) => prev.filter((a) => a.id !== addon.id));
          } catch (err: any) {
            Alert.alert("Erro", err.message || "Falha ao deletar");
          }
        },
      },
    ]);
  };

  const renderProduct = ({ item }: { item: StoreProduct }) => {
    const saleType = item.sale_type || "unit";
    return (
      <View style={[styles.productCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.productHeader}>
          {item.image ? (
            <Image source={{ uri: getFullRemoteUrl(item.image) }} style={styles.productThumb} />
          ) : (
            <View style={[styles.productThumbPlaceholder, { backgroundColor: colors.surface }]}>
              <Camera color={colors.icon} size={20} />
            </View>
          )}
          <View style={styles.productInfo}>
            <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            {item.description ? (
              <Text style={[styles.productDesc, { color: colors.textSecondary }]} numberOfLines={1}>{item.description}</Text>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              <Text style={[styles.productPrice, { color: colors.tint }]}>
                {formatProductPrice(item.price, saleType)}
              </Text>
              {saleType === "weight" && (
                <View style={[styles.categoryBadge, { backgroundColor: "#FEF3C7" }]}>
                  <Scale color="#D97706" size={10} />
                  <Text style={[styles.categoryBadgeText, { color: "#D97706" }]}>kg</Text>
                </View>
              )}
              {item.category ? (
                <View style={[styles.categoryBadge, { backgroundColor: `${colors.tint}20` }]}>
                  <Text style={[styles.categoryBadgeText, { color: colors.tint }]}>
                    {categoryLabel(item.category)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={[styles.availabilityDot, { backgroundColor: item.is_available ? "#10B981" : "#EF4444" }]} />
        </View>
        <View style={styles.productActions}>
          <TouchableOpacity style={[styles.productAction, { backgroundColor: colors.surface }]} onPress={() => handleToggleAvailable(item)}>
            {item.is_available ? <Eye color="#10B981" size={16} /> : <EyeOff color="#EF4444" size={16} />}
            <Text style={[styles.productActionText, { color: item.is_available ? "#10B981" : "#EF4444" }]}>
              {item.is_available ? "Visível" : "Oculto"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.productAction, { backgroundColor: colors.surface }]} onPress={() => openAddons(item)}>
            <Puzzle color={colors.tint} size={16} />
            <Text style={[styles.productActionText, { color: colors.tint }]}>Adicionais</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.productAction, { backgroundColor: colors.surface }]} onPress={() => openForm(item)}>
            <Edit3 color={colors.tint} size={16} />
            <Text style={[styles.productActionText, { color: colors.tint }]}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.productAction, { backgroundColor: colors.surface }]} onPress={() => handleDelete(item)}>
            <Trash2 color={colors.danger} size={16} />
            <Text style={[styles.productActionText, { color: colors.danger }]}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Produtos</Text>
        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: colors.surface }]}
          onPress={() => router.push("/delivery/vendor/categories")}
        >
          <FolderOpen color={colors.headerText} size={18} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.tint }]} onPress={() => openForm()}>
          <Plus color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <>
          {products.length > 0 && (
            <View style={styles.searchSection}>
              <View
                style={[
                  styles.searchContainer,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Search color={colors.icon} size={18} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Buscar produto..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
                    <X color={colors.icon} size={16} />
                  </TouchableOpacity>
                )}
              </View>
              {searchQuery.trim().length > 0 && (
                <Text style={[styles.searchCount, { color: colors.textSecondary }]}>
                  {filteredProducts.length} de {products.length} produto{products.length !== 1 ? "s" : ""}
                </Text>
              )}
            </View>
          )}
          <FlatList
            data={displayedProducts}
            keyExtractor={(item) => item.id}
            renderItem={renderProduct}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.tint} />}
            onEndReached={() => {
              if (limit < filteredProducts.length) {
                setLimit((prev) => prev + 24);
              }
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={() => {
              if (limit < filteredProducts.length) {
                return (
                  <View style={{ paddingVertical: 20, alignItems: "center" }}>
                    <ActivityIndicator size="small" color={colors.tint} />
                  </View>
                );
              }
              return null;
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {searchQuery.trim().length > 0 ? (
                  <>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum resultado</Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                      Nenhum produto encontrado para &quot;{searchQuery.trim()}&quot;
                    </Text>
                    <TouchableOpacity
                      style={[styles.emptyAddButton, { backgroundColor: colors.surface }]}
                      onPress={() => setSearchQuery("")}
                    >
                      <Text style={[styles.emptyAddButtonText, { color: colors.text }]}>Limpar busca</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum produto</Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Adicione produtos ao seu cardápio</Text>
                    <TouchableOpacity style={[styles.emptyAddButton, { backgroundColor: colors.tint }]} onPress={() => openForm()}>
                      <Plus color="#fff" size={18} />
                      <Text style={styles.emptyAddButtonText}>Adicionar produto</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            }
          />
        </>
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <X color={colors.text} size={24} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingId ? "Editar produto" : "Novo produto"}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.tint} /> : <Check color={colors.tint} size={24} />}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} keyboardShouldPersistTaps="handled">
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Foto</Text>
              <TouchableOpacity
                style={[styles.imagePicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowImagePicker(true)}
                activeOpacity={0.7}
              >
                {formImage ? (
                  <Image source={{ uri: isLocalImageUri(formImage) ? formImage : getFullRemoteUrl(formImage) }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Camera color={colors.icon} size={32} />
                    <Text style={[styles.imagePlaceholderText, { color: colors.textSecondary }]}>Adicionar foto</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nome *</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={formName}
                onChangeText={setFormName}
                placeholder="Nome do produto"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tipo de venda *</Text>
              <View style={styles.saleTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.saleTypeChip,
                    {
                      backgroundColor: formSaleType === "unit" ? colors.tint : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setFormSaleType("unit")}
                >
                  <Text style={{ color: formSaleType === "unit" ? "#fff" : colors.text, fontWeight: "600" }}>
                    Por unidade
                  </Text>
                  <Text style={{ color: formSaleType === "unit" ? "#ffffffcc" : colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                    Ex: pacote, lata, unidade
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saleTypeChip,
                    {
                      backgroundColor: formSaleType === "weight" ? colors.tint : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setFormSaleType("weight")}
                >
                  <Text style={{ color: formSaleType === "weight" ? "#fff" : colors.text, fontWeight: "600" }}>
                    Por peso (kg)
                  </Text>
                  <Text style={{ color: formSaleType === "weight" ? "#ffffffcc" : colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                    Ex: frutas, carne, legumes
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Preço {formSaleType === "weight" ? "(R$/kg)" : "(R$)"} *
              </Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={formPrice}
                onChangeText={setFormPrice}
                placeholder={formSaleType === "weight" ? "Preço por quilo" : "0.00"}
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Categoria</Text>
              {categories.length === 0 ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
                  Crie categorias como Frutas, Legumes, Perecíveis…
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <TouchableOpacity
                    style={[styles.catChip, { backgroundColor: !formCategoryId ? colors.tint : colors.surface, borderColor: colors.border }]}
                    onPress={() => setFormCategoryId(null)}
                  >
                    <Text style={{ color: !formCategoryId ? "#fff" : colors.text, fontSize: 13, fontWeight: "500" }}>Sem categoria</Text>
                  </TouchableOpacity>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catChip, { backgroundColor: formCategoryId === cat.id ? colors.tint : colors.surface, borderColor: colors.border }]}
                      onPress={() => setFormCategoryId(cat.id)}
                    >
                      <Text style={{ color: formCategoryId === cat.id ? "#fff" : colors.text, fontSize: 13, fontWeight: "500" }}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View style={styles.newCatRow}>
                <TextInput
                  style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, marginBottom: 0 }]}
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholder="Nova categoria (ex: Frutas)"
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.newCatBtn, { backgroundColor: colors.tint, opacity: creatingCategory ? 0.6 : 1 }]}
                  onPress={handleCreateCategoryInline}
                  disabled={creatingCategory}
                >
                  {creatingCategory ? <ActivityIndicator color="#fff" size="small" /> : <Plus color="#fff" size={18} />}
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Descrição</Text>
              <TextInput
                style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
                value={formDesc}
                onChangeText={setFormDesc}
                placeholder="Descrição (opcional)"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={addonModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setAddonModalVisible(false)}>
                <X color={colors.text} size={24} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Adicionais — {addonProduct?.name}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border }]}
                  value={addonName}
                  onChangeText={setAddonName}
                  placeholder="Nome do adicional"
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  style={[styles.input, { width: 100, color: colors.text, borderColor: colors.border }]}
                  value={addonPrice}
                  onChangeText={setAddonPrice}
                  placeholder="R$ 0.00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: colors.tint }]}
                  onPress={handleSaveAddon}
                >
                  <Check color="#fff" size={20} />
                </TouchableOpacity>
              </View>
            </View>

            {loadingAddons ? (
              <ActivityIndicator style={{ marginTop: 32 }} color={colors.tint} />
            ) : (
              <FlatList
                data={addons}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <View style={[styles.addonRow, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "500" }}>{item.name}</Text>
                      <Text style={{ color: colors.tint, fontSize: 13 }}>R$ {item.price.toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingAddonId(item.id);
                          setAddonName(item.name);
                          setAddonPrice(item.price.toString());
                        }}
                      >
                        <Edit3 color={colors.tint} size={18} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteAddon(item)}>
                        <Trash2 color={colors.danger} size={18} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={{ color: colors.textSecondary, textAlign: "center", paddingTop: 32 }}>
                    Nenhum adicional cadastrado
                  </Text>
                }
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ImagePickerModal
        visible={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onImageSelected={(uri) => { setFormImage(uri); setImageRemoved(false); }}
        onRemoveImage={() => { setFormImage(null); setImageRemoved(true); }}
        hasImage={!!formImage}
        title="Foto do produto"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 50,
    paddingBottom: 12,
    gap: 8,
  },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "600", marginHorizontal: 4 },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  searchSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, paddingVertical: 0 },
  searchCount: { fontSize: 12, marginTop: 8, marginLeft: 2 },
  listContent: { padding: 16, paddingBottom: 32 },
  productCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  productThumb: { width: 56, height: 56, borderRadius: 10, marginRight: 12 },
  productThumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  productInfo: { flex: 1, marginRight: 8 },
  productName: { fontSize: 16, fontWeight: "600" },
  productDesc: { fontSize: 13, marginTop: 2 },
  productPrice: { fontSize: 16, fontWeight: "700" },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: "600" },
  availabilityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  imagePicker: {
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreview: { width: "100%", height: "100%" },
  imagePlaceholder: { alignItems: "center", gap: 8 },
  imagePlaceholderText: { fontSize: 14, fontWeight: "500" },
  productActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  productAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  productActionText: { fontSize: 12, fontWeight: "500" },
  emptyContainer: { alignItems: "center", paddingTop: 64, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: "center", marginBottom: 20 },
  emptyAddButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyAddButtonText: { color: "#fff", fontWeight: "600" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalContent: { maxHeight: "92%", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: "600" },
  modalBody: { maxHeight: 560 },
  modalBodyContent: { padding: 16, paddingBottom: 40 },
  fieldLabel: { fontSize: 13, fontWeight: "500", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 4,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  saleTypeRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  saleTypeChip: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  newCatRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 },
  newCatBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addonRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
});
