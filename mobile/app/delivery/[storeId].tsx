import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  ScrollView,
  Clipboard,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useCartStore, MIN_WEIGHT, WEIGHT_STEP } from "@/store/useCartStore";
import {
  getStore,
  listAddresses,
  Store as StoreType,
  StoreProduct,
  StoreProductCategory,
  StoreHours,
  ProductAddon,
  listProductAddons,
  PRODUCT_CATEGORIES,
  WEEKDAYS,
  formatProductPrice,
  formatQuantityLabel,
  StoreCoupon,
} from "@/services/deliveryApi";
import { getFullRemoteUrl } from "@/services/mediaCache";
import { FoodProductCard } from "@/components/FoodProductCard";
import { GridProductCard } from "@/components/GridProductCard";
import { CouponsBottomSheetModal } from "@/components/CouponsBottomSheetModal";
import { StoreDetailsBottomSheetModal } from "@/components/StoreDetailsBottomSheetModal";
import { Ionicons } from "@expo/vector-icons";

function categoryLabel(name: string): string {
  return PRODUCT_CATEGORIES[name] || name;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

function formatEta(min: number): string {
  if (min <= 20) return "15–25 min";
  if (min <= 30) return "25–35 min";
  if (min <= 40) return "35–45 min";
  if (min <= 55) return "45–60 min";
  return `${min} min`;
}

export default function StoreScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
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
  const insets = useSafeAreaInsets();

  const [store, setStore] = useState<StoreType | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [storeCategories, setStoreCategories] = useState<
    StoreProductCategory[]
  >([]);
  const [hours, setHours] = useState<StoreHours[]>([]);
  const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
  const storeDetailsBottomSheetRef = useRef<BottomSheetModal>(null);
  const couponsBottomSheetRef = useRef<BottomSheetModal>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const flatListRef = useRef<ScrollView>(null);
  const categoryPositions = useRef<Record<string, number>>({});

  const handleCategoryPress = (catName: string | null) => {
    setSelectedCategory(catName);
    if (!catName) {
      flatListRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const offset = categoryPositions.current[catName];
    if (offset !== undefined) {
      flatListRef.current?.scrollTo({
        y: offset - 135,
        animated: true,
      });
    }
  };

  const [scrollY, setScrollY] = useState(0);
  const [isGridViewVisible, setIsGridViewVisible] = useState(false);
  const [gridSelectedCategory, setGridSelectedCategory] = useState<
    string | null
  >(null);

  const [addonModalVisible, setAddonModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(
    null,
  );
  const [productAddons, setProductAddons] = useState<ProductAddon[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(
    new Set(),
  );
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [modalQty, setModalQty] = useState(1);

  const loadStore = useCallback(async () => {
    if (!token || !storeId) return;
    try {
      let geo: { lat?: number; lng?: number } = {};
      try {
        const addrRes = await listAddresses(token);
        const addr =
          addrRes.addresses.find((a) => a.is_default) || addrRes.addresses[0];
        if (addr?.latitude != null && addr?.longitude != null) {
          geo = { lat: addr.latitude, lng: addr.longitude };
        }
      } catch {
        // ignore address errors — still load store
      }

      const data = await getStore(token, storeId, geo);
      setStore(data.store);
      setProducts(data.products.filter((p) => p.is_available));
      setStoreCategories(data.categories || []);
      setHours(data.hours || []);
      setCoupons(data.coupons || []);
    } catch (err) {
      console.error("Failed to load store:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, storeId]);

  const copyCouponCode = (code: string) => {
    Clipboard.setString(code);
    Alert.alert(
      "Cupom copiado!",
      `O código "${code}" foi copiado para a sua área de transferência.`,
    );
  };

  const getStoreStatusString = () => {
    if (!store) return "Fechado";
    if (!store.is_open) {
      return "Fechado temporariamente";
    }
    if (hours.length === 0) {
      return "Fechado";
    }

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const todayKey = now.getDay();
    const todayH = hours.find((h) => h.day_of_week === todayKey);

    if (todayH && !todayH.is_closed) {
      try {
        const [oh, om] = todayH.open_time.split(":").map(Number);
        const [ch, cm] = todayH.close_time.split(":").map(Number);
        const openMins = oh * 60 + om;
        const closeMins = ch * 60 + cm;

        const openStr = todayH.open_time.slice(0, 5);
        const closeStr = todayH.close_time.slice(0, 5);

        if (currentMins >= openMins && currentMins < closeMins) {
          return `Aberto - Fecha às ${closeStr}`;
        } else if (currentMins < openMins) {
          return `Fechado - Abre às ${openStr}`;
        }
      } catch {
        // fallback
      }
    }

    // Closed today, check tomorrow
    const tomorrowKey = (todayKey + 1) % 7;
    const tomorrowH = hours.find((h) => h.day_of_week === tomorrowKey);
    if (tomorrowH && !tomorrowH.is_closed) {
      return `Fechado - Abre amanhã às ${tomorrowH.open_time.slice(0, 5)}`;
    }

    // Check future days
    for (let i = 2; i < 7; i++) {
      const nextDayKey = (todayKey + i) % 7;
      const nextH = hours.find((h) => h.day_of_week === nextDayKey);
      if (nextH && !nextH.is_closed) {
        const dayLabel =
          WEEKDAYS.find((d) => d.key === nextDayKey)?.label || "";
        return `Fechado - Abre ${dayLabel} às ${nextH.open_time.slice(0, 5)}`;
      }
    }

    return "Fechado";
  };

  const renderFormattedStatus = () => {
    const statusStr = getStoreStatusString();

    if (statusStr.startsWith("Fechado - ")) {
      const rest = statusStr.replace("Fechado - ", "");
      return (
        <Text style={[styles.storeStatusText, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.danger, fontWeight: "bold" }}>
            Fechado
          </Text>{" "}
          • {rest}
        </Text>
      );
    }

    if (statusStr === "Fechado" || statusStr === "Fechado temporariamente") {
      return (
        <Text
          style={[
            styles.storeStatusText,
            { color: colors.danger, fontWeight: "bold" },
          ]}
        >
          {statusStr}
        </Text>
      );
    }

    if (statusStr.startsWith("Aberto - ")) {
      const rest = statusStr.replace("Aberto - ", "");
      return (
        <Text style={[styles.storeStatusText, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontWeight: "bold" }}>Aberto</Text>{" "}
          • {rest}
        </Text>
      );
    }

    return (
      <Text style={[styles.storeStatusText, { color: colors.textSecondary }]}>
        {statusStr}
      </Text>
    );
  };

  useFocusEffect(
    useCallback(() => {
      loadStore();
    }, [loadStore]),
  );

  const getItemQty = (productId: string) => {
    if (cartStoreId !== storeId) return 0;
    const item = items.find((i) => i.productId === productId);
    return item?.quantity || 0;
  };

  const loadProductAddons = async (product: StoreProduct) => {
    setLoadingAddons(true);
    try {
      const data = await listProductAddons(token!, product.id);
      setProductAddons(data.addons.filter((a) => a.is_available));
    } catch {
      setProductAddons([]);
    } finally {
      setLoadingAddons(false);
    }
  };

  const openAddonsModal = async (product: StoreProduct) => {
    setSelectedProduct(product);
    setSelectedAddonIds(new Set());
    setModalQty(product.sale_type === "weight" ? MIN_WEIGHT : 1);
    setAddonModalVisible(true);
    await loadProductAddons(product);
  };

  const openProductDetail = (product: StoreProduct) => {
    router.push({
      pathname: "/delivery/product/[productId]",
      params: { productId: product.id, storeId },
    });
  };


  const toggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(addonId)) next.delete(addonId);
      else next.add(addonId);
      return next;
    });
  };

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

  const confirmAddToCart = (closeDetail = false) => {
    if (!selectedProduct || !store) return;
    const addons = productAddons
      .filter((a) => selectedAddonIds.has(a.id))
      .map((a) => ({ id: a.id, name: a.name, price: a.price }));

    addProductToCart(selectedProduct, addons, modalQty);
    setAddonModalVisible(false);
  };

  const quickAddToCart = (product: StoreProduct) => {
    const saleType = product.sale_type || "unit";
    const quantity = saleType === "weight" ? MIN_WEIGHT : 1;
    addProductToCart(product, [], quantity);
  };

  const promotionalProducts = useMemo(() => {
    return products.filter(
      (p) => p.promotional_price != null && p.promotional_price > 0,
    );
  }, [products]);

  const productCategoryNames = useMemo(() => {
    const cats =
      storeCategories.length > 0
        ? storeCategories.map((c) => c.name)
        : [...new Set(products.map((p) => p.category).filter(Boolean))];
    if (promotionalProducts.length > 0) {
      return ["Promoções", ...cats];
    }
    return cats;
  }, [storeCategories, products, promotionalProducts]);

  const isFoodOrDrinkStore =
    !!store?.category &&
    [
      "restaurante",
      "padaria",
      "fast_food",
      "lanchonete",
      "confeitaria",
      "acougue",
      "bebidas",
    ].includes(store.category.toLowerCase());

  const visibleProducts = useMemo(() => {
    return products;
  }, [products]);

  const gridProducts = useMemo(() => {
    if (!gridSelectedCategory) {
      return products;
    }
    if (gridSelectedCategory === "Promoções") {
      return promotionalProducts;
    }
    return products.filter(
      (p) =>
        p.category === gridSelectedCategory ||
        p.category_id ===
          storeCategories.find((c) => c.name === gridSelectedCategory)?.id,
    );
  }, [products, gridSelectedCategory, storeCategories, promotionalProducts]);

  const renderGridProductCard = (product: StoreProduct, isCarousel = false) => {
    return (
      <GridProductCard
        key={product.id}
        product={product}
        qty={getItemQty(product.id)}
        isCarousel={isCarousel}
        onPress={() => openProductDetail(product)}
        onUpdateQty={(newQty) => updateQuantity(product.id, newQty)}
        onRemove={() => removeItem(product.id)}
        onQuickAdd={() => quickAddToCart(product)}
      />
    );
  };

  const renderFoodProductCard = (product: StoreProduct) => {
    return (
      <FoodProductCard
        key={product.id}
        product={product}
        qty={getItemQty(product.id)}
        onPress={() => openProductDetail(product)}
        onUpdateQty={(newQty) => updateQuantity(product.id, newQty)}
        onRemove={() => removeItem(product.id)}
        onAddPress={() => {
          if (product.has_addons || product.addon_categories?.length) {
            openAddonsModal(product);
          } else {
            quickAddToCart(product);
          }
        }}
      />
    );
  };

  const groupedProducts = useMemo(() => {
    const groups: { category: string; items: StoreProduct[] }[] = [];

    // 1. Add Promoções first if any
    if (promotionalProducts.length > 0) {
      groups.push({ category: "Promoções", items: promotionalProducts });
    }

    // 2. Add other categories
    if (storeCategories.length > 0) {
      const assigned = new Set<string>();
      for (const cat of storeCategories) {
        const catItems = visibleProducts.filter(
          (p) => p.category_id === cat.id || p.category === cat.name,
        );
        if (catItems.length > 0) {
          groups.push({ category: cat.name, items: catItems });
          catItems.forEach((p) => assigned.add(p.id));
        }
      }
      const leftover = visibleProducts.filter((p) => !assigned.has(p.id));
      if (leftover.length > 0) {
        groups.push({ category: "Outros", items: leftover });
      }
    } else {
      const normalCats = productCategoryNames.filter((c) => c !== "Promoções");
      for (const cat of normalCats) {
        const catItems = visibleProducts.filter((p) => p.category === cat);
        if (catItems.length > 0) {
          groups.push({ category: cat, items: catItems });
        }
      }
      // If we only have Promoções, we shouldn't push visibleProducts under "Produtos" again
      if (groups.length === 0 && visibleProducts.length > 0) {
        groups.push({ category: "Produtos", items: visibleProducts });
      }
    }

    return groups;
  }, [
    storeCategories,
    productCategoryNames,
    visibleProducts,
    promotionalProducts,
  ]);
  if (loading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!store) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <Text style={{ color: colors.textSecondary }}>Loja não encontrada</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isGridViewVisible ? (
        <View style={{ flex: 1, paddingTop: insets.top }}>
          {/* Header row with ArrowLeft and Search Icon */}
          <View style={styles.gridHeader}>
            <TouchableOpacity
              onPress={() => setIsGridViewVisible(false)}
              style={styles.gridBackButton}
            >
              <Ionicons
                name="chevron-back-outline"
                color={colors.text}
                size={24}
              />
            </TouchableOpacity>

            <Text
              style={[styles.gridHeaderTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {store?.name}
            </Text>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <TouchableOpacity
                onPress={() => {
                  router.push(`/delivery/search-products/${storeId}`);
                }}
                style={styles.gridSearchButton}
              >
                <MaterialCommunityIcons
                  name="magnify"
                  color={colors.text}
                  size={24}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => storeDetailsBottomSheetRef.current?.present()}
                style={styles.gridSearchButton}
              >
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  color={colors.text}
                  size={24}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Categories bar: "Todos" and others */}
          <View style={{ height: 50, marginBottom: 8 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.categoryFilter,
                { paddingBottom: 10 },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  {
                    borderBottomColor: !gridSelectedCategory
                      ? colors.tint
                      : "transparent",
                  },
                ]}
                onPress={() => setGridSelectedCategory(null)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    {
                      color: !gridSelectedCategory ? colors.tint : colors.text,
                      fontWeight: !gridSelectedCategory ? "500" : "400",
                    },
                  ]}
                >
                  Todos
                </Text>
              </TouchableOpacity>
              {productCategoryNames.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    {
                      borderBottomColor:
                        gridSelectedCategory === cat
                          ? colors.tint
                          : "transparent",
                    },
                  ]}
                  onPress={() => setGridSelectedCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      {
                        color:
                          gridSelectedCategory === cat
                            ? colors.tint
                            : colors.text,
                        fontWeight:
                          gridSelectedCategory === cat ? "500" : "400",
                      },
                    ]}
                  >
                    {categoryLabel(cat)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Grid or List of products */}
          <FlatList
            data={gridProducts}
            key={
              isFoodOrDrinkStore
                ? `list-${gridSelectedCategory || "all"}`
                : `grid-${gridSelectedCategory || "all"}`
            }
            keyExtractor={(item) => item.id}
            numColumns={isFoodOrDrinkStore ? 1 : 2}
            columnWrapperStyle={
              isFoodOrDrinkStore ? undefined : styles.gridColumnWrapper
            }
            contentContainerStyle={[
              styles.listContent,
              { paddingTop: 10, paddingBottom: 100 },
            ]}
            renderItem={({ item: product }) =>
              isFoodOrDrinkStore
                ? renderFoodProductCard(product)
                : renderGridProductCard(product)
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  Nenhum produto disponível
                </Text>
              </View>
            }
          />
        </View>
      ) : (
        <>
          {/* Sticky Header */}
          {scrollY > 320 && (
            <View
              style={[
                styles.stickyHeaderContainer,
                {
                  backgroundColor: colors.background,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <View style={styles.stickyHeaderRow}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={[
                    styles.searchButton,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <Ionicons
                    name="chevron-back-outline"
                    color={colors.headerText}
                    size={20}
                  />
                </TouchableOpacity>

                <Text
                  style={[styles.stickyStoreName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {store?.name}
                </Text>

                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  {coupons.length > 0 && (
                    <TouchableOpacity
                      onPress={() => couponsBottomSheetRef.current?.present()}
                      style={[
                        styles.couponBadgeHeader,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.couponBadgeText, { color: colors.text }]}
                      >
                        {coupons.length}{" "}
                        {coupons.length === 1 ? "cupom" : "cupons"}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => {
                      router.push(`/delivery/search-products/${storeId}`);
                    }}
                    style={[
                      styles.searchButton,
                      { backgroundColor: colors.border },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="magnify"
                      color={colors.headerText}
                      size={20}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() =>
                      storeDetailsBottomSheetRef.current?.present()
                    }
                    style={[
                      styles.searchButton,
                      { backgroundColor: colors.border },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      color={colors.headerText}
                      size={20}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                  styles.categoryFilter,
                  { paddingBottom: 0 },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryChip,
                    {
                      borderBottomColor: !selectedCategory
                        ? colors.tint
                        : "transparent",
                    },
                  ]}
                  onPress={() => handleCategoryPress(null)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      {
                        color: !selectedCategory ? colors.tint : colors.text,
                        fontWeight: !selectedCategory ? "600" : "500",
                      },
                    ]}
                  >
                    Todos
                  </Text>
                </TouchableOpacity>
                {productCategoryNames.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      {
                        borderBottomColor:
                          selectedCategory === cat
                            ? colors.tint
                            : "transparent",
                      },
                    ]}
                    onPress={() =>
                      handleCategoryPress(selectedCategory === cat ? null : cat)
                    }
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        {
                          color:
                            selectedCategory === cat
                              ? colors.tint
                              : colors.text,
                          fontWeight: selectedCategory === cat ? "600" : "500",
                        },
                      ]}
                    >
                      {categoryLabel(cat)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View
            style={[
              styles.header,
              {
                backgroundColor: "transparent",
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10,
                justifyContent: "space-between",
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.searchButton, { backgroundColor: colors.border }]}
            >
              <Ionicons
                name="chevron-back-outline"
                color={colors.headerText}
                size={24}
              />
            </TouchableOpacity>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              {coupons.length > 0 && (
                <TouchableOpacity
                  onPress={() => couponsBottomSheetRef.current?.present()}
                  style={[
                    styles.couponBadgeHeader,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.couponBadgeText, { color: colors.text }]}
                  >
                    {coupons.length} {coupons.length === 1 ? "cupom" : "cupons"}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => {
                  router.push(`/delivery/search-products/${storeId}`);
                }}
                style={[
                  styles.searchButton,
                  { backgroundColor: colors.border },
                ]}
              >
                <MaterialCommunityIcons
                  name="magnify"
                  color={colors.headerText}
                  size={20}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => storeDetailsBottomSheetRef.current?.present()}
                style={[
                  styles.searchButton,
                  { backgroundColor: colors.border },
                ]}
              >
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  color={colors.headerText}
                  size={20}
                />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            ref={flatListRef}
            contentContainerStyle={[
              styles.listContent,
              cartStoreId === storeId &&
                getItemCount() > 0 && { paddingBottom: 100 },
            ]}
            onScroll={(e) => {
              setScrollY(e.nativeEvent.contentOffset.y);
            }}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadStore();
                }}
                tintColor={colors.tint}
              />
            }
          >
            {/* Store Details Container */}
            <View
              style={[
                styles.storeDetailsContainer,
                {
                  backgroundColor: colors.background,
                },
              ]}
            >
              {/* Banner */}
              {store.image_banner ? (
                <Image
                  source={{ uri: getFullRemoteUrl(store.image_banner) }}
                  style={styles.heroBanner}
                />
              ) : (
                <View
                  style={[
                    styles.heroBanner,
                    styles.heroBannerFallback,
                    { backgroundColor: colors.surface },
                  ]}
                />
              )}

              {/* Clickable Store Hero Info */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => storeDetailsBottomSheetRef.current?.present()}
                style={[styles.storeInfoWrapper, { alignItems: "center" }]}
              >
                {/* Store Logo/Avatar */}
                <View
                  style={{
                    marginTop: -50,
                    marginBottom: 10,
                    alignItems: "center",
                  }}
                >
                  {store.avatar ? (
                    <Image
                      source={{ uri: getFullRemoteUrl(store.avatar) }}
                      style={[
                        styles.storeInfoAvatar,
                        { borderWidth: 3, borderColor: colors.background },
                      ]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.storeInfoAvatarPlaceholder,
                        {
                          backgroundColor: colors.surface,
                          borderWidth: 3,
                          borderColor: colors.background,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="store"
                        color={colors.icon}
                        size={32}
                      />
                    </View>
                  )}
                </View>

                <View style={{ alignItems: "center" }}>
                  <Text
                    style={[
                      styles.storeTitleName,
                      { color: colors.text, textAlign: "center" },
                    ]}
                  >
                    {store.name}
                  </Text>

                  {/* Rating & Distance & Eta Row */}
                  <View
                    style={[
                      styles.storeMetaCompactRow,
                      { justifyContent: "center" },
                    ]}
                  >
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <MaterialCommunityIcons
                        name="star"
                        color="#F59E0B"
                        size={14}
                      />
                      <Text
                        style={[
                          styles.storeMetaCompactText,
                          { color: colors.text, fontWeight: 500 },
                        ]}
                      >
                        {store.score && Number(store.ratings_count) > 0
                          ? ` ${Number(store.score).toFixed(1)} (${store.ratings_count} ${Number(store.ratings_count) > 1 ? "avaliações" : "avaliação"})`
                          : " Novo"}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.storeMetaCompactText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {" • "}
                      {store.eta_min != null
                        ? formatEta(store.eta_min)
                        : store.prep_time_minutes
                          ? `${store.prep_time_minutes} min`
                          : "30 min"}
                      {store.distance_km != null
                        ? ` • ${formatDistance(store.distance_km)}`
                        : ""}
                    </Text>
                  </View>

                  {/* Status Row */}
                  <View
                    style={[
                      styles.storeStatusRow,
                      { justifyContent: "center", marginTop: 4 },
                    ]}
                  >
                    {renderFormattedStatus()}
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* List items mapping */}
            {groupedProducts.map((group) => (
              <View
                key={group.category}
                style={{ marginBottom: 16 }}
                onLayout={(e) => {
                  categoryPositions.current[group.category] =
                    e.nativeEvent.layout.y;
                }}
              >
                {/* Category Header with "Ver todos" link */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 10,
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={[
                      styles.sectionTitle,
                      {
                        color: colors.text,
                        marginTop: 0,
                        marginBottom: 0,
                      },
                    ]}
                  >
                    {categoryLabel(group.category)}
                  </Text>
                </View>

                {group.category === "Promoções" || !isFoodOrDrinkStore ? (
                  /* Horizontal Carousel of products */
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingVertical: 4 }}
                  >
                    {group.items
                      .slice(0, 12)
                      .map((product) => renderGridProductCard(product, true))}

                    {/* "Ver todos" card at the end */}
                    {group.items.length > 12 && (
                      <TouchableOpacity
                        style={[
                          styles.carouselViewAllCard,
                          {
                            backgroundColor: colors.cardBackground,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() => {
                          setGridSelectedCategory(group.category);
                          setIsGridViewVisible(true);
                        }}
                      >
                        <Text
                          style={[
                            styles.carouselViewAllText,
                            { color: colors.text },
                          ]}
                        >
                          Ver todos
                        </Text>
                        <MaterialCommunityIcons
                          name="arrow-right"
                          color={colors.tint}
                          size={18}
                          style={{ marginVertical: 6 }}
                        />
                        <Text
                          style={[
                            styles.carouselViewAllSubtext,
                            { color: colors.textSecondary },
                          ]}
                        >
                          +{group.items.length - 12}{" "}
                          {group.items.length - 12 === 1
                            ? "adicional"
                            : "adicionais"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                ) : (
                  <View style={{ gap: 8 }}>
                    {group.items.map((product) =>
                      renderFoodProductCard(product),
                    )}
                  </View>
                )}
              </View>
            ))}

            {groupedProducts.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  Nenhum produto disponível
                </Text>
              </View>
            )}
          </ScrollView>
        </>
      )}

      <Modal visible={addonModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View
              style={[styles.modalHeader, { borderBottomColor: colors.border }]}
            >
              <TouchableOpacity onPress={() => setAddonModalVisible(false)}>
                <MaterialCommunityIcons
                  name="close"
                  color={colors.text}
                  size={24}
                />
              </TouchableOpacity>
              <Text
                style={[styles.modalTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {selectedProduct?.name}
              </Text>
              <TouchableOpacity onPress={() => confirmAddToCart()}>
                <MaterialCommunityIcons
                  name="check"
                  color={colors.tint}
                  size={24}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
            >
              {selectedProduct && (
                <View
                  style={[styles.addonBaseItem, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.text, fontWeight: "500" }}>
                    {formatProductPrice(
                      selectedProduct.price,
                      selectedProduct.sale_type || "unit",
                    )}
                  </Text>
                </View>
              )}

              {selectedProduct && (
                <View style={styles.modalQtySection}>
                  <Text
                    style={[
                      styles.modalQtyLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {(selectedProduct.sale_type || "unit") === "weight"
                      ? "Quantidade (kg)"
                      : "Quantidade"}
                  </Text>
                  <View style={styles.quantityRow}>
                    <TouchableOpacity
                      style={[
                        styles.qtyButton,
                        { backgroundColor: colors.surface },
                      ]}
                      onPress={() => {
                        const saleType = selectedProduct.sale_type || "unit";
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
                    <Text
                      style={[
                        styles.qtyText,
                        {
                          color: colors.text,
                          minWidth: 56,
                          textAlign: "center",
                        },
                      ]}
                    >
                      {formatQuantityLabel(
                        modalQty,
                        selectedProduct.sale_type || "unit",
                      )}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.qtyButton,
                        { backgroundColor: colors.tint },
                      ]}
                      onPress={() => {
                        const saleType = selectedProduct.sale_type || "unit";
                        const step = saleType === "weight" ? WEIGHT_STEP : 1;
                        setModalQty((q) => Math.round((q + step) * 10) / 10);
                      }}
                    >
                      <MaterialCommunityIcons
                        name="plus"
                        color="#fff"
                        size={20}
                      />
                    </TouchableOpacity>
                  </View>
                  {selectedProduct.sale_type === "weight" && (
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
                  <Text
                    style={{
                      color: colors.tint,
                      fontWeight: "700",
                      marginTop: 12,
                      fontSize: 16,
                    }}
                  >
                    Subtotal: R${" "}
                    {(
                      (selectedProduct.price +
                        productAddons
                          .filter((a) => selectedAddonIds.has(a.id))
                          .reduce((s, a) => s + a.price, 0)) *
                      modalQty
                    ).toFixed(2)}
                  </Text>
                </View>
              )}

              {loadingAddons ? (
                <ActivityIndicator
                  style={{ marginTop: 24 }}
                  color={colors.tint}
                />
              ) : productAddons.length === 0 ? (
                <Text
                  style={{
                    color: colors.textSecondary,
                    textAlign: "center",
                    marginTop: 16,
                  }}
                >
                  Sem adicionais — ajuste a quantidade e confirme
                </Text>
              ) : (
                productAddons.map((addon) => {
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
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {cartStoreId === storeId && getItemCount() > 0 && (
        <TouchableOpacity
          style={[
            styles.floatingCartBar,
            {
              backgroundColor: colors.fab,
              bottom: insets.bottom + 24,
            },
          ]}
          onPress={() => router.push("/delivery/cart")}
          activeOpacity={0.9}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <MaterialCommunityIcons
              name="cart"
              color={isDark ? "#121212" : "#FFFFFF"}
              size={20}
              style={{ marginRight: 8 }}
            />
            <Text
              style={{
                color: isDark ? "#121212" : "#FFFFFF",
                fontWeight: "600",
                fontSize: 15,
              }}
            >
              {getItemCount()} {getItemCount() === 1 ? "item" : "itens"} • R${" "}
              {getSubtotal().toFixed(2).replace(".", ",")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              style={{
                color: isDark ? "#121212" : "#FFFFFF",
                fontWeight: "700",
                fontSize: 15,
                marginRight: 4,
              }}
            >
              Ver Carrinho
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <StoreDetailsBottomSheetModal
        ref={storeDetailsBottomSheetRef}
        store={store}
        hours={hours}
        onViewReviews={() => {
          router.push(`/delivery/reviews/${storeId}`);
        }}
      />

      <CouponsBottomSheetModal
        ref={couponsBottomSheetRef}
        coupons={coupons}
        onCopyCoupon={copyCouponCode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  carouselProductCard: {
    width: 160,
    minHeight: 260,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    marginRight: 12,
  },
  carouselProductImage: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    marginBottom: 8,
  },
  carouselProductImageFallback: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  carouselProductPrice: {
    fontSize: 15,
    fontWeight: "700",
  },
  carouselProductName: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
    height: 36,
  },
  carouselViewAllCard: {
    width: 110,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  carouselViewAllText: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  carouselViewAllSubtext: {
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
  qtyBadgeOverlay: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 2,
  },
  qtyBadgeOverlayText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  gridColumnWrapper: {
    justifyContent: "space-between",
    marginBottom: 10,
  },
  gridHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  gridBackButton: {
    padding: 8,
  },
  gridHeaderTitle: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10,
  },
  gridSearchButton: {
    padding: 8,
  },
  stickyHeaderContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 11,
    borderBottomWidth: 1,
  },
  stickyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 50,
    paddingBottom: 8,
  },
  stickyStoreName: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10,
  },
  couponBadgeHeader: {
    height: 36,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    gap: 6,
  },
  couponBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 50,
    paddingBottom: 12,
  },
  backButton: { padding: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    marginHorizontal: 8,
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingCartBar: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 999,
  },
  floatingCartQtyContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingCartQtyText: {
    fontWeight: "700",
    fontSize: 14,
  },
  floatingCartCenter: {
    flexDirection: "row",
    alignItems: "center",
  },
  floatingCartText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  floatingCartTotal: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  storeBanner: {
    flexDirection: "row",
    padding: 16,
    marginHorizontal: 16,
    marginTop: -28,
    borderRadius: 12,
    borderWidth: 1,
  },
  heroSection: { marginBottom: 8 },
  heroBanner: { width: "100%", height: 160 },
  heroBannerFallback: {},
  bannerAvatar: { width: 72, height: 72, borderRadius: 12 },
  bannerPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerInfo: { flex: 1, marginLeft: 12, justifyContent: "center" },
  bannerName: { fontSize: 18, fontWeight: "700" },
  bannerCategory: { fontSize: 13, marginTop: 2 },
  bannerMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  bannerMetaText: { fontSize: 12 },
  closedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  closedText: { color: "#DC2626", fontSize: 12, fontWeight: "600" },
  hoursCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  couponsContainer: {
    marginBottom: 16,
  },
  couponsTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginHorizontal: 16,
    marginBottom: 8,
  },
  couponsScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  couponCard: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    height: 76,
    minWidth: 170,
  },
  couponTicketLeft: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  couponTicketDivider: {
    width: 1,
    height: "100%",
    borderWidth: 1,
  },
  couponTicketRight: {
    paddingHorizontal: 12,
    justifyContent: "center",
    flex: 1,
  },
  couponValueText: {
    fontSize: 14,
    fontWeight: "700",
  },
  couponCodeText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 2,
  },
  couponMinOrderText: {
    fontSize: 10,
    marginTop: 2,
  },
  hoursHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  hoursTitle: { fontSize: 14, fontWeight: "600" },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  hoursDay: { fontSize: 13 },
  hoursTime: { fontSize: 13 },
  categoryFilter: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 20,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: "400",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  listContent: { padding: 16, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 8,
    marginBottom: 10,
  },
  productCard: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: "center",
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: "600" },
  productDesc: { fontSize: 13, marginTop: 4 },
  productPrice: { fontSize: 16, fontWeight: "700", marginTop: 6 },
  productImage: { width: 84, height: 84, borderRadius: 10, marginLeft: 10 },
  productActions: { marginLeft: 14 },
  mercadoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  mercadoCard: {
    width: "48.5%",
    minHeight: 360,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  mercadoImageWrap: {
    position: "relative",
    marginBottom: 8,
  },
  mercadoImage: {
    width: "100%",
    aspectRatio: 0.85,
    borderRadius: 8,
  },
  mercadoPlusBtn: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  mercadoImageFallback: {
    width: "100%",
    aspectRatio: 0.85,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  mercadoPrice: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  mercadoName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  mercadoDesc: {
    fontSize: 12,
    marginBottom: 4,
  },
  mercadoSaleType: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 8,
  },
  mercadoActions: {
    alignItems: "flex-start",
  },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 20,
    textAlign: "center",
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: { alignItems: "center", paddingTop: 48 },
  emptyText: { fontSize: 15 },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalCenterOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
  },
  hoursModalContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  hoursModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  hoursModalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  hoursModalClose: {
    padding: 4,
  },
  modalContent: {
    maxHeight: "88%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  detailModalContent: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: "hidden",
  },
  detailScrollView: { flex: 1 },
  detailScroll: { paddingBottom: 40 },
  detailImage: {
    width: "100%",
    height: 280,
    backgroundColor: "#f0f0f0",
  },
  detailName: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
    marginHorizontal: 16,
  },
  detailDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginHorizontal: 16,
  },
  detailPrice: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  detailAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  detailAddBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  relatedSection: {
    marginTop: 20,
    paddingBottom: 8,
  },
  relatedTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginHorizontal: 16,
    marginBottom: 12,
  },
  relatedCarousel: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  modalQtySection: { marginBottom: 16, alignItems: "flex-start" },
  modalQtyLabel: { fontSize: 13, fontWeight: "500", marginBottom: 8 },
  weightPresets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  weightPreset: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  addonBaseItem: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  addonItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
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
  revModalContainer: {
    flex: 1,
  },
  revModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  revModalCloseButton: {
    padding: 8,
  },
  revModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  revModalBody: {
    flex: 1,
    padding: 16,
  },
  reviewSummaryCard: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
  },
  reviewSummaryScoreSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 16,
  },
  reviewSummaryAverageText: {
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 40,
  },
  reviewSummaryDivider: {
    width: 1,
    height: "80%",
    marginHorizontal: 4,
  },
  reviewSummaryMetaSection: {
    flex: 1,
    paddingLeft: 16,
  },
  reviewSummaryMetaTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  writeReviewContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  writeReviewTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  starSelectorRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    height: 80,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  submitButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  reviewsListSection: {
    marginBottom: 40,
  },
  reviewsSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 16,
  },
  emptyReviewsText: {
    fontSize: 14,
    textAlign: "center",
    marginVertical: 20,
  },
  reviewItemCard: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  reviewItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  reviewUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  reviewUserAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: "600",
  },
  reviewCommentText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    paddingLeft: 46,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  storeDetailsContainer: {
    marginBottom: 8,
    marginTop: -16,
    marginLeft: -16,
    marginRight: -16,
  },
  storeInfoWrapper: {
    padding: 16,
    paddingTop: 12,
  },
  storeHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  storeTitleName: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  storeMetaCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  storeMetaCompactText: {
    fontSize: 14,
  },
  storeStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  storeStatusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  verDetalhesBtn: {
    paddingVertical: 2,
  },
  verDetalhesText: {
    fontSize: 13,
    fontWeight: "600",
  },
  storeInfoAvatar: {
    width: 80,
    height: 80,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  storeInfoAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  couponCollapsibleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginVertical: 12,
  },
  couponCollapsibleText: {
    fontSize: 14,
    fontWeight: "500",
  },
  detailsModalContent: {
    width: "100%",
    height: "80%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
  },
  detailsModalScroll: {
    padding: 20,
    paddingBottom: 40,
  },
  detailsModalSection: {
    paddingVertical: 16,
    gap: 10,
  },
  detailsModalStoreName: {
    fontSize: 20,
    fontWeight: "700",
  },
  detailsModalDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailsModalSecTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  detailsModalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  detailsModalLabel: {
    fontSize: 14,
  },
  detailsModalValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  detailsModalAddressText: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailsModalReviewsBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  detailsModalReviewsBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  couponsModalContent: {
    width: "100%",
    height: "75%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
  },
  couponsModalScroll: {
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  couponModalCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    height: 80,
    marginBottom: 12,
  },
});
