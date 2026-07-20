import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, MapPin, Tag } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  getOrder,
  Order,
  OrderItem,
  Store,
  getOrderStatusLabel,
  ORDER_STATUS_COLORS,
  formatQuantityLabel,
} from "@/services/deliveryApi";

const STEPS = ["PENDING_PAYMENT", "PAID", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"];

function getStepIndex(status: string): number {
  const normalized = status.toUpperCase();
  if (normalized === "PENDING_PAYMENT" || normalized === "PENDENTE") return 0;
  if (normalized === "PAID") return 1;
  if (normalized === "ACCEPTED" || normalized === "CONFIRMADO") return 2;
  if (normalized === "PREPARING" || normalized === "PREPARANDO") return 3;
  if (normalized === "READY" || normalized === "OUT_FOR_DELIVERY" || normalized === "SAIU_ENTREGA") return 4;
  if (normalized === "DELIVERED" || normalized === "ENTREGUE") return 5;
  return -1;
}

function formatOrderDate(dateStr: string): string {
  const part = dateStr.slice(0, 10);
  const [y, m, d] = part.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!token || !id) return;
    try {
      const data = await getOrder(token, id);
      setOrder(data.order);
      setItems(data.items);
      setStore(data.store);
    } catch (err) {
      console.error("Failed to load order:", err);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.textSecondary }}>Pedido não encontrado</Text>
      </View>
    );
  }

  const currentStep = getStepIndex(order.status);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>
          Pedido #{order.id.slice(0, 8).toUpperCase()}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Progress */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Status do pedido</Text>
          <View style={styles.stepsContainer}>
            {STEPS.map((step, idx) => {
              const isActive = idx <= currentStep;
              const isCurrent = idx === currentStep;
              return (
                <View key={step} style={styles.stepRow}>
                  <View style={[styles.stepDot, { backgroundColor: isActive ? ORDER_STATUS_COLORS[step] : colors.surface }]} />
                  <View style={[styles.stepLine, { backgroundColor: idx < STEPS.length - 1 ? (isActive && idx < currentStep ? ORDER_STATUS_COLORS[step] : colors.border) : "transparent" }]} />
                  <Text style={[styles.stepLabel, { color: isActive ? ORDER_STATUS_COLORS[step] : colors.textSecondary, fontWeight: isCurrent ? "700" : "400" }]}>
                    {getOrderStatusLabel(step, order.fulfillment_type)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Store Info */}
        {store && (
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Loja</Text>
            <Text style={{ color: colors.text, fontWeight: "500" }}>{store.name}</Text>
          </View>
        )}

        {/* Items */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Itens</Text>
          {items.map((item) => {
            let parsedAddons: { name: string; price: number }[] = [];
            if (item.addons && Array.isArray(item.addons)) {
              parsedAddons = item.addons;
            } else if (typeof item.addons === "string") {
              try { parsedAddons = JSON.parse(item.addons); } catch {}
            }
            return (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: colors.text }]}>
                    {item.sale_type === "weight"
                      ? `${formatQuantityLabel(item.quantity_decimal ?? item.quantity, "weight")} ${item.product_name}`
                      : `${item.quantity}x ${item.product_name}`}
                  </Text>
                  {parsedAddons.length > 0 && parsedAddons.map((addon, idx) => (
                    <Text key={idx} style={[styles.addonText, { color: colors.textSecondary }]}>
                      + {addon.name} (R$ {(addon.price || 0).toFixed(2)})
                    </Text>
                  ))}
                </View>
                <Text style={[styles.itemPrice, { color: colors.text }]}>R$ {item.subtotal.toFixed(2)}</Text>
              </View>
            );
          })}
        </View>

        {/* Address / Fulfillment */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <MapPin color={colors.icon} size={18} />
            <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>
              {order.fulfillment_type === "retirada" ? "Retirada" : "Entrega"}
            </Text>
          </View>
          {order.scheduled_date && order.slot_start && (
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600", marginBottom: 6 }}>
              {order.fulfillment_type === "retirada"
                ? `Retirar em ${formatOrderDate(order.scheduled_date)} a partir das ${order.slot_start}`
                : `Receber em ${formatOrderDate(order.scheduled_date)} das ${order.slot_start} às ${order.slot_end}`}
            </Text>
          )}
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            {order.address_snapshot.rua}, {order.address_snapshot.numero} - {order.address_snapshot.bairro}, {order.address_snapshot.cidade}-{order.address_snapshot.estado}
          </Text>
        </View>

        {/* Totals */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.totalRow}>
            <Text style={{ color: colors.textSecondary }}>Subtotal</Text>
            <Text style={{ color: colors.text }}>R$ {order.subtotal.toFixed(2)}</Text>
          </View>
          {order.discount > 0 && (
            <View style={styles.totalRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Tag color="#10B981" size={14} />
                <Text style={{ color: "#10B981" }}>{order.coupon_code}</Text>
              </View>
              <Text style={{ color: "#10B981" }}>- R$ {order.discount.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={{ color: colors.textSecondary }}>
              {order.fulfillment_type === "retirada" ? "Retirada" : "Entrega"}
            </Text>
            <Text style={{ color: colors.text }}>
              {order.delivery_fee > 0 ? `R$ ${order.delivery_fee.toFixed(2)}` : "Grátis"}
            </Text>
          </View>
          <View style={[styles.totalRow, styles.totalFinal]}>
            <Text style={[styles.totalFinalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.totalFinalValue, { color: colors.tint }]}>R$ {order.total.toFixed(2)}</Text>
          </View>
        </View>

        {order.observation && (
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Observação</Text>
            <Text style={{ color: colors.textSecondary }}>{order.observation}</Text>
          </View>
        )}

        <Text style={[styles.dateText, { color: colors.textSecondary }]}>
          Pedido feito em {new Date(order.created_at).toLocaleDateString("pt-BR")} às {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </ScrollView>
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
  content: { padding: 16, paddingBottom: 48 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", marginBottom: 10 },
  stepsContainer: { paddingLeft: 4 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 28 },
  stepDot: { width: 14, height: 14, borderRadius: 7 },
  stepLine: { width: 2, height: 14, borderRadius: 1, position: "absolute", left: 6, top: 14 },
  stepLabel: { fontSize: 14 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  itemName: { fontSize: 14 },
  addonText: { fontSize: 12, paddingLeft: 8 },
  itemPrice: { fontSize: 14 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalFinal: { borderTopWidth: 1, borderTopColor: "#E5E7EB", marginTop: 8, paddingTop: 8 },
  totalFinalLabel: { fontSize: 16, fontWeight: "700" },
  totalFinalValue: { fontSize: 18, fontWeight: "700" },
  dateText: { fontSize: 12, textAlign: "center", marginTop: 8 },
});
