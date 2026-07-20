import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  getVendorStore,
  listStoreHours,
  createStoreHours,
  StoreHours,
  WEEKDAYS,
} from "@/services/deliveryApi";

export default function VendorHoursScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();

  const [hours, setHours] = useState<StoreHours[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const storeData = await getVendorStore(token);
      if (storeData.store) {
        setStoreId(storeData.store.id);
        const hoursData = await listStoreHours(token, storeData.store.id);
        setHours(hoursData.hours);
      }
    } catch (err) {
      console.error("Failed to load hours:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const getHoursForDay = (dayOfWeek: number) => {
    return hours.find((h) => h.day_of_week === dayOfWeek);
  };

  const handleSaveDay = async (dayOfWeek: number, openTime: string, closeTime: string, isClosed: boolean) => {
    if (!token || !storeId) return;
    setSaving(true);
    try {
      await createStoreHours(token, storeId, {
        day_of_week: dayOfWeek,
        open_time: openTime,
        close_time: closeTime,
        is_closed: isClosed,
      });
      const hoursData = await listStoreHours(token, storeId);
      setHours(hoursData.hours);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao salvar horário");
    } finally {
      setSaving(false);
    }
  };

  const quickSetAll = (openTime: string, closeTime: string) => {
    Alert.alert("Definir horário para todos", `Definir ${openTime} - ${closeTime} para todos os dias?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        onPress: async () => {
          if (!token || !storeId) return;
          setSaving(true);
          try {
            for (let day = 0; day <= 6; day++) {
              await createStoreHours(token, storeId, {
                day_of_week: day,
                open_time: openTime,
                close_time: closeTime,
                is_closed: false,
              });
            }
            const hoursData = await listStoreHours(token, storeId);
            setHours(hoursData.hours);
          } catch (err: any) {
            Alert.alert("Erro", err.message || "Falha ao salvar");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const renderDay = ({ item: day }: { item: { key: number; label: string } }) => {
    const h = getHoursForDay(day.key);
    const isClosed = h?.is_closed ?? true;
    const openTime = h?.open_time || "08:00";
    const closeTime = h?.close_time || "22:00";

    return (
      <View style={[styles.dayCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.dayHeader}>
          <Text style={[styles.dayName, { color: colors.text }]}>{day.label}</Text>
          <Switch
            value={!isClosed}
            onValueChange={(val) => handleSaveDay(day.key, openTime, closeTime, !val)}
            trackColor={{ false: "#D1D5DB", true: `${colors.tint}80` }}
            thumbColor={isClosed ? "#9CA3AF" : colors.tint}
            disabled={saving}
          />
        </View>
        {!isClosed && (
          <View style={styles.timeRow}>
            <View style={styles.timeBlock}>
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Abertura</Text>
              <TouchableOpacity
                style={[styles.timeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  const parts = openTime.split(":");
                  let h = parseInt(parts[0]);
                  h = (h + 1) % 24;
                  handleSaveDay(day.key, `${String(h).padStart(2, "0")}:00`, closeTime, false);
                }}
              >
                <Text style={[styles.timeValue, { color: colors.tint }]}>{openTime}</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.timeSeparator, { color: colors.textSecondary }]}>até</Text>
            <View style={styles.timeBlock}>
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Fechamento</Text>
              <TouchableOpacity
                style={[styles.timeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  const parts = closeTime.split(":");
                  let h = parseInt(parts[0]);
                  h = (h + 1) % 24;
                  handleSaveDay(day.key, openTime, `${String(h).padStart(2, "0")}:00`, false);
                }}
              >
                <Text style={[styles.timeValue, { color: colors.tint }]}>{closeTime}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Horários</Text>
        {saving && <ActivityIndicator color={colors.tint} />}
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} onPress={() => quickSetAll("08:00", "22:00")}>
          <Text style={{ color: colors.text, fontSize: 13 }}>Padrão: 08:00 - 22:00</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} onPress={() => quickSetAll("11:00", "23:00")}>
          <Text style={{ color: colors.text, fontSize: 13 }}>Almoço: 11:00 - 23:00</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList
          data={WEEKDAYS}
          keyExtractor={(item) => item.key.toString()}
          renderItem={renderDay}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.tint} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 50, paddingBottom: 12 },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "600", marginHorizontal: 8 },
  quickActions: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  quickBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, paddingBottom: 32 },
  dayCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayName: { fontSize: 16, fontWeight: "600" },
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 8 },
  timeBlock: { flex: 1 },
  timeLabel: { fontSize: 12, marginBottom: 4 },
  timeBtn: { padding: 10, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  timeValue: { fontSize: 16, fontWeight: "700" },
  timeSeparator: { fontSize: 13, marginTop: 18 },
});
