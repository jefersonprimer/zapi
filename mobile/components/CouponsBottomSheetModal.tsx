import React, { forwardRef, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StoreCoupon } from "@/services/deliveryApi";

interface CouponsBottomSheetModalProps {
  coupons: StoreCoupon[];
  onCopyCoupon: (code: string) => void;
}

export const CouponsBottomSheetModal = forwardRef<
  BottomSheetModal,
  CouponsBottomSheetModalProps
>(({ coupons, onCopyCoupon }, ref) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["85%"], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const handleClose = () => {
    if (ref && "current" in ref && ref.current) {
      ref.current.dismiss();
    }
  };

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.headerButton, { borderColor: colors.border }]}
          >
            <Ionicons name="close" color={colors.textSecondary} size={24} />
          </TouchableOpacity>
          <Text
            style={[styles.modalTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            Cupons Disponíveis
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <BottomSheetScrollView
          contentContainerStyle={[
            styles.couponsModalScroll,
            { paddingBottom: 40 + insets.bottom },
          ]}
        >
          {coupons.map((coupon) => (
            <TouchableOpacity
              key={coupon.id}
              style={[
                styles.couponModalCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => {
                onCopyCoupon(coupon.code);
                handleClose();
              }}
            >
              <View
                style={[
                  styles.couponTicketLeft,
                  { backgroundColor: `${colors.tint}10` },
                ]}
              >
                <MaterialCommunityIcons
                  name="ticket-percent"
                  color={colors.tint}
                  size={24}
                />
              </View>

              <View
                style={[
                  styles.couponTicketDivider,
                  { borderStyle: "dashed", borderColor: colors.border },
                ]}
              />

              <View style={styles.couponTicketRight}>
                <Text
                  style={[
                    styles.couponValueText,
                    { color: colors.text, fontSize: 16 },
                  ]}
                >
                  {coupon.discount_type === "percentage"
                    ? `${coupon.discount_value}% OFF`
                    : `R$ ${coupon.discount_value.toFixed(0)} OFF`}
                </Text>
                <Text
                  style={[
                    styles.couponCodeText,
                    { color: colors.tint, fontSize: 14 },
                  ]}
                >
                  Código: {coupon.code}
                </Text>
                {coupon.min_order > 0 && (
                  <Text
                    style={[
                      styles.couponMinOrderText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Mínimo: R$ {coupon.min_order.toFixed(0)}
                  </Text>
                )}
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    marginTop: 4,
                  }}
                >
                  Toque para copiar o código
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
});

CouponsBottomSheetModal.displayName = "CouponsBottomSheetModal";

const styles = StyleSheet.create({
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "500",
    flex: 1,
    textAlign: "center",
  },
  couponsModalScroll: {
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  couponModalCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    height: 80,
    marginBottom: 12,
  },
  couponTicketLeft: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  couponTicketDivider: {
    width: 1,
    height: "100%",
    borderWidth: 1,
  },
  couponTicketRight: {
    paddingHorizontal: 12,
    justifyContent: "center",
    flex: 1,
  },
  couponValueText: {
    fontSize: 14,
    fontWeight: "700",
  },
  couponCodeText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 2,
  },
  couponMinOrderText: {
    fontSize: 10,
    marginTop: 2,
  },
});
