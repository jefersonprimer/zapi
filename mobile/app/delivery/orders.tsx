import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  listOrders,
  Order,
  getOrderStatusLabel,
  ORDER_STATUS_COLORS,
} from "@/services/deliveryApi";

export default function OrdersScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listOrders(token);
      setOrders(data.orders);
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={[styles.orderCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
      onPress={() => router.push({ pathname: "/delivery/orders/[id]", params: { id: item.id } })}
      activeOpacity={0.7}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderIdRow}>
          <MaterialCommunityIcons name="package-variant" color={colors.icon} size={18} />
          <Text style={[styles.orderId, { color: colors.text }]}>
            #{item.id.slice(0, 8).toUpperCase()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: ORDER_STATUS_COLORS[item.status] + "20" }]}>
          <Text style={[styles.statusText, { color: ORDER_STATUS_COLORS[item.status] }]}>
            {getOrderStatusLabel(item.status, item.fulfillment_type)}
          </Text>
        </View>
      </View>
      <View style={styles.orderDetails}>
        <Text style={[styles.orderTotal, { color: colors.tint }]}>
          R$ {item.total.toFixed(2)}
        </Text>
        <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
          {new Date(item.created_at).toLocaleDateString("pt-BR")} {new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
      {item.discount > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
          <MaterialCommunityIcons name="tag-outline" color="#10B981" size={12} />
          <Text style={{ color: "#10B981", fontSize: 12, fontWeight: "500" }}>
            {item.coupon_code} — Desconto: -R$ {item.discount.toFixed(2)}
          </Text>
        </View>
      )}
      <View style={styles.orderAddress}>
        <Text style={[styles.orderAddressText, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.fulfillment_type === "retirada"
            ? "Retirada na loja"
            : `${item.address_snapshot.rua}, ${item.address_snapshot.numero} - ${item.address_snapshot.bairro}`}
        </Text>
        <MaterialCommunityIcons name="chevron-right" color={colors.icon} size={18} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Meus Pedidos</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} tintColor={colors.tint} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="package-variant" color={colors.icon} size={64} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Nenhum pedido encontrado
            </Text>
          </View>
        }
      />
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
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "600", marginHorizontal: 8 },
  listContent: { padding: 16, paddingBottom: 32 },
  orderCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderIdRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  orderId: { fontSize: 14, fontWeight: "600" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 12, fontWeight: "600" },
  orderDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  orderTotal: { fontSize: 18, fontWeight: "700" },
  orderDate: { fontSize: 13 },
  orderAddress: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  orderAddressText: { flex: 1, fontSize: 13 },
  emptyContainer: { alignItems: "center", paddingTop: 64 },
  emptyText: { fontSize: 16, marginTop: 12 },
});
