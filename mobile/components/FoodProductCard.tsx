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

interface FoodProductCardProps {
  product: StoreProduct;
  qty: number;
  onPress: () => void;
  onUpdateQty: (newQty: number) => void;
  onRemove: () => void;
  onAddPress: () => void;
  layout?: "horizontal" | "vertical";
}

export const FoodProductCard: React.FC<FoodProductCardProps> = ({
  product,
  qty,
  onPress,
  onUpdateQty,
  onRemove,
  onAddPress,
  layout = "horizontal",
}) => {
  const { colors } = useAppTheme();
  const saleType = product.sale_type || "unit";
  const step = saleType === "weight" ? WEIGHT_STEP : 1;
  const minQty = saleType === "weight" ? MIN_WEIGHT : 1;
  const isVertical = layout === "vertical";
  const discountPct = product.promotional_price
    ? Math.round(
        ((product.price - product.promotional_price) / product.price) * 100,
      )
    : 0;

  const renderImageContainer = () => (
    <View
      style={isVertical ? styles.verticalImageContainer : styles.imageContainer}
    >
      {product.image ? (
        <Image
          source={{ uri: getFullRemoteUrl(product.image) }}
          style={isVertical ? styles.verticalProductImage : styles.productImage}
        />
      ) : (
        <View
          style={[
            isVertical ? styles.verticalProductImage : styles.productImage,
            {
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="store"
            color={colors.icon}
            size={isVertical ? 36 : 26}
          />
        </View>
      )}

      {qty > 0 ? (
        <View
          style={[
            styles.quantityOverlay,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.qtyButton, { backgroundColor: colors.border }]}
            onPress={() =>
              qty <= minQty
                ? onRemove()
                : onUpdateQty(Math.round((qty - step) * 10) / 10)
            }
          >
            <MaterialCommunityIcons
              name="minus"
              color={colors.text}
              size={20}
            />
          </TouchableOpacity>
          <Text
            style={[styles.qtyText, { color: colors.text }]}
            numberOfLines={1}
          >
            {formatQuantityLabel(qty, saleType)}
          </Text>
          <TouchableOpacity
            style={[styles.qtyButton, { backgroundColor: colors.tint }]}
            onPress={() => onUpdateQty(Math.round((qty + step) * 10) / 10)}
          >
            <MaterialCommunityIcons name="plus" color="#fff" size={20} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.addOverlay,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={onAddPress}
        >
          <MaterialCommunityIcons name="plus" color={colors.tint} size={22} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View
      style={[
        isVertical ? styles.verticalProductCard : styles.productCard,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={{
          flex: 1,
          flexDirection: isVertical ? "column" : "row",
          alignItems: isVertical ? "stretch" : "center",
        }}
      >
        {isVertical ? (
          <>
            {renderImageContainer()}
            <View style={styles.verticalProductInfo}>
              {product.promotional_price ? (
                <View style={styles.priceColumn}>
                  <Text style={[styles.productPrice, { color: colors.tint }]}>
                    {formatProductPrice(product.promotional_price, saleType)}
                  </Text>
                  <View style={styles.discountRow}>
                    <Text
                      style={[
                        styles.productPriceOriginal,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatProductPrice(product.price, saleType)}
                    </Text>
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>
                        {discountPct}% OFF
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <Text style={[styles.productPrice, { color: colors.tint }]}>
                  {formatProductPrice(product.price, saleType)}
                </Text>
              )}
              <Text
                style={[styles.productName, { color: colors.text }]}
                numberOfLines={2}
              >
                {product.name}
              </Text>
              {product.description ? (
                <Text
                  style={[styles.productDesc, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {product.description}
                </Text>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <View style={styles.productInfo}>
              <Text
                style={[styles.productName, { color: colors.text }]}
                numberOfLines={2}
              >
                {product.name}
              </Text>
              {product.description ? (
                <Text
                  style={[styles.productDesc, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {product.description}
                </Text>
              ) : null}
              {product.promotional_price ? (
                <View style={styles.priceColumn}>
                  <Text style={[styles.productPrice, { color: colors.tint }]}>
                    {formatProductPrice(product.promotional_price, saleType)}
                  </Text>
                  <View style={styles.discountRow}>
                    <Text
                      style={[
                        styles.productPriceOriginal,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatProductPrice(product.price, saleType)}
                    </Text>
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>
                        {discountPct}% OFF
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <Text style={[styles.productPrice, { color: colors.tint }]}>
                  {formatProductPrice(product.price, saleType)}
                </Text>
              )}
            </View>
            {renderImageContainer()}
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  productCard: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: "center",
  },
  verticalProductCard: {
    flex: 1,
    maxWidth: "48%",
    flexDirection: "column",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    margin: 6,
    alignItems: "stretch",
  },
  productInfo: { flex: 1, paddingRight: 8 },
  verticalProductInfo: {
    marginTop: 8,
    gap: 4,
  },
  priceColumn: {
    flexDirection: "column",
    alignItems: "flex-start",
    marginTop: 4,
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
  productName: { fontSize: 14, fontWeight: "400" },
  productDesc: { fontSize: 12, marginTop: 4 },
  productPrice: { fontSize: 16, fontWeight: "500" },
  imageContainer: {
    position: "relative",
    marginLeft: 10,
    paddingBottom: 10, // space for overlay
  },
  verticalImageContainer: {
    position: "relative",
    width: "100%",
    height: 140,
    paddingBottom: 10, // space for overlay
  },
  productImage: { width: 100, height: 100, borderRadius: 16 },
  verticalProductImage: { width: "100%", height: 140, borderRadius: 10 },
  quantityOverlay: {
    position: "absolute",
    bottom: -6,
    left: -10,
    right: -10,
    height: 42,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  qtyButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  addOverlay: {
    position: "absolute",
    bottom: -6,
    right: -4,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
});
