import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useAppTheme } from "@/context/ThemeContext";

interface ReviewBannerProps {
  participantStoreId: string;
  onClose: () => void;
}

export function ReviewBanner({ participantStoreId, onClose }: ReviewBannerProps) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  const handleClose = async () => {
    try {
      await SecureStore.setItemAsync(
        `dismissed_review_banner_${participantStoreId}`,
        "true",
      );
    } catch (err) {
      console.error("Error saving review banner dismissal:", err);
    }
    onClose();
  };

  const handleStarPress = (rating: number) => {
    router.push({
      pathname: "/delivery/reviews/[storeId]",
      params: {
        storeId: participantStoreId,
        rating: rating.toString(),
      },
    });
  };

  return (
    <View
      style={[
        styles.reviewBannerContainer,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.25 : 0.08,
          shadowRadius: 12,
          elevation: 4,
        },
      ]}
    >
      <View style={styles.reviewBannerHeader}>
        <TouchableOpacity style={styles.reviewBannerCloseBtn} onPress={handleClose}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text
          style={[
            styles.reviewBannerTitle,
            { color: colors.text, textAlign: "center", flex: 1 },
          ]}
        >
          Avalie o pedido
        </Text>

        <View style={{ width: 32 }} />
      </View>

      <Text style={[styles.reviewBannerSub, { color: colors.textSecondary }]}>
        Como foi sua experiência com a loja? Avalie tocando nas estrelas:
      </Text>

      <View style={styles.reviewStarsRow}>
        {[1, 2, 3, 4, 5].map((val) => (
          <TouchableOpacity
            key={val}
            onPress={() => handleStarPress(val)}
            style={styles.reviewStarButton}
            activeOpacity={0.6}
          >
            <Ionicons name="star-outline" size={28} color="#FFD700" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reviewBannerContainer: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    borderRadius: 24,
    borderWidth: 0.5,
  },
  reviewBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  reviewBannerTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  reviewBannerCloseBtn: {
    padding: 4,
  },
  reviewBannerSub: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  reviewStarsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  reviewStarButton: {
    padding: 6,
  },
});
