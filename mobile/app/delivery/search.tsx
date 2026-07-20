import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, ArrowLeft, Store, MapPin } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  searchStores,
  listAddresses,
  Store as StoreType,
  UserAddress,
} from "@/services/deliveryApi";
import StoreCard from "@/components/StoreCard";

export default function SearchScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState("");
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState<UserAddress | null>(null);

  useEffect(() => {
    if (!token) return;
    listAddresses(token)
      .then((addrRes) => {
        const defaultAddr =
          addrRes.addresses.find((a) => a.is_default) ||
          addrRes.addresses[0] ||
          null;
        setAddress(defaultAddr);
      })
      .catch((err) => console.error("Failed to load address:", err));
  }, [token]);

  useEffect(() => {
    if (!token || !address) return;

    if (!searchQuery.trim()) {
      setStores([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const geoParams = {
          state: address.estado,
          city: address.cidade,
          ...(address.latitude != null && address.longitude != null
            ? { lat: address.latitude, lng: address.longitude }
            : {}),
        };
        const data = await searchStores(token, searchQuery.trim(), geoParams);
        setStores(data.stores || []);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, token, address]);

  const renderStore = ({ item }: { item: StoreType }) => {
    return <StoreCard item={item} />;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header containing search bar */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.headerBackground,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.headerText} />
        </TouchableOpacity>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Search color={colors.icon} size={18} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar loja..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={[styles.clearText, { color: colors.tint }]}>
                Limpar
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!address ? (
        <View style={styles.emptyContainer}>
          <MapPin color={colors.icon} size={64} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Cadastre um endereço para buscar lojas na sua cidade
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.tint }]}
            onPress={() => router.push("/delivery/addresses")}
          >
            <Text style={styles.emptyButtonText}>Adicionar endereço</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
            </View>
          )}

          {!loading && searchQuery.trim().length > 0 && (
            <FlatList
              data={stores}
              keyExtractor={(item) => item.id}
              renderItem={renderStore}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Store color={colors.icon} size={64} />
                  <Text
                    style={[styles.emptyText, { color: colors.textSecondary }]}
                  >
                    Nenhuma loja encontrada para &quot;{searchQuery}&quot;
                  </Text>
                </View>
              }
            />
          )}

          {!loading && searchQuery.trim().length === 0 && (
            <View style={styles.emptyContainer}>
              <Search color={colors.icon} size={64} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Digite o nome de uma loja para começar a buscar
              </Text>
            </View>
          )}
        </View>
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
    paddingBottom: 12,
    gap: 8,
  },
  backButton: { padding: 8 },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, paddingVertical: 0 },
  clearText: { fontSize: 13, fontWeight: "600", marginLeft: 4 },
  list: { flex: 1 },
  listContent: { padding: 16 },
  storeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  storeAvatar: { width: 60, height: 60, borderRadius: 12 },
  storeAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
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
  loadingContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 64,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 15, marginTop: 12, textAlign: "center" },
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
});
