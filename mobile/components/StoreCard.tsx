import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";
import { Store as StoreType } from "@/services/deliveryApi";
import { getFullRemoteUrl } from "@/services/mediaCache";

interface StoreCardProps {
  item: StoreType;
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

export default function StoreCard({ item }: StoreCardProps) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const isOpen = isStoreOpenNow(item);

  return (
    <TouchableOpacity
      style={[
        styles.storeCard,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
        },
      ]}
      onPress={() =>
        router.push({
          pathname: "/delivery/[storeId]",
          params: { storeId: item.id },
        })
      }
      activeOpacity={0.7}
    >
      {item.avatar ? (
        <Image
          source={{ uri: getFullRemoteUrl(item.avatar) }}
          style={styles.storeAvatar}
        />
      ) : (
        <View
          style={[
            styles.storeAvatarPlaceholder,
            { backgroundColor: colors.surface },
          ]}
        >
          <Ionicons name="storefront-outline" color={colors.icon} size={32} />
        </View>
      )}
      <View style={styles.storeInfo}>
        <View
          style={{
            flexDirection: "column",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <Text
            style={[styles.storeName, { color: colors.text }]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 4,
            }}
          >
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isOpen ? "#D1FAE5" : "#FEE2E2" },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: isOpen ? "#065F46" : "#991B1B" },
                ]}
              >
                {isOpen ? "Aberto" : "Fechado"}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: `${colors.tint}10`,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                gap: 2,
              }}
            >
              <Ionicons name="star" size={11} color="#F59E0B" />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "bold",
                  color: colors.text,
                }}
              >
                {item.score && Number(item.ratings_count) > 0
                  ? `${Number(item.score).toFixed(1)}`
                  : "Novo"}
              </Text>
            </View>
            {item.has_coupons && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#FEF3C7",
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  gap: 3,
                }}
              >
                <Ionicons name="pricetag" size={10} color="#D97706" />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "bold",
                    color: "#B45309",
                  }}
                >
                  Cupom
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.storeMeta}>
          {item.eta_min != null && (
            <View style={styles.metaItem}>
              <Ionicons
                name="time-outline"
                size={12}
                color={colors.textSecondary}
              />
              <Text style={[styles.storeFee, { color: colors.textSecondary }]}>
                {formatEta(item.eta_min)}
              </Text>
            </View>
          )}
          {item.distance_km != null && (
            <View style={styles.metaItem}>
              <Ionicons
                name="bicycle-outline"
                size={12}
                color={colors.textSecondary}
              />
              <Text style={[styles.storeFee, { color: colors.textSecondary }]}>
                {formatDistance(item.distance_km)}
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            {item.delivery_fee === 0 && (
              <Ionicons
                name="bicycle-outline"
                size={12}
                color={colors.textSecondary}
              />
            )}
            <Text style={[styles.storeFee, { color: colors.textSecondary }]}>
              {item.delivery_fee === 0
                ? "Entrega grátis"
                : `R$ ${item.delivery_fee.toFixed(2)}`}
            </Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" color={colors.icon} size={20} />
    </TouchableOpacity>
  );
}

export function StoreCardSkeleton() {
  const { colors } = useAppTheme();
  const fadeAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.7,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.35,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [fadeAnim]);

  return (
    <Animated.View
      style={[
        styles.storeCard,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
          opacity: fadeAnim,
        },
      ]}
    >
      <View
        style={[
          styles.storeAvatarPlaceholder,
          { backgroundColor: colors.surface },
        ]}
      />
      <View style={styles.storeInfo}>
        <View
          style={{
            flexDirection: "column",
            gap: 8,
          }}
        >
          <View
            style={[
              styles.skeletonLine,
              { backgroundColor: colors.surface, width: "65%", height: 16 },
            ]}
          />
          <View style={{ flexDirection: "row", gap: 6 }}>
            <View
              style={[
                styles.skeletonLine,
                { backgroundColor: colors.surface, width: 55, height: 16 },
              ]}
            />
            <View
              style={[
                styles.skeletonLine,
                { backgroundColor: colors.surface, width: 40, height: 16 },
              ]}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <View
              style={[
                styles.skeletonLine,
                { backgroundColor: colors.surface, width: 55, height: 12 },
              ]}
            />
            <View
              style={[
                styles.skeletonLine,
                { backgroundColor: colors.surface, width: 45, height: 12 },
              ]}
            />
            <View
              style={[
                styles.skeletonLine,
                { backgroundColor: colors.surface, width: 65, height: 12 },
              ]}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
  storeName: { fontSize: 16, fontWeight: "500" },
  storeMeta: {
    flexDirection: "row",
    marginTop: 4,
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  storeFee: { fontSize: 12 },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  skeletonLine: {
    borderRadius: 4,
  },
});
