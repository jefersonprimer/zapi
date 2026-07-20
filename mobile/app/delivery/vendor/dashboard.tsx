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
import {
  ArrowLeft,
  Store,
  Package,
  ToggleLeft,
  ToggleRight,
  Plus,
  Clock,
  Pencil,
  Tag,
  Calendar,
  FolderOpen,
  Bike,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  getVendorStore,
  listVendorOrders,
  toggleStore,
  Store as StoreType,
  Order,
  STORE_CATEGORIES,
  getOrderStatusLabel,
  ORDER_STATUS_COLORS,
} from "@/services/deliveryApi";

export default function VendorDashboardScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();

  const [store, setStore] = useState<StoreType | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const storeData = await getVendorStore(token);
      setStore(storeData.store);
      if (storeData.store) {
        const od = await listVendorOrders(token);
        setOrders(od.orders);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error("Failed to load vendor data:", err);
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

  const handleToggle = async () => {
    if (!token || !store || toggling) return;
    setToggling(true);
    try {
      const data = await toggleStore(token, store.id);
      setStore(data.store);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao alterar status");
    } finally {
      setToggling(false);
    }
  };

  const recentOrders = orders.slice(0, 5);
  const pendingCount = orders.filter((o) => o.status === "WAITING_STORE_CONFIRMATION" || o.status === "PAID" || o.status === "pendente").length;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!store) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={colors.headerText} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>Vendedor</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Store color={colors.icon} size={64} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Criar sua loja</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Cadastre sua loja em menos de 5 minutos
          </Text>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: colors.tint }]}
            onPress={() => router.push("/delivery/vendor/create-store")}
          >
            <Plus color="#fff" size={20} />
            <Text style={styles.createButtonText}>Criar Loja</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Minha Loja</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push({ pathname: "/delivery/vendor/create-store", params: { mode: "edit" } })}
        >
          <Pencil color={colors.headerText} size={22} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={recentOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.tint} />
        }
        ListHeaderComponent={
          <>
            {/* Store Card */}
            <View style={[styles.storeCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.storeHeader}>
                <View style={styles.storeInfo}>
                  <Text style={[styles.storeName, { color: colors.text }]}>{store.name}</Text>
                  <Text style={[styles.storeCategory, { color: colors.textSecondary }]}>
                    {STORE_CATEGORIES[store.category] || store.category} • {store.city}/{store.state}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleToggle} disabled={toggling}>
                  {toggling ? (
                    <ActivityIndicator color={colors.tint} />
                  ) : store.is_open ? (
                    <ToggleRight color={colors.tint} size={48} />
                  ) : (
                    <ToggleLeft color={colors.icon} size={48} />
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.storeStatus}>
                <View style={[styles.statusDot, { backgroundColor: store.is_open ? "#10B981" : "#EF4444" }]} />
                <Text style={[styles.statusText, { color: store.is_open ? "#10B981" : "#EF4444" }]}>
                  {store.is_open ? "Aberta" : "Fechada"}
                </Text>
              </View>
              <View style={styles.storeStats}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.tint }]}>R$ {store.delivery_fee.toFixed(2)}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Taxa entrega</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.tint }]}>R$ {store.minimum_order.toFixed(2)}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pedido mín.</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: pendingCount > 0 ? "#F59E0B" : colors.text }]}>
                    {pendingCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pendentes</Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => router.push("/delivery/vendor/products")}
              >
                <Package color={colors.tint} size={28} />
                <Text style={[styles.actionTitle, { color: colors.text }]}>Produtos</Text>
                <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Gerenciar cardápio</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => router.push("/delivery/vendor/orders")}
              >
                <Clock color={colors.tint} size={28} />
                <Text style={[styles.actionTitle, { color: colors.text }]}>Pedidos</Text>
                <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Ver recebidos</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => router.push("/delivery/vendor/categories")}
              >
                <FolderOpen color={colors.tint} size={28} />
                <Text style={[styles.actionTitle, { color: colors.text }]}>Categorias</Text>
                <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Frutas, Legumes…</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => router.push("/delivery/vendor/coupons")}
              >
                <Tag color={colors.tint} size={28} />
                <Text style={[styles.actionTitle, { color: colors.text }]}>Cupons</Text>
                <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Descontos</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => router.push("/delivery/vendor/hours")}
              >
                <Calendar color={colors.tint} size={28} />
                <Text style={[styles.actionTitle, { color: colors.text }]}>Horários</Text>
                <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Funcionamento</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => router.push("/delivery/vendor/slots")}
              >
                <Bike color={colors.tint} size={28} />
                <Text style={[styles.actionTitle, { color: colors.text }]}>Agendamento</Text>
                <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Entrega e retirada</Text>
              </TouchableOpacity>
            </View>

            {/* Recent Orders */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Pedidos recentes</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={[styles.orderCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.orderHeader}>
              <Text style={[styles.orderId, { color: colors.text }]}>
                #{item.id.slice(0, 8).toUpperCase()}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: ORDER_STATUS_COLORS[item.status] + "20" }]}>
                <Text style={[styles.statusBadgeText, { color: ORDER_STATUS_COLORS[item.status] }]}>
                  {getOrderStatusLabel(item.status, item.fulfillment_type)}
                </Text>
              </View>
            </View>
            <Text style={[styles.orderTotal, { color: colors.tint }]}>R$ {item.total.toFixed(2)}</Text>
            <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
              {new Date(item.created_at).toLocaleDateString("pt-BR")} {new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.ordersEmpty}>
            <Text style={[styles.ordersEmptyText, { color: colors.textSecondary }]}>
              Nenhum pedido recebido ainda
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
  storeCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  storeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  storeInfo: { flex: 1, marginRight: 12 },
  storeName: { fontSize: 20, fontWeight: "700" },
  storeCategory: { fontSize: 13, marginTop: 2 },
  storeStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: "600" },
  storeStats: {
    flexDirection: "row",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 16, fontWeight: "700" },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, marginVertical: -4 },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  actionTitle: { fontSize: 15, fontWeight: "600", marginTop: 8 },
  actionSubtitle: { fontSize: 12, marginTop: 2 },
  sectionHeader: { marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: "600" },
  orderCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderId: { fontSize: 14, fontWeight: "600" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 12, fontWeight: "600" },
  orderTotal: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  orderDate: { fontSize: 13, marginTop: 4 },
  ordersEmpty: { alignItems: "center", paddingVertical: 24 },
  ordersEmptyText: { fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginTop: 16 },
  emptySubtitle: { fontSize: 15, marginTop: 8, textAlign: "center" },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  createButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
