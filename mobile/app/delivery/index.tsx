import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useCartStore } from "@/store/useCartStore";
import {
  listStores,
  listAddresses,
  Store as StoreType,
  UserAddress,
  STORE_CATEGORIES,
} from "@/services/deliveryApi";
import CategoryGrid from "@/components/CategoryGrid";
import PromotionsSection from "@/components/PromotionsSection";
import StoreCard, { StoreCardSkeleton } from "@/components/StoreCard";
import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";

const LABEL_TEXT: Record<string, string> = {
  casa: "Casa",
  trabalho: "Trabalho",
  outro: "Outro",
};

function isStoreOpenNow(store: StoreType): boolean {
  if (!store.is_open) return false;
  if (!store.hours || store.hours.length === 0) {
    return store.is_open;
  }

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const todayKey = now.getDay();
  const todayH = store.hours.find((h) => h.day_of_week === todayKey);

  if (todayH && !todayH.is_closed) {
    try {
      const [oh, om] = todayH.open_time.split(":").map(Number);
      const [ch, cm] = todayH.close_time.split(":").map(Number);
      const openMins = oh * 60 + om;
      const closeMins = ch * 60 + cm;

      return currentMins >= openMins && currentMins < closeMins;
    } catch {
      return store.is_open;
    }
  }

  return false;
}

export default function DeliveryScreen() {
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { storeId: cartStoreId, getItemCount } = useCartStore();

  const [stores, setStores] = useState<StoreType[]>([]);
  const [address, setAddress] = useState<UserAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(24);
  const [refreshing, setRefreshing] = useState(false);

  const displayedStores = stores.slice(0, limit);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string | null>(null);
  const [openNow, setOpenNow] = useState(false);
  const [freeDelivery, setFreeDelivery] = useState(false);
  const [promotionOnly, setPromotionOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>("default");

  // Modal visibility states
  const [hasPromptedAddress, setHasPromptedAddress] = useState(false);

  const sortBottomSheetRef = useRef<BottomSheetModal>(null);
  const sortSnapPoints = useMemo(() => ["55%"], []);

  const deliveryBottomSheetRef = useRef<BottomSheetModal>(null);
  const deliverySnapPoints = useMemo(() => ["40%"], []);

  const paymentBottomSheetRef = useRef<BottomSheetModal>(null);
  const paymentSnapPoints = useMemo(() => ["40%"], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const loadData = useCallback(async () => {
    if (!token) return;
    setLimit(24);
    try {
      const addrRes = await listAddresses(token);
      const defaultAddr =
        addrRes.addresses.find((a) => a.is_default) ||
        addrRes.addresses[0] ||
        null;
      setAddress(defaultAddr);

      if (!defaultAddr) {
        setStores([]);
        if (!hasPromptedAddress) {
          setHasPromptedAddress(true);
          router.push("/delivery/addresses");
        }
        return;
      }

      const geoParams = {
        state: defaultAddr.estado,
        city: defaultAddr.cidade,
        ...(defaultAddr.latitude != null && defaultAddr.longitude != null
          ? { lat: defaultAddr.latitude, lng: defaultAddr.longitude }
          : {}),
      };

      const data = await listStores(token, {
        ...geoParams,
        ...(selectedCategory ? { category: selectedCategory } : {}),
      });

      let list = data.stores;

      // Filter by fulfillment mode
      if (deliveryMode === "delivery") {
        list = list.filter((s) => s.accepts_delivery !== false);
      } else if (deliveryMode === "pickup") {
        list = list.filter((s) => s.accepts_pickup !== false);
      }

      // Filter by payment method
      if (paymentFilter === "online") {
        list = list.filter((s) => !!s.pix_key);
      }

      // Filter by free delivery
      if (freeDelivery) {
        list = list.filter((s) => s.delivery_fee === 0);
      }

      // Filter by open now
      if (openNow) {
        list = list.filter((s) => isStoreOpenNow(s));
      }

      // Filter by promotion
      if (promotionOnly) {
        list = list.filter((s) => s.has_coupons === true);
      }

      // Sort stores
      if (sortBy === "rating") {
        list.sort((a, b) => (b.score || 0) - (a.score || 0));
      } else if (sortBy === "delivery_time") {
        list.sort(
          (a, b) =>
            (a.eta_min ?? a.prep_time_minutes ?? 999) -
            (b.eta_min ?? b.prep_time_minutes ?? 999),
        );
      } else if (sortBy === "delivery_fee") {
        list.sort((a, b) => a.delivery_fee - b.delivery_fee);
      } else if (sortBy === "distance") {
        list.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999));
      } else if (sortBy === "price") {
        list.sort((a, b) => a.minimum_order - b.minimum_order);
      }

      setStores(list);
    } catch (err) {
      console.error("Failed to load stores:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    token,
    selectedCategory,
    freeDelivery,
    openNow,
    deliveryMode,
    paymentFilter,
    promotionOnly,
    sortBy,
    hasPromptedAddress,
    router,
  ]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderStore = ({ item }: { item: StoreType }) => {
    return (
      <View style={{ paddingHorizontal: 16 }}>
        <StoreCard item={item} />
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
          <Ionicons
            name="chevron-back-outline"
            color={colors.headerText}
            size={24}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>
          Zapi Delivery
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.searchHeaderButton,
              { backgroundColor: colors.surface },
            ]}
            onPress={() => router.push("/delivery/search")}
          >
            <MaterialCommunityIcons
              name="magnify"
              color={colors.icon}
              size={20}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ordersButton, { backgroundColor: colors.surface }]}
            onPress={() => router.push("/delivery/orders")}
          >
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              color={colors.icon}
              size={20}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.vendorButton, { backgroundColor: colors.surface }]}
            onPress={() => router.push("/delivery/vendor/dashboard")}
          >
            <MaterialCommunityIcons
              name="store"
              color={colors.icon}
              size={20}
            />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.addressBar,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={() => router.push("/delivery/addresses")}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="map-marker"
          size={18}
          color={colors.tint}
        />
        <View style={styles.addressBarText}>
          {loading ? (
            <Text
              style={[styles.addressLabel, { color: colors.textSecondary }]}
            >
              Carregando endereço...
            </Text>
          ) : address ? (
            <>
              <Text
                style={[styles.addressLabel, { color: colors.text }]}
                numberOfLines={1}
              >
                {LABEL_TEXT[address.label] || address.label} · {address.cidade}/
                {address.estado}
              </Text>
              <Text
                style={[styles.addressDetail, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {address.rua}, {address.numero} — {address.bairro}
              </Text>
            </>
          ) : (
            <Text style={[styles.addressLabel, { color: colors.text }]}>
              Informe seu endereço de entrega
            </Text>
          )}
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={18}
          color={colors.icon}
        />
      </TouchableOpacity>

      {loading && !address ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
        >
          <StoreCardSkeleton />
          <StoreCardSkeleton />
          <StoreCardSkeleton />
          <StoreCardSkeleton />
          <StoreCardSkeleton />
        </ScrollView>
      ) : !address ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="map-marker"
            color={colors.icon}
            size={64}
          />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Cadastre um endereço para ver lojas na sua cidade
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.tint }]}
            onPress={() => router.push("/delivery/addresses")}
          >
            <Text style={styles.emptyButtonText}>Adicionar endereço</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={loading ? [] : displayedStores}
          keyExtractor={(item) => item.id}
          renderItem={renderStore}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.tint}
            />
          }
          ListHeaderComponent={
            <>
              <CategoryGrid
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                city={address?.cidade}
                state={address?.estado}
              />

              <PromotionsSection />

              <View style={styles.filtersContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterScroll}
                  contentContainerStyle={styles.filterRow}
                >
                  {/* Ordenar por Filter */}
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      sortBy !== "default" && styles.filterChipActive,
                      {
                        backgroundColor:
                          sortBy !== "default" ? colors.tint : colors.surface,
                        borderColor:
                          sortBy !== "default" ? colors.tint : colors.border,
                      },
                    ]}
                    onPress={() => sortBottomSheetRef.current?.present()}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name="arrow-up-down"
                      size={14}
                      color={sortBy !== "default" ? "#FFF" : colors.text}
                    />
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: sortBy !== "default" ? "#FFF" : colors.text },
                      ]}
                    >
                      {sortBy === "default"
                        ? "Ordenar"
                        : sortBy === "price"
                          ? "Menor pedido"
                          : sortBy === "rating"
                            ? "Melhor avaliação"
                            : sortBy === "delivery_time"
                              ? "Mais rápido"
                              : sortBy === "delivery_fee"
                                ? "Menor taxa"
                                : "Mais próximo"}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={14}
                      color={sortBy !== "default" ? "#FFF" : colors.text}
                    />
                  </TouchableOpacity>

                  {/* Forma de Entrega Filter */}
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      deliveryMode !== "all" && styles.filterChipActive,
                      {
                        backgroundColor:
                          deliveryMode !== "all" ? colors.tint : colors.surface,
                        borderColor:
                          deliveryMode !== "all" ? colors.tint : colors.border,
                      },
                    ]}
                    onPress={() => deliveryBottomSheetRef.current?.present()}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: deliveryMode !== "all" ? "#FFF" : colors.text,
                        },
                      ]}
                    >
                      {deliveryMode === "all"
                        ? "Forma de entrega"
                        : deliveryMode === "delivery"
                          ? "Entregar (Delivery)"
                          : "Retirar"}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={14}
                      color={deliveryMode !== "all" ? "#FFF" : colors.text}
                    />
                  </TouchableOpacity>

                  {/* Forma de Pagamento Filter */}
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      paymentFilter !== null && styles.filterChipActive,
                      {
                        backgroundColor:
                          paymentFilter !== null ? colors.tint : colors.surface,
                        borderColor:
                          paymentFilter !== null ? colors.tint : colors.border,
                      },
                    ]}
                    onPress={() => paymentBottomSheetRef.current?.present()}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: paymentFilter !== null ? "#FFF" : colors.text,
                        },
                      ]}
                    >
                      {paymentFilter === null
                        ? "Forma de pagamento"
                        : paymentFilter === "card"
                          ? "Máquina de cartão"
                          : "Online (Pix)"}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={14}
                      color={paymentFilter !== null ? "#FFF" : colors.text}
                    />
                  </TouchableOpacity>

                  {/* Abertos Filter (toggle) */}
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      openNow && styles.filterChipActive,
                      {
                        backgroundColor: openNow ? colors.tint : colors.surface,
                        borderColor: openNow ? colors.tint : colors.border,
                      },
                    ]}
                    onPress={() => setOpenNow(!openNow)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: openNow ? "#FFF" : colors.text },
                      ]}
                    >
                      Abertos agora
                    </Text>
                  </TouchableOpacity>

                  {/* Entrega Gratis Filter (toggle) */}
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      freeDelivery && styles.filterChipActive,
                      {
                        backgroundColor: freeDelivery
                          ? colors.tint
                          : colors.surface,
                        borderColor: freeDelivery ? colors.tint : colors.border,
                      },
                    ]}
                    onPress={() => setFreeDelivery(!freeDelivery)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name="motorbike"
                      size={14}
                      color={freeDelivery ? "#FFF" : colors.text}
                    />
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: freeDelivery ? "#FFF" : colors.text },
                      ]}
                    >
                      Entrega grátis
                    </Text>
                  </TouchableOpacity>

                  {/* Promoções Filter (toggle) */}
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      promotionOnly && styles.filterChipActive,
                      {
                        backgroundColor: promotionOnly
                          ? colors.tint
                          : colors.surface,
                        borderColor: promotionOnly
                          ? colors.tint
                          : colors.border,
                      },
                    ]}
                    onPress={() => setPromotionOnly(!promotionOnly)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name="tag-outline"
                      size={14}
                      color={promotionOnly ? "#FFF" : colors.text}
                    />
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: promotionOnly ? "#FFF" : colors.text },
                      ]}
                    >
                      Promoções
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {!loading && (
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {selectedCategory
                      ? STORE_CATEGORIES[selectedCategory] || "Lojas"
                      : "Lojas"}
                  </Text>
                </View>
              )}
            </>
          }
          onEndReached={() => {
            if (limit < stores.length) {
              setLimit((prev) => prev + 24);
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={() => {
            if (limit < stores.length) {
              return (
                <View style={{ paddingVertical: 20, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={colors.tint} />
                </View>
              );
            }
            return null;
          }}
          ListEmptyComponent={
            loading ? (
              <View style={{ paddingHorizontal: 16 }}>
                <StoreCardSkeleton />
                <StoreCardSkeleton />
                <StoreCardSkeleton />
                <StoreCardSkeleton />
                <StoreCardSkeleton />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name="store"
                  color={colors.icon}
                  size={64}
                />
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  Nenhuma loja em {address.cidade}
                </Text>
              </View>
            )
          }
        />
      )}
      {cartStoreId && (
        <TouchableOpacity
          style={[
            styles.cartButton,
            {
              backgroundColor: colors.fab,
              bottom: Math.max(insets.bottom, 16) + 16,
            },
          ]}
          onPress={() => router.push("/delivery/cart")}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="cart"
            color={isDark ? "#121212" : "#FFFFFF"}
            size={24}
          />
          <View style={[styles.badge, { backgroundColor: colors.badge }]}>
            <Text style={[styles.badgeText, { color: colors.badgeText }]}>
              {getItemCount()}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Modal - Forma de Entrega */}
      <BottomSheetModal
        ref={deliveryBottomSheetRef}
        index={0}
        snapPoints={deliverySnapPoints}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: colors.background,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView
          style={{
            flex: 1,
            paddingBottom: insets.bottom,
            paddingHorizontal: 20,
          }}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => deliveryBottomSheetRef.current?.dismiss()}
              style={[styles.modalCloseButton, { borderColor: colors.border }]}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Forma de Entrega
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {[
            { key: "all", label: "Todas" },
            { key: "delivery", label: "Entregar (Delivery)" },
            { key: "pickup", label: "Retirar" },
          ].map((option) => {
            const selected = deliveryMode === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.modalOption,
                  selected && { backgroundColor: `${colors.tint}15` },
                  { borderBottomColor: colors.border },
                ]}
                onPress={() => {
                  setDeliveryMode(option.key);
                  deliveryBottomSheetRef.current?.dismiss();
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: colors.text },
                    selected && { color: colors.tint, fontWeight: "600" },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </BottomSheetView>
      </BottomSheetModal>

      {/* Modal - Forma de Pagamento */}
      <BottomSheetModal
        ref={paymentBottomSheetRef}
        index={0}
        snapPoints={paymentSnapPoints}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: colors.background,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView
          style={{
            flex: 1,
            paddingBottom: insets.bottom,
            paddingHorizontal: 20,
          }}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => paymentBottomSheetRef.current?.dismiss()}
              style={[styles.modalCloseButton, { borderColor: colors.border }]}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Forma de Pagamento
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {[
            { key: null, label: "Todas" },
            { key: "card", label: "Máquina de cartão" },
            { key: "online", label: "Online (Pix)" },
          ].map((option) => {
            const selected = paymentFilter === option.key;
            return (
              <TouchableOpacity
                key={String(option.key)}
                style={[
                  styles.modalOption,
                  selected && { backgroundColor: `${colors.tint}15` },
                  { borderBottomColor: colors.border },
                ]}
                onPress={() => {
                  setPaymentFilter(option.key);
                  paymentBottomSheetRef.current?.dismiss();
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: colors.text },
                    selected && { color: colors.tint, fontWeight: "600" },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </BottomSheetView>
      </BottomSheetModal>

      {/* Modal - Ordenar por */}
      <BottomSheetModal
        ref={sortBottomSheetRef}
        index={0}
        snapPoints={sortSnapPoints}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: colors.background,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView
          style={{
            flex: 1,
            paddingBottom: insets.bottom,
            paddingHorizontal: 20,
          }}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => sortBottomSheetRef.current?.dismiss()}
              style={[styles.modalCloseButton, { borderColor: colors.border }]}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Ordenar Por
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {[
            { key: "default", label: "Padrão / Relevância" },
            { key: "price", label: "Preço (Menor pedido mínimo)" },
            { key: "rating", label: "Avaliação (Melhores notas)" },
            {
              key: "delivery_time",
              label: "Tempo de entrega (Mais rápidos)",
            },
            {
              key: "delivery_fee",
              label: "Taxa de entrega (Mais baratas)",
            },
            { key: "distance", label: "Distância (Mais próximos)" },
          ].map((option) => {
            const selected = sortBy === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.modalOption,
                  selected && { backgroundColor: `${colors.tint}15` },
                  { borderBottomColor: colors.border },
                ]}
                onPress={() => {
                  setSortBy(option.key);
                  sortBottomSheetRef.current?.dismiss();
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: colors.text },
                    selected && { color: colors.tint, fontWeight: "600" },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </BottomSheetView>
      </BottomSheetModal>
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
  },
  backButton: { padding: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    marginHorizontal: 8,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  ordersButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  vendorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cartButton: {
    position: "absolute",
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 99,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  addressBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  addressBarText: { flex: 1 },
  addressLabel: { fontSize: 14, fontWeight: "600" },
  addressDetail: { fontSize: 12, marginTop: 2 },
  searchHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  filtersContainer: {
    paddingTop: 20,
    paddingBottom: 2,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 4,
    borderWidth: 1,
  },
  filterChipActive: {},
  filterChipText: { fontSize: 12, fontWeight: "500" },
  filterDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 2,
    marginVertical: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sectionCount: { fontSize: 13 },
  list: { flex: 1 },
  listContent: { paddingTop: 16, paddingBottom: 100 },
  storeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  storeAvatar: { width: 78, height: 78, borderRadius: 16 },
  storeAvatarPlaceholder: {
    width: 78,
    height: 78,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  storeInfo: { flex: 1, marginLeft: 12 },
  storeName: { fontSize: 16, fontWeight: "600" },
  storeCategory: { fontSize: 13, marginTop: 2 },
  storeMeta: {
    flexDirection: "row",
    marginTop: 4,
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  storeFee: { fontSize: 12 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 64,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 16, marginTop: 12, textAlign: "center" },
  emptyButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.4)",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "500",
    textAlign: "center",
    flex: 1,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: "400",
  },
});
