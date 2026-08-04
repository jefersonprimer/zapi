import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { listPromotions, PromotionalProduct } from "@/services/deliveryApi";
import { getFullRemoteUrl } from "@/services/mediaCache";

export default function PromotionsSection() {
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const router = useRouter();
  const [promotions, setPromotions] = useState<PromotionalProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPromotions() {
      if (!token) return;
      try {
        setLoading(true);
        const data = await listPromotions(token);
        setPromotions(data.promotions || []);
      } catch (err) {
        console.error("Error loading promotions:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPromotions();
  }, [token]);

  if (!loading && promotions.length === 0) {
    return null;
  }

  const MAX_PROMOTIONS = 12;
  const displayedPromotions = promotions.slice(0, MAX_PROMOTIONS);

  return (
    <View style={styles.sectionContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              Ofertas Imperdíveis
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Até 50% OFF</Text>
            </View>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Os melhores descontos da sua região reunidos aqui
          </Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.tint} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
        >
          {displayedPromotions.map((item) => {
            const discountPct = Math.round(
              ((item.price - item.promotional_price) / item.price) * 100
            );

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.cardBackground || colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() =>
                  router.push({
                    pathname: "/delivery/[storeId]",
                    params: { storeId: item.store_id },
                  })
                }
              >
                {/* Store Info Header */}
                <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
                  {item.store_avatar ? (
                    <Image
                      source={{ uri: getFullRemoteUrl(item.store_avatar) }}
                      style={styles.storeAvatar}
                    />
                  ) : (
                    <View style={[styles.storeAvatarPlaceholder, { backgroundColor: colors.surface }]}>
                      <Ionicons name="storefront-outline" size={12} color={colors.textSecondary} />
                    </View>
                  )}
                  <Text
                    style={[styles.storeName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.store_name}
                  </Text>
                </View>

                {/* Product Image Area */}
                <View style={styles.imageContainer}>
                  {item.image ? (
                    <Image
                      source={{ uri: getFullRemoteUrl(item.image) }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.productImagePlaceholder, { backgroundColor: colors.surface }]}>
                      <Ionicons name="pricetag-outline" size={24} color={colors.icon} />
                    </View>
                  )}

                  {/* Discount Tag */}
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>{discountPct}% OFF</Text>
                  </View>
                </View>

                {/* Product Details */}
                <View style={styles.cardDetails}>
                  <Text
                    style={[styles.productName, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                  {item.description ? (
                    <Text
                      style={[styles.productDescription, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {item.description}
                    </Text>
                  ) : null}

                  {/* Prices */}
                  <View style={styles.priceRow}>
                    <Text style={[styles.oldPrice, { color: colors.textSecondary }]}>
                      R$ {item.price.toFixed(2).replace(".", ",")}
                    </Text>
                    <Text style={[styles.promoPrice, { color: colors.tint }]}>
                      R$ {item.promotional_price.toFixed(2).replace(".", ",")}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginVertical: 14,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  headerTextContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  badge: {
    backgroundColor: "rgba(244, 63, 94, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.2)",
  },
  badgeText: {
    color: "#F43F5E",
    fontSize: 10,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContainer: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
  card: {
    width: 160,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "column",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  storeAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  storeAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  storeName: {
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  imageContainer: {
    width: "100%",
    height: 160,
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  productImagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  discountBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
  },
  discountText: {
    color: "#B91C1C",
    fontSize: 9,
    fontWeight: "800",
  },
  cardDetails: {
    padding: 10,
    flex: 1,
    justifyContent: "space-between",
  },
  productName: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 16,
  },
  productDescription: {
    fontSize: 11,
    marginTop: 2,
  },
  priceRow: {
    marginTop: 8,
    flexDirection: "column",
  },
  oldPrice: {
    fontSize: 10,
    textDecorationLine: "line-through",
  },
  promoPrice: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 1,
  },
});
