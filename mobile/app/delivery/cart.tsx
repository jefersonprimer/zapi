import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAppTheme } from "@/context/ThemeContext";
import { useCartStore, MIN_WEIGHT, WEIGHT_STEP } from "@/store/useCartStore";
import {
  formatProductPrice,
  formatQuantityLabel,
} from "@/services/deliveryApi";
import { Ionicons } from "@expo/vector-icons";

export default function CartScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    storeName,
    items,
    removeItem,
    updateQuantity,
    getSubtotal,
    getTotal,
    discount,
    couponCode,
    clearCart,
  } = useCartStore();

  const subtotal = getSubtotal();
  const total = getTotal();

  const handleClear = () => {
    Alert.alert("Limpar carrinho?", "Todos os itens serão removidos.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Limpar", style: "destructive", onPress: clearCart },
    ]);
  };

  if (items.length === 0) {
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
            Carrinho
          </Text>
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="shopping"
            color={colors.icon}
            size={64}
          />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Carrinho vazio
          </Text>
        </View>
      </View>
    );
  }

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
          Carrinho
        </Text>
        <TouchableOpacity onPress={handleClear}>
          <Text style={[styles.clearText, { color: colors.danger }]}>
            Limpar
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.storeBanner, { backgroundColor: colors.surface }]}>
        <Text style={[styles.storeLabel, { color: colors.textSecondary }]}>
          Loja:
        </Text>
        <Text style={[styles.storeName, { color: colors.text }]}>
          {storeName}
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item, idx) => `${item.productId}-${idx}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const saleType = item.saleType || "unit";
          const addonsTotal = item.addons.reduce((sum, a) => sum + a.price, 0);
          const step = saleType === "weight" ? WEIGHT_STEP : 1;
          const minQty = saleType === "weight" ? MIN_WEIGHT : 1;
          return (
            <View
              style={[
                styles.itemCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.itemInfo}>
                <Text
                  style={[styles.itemName, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                <Text
                  style={[styles.unitPrice, { color: colors.textSecondary }]}
                >
                  {formatProductPrice(item.price, saleType)}
                </Text>
                {item.addons.length > 0 && (
                  <View style={styles.addonsContainer}>
                    {item.addons.map((addon) => (
                      <Text
                        key={addon.id}
                        style={[
                          styles.addonText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        + {addon.name} (R$ {addon.price.toFixed(2)})
                      </Text>
                    ))}
                  </View>
                )}
                <Text style={[styles.itemPrice, { color: colors.tint }]}>
                  R$ {((item.price + addonsTotal) * item.quantity).toFixed(2)}
                </Text>
                {item.observation ? (
                  <Text
                    style={[styles.itemObs, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    Obs: {item.observation}
                  </Text>
                ) : null}
              </View>
              <View style={styles.itemActions}>
                <View style={styles.quantityRow}>
                  <TouchableOpacity
                    style={[
                      styles.qtyButton,
                      { backgroundColor: colors.surface },
                    ]}
                    onPress={() =>
                      item.quantity <= minQty
                        ? removeItem(item.productId)
                        : updateQuantity(
                            item.productId,
                            Math.round((item.quantity - step) * 10) / 10,
                          )
                    }
                  >
                    <MaterialCommunityIcons
                      name="minus"
                      color={colors.text}
                      size={16}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.qtyText, { color: colors.text }]}>
                    {formatQuantityLabel(item.quantity, saleType)}
                  </Text>
                  <TouchableOpacity
                    style={[styles.qtyButton, { backgroundColor: colors.tint }]}
                    onPress={() =>
                      updateQuantity(
                        item.productId,
                        Math.round((item.quantity + step) * 10) / 10,
                      )
                    }
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      color="#fff"
                      size={16}
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => removeItem(item.productId)}
                  style={styles.removeButton}
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    color={colors.danger}
                    size={16}
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.cardBackground,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
            Subtotal
          </Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>
            R$ {subtotal.toFixed(2)}
          </Text>
        </View>
        {couponCode && discount > 0 && (
          <View style={styles.totalRow}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <MaterialCommunityIcons
                name="tag-outline"
                color="#10B981"
                size={14}
              />
              <Text style={[styles.totalLabel, { color: "#10B981" }]}>
                {couponCode}
              </Text>
            </View>
            <Text style={[styles.totalValue, { color: "#10B981" }]}>
              - R$ {discount.toFixed(2)}
            </Text>
          </View>
        )}
        <View style={[styles.totalRow, { marginTop: 4 }]}>
          <Text
            style={[
              styles.totalLabel,
              { color: colors.text, fontWeight: "700", fontSize: 16 },
            ]}
          >
            Total
          </Text>
          <Text
            style={[
              styles.totalValue,
              { color: colors.tint, fontSize: 18, fontWeight: "700" },
            ]}
          >
            R$ {total.toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButton, { backgroundColor: colors.tint }]}
          onPress={() => router.push("/delivery/checkout")}
        >
          <Text style={styles.checkoutText}>Finalizar Pedido</Text>
        </TouchableOpacity>
      </View>
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
  },
  backButton: { padding: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "500",
    marginHorizontal: 8,
  },
  clearText: { fontSize: 14, fontWeight: "500", padding: 8 },
  storeBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
  },
  storeLabel: { fontSize: 13, marginRight: 6 },
  storeName: { fontSize: 15, fontWeight: "600" },
  listContent: { padding: 16, paddingBottom: 8 },
  itemCard: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    alignItems: "center",
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "600" },
  unitPrice: { fontSize: 12, marginTop: 2 },
  addonsContainer: { marginTop: 4, gap: 2 },
  addonText: { fontSize: 12 },
  itemPrice: { fontSize: 15, fontWeight: "700", marginTop: 4 },
  itemObs: { fontSize: 12, marginTop: 2 },
  itemActions: { alignItems: "flex-end", marginLeft: 12, gap: 8 },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontSize: 15,
    fontWeight: "600",
    minWidth: 20,
    textAlign: "center",
  },
  removeButton: { padding: 4 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalLabel: { fontSize: 15 },
  totalValue: { fontSize: 15 },
  checkoutButton: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  checkoutText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 16, marginTop: 12 },
});
