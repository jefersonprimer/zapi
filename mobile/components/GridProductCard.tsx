import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  StoreProduct,
  formatProductPrice,
  formatQuantityLabel,
} from "@/services/deliveryApi";
import { useAppTheme } from "@/context/ThemeContext";
import { getFullRemoteUrl } from "@/services/mediaCache";
import { MIN_WEIGHT, WEIGHT_STEP } from "@/store/useCartStore";

interface GridProductCardProps {
  product: StoreProduct;
  qty: number;
  isCarousel?: boolean;
  onPress: () => void;
  onUpdateQty: (newQty: number) => void;
  onRemove: () => void;
  onQuickAdd: () => void;
}

export const GridProductCard: React.FC<GridProductCardProps> = ({
  product,
  qty,
  isCarousel = false,
  onPress,
  onUpdateQty,
  onRemove,
  onQuickAdd,
}) => {
  const { colors } = useAppTheme();
  const saleType = product.sale_type || "unit";
  const step = saleType === "weight" ? WEIGHT_STEP : 1;
  const minQty = saleType === "weight" ? MIN_WEIGHT : 1;
  const discountPct = product.promotional_price ? Math.round(((product.price - product.promotional_price) / product.price) * 100) : 0;

  return (
    <View
      style={[
        isCarousel ? styles.carouselProductCard : styles.mercadoCard,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
        },
        !isCarousel && { width: "48.5%" },
      ]}
    >
      <View
        style={isCarousel ? { position: "relative" } : styles.mercadoImageWrap}
      >
        <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
          {product.image ? (
            <Image
              source={{ uri: getFullRemoteUrl(product.image) }}
              style={
                isCarousel ? styles.carouselProductImage : styles.mercadoImage
              }
            />
          ) : (
            <View
              style={[
                isCarousel
                  ? styles.carouselProductImageFallback
                  : styles.mercadoImageFallback,
                { backgroundColor: colors.surface },
              ]}
            >
              <MaterialCommunityIcons
                name="store"
                color={colors.icon}
                size={isCarousel ? 30 : 36}
              />
            </View>
          )}
        </TouchableOpacity>

        {qty > 0 ? (
          <View
            style={[
              styles.mercadoPlusBtn,
              {
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                left: 6,
                right: 6,
                width: "auto",
                flexDirection: "row",
                paddingHorizontal: 8,
                justifyContent: "space-between",
                alignItems: "center",
              },
            ]}
          >
            <TouchableOpacity
              onPress={() =>
                qty <= minQty
                  ? onRemove()
                  : onUpdateQty(Math.round((qty - step) * 10) / 10)
              }
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
              }}
              hitSlop={6}
            >
              <MaterialCommunityIcons
                name="minus"
                color={colors.tint}
                size={24}
              />
            </TouchableOpacity>

            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                color: colors.text,
                marginHorizontal: 2,
              }}
            >
              {formatQuantityLabel(qty, saleType)}
            </Text>

            <TouchableOpacity
              onPress={() => onUpdateQty(Math.round((qty + step) * 10) / 10)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
              }}
              hitSlop={6}
            >
              <MaterialCommunityIcons
                name="plus"
                color={colors.tint}
                size={24}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.mercadoPlusBtn,
              {
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
            onPress={onQuickAdd}
            hitSlop={6}
          >
            <MaterialCommunityIcons name="plus" color={colors.tint} size={24} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        {product.promotional_price ? (
          <View style={styles.priceColumn}>
            <Text
              style={[
                isCarousel ? styles.carouselProductPrice : styles.mercadoPrice,
                { color: colors.tint },
              ]}
            >
              {formatProductPrice(product.promotional_price, saleType)}
            </Text>
            <View style={styles.discountRow}>
              <Text style={[styles.productPriceOriginal, { color: colors.textSecondary }]}>
                {formatProductPrice(product.price, saleType)}
              </Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>{discountPct}% OFF</Text>
              </View>
            </View>
          </View>
        ) : (
          <Text
            style={[
              isCarousel ? styles.carouselProductPrice : styles.mercadoPrice,
              { color: colors.tint },
            ]}
          >
            {formatProductPrice(product.price, saleType)}
          </Text>
        )}
        <Text
          style={[
            isCarousel ? styles.carouselProductName : styles.mercadoName,
            { color: colors.text },
          ]}
          numberOfLines={3}
        >
          {product.name}
        </Text>
        {!isCarousel && product.description ? (
          <Text
            style={[styles.mercadoDesc, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {product.description}
          </Text>
        ) : null}
        {!isCarousel && (
          <Text
            style={[styles.mercadoSaleType, { color: colors.textSecondary }]}
          >
            {saleType === "weight" ? "Peso (kg)" : "Unidade"}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  carouselProductCard: {
    width: 160,
    minHeight: 260,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    marginRight: 12,
  },
  carouselProductImage: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    marginBottom: 8,
  },
  carouselProductImageFallback: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  carouselProductPrice: {
    fontSize: 16,
    fontWeight: "500",
  },
  carouselProductName: {
    fontSize: 14,
    fontWeight: "400",
    marginTop: 4,
    height: 36,
  },
  mercadoCard: {
    width: "48.5%",
    minHeight: 360,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  mercadoImageWrap: {
    position: "relative",
    marginBottom: 8,
  },
  mercadoImage: {
    width: "100%",
    aspectRatio: 0.85,
    borderRadius: 8,
  },
  mercadoPlusBtn: {
    position: "absolute",
    right: 6,
    bottom: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  mercadoImageFallback: {
    width: "100%",
    aspectRatio: 0.85,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  mercadoPrice: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  mercadoName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  mercadoDesc: {
    fontSize: 12,
    marginBottom: 4,
  },
  mercadoSaleType: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 8,
  },
  priceColumn: {
    flexDirection: "column",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  discountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  discountBadge: {
    backgroundColor: "rgba(244, 63, 94, 0.1)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  discountBadgeText: {
    color: "#F43F5E",
    fontSize: 9,
    fontWeight: "bold",
  },
  productPriceOriginal: {
    fontSize: 12,
    textDecorationLine: "line-through",
  },
});
