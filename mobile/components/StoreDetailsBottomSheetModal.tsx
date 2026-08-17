import React, { forwardRef, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Store, StoreHours, WEEKDAYS } from "@/services/deliveryApi";

interface StoreDetailsBottomSheetModalProps {
  store: Store;
  hours: StoreHours[];
  onViewReviews: () => void;
}

export const StoreDetailsBottomSheetModal = forwardRef<
  BottomSheetModal,
  StoreDetailsBottomSheetModalProps
>(({ store, hours, onViewReviews }, ref) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["96%"], []);

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
            Detalhes da Loja
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <BottomSheetScrollView
          contentContainerStyle={[
            styles.detailsModalScroll,
            { paddingBottom: 40 + insets.bottom },
          ]}
        >
          {/* Store Name and Description */}
          <View style={styles.detailsModalSection}>
            <Text
              style={[styles.detailsModalStoreName, { color: colors.text }]}
            >
              {store.name}
            </Text>
            {store.description && (
              <Text
                style={[
                  styles.detailsModalDesc,
                  { color: colors.textSecondary },
                ]}
              >
                {store.description}
              </Text>
            )}
          </View>

          {/* Delivery and Minimum Order */}
          <View
            style={[
              styles.detailsModalSection,
              { borderTopColor: colors.border, borderTopWidth: 1 },
            ]}
          >
            <Text style={[styles.detailsModalSecTitle, { color: colors.text }]}>
              Valores e Prazos
            </Text>
            <View style={styles.detailsModalRow}>
              <Text
                style={[
                  styles.detailsModalLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Taxa de entrega
              </Text>
              <Text style={[styles.detailsModalValue, { color: colors.text }]}>
                {store.delivery_fee === 0
                  ? "Grátis"
                  : `R$ ${store.delivery_fee.toFixed(2)}`}
              </Text>
            </View>
            <View style={styles.detailsModalRow}>
              <Text
                style={[
                  styles.detailsModalLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Pedido mínimo
              </Text>
              <Text style={[styles.detailsModalValue, { color: colors.text }]}>
                {store.minimum_order === 0
                  ? "Sem valor mínimo"
                  : `R$ ${store.minimum_order.toFixed(2)}`}
              </Text>
            </View>
            {store.prep_time_minutes ? (
              <View style={styles.detailsModalRow}>
                <Text
                  style={[
                    styles.detailsModalLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Tempo de preparo
                </Text>
                <Text
                  style={[styles.detailsModalValue, { color: colors.text }]}
                >
                  ~{store.prep_time_minutes} min
                </Text>
              </View>
            ) : null}
          </View>

          {/* Address */}
          <View
            style={[
              styles.detailsModalSection,
              { borderTopColor: colors.border, borderTopWidth: 1 },
            ]}
          >
            <Text style={[styles.detailsModalSecTitle, { color: colors.text }]}>
              Endereço
            </Text>
            <Text
              style={[styles.detailsModalAddressText, { color: colors.text }]}
            >
              {store.street
                ? `${store.street}, ${store.number || "S/N"}`
                : "Endereço não disponível"}
              {store.neighborhood ? ` - ${store.neighborhood}` : ""}
              {`\n${store.city} - ${store.state}`}
              {store.cep ? `\nCEP: ${store.cep}` : ""}
            </Text>
          </View>

          {/* Phone & CNPJ */}
          {(store.phone || store.cnpj) && (
            <View
              style={[
                styles.detailsModalSection,
                { borderTopColor: colors.border, borderTopWidth: 1 },
              ]}
            >
              <Text
                style={[styles.detailsModalSecTitle, { color: colors.text }]}
              >
                Contato & Dados
              </Text>
              {store.phone && (
                <Text
                  style={[
                    styles.detailsModalAddressText,
                    { color: colors.text },
                  ]}
                >
                  Tel: {store.phone}
                </Text>
              )}
              {store.cnpj && (
                <Text
                  style={[
                    styles.detailsModalAddressText,
                    { color: colors.text, marginTop: 4 },
                  ]}
                >
                  CNPJ: {store.cnpj}
                </Text>
              )}
            </View>
          )}

          {/* Hours */}
          {hours && hours.length > 0 && (
            <View
              style={[
                styles.detailsModalSection,
                { borderTopColor: colors.border, borderTopWidth: 1 },
              ]}
            >
              <Text
                style={[styles.detailsModalSecTitle, { color: colors.text }]}
              >
                Horários de Funcionamento
              </Text>
              {WEEKDAYS.map((day) => {
                const h = hours.find((x) => x.day_of_week === day.key);
                return (
                  <View key={day.key} style={styles.detailsModalRow}>
                    <Text
                      style={[
                        styles.detailsModalLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {day.label}
                    </Text>
                    <Text
                      style={[
                        styles.detailsModalValue,
                        {
                          color:
                            h && !h.is_closed ? colors.text : colors.danger,
                        },
                      ]}
                    >
                      {h && !h.is_closed
                        ? `${h.open_time.slice(0, 5)} - ${h.close_time.slice(0, 5)}`
                        : "Fechado"}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Reviews Button Link */}
          <TouchableOpacity
            style={[
              styles.detailsModalReviewsBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => {
              handleClose();
              onViewReviews();
            }}
          >
            <Text
              style={[
                styles.detailsModalReviewsBtnText,
                { color: colors.tint },
              ]}
            >
              Ver Avaliações da Loja
            </Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
});

StoreDetailsBottomSheetModal.displayName = "StoreDetailsBottomSheetModal";

const styles = StyleSheet.create({
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
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
    marginHorizontal: 8,
  },
  detailsModalScroll: {
    padding: 20,
    paddingBottom: 40,
  },
  detailsModalSection: {
    paddingVertical: 16,
    gap: 10,
  },
  detailsModalStoreName: {
    fontSize: 20,
    fontWeight: "700",
  },
  detailsModalDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailsModalSecTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  detailsModalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  detailsModalLabel: {
    fontSize: 14,
  },
  detailsModalValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  detailsModalAddressText: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailsModalReviewsBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  detailsModalReviewsBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
