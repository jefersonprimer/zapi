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
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
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

const DASHBOARD_WEB_URL = "http://192.168.5.22:3001/dashboard";

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
    }, [loadData]),
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

  const handleOpenDashboard = () => {
    Linking.openURL(DASHBOARD_WEB_URL);
  };

  const recentOrders = orders.slice(0, 5);
  const pendingCount = orders.filter(
    (o) =>
      o.status === "WAITING_STORE_CONFIRMATION" ||
      o.status === "PAID" ||
      o.status === "pendente",
  ).length;
  const todayRevenue = orders
    .filter((o) => {
      const d = new Date(o.created_at);
      const now = new Date();
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, o) => sum + o.total, 0);

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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[styles.header, { backgroundColor: colors.headerBackground }]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialCommunityIcons name="arrow-left" color={colors.headerText} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>
            Minha Loja
          </Text>
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="store" color={colors.icon} size={64} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Crie sua loja no Dashboard
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Acesse o painel web para cadastrar sua loja, produtos, horários e
            muito mais.
          </Text>
          <TouchableOpacity
            style={[styles.dashboardButton, { backgroundColor: colors.tint }]}
            onPress={handleOpenDashboard}
          >
            <MaterialCommunityIcons name="open-in-new" color="#fff" size={18} />
            <Text style={styles.dashboardButtonText}>Abrir Dashboard</Text>
          </TouchableOpacity>
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
          <MaterialCommunityIcons name="arrow-left" color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>
          Minha Loja
        </Text>
      </View>

      <FlatList
        data={recentOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
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
        ListHeaderComponent={
          <>
            {/* Store Card */}
            <View
              style={[
                styles.storeCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.storeHeader}>
                <View style={styles.storeInfo}>
                  <Text style={[styles.storeName, { color: colors.text }]}>
                    {store.name}
                  </Text>
                  <Text
                    style={[
                      styles.storeCategory,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {STORE_CATEGORIES[store.category] || store.category} •{" "}
                    {store.city}/{store.state}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleToggle} disabled={toggling}>
                  {toggling ? (
                    <ActivityIndicator color={colors.tint} />
                  ) : store.is_open ? (
                    <MaterialCommunityIcons name="toggle-switch" color={colors.tint} size={48} />
                  ) : (
                    <MaterialCommunityIcons name="toggle-switch-off" color={colors.icon} size={48} />
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.storeStatus}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: store.is_open ? "#10B981" : "#EF4444",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: store.is_open ? "#10B981" : "#EF4444",
                    },
                  ]}
                >
                  {store.is_open ? "Aberta" : "Fechada"}
                </Text>
              </View>
            </View>

            {/* Today Stats */}
            <View style={styles.statsRow}>
              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons name="cart" color={colors.tint} size={20} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {pendingCount}
                </Text>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Pedidos hoje
                </Text>
              </View>
              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons name="trending-up" color="#10B981" size={20} />
                <Text style={[styles.statValue, { color: "#10B981" }]}>
                  R$ {todayRevenue.toFixed(2)}
                </Text>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Faturamento
                </Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => router.push("/delivery/vendor/orders")}
              >
                <MaterialCommunityIcons name="clock-outline" color={colors.tint} size={28} />
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Pedidos
                </Text>
                <Text
                  style={[
                    styles.actionSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Gerenciar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => router.push("/delivery/vendor/products")}
              >
                <MaterialCommunityIcons name="package-variant" color={colors.tint} size={28} />
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Produtos
                </Text>
                <Text
                  style={[
                    styles.actionSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Estoque e preço
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => router.push("/(tabs)")}
              >
                <MaterialCommunityIcons name="message-text-outline" color={colors.tint} size={28} />
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Mensagens
                </Text>
                <Text
                  style={[
                    styles.actionSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Chat com clientes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: colors.tint,
                    borderColor: colors.tint,
                  },
                ]}
                onPress={handleOpenDashboard}
              >
                <MaterialCommunityIcons name="open-in-new" color="#fff" size={28} />
                <Text style={[styles.actionTitle, { color: "#fff" }]}>
                  Dashboard
                </Text>
                <Text style={[styles.actionSubtitle, { color: "#ffffffcc" }]}>
                  Gerenciar no navegador
                </Text>
              </TouchableOpacity>
            </View>

            {/* Recent Orders */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Pedidos recentes
              </Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.orderCard,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.orderHeader}>
              <Text style={[styles.orderId, { color: colors.text }]}>
                #{item.id.slice(0, 8).toUpperCase()}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: ORDER_STATUS_COLORS[item.status] + "20",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: ORDER_STATUS_COLORS[item.status] },
                  ]}
                >
                  {getOrderStatusLabel(item.status, item.fulfillment_type)}
                </Text>
              </View>
            </View>
            <Text style={[styles.orderTotal, { color: colors.tint }]}>
              R$ {item.total.toFixed(2)}
            </Text>
            <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
              {new Date(item.created_at).toLocaleDateString("pt-BR")}{" "}
              {new Date(item.created_at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.ordersEmpty}>
            <Text
              style={[styles.ordersEmptyText, { color: colors.textSecondary }]}
            >
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
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    marginHorizontal: 8,
  },
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
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "700", marginTop: 6 },
  statLabel: { fontSize: 12, marginTop: 2 },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
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
  sectionHeader: { marginBottom: 10, marginTop: 4 },
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 12, fontWeight: "600" },
  orderTotal: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  orderDate: { fontSize: 13, marginTop: 4 },
  ordersEmpty: { alignItems: "center", paddingVertical: 24 },
  ordersEmptyText: { fontSize: 14 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginTop: 16 },
  emptySubtitle: {
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
  },
  dashboardButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  dashboardButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
