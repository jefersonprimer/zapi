import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, ChevronRight, Tag } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  listVendorOrders,
  updateOrderStatus,
  Order,
  getOrderStatusLabel,
  ORDER_STATUS_COLORS,
} from "@/services/deliveryApi";

const STATUS_FLOW: Record<string, string> = {
  // Legacy
  pendente: "confirmado",
  confirmado: "preparando",
  preparando: "saiu_entrega",
  saiu_entrega: "entregue",
  // New Decoupled
  PENDING: "WAITING_STORE_CONFIRMATION",
  PENDING_PAYMENT: "WAITING_STORE_CONFIRMATION",
  PAID: "ACCEPTED",
  WAITING_STORE_CONFIRMATION: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

const STATUS_ACTION_LABELS_DELIVERY: Record<string, string> = {
  // Legacy
  pendente: "Confirmar pedido",
  confirmado: "Iniciar preparo",
  preparando: "Saiu para entrega",
  saiu_entrega: "Marcar como entregue",
  // New Decoupled
  PENDING: "Aguardando pagamento",
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Aceitar e confirmar",
  WAITING_STORE_CONFIRMATION: "Aceitar e confirmar",
  ACCEPTED: "Iniciar preparo",
  PREPARING: "Enviar pedido",
  OUT_FOR_DELIVERY: "Marcar como entregue",
};

const STATUS_ACTION_LABELS_PICKUP: Record<string, string> = {
  // Legacy
  pendente: "Confirmar pedido",
  confirmado: "Iniciar preparo",
  preparando: "Pronto para retirada",
  saiu_entrega: "Marcar como retirado",
  // New Decoupled
  PENDING: "Aguardando pagamento",
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Aceitar e confirmar",
  WAITING_STORE_CONFIRMATION: "Aceitar e confirmar",
  ACCEPTED: "Iniciar preparo",
  PREPARING: "Pronto para retirada",
  OUT_FOR_DELIVERY: "Marcar como retirado",
};

function getActionLabel(order: Order): string | null {
  if (order.status === "READY") {
    return "Marcar como retirado";
  }
  const labels =
    order.fulfillment_type === "retirada"
      ? STATUS_ACTION_LABELS_PICKUP
      : STATUS_ACTION_LABELS_DELIVERY;
  
  const currentStatus = order.status;
  return STATUS_FLOW[currentStatus] ? labels[currentStatus] ?? null : null;
}

export default function VendorOrdersScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listVendorOrders(token);
      setOrders(data.orders);
    } catch (err) {
      console.error("Failed to load vendor orders:", err);
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

  const handleAdvanceStatus = async (order: Order) => {
    if (!token || updatingId) return;
    let nextStatus = STATUS_FLOW[order.status];
    if (order.status === "PREPARING" && order.fulfillment_type === "retirada") {
      nextStatus = "READY";
    }
    if (order.status === "READY") {
      nextStatus = "DELIVERED";
    }
    if (!nextStatus) return;

    setUpdatingId(order.id);
    try {
      await updateOrderStatus(token, order.id, nextStatus);
      loadOrders();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao atualizar status");
    } finally {
      setUpdatingId(null);
    }
  };

  const renderOrder = ({ item }: { item: Order }) => {
    let nextStatus = STATUS_FLOW[item.status];
    if (item.status === "PREPARING" && item.fulfillment_type === "retirada") {
      nextStatus = "READY";
    }
    if (item.status === "READY") {
      nextStatus = "DELIVERED";
    }
    const nextLabel = getActionLabel(item);
    const isPickup = item.fulfillment_type === "retirada";

    return (
      <View style={[styles.orderCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.orderHeader}>
          <Text style={[styles.orderId, { color: colors.text }]}>
            #{item.id.slice(0, 8).toUpperCase()}
          </Text>
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

        <Text style={[styles.fulfillmentTag, { color: colors.textSecondary }]}>
          {isPickup ? "Retirada na loja" : "Entrega"}
        </Text>

        {item.discount > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <Tag color="#10B981" size={12} />
            <Text style={{ color: "#10B981", fontSize: 12, fontWeight: "500" }}>
              {item.coupon_code} — Desconto: -R$ {item.discount.toFixed(2)}
            </Text>
          </View>
        )}

        <View style={[styles.addressRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={2}>
            {isPickup
              ? "Cliente retira na loja"
              : `${item.address_snapshot.rua}, ${item.address_snapshot.numero} - ${item.address_snapshot.bairro}`}
          </Text>
        </View>

        {nextLabel && nextStatus && (
          <TouchableOpacity
            style={[styles.advanceButton, { backgroundColor: ORDER_STATUS_COLORS[item.status] }]}
            onPress={() => handleAdvanceStatus(item)}
            disabled={updatingId === item.id}
          >
            {updatingId === item.id ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.advanceButtonText}>{nextLabel}</Text>
                <ChevronRight color="#fff" size={16} />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Pedidos Recebidos</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
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
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Nenhum pedido recebido
              </Text>
            </View>
          }
        />
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
  },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "600", marginHorizontal: 8 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  fulfillmentTag: { fontSize: 12, fontWeight: "500", marginTop: 4 },
  addressRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  addressText: { fontSize: 13 },
  advanceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 40,
    borderRadius: 10,
    marginTop: 12,
  },
  advanceButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  emptyContainer: { alignItems: "center", paddingTop: 64 },
  emptyText: { fontSize: 16 },
});
