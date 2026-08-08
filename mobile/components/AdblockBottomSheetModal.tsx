import React, { forwardRef, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";

interface AdblockBottomSheetModalProps {
  adblockEnabled: boolean;
  onToggleAdblock: () => void;
  blockedCount: number;
  trackersBlockedCount: number;
  dataSavedMb: number;
  timeSavedSeconds: number;
  onResetStats: () => void;
}

export const AdblockBottomSheetModal = forwardRef<
  BottomSheetModal,
  AdblockBottomSheetModalProps
>(
  (
    {
      adblockEnabled,
      onToggleAdblock,
      blockedCount,
      trackersBlockedCount,
      dataSavedMb,
      timeSavedSeconds,
      onResetStats,
    },
    ref,
  ) => {
    const { colors, isDark } = useAppTheme();

    const snapPoints = useMemo(() => ["55%"], []);

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
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.headerButton, { borderColor: colors.border }]}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              AdBlock
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Toggle Switch Row */}
          <View
            style={[styles.toggleRow, { borderBottomColor: colors.border }]}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                Filtro de Anúncios e Rastreadores
              </Text>
              <Text
                style={[styles.toggleDesc, { color: colors.textSecondary }]}
              >
                Bloqueia publicidade intrusiva e scripts maliciosos.
              </Text>
            </View>
            <TouchableOpacity
              onPress={onToggleAdblock}
              style={[
                styles.switchTrack,
                { backgroundColor: adblockEnabled ? "#07C160" : colors.border },
              ]}
            >
              <View
                style={[
                  styles.switchThumb,
                  {
                    alignSelf: adblockEnabled ? "flex-end" : "flex-start",
                    backgroundColor: "#fff",
                  },
                ]}
              />
            </TouchableOpacity>
          </View>

          {/* Statistics */}
          {adblockEnabled ? (
            <View style={styles.statsContainer}>
              <View style={styles.statsGrid}>
                <View
                  style={[
                    styles.statBox,
                    { backgroundColor: isDark ? "#2A2A2F" : "#F8FAFC" },
                  ]}
                >
                  <Text style={styles.statVal}>{blockedCount}</Text>
                  <Text
                    style={[styles.statLabel, { color: colors.textSecondary }]}
                  >
                    Anúncios Bloqueados
                  </Text>
                </View>
                <View
                  style={[
                    styles.statBox,
                    { backgroundColor: isDark ? "#2A2A2F" : "#F8FAFC" },
                  ]}
                >
                  <Text style={styles.statVal}>{trackersBlockedCount}</Text>
                  <Text
                    style={[styles.statLabel, { color: colors.textSecondary }]}
                  >
                    Rastreadores Impedidos
                  </Text>
                </View>
              </View>
              <View style={styles.statsGrid}>
                <View
                  style={[
                    styles.statBox,
                    { backgroundColor: isDark ? "#2A2A2F" : "#F8FAFC" },
                  ]}
                >
                  <Text style={styles.statVal}>{dataSavedMb} MB</Text>
                  <Text
                    style={[styles.statLabel, { color: colors.textSecondary }]}
                  >
                    Dados Economizados
                  </Text>
                </View>
                <View
                  style={[
                    styles.statBox,
                    { backgroundColor: isDark ? "#2A2A2F" : "#F8FAFC" },
                  ]}
                >
                  <Text style={styles.statVal}>{timeSavedSeconds}s</Text>
                  <Text
                    style={[styles.statLabel, { color: colors.textSecondary }]}
                  >
                    Tempo de Carregamento Salvo
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onResetStats}
                style={[styles.resetButton, { borderColor: colors.border }]}
              >
                <Text
                  style={[styles.resetText, { color: colors.textSecondary }]}
                >
                  Zerar Estatísticas
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.disabledContainer}>
              <MaterialCommunityIcons
                name="shield-alert"
                size={48}
                color={colors.textSecondary}
                style={{ marginBottom: 12 }}
              />
              <Text style={[styles.disabledText, { color: colors.text }]}>
                AdBlock está desativado
              </Text>
              <Text
                style={[styles.disabledDesc, { color: colors.textSecondary }]}
              >
                Você verá anúncios e rastreadores comuns ao navegar pelas
                páginas.
              </Text>
            </View>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

AdblockBottomSheetModal.displayName = "AdblockBottomSheetModal";

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 15,
    borderBottomWidth: 1,
    marginBottom: 15,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  toggleDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  switchTrack: {
    width: 48,
    height: 26,
    borderRadius: 13,
    padding: 2,
    justifyContent: "center",
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  statsContainer: {
    marginTop: 10,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 4,
  },
  statVal: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#07C160",
  },
  statLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
  },
  resetButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
  },
  resetText: {
    fontSize: 13,
  },
  disabledContainer: {
    alignItems: "center",
    paddingVertical: 30,
  },
  disabledText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  disabledDesc: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
