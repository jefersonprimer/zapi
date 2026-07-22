import React, { useState, useCallback, useMemo } from "react";
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
  Image,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Search,
  X,
  Pencil,
  Check,
  ExternalLink,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { getFullRemoteUrl } from "@/services/mediaCache";
import {
  getVendorStore,
  listProducts,
  updateProduct,
  StoreProduct,
  formatProductPrice,
} from "@/services/deliveryApi";

const DASHBOARD_WEB_URL = "http://192.168.5.22:3001/dashboard";

export default function VendorProductsScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceValue, setPriceValue] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const storeData = await getVendorStore(token);
      if (storeData.store) {
        const prodData = await listProducts(token, storeData.store.id);
        setProducts(prodData.products);
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
    }, [loadData]),
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q),
    );
  }, [products, searchQuery]);

  const handleToggleAvailable = async (product: StoreProduct) => {
    if (!token) return;
    try {
      await updateProduct(token, product.id, {
        is_available: !product.is_available,
      });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, is_available: !p.is_available } : p,
        ),
      );
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao atualizar");
    }
  };

  const startEditPrice = (product: StoreProduct) => {
    setEditingPriceId(product.id);
    setPriceValue(product.price.toString().replace(".", ","));
  };

  const savePrice = async (product: StoreProduct) => {
    if (!token) return;
    const price = parseFloat(priceValue.replace(",", "."));
    if (isNaN(price) || price <= 0) {
      Alert.alert("Erro", "Preço deve ser maior que 0");
      return;
    }
    setSavingPrice(true);
    try {
      await updateProduct(token, product.id, { price });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, price } : p)),
      );
      setEditingPriceId(null);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao atualizar preço");
    } finally {
      setSavingPrice(false);
    }
  };

  const renderProduct = ({ item }: { item: StoreProduct }) => {
    const isEditing = editingPriceId === item.id;
    return (
      <View
        style={[
          styles.productCard,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.productHeader}>
          {item.image ? (
            <Image
              source={{ uri: getFullRemoteUrl(item.image) }}
              style={styles.productThumb}
            />
          ) : (
            <View
              style={[
                styles.productThumbPlaceholder,
                { backgroundColor: colors.surface },
              ]}
            >
              <Text style={{ color: colors.icon, fontSize: 18 }}>
                {item.name.charAt(0)}
              </Text>
            </View>
          )}
          <View style={styles.productInfo}>
            <Text
              style={[styles.productName, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {item.description ? (
              <Text
                style={[styles.productDesc, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.description}
              </Text>
            ) : null}
            <View style={styles.priceRow}>
              {isEditing ? (
                <View style={styles.priceEditRow}>
                  <TextInput
                    style={[
                      styles.priceInput,
                      {
                        color: colors.text,
                        borderColor: colors.tint,
                      },
                    ]}
                    value={priceValue}
                    onChangeText={setPriceValue}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[
                      styles.priceSaveBtn,
                      { backgroundColor: colors.tint },
                    ]}
                    onPress={() => savePrice(item)}
                    disabled={savingPrice}
                  >
                    {savingPrice ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Check color="#fff" size={16} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.priceCancelBtn}
                    onPress={() => setEditingPriceId(null)}
                  >
                    <X color={colors.icon} size={16} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.priceDisplay}
                  onPress={() => startEditPrice(item)}
                >
                  <Text style={[styles.productPrice, { color: colors.tint }]}>
                    {formatProductPrice(item.price, item.sale_type || "unit")}
                  </Text>
                  <Pencil color={colors.tint} size={12} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              {
                backgroundColor: item.is_available ? "#10B98120" : "#EF444420",
              },
            ]}
            onPress={() => handleToggleAvailable(item)}
          >
            {item.is_available ? (
              <Eye color="#10B981" size={20} />
            ) : (
              <EyeOff color="#EF4444" size={20} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { backgroundColor: colors.headerBackground }]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>
          Produtos
        </Text>
        <TouchableOpacity
          style={[styles.dashboardBtn, { backgroundColor: colors.surface }]}
          onPress={() => {
            Linking.openURL(DASHBOARD_WEB_URL);
          }}
        >
          <ExternalLink color={colors.headerText} size={18} />
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
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
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
                  <TouchableOpacity
                    onPress={() => setSearchQuery("")}
                    hitSlop={8}
                  >
                    <X color={colors.icon} size={16} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            renderItem={renderProduct}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
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
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {searchQuery.trim() ? "Nenhum resultado" : "Nenhum produto"}
                </Text>
                <Text
                  style={[
                    styles.emptySubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  {searchQuery.trim()
                    ? "Nenhum produto encontrado"
                    : "Cadastre produtos no Dashboard Web"}
                </Text>
                {!searchQuery.trim() && (
                  <TouchableOpacity
                    style={[
                      styles.dashboardLinkBtn,
                      { backgroundColor: colors.tint },
                    ]}
                    onPress={() => {
                      Linking.openURL(DASHBOARD_WEB_URL);
                    }}
                  >
                    <ExternalLink color="#fff" size={16} />
                    <Text style={styles.dashboardLinkText}>
                      Abrir Dashboard
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        </>
      )}
    </View>
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
    gap: 8,
  },
  backButton: { padding: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    marginHorizontal: 4,
  },
  dashboardBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
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
    alignItems: "center",
  },
  productThumb: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
  productThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  productInfo: { flex: 1, marginRight: 8 },
  productName: { fontSize: 15, fontWeight: "600" },
  productDesc: { fontSize: 12, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  priceDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  productPrice: { fontSize: 15, fontWeight: "700" },
  priceEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  priceInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    width: 90,
    fontWeight: "600",
  },
  priceSaveBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  priceCancelBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  dashboardLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  dashboardLinkText: { color: "#fff", fontWeight: "600" },
});
