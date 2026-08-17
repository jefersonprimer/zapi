import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useCartStore, MIN_WEIGHT, WEIGHT_STEP } from "@/store/useCartStore";
import {
  getStore,
  listProductAddons,
  StoreProduct,
  ProductAddon,
  PRODUCT_CATEGORIES,
  formatProductPrice,
  formatQuantityLabel,
} from "@/services/deliveryApi";
import { getFullRemoteUrl } from "@/services/mediaCache";
import { GridProductCard } from "@/components/GridProductCard";

function categoryLabel(name: string): string {
  return PRODUCT_CATEGORIES[name] || name;
}

export default function ProductDetailScreen() {
  const { productId, storeId } = useLocalSearchParams<{
    productId: string;
    storeId: string;
  }>();
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    storeId: cartStoreId,
    storeName: cartStoreName,
    items,
    addItem,
    updateQuantity,
    removeItem,
    getItemCount,
    getSubtotal,
  } = useCartStore();

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<any>(null);
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [productAddons, setProductAddons] = useState<ProductAddon[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(
    new Set(),
  );
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [modalQty, setModalQty] = useState(1);

  const loadData = useCallback(async () => {
    if (!token || !storeId || !productId) return;
    try {
      const data = await getStore(token, storeId);
      setStore(data.store);
      setProducts(data.products.filter((p) => p.is_available));
      const foundProduct = data.products.find((p) => p.id === productId);
      if (foundProduct) {
        setProduct(foundProduct);
        setModalQty(foundProduct.sale_type === "weight" ? MIN_WEIGHT : 1);

        // Load Addons
        setLoadingAddons(true);
        try {
          const addonsData = await listProductAddons(token, foundProduct.id);
          setProductAddons(addonsData.addons.filter((a) => a.is_available));
        } catch {
          setProductAddons([]);
        } finally {
          setLoadingAddons(false);
        }
      }
    } catch (err) {
      console.error("Failed to load store/product detail:", err);
      Alert.alert("Erro", "Não foi possível carregar os detalhes do produto.");
    } finally {
      setLoading(false);
    }
  }, [token, storeId, productId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const relatedProducts = useMemo(() => {
    if (!product || !products.length) return [];
    return products.filter(
      (p) =>
        p.id !== product.id &&
        (product.category_id
          ? p.category_id === product.category_id
          : p.category === product.category),
    );
  }, [products, product]);

  const getItemQty = (pId: string) => {
    if (cartStoreId !== storeId) return 0;
    const item = items.find((i) => i.productId === pId);
    return item?.quantity || 0;
  };

  const toggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(addonId)) next.delete(addonId);
      else next.add(addonId);
      return next;
    });
  };

  const confirmAddToCart = () => {
    if (!product || !store) return;
    const addons = productAddons
      .filter((a) => selectedAddonIds.has(a.id))
      .map((a) => ({ id: a.id, name: a.name, price: a.price }));

    const saleType = product.sale_type || "unit";
    const cartItem = {
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: modalQty,
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
              router.back();
            },
          },
        ],
      );
      return;
    }

    addItem(storeId!, store.name, cartItem);
    Alert.alert("Sucesso", "Produto adicionado ao carrinho!");
    router.back();
  };

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!product) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={{ color: colors.textSecondary }}>
          Produto não encontrado
        </Text>
      </View>
    );
  }

  const renderGridProductCard = (item: StoreProduct, isCarousel = false) => {
    return (
      <GridProductCard
        key={item.id}
        product={item}
        qty={getItemQty(item.id)}
        isCarousel={isCarousel}
        onPress={() =>
          router.push({
            pathname: "/delivery/product/[productId]",
            params: { productId: item.id, storeId },
          })
        }
        onUpdateQty={(newQty) => updateQuantity(item.id, newQty)}
        onRemove={() => removeItem(item.id)}
        onQuickAdd={() => {
          const saleType = item.sale_type || "unit";
          const quantity = saleType === "weight" ? MIN_WEIGHT : 1;
          addItem(storeId!, store.name, {
            productId: item.id,
            name: item.name,
            price: item.price,
            quantity,
            saleType,
            image: item.image || undefined,
            addons: [],
          });
        }}
      />
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Image Container with Contain mode to never crop */}
          {product.image ? (
            <View
              style={[
                styles.imageContainer,
                {
                  backgroundColor: colors.surface,
                  paddingTop: insets.top + 20,
                },
              ]}
            >
              <Image
                source={{ uri: getFullRemoteUrl(product.image) }}
                style={styles.image}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View
              style={[
                styles.imageContainer,
                styles.imageFallback,
                {
                  backgroundColor: colors.surface,
                  paddingTop: insets.top + 20,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="store"
                color={colors.icon}
                size={64}
              />
            </View>
          )}

          <View style={styles.detailsSection}>
            <Text style={[styles.name, { color: colors.text }]}>
              {product.name}
            </Text>

            {product.description ? (
              <Text style={[styles.desc, { color: colors.textSecondary }]}>
                {product.description}
              </Text>
            ) : null}

            <Text style={[styles.price, { color: colors.tint }]}>
              {formatProductPrice(product.price, product.sale_type || "unit")}
            </Text>
          </View>

          {/* Quantity Section */}
          <View
            style={[
              styles.qtySection,
              {
                borderTopColor: colors.border,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.qtyLabel, { color: colors.textSecondary }]}>
              {(product.sale_type || "unit") === "weight"
                ? "Quantidade (kg)"
                : "Quantidade"}
            </Text>
            <View style={styles.quantityRow}>
              <TouchableOpacity
                style={[styles.qtyButton, { backgroundColor: colors.surface }]}
                onPress={() => {
                  const saleType = product.sale_type || "unit";
                  const step = saleType === "weight" ? WEIGHT_STEP : 1;
                  const min = saleType === "weight" ? MIN_WEIGHT : 1;
                  setModalQty((q) =>
                    Math.max(min, Math.round((q - step) * 10) / 10),
                  );
                }}
              >
                <MaterialCommunityIcons
                  name="minus"
                  color={colors.text}
                  size={20}
                />
              </TouchableOpacity>
              <Text style={[styles.qtyText, { color: colors.text }]}>
                {formatQuantityLabel(modalQty, product.sale_type || "unit")}
              </Text>
              <TouchableOpacity
                style={[styles.qtyButton, { backgroundColor: colors.tint }]}
                onPress={() => {
                  const saleType = product.sale_type || "unit";
                  const step = saleType === "weight" ? WEIGHT_STEP : 1;
                  setModalQty((q) => Math.round((q + step) * 10) / 10);
                }}
              >
                <MaterialCommunityIcons name="plus" color="#fff" size={20} />
              </TouchableOpacity>
            </View>

            {product.sale_type === "weight" && (
              <View style={styles.weightPresets}>
                {[0.25, 0.5, 1, 1.5, 2].map((kg) => (
                  <TouchableOpacity
                    key={kg}
                    style={[
                      styles.weightPreset,
                      {
                        backgroundColor:
                          modalQty === kg ? colors.tint : colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setModalQty(kg)}
                  >
                    <Text
                      style={{
                        color: modalQty === kg ? "#fff" : colors.text,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {kg < 1 ? `${kg * 1000}g` : `${kg}kg`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Addons List */}
          {loadingAddons ? (
            <ActivityIndicator
              style={{ marginVertical: 20 }}
              color={colors.tint}
            />
          ) : productAddons.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Adicionais
              </Text>
              {productAddons.map((addon) => {
                const selected = selectedAddonIds.has(addon.id);
                return (
                  <TouchableOpacity
                    key={addon.id}
                    style={[
                      styles.addonItem,
                      {
                        backgroundColor: selected
                          ? `${colors.tint}15`
                          : colors.cardBackground,
                        borderColor: selected ? colors.tint : colors.border,
                      },
                    ]}
                    onPress={() => toggleAddon(addon.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "500" }}>
                        {addon.name}
                      </Text>
                      <Text
                        style={{
                          color: colors.tint,
                          fontSize: 13,
                          marginTop: 2,
                        }}
                      >
                        + R$ {addon.price.toFixed(2)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.addonCheck,
                        {
                          backgroundColor: selected
                            ? colors.tint
                            : "transparent",
                          borderColor: selected ? colors.tint : colors.border,
                        },
                      ]}
                    >
                      {selected && (
                        <MaterialCommunityIcons
                          name="check"
                          color="#fff"
                          size={14}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {/* Confirm Button */}
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.tint }]}
            onPress={confirmAddToCart}
          >
            <Text style={styles.addBtnText}>
              Adicionar ao Carrinho · R${" "}
              {(
                (product.price +
                  productAddons
                    .filter((a) => selectedAddonIds.has(a.id))
                    .reduce((s, a) => s + a.price, 0)) *
                modalQty
              ).toFixed(2)}
            </Text>
          </TouchableOpacity>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <View style={styles.relatedSection}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.text, marginLeft: 16 },
                ]}
              >
                Mais em {categoryLabel(product.category || "Produtos")}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.relatedCarousel}
              >
                {relatedProducts.map((p) => renderGridProductCard(p, true))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <TouchableOpacity
        onPress={() => router.back()}
        style={[
          styles.backButtonFloating,
          {
            top: insets.top > 0 ? insets.top + 12 : 20,
            backgroundColor: colors.surface + "cc",
          },
        ]}
      >
        <Ionicons name="chevron-back-outline" color={colors.text} size={24} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backButtonFloating: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  imageContainer: {
    width: "100%",
    height: 380,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,

    overflow: "hidden",
  },
  image: {
    width: "84%",
    height: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  imageFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  detailsSection: {
    padding: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: "400",
  },
  desc: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  price: {
    fontSize: 20,
    fontWeight: "500",
    marginTop: 12,
  },
  qtySection: {
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  qtyLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  qtyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontSize: 18,
    fontWeight: "700",
    minWidth: 50,
    textAlign: "center",
  },
  weightPresets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  weightPreset: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  addonItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  addonCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "400",
  },
  relatedSection: {
    marginTop: 12,
  },
  relatedCarousel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
