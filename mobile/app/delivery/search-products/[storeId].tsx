import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useCartStore, MIN_WEIGHT } from "@/store/useCartStore";
import {
  getStore,
  StoreProduct,
  Store as StoreType,
} from "@/services/deliveryApi";
import { FoodProductCard } from "@/components/FoodProductCard";

export default function StoreSearchScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();
  const {
    storeId: cartStoreId,
    storeName: cartStoreName,
    items,
    addItem,
    updateQuantity,
    removeItem,
  } = useCartStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [store, setStore] = useState<StoreType | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStoreData() {
      if (!token || !storeId) return;
      try {
        const data = await getStore(token, storeId);
        setStore(data.store);
        setProducts(data.products.filter((p) => p.is_available));
      } catch (err) {
        console.error("Failed to load products for search:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStoreData();
  }, [token, storeId]);

  const getItemQty = (productId: string) => {
    if (cartStoreId !== storeId) return 0;
    const item = items.find((i) => i.productId === productId);
    return item?.quantity || 0;
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        (p.category?.toLowerCase().includes(q) ?? false),
    );
  }, [products, searchQuery]);

  const addProductToCart = (
    product: StoreProduct,
    addons: { id: string; name: string; price: number }[],
    quantity: number,
  ) => {
    if (!store) return;
    const saleType = product.sale_type || "unit";
    const cartItem = {
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      saleType,
      image: product.image || undefined,
      addons,
    };

    if (cartStoreId && cartStoreId !== storeId) {
      Alert.alert(
        "Trocar de loja?",
        `Você já tem itens de "${cartStoreName}" no carrinho. Trocar de loja limpará o carrinho.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Trocar",
            onPress: () => {
              useCartStore.getState().clearCart();
              addItem(storeId!, store.name, cartItem);
            },
          },
        ],
      );
      return;
    }

    addItem(storeId!, store.name, cartItem);
  };

  const quickAddToCart = (product: StoreProduct) => {
    const saleType = product.sale_type || "unit";
    const quantity = saleType === "weight" ? MIN_WEIGHT : 1;
    addProductToCart(product, [], quantity);
  };

  const openProductDetail = (product: StoreProduct) => {
    router.push({
      pathname: "/delivery/product/[productId]",
      params: { productId: product.id, storeId },
    });
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "left", "right"]}
    >
      {/* Header containing search bar */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.headerBackground,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="chevron-back-outline"
            color={colors.headerText}
            size={24}
          />
        </TouchableOpacity>

        <View
          style={[
            styles.searchInputBox,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <MaterialCommunityIcons
            name="magnify"
            color={colors.icon}
            size={20}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={
              store
                ? `Buscar em ${store.name}...`
                : "Buscar produtos na loja..."
            }
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoFocus={true}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
              <MaterialCommunityIcons
                name="close"
                color={colors.icon}
                size={20}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList
          key="search-grid"
          data={searchResults}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {searchQuery.trim().length > 0 ? (
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  Nenhum produto encontrado
                </Text>
              ) : (
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  Digite para buscar produtos nesta loja
                </Text>
              )}
            </View>
          }
          renderItem={({ item: product }) => (
            <FoodProductCard
              product={product}
              qty={getItemQty(product.id)}
              onPress={() => openProductDetail(product)}
              onUpdateQty={(newQty) => updateQuantity(product.id, newQty)}
              onRemove={() => removeItem(product.id)}
              onAddPress={() => {
                if (product.has_addons || product.addon_categories?.length) {
                  openProductDetail(product);
                } else {
                  quickAddToCart(product);
                }
              }}
              layout="vertical"
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButton: {
    padding: 8,
  },
  searchInputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 40,
    marginLeft: 4,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    marginLeft: 8,
    fontSize: 15,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
  },
});
