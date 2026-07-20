import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, Plus, Trash2, Edit3, X, Clock } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  getVendorStore,
  listDeliverySlots,
  createDeliverySlot,
  updateDeliverySlot,
  deleteDeliverySlot,
  updateStore,
  StoreDeliverySlot,
  SlotFulfillmentType,
} from "@/services/deliveryApi";

const FULFILLMENT_OPTIONS: { value: SlotFulfillmentType; label: string }[] = [
  { value: "ambos", label: "Entrega e Retirada" },
  { value: "entrega", label: "Só Entrega" },
  { value: "retirada", label: "Só Retirada" },
];

export default function VendorSlotsScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();

  const [slots, setSlots] = useState<StoreDeliverySlot[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [acceptsDelivery, setAcceptsDelivery] = useState(true);
  const [acceptsPickup, setAcceptsPickup] = useState(true);
  const [scheduleDays, setScheduleDays] = useState("5");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formStart, setFormStart] = useState("14:00");
  const [formEnd, setFormEnd] = useState("15:00");
  const [formFee, setFormFee] = useState("10.00");
  const [formType, setFormType] = useState<SlotFulfillmentType>("ambos");

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const storeData = await getVendorStore(token);
      if (storeData.store) {
        setStoreId(storeData.store.id);
        setAcceptsDelivery(storeData.store.accepts_delivery !== false);
        setAcceptsPickup(storeData.store.accepts_pickup !== false);
        setScheduleDays(String(storeData.store.schedule_days ?? 5));
        const slotsData = await listDeliverySlots(token, storeData.store.id);
        setSlots(slotsData.slots);
      }
    } catch (err) {
      console.error("Failed to load slots:", err);
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

  const saveStoreSettings = async (
    nextDelivery: boolean,
    nextPickup: boolean,
    nextDays?: string
  ) => {
    if (!token || !storeId) return;
    try {
      const days = parseInt(nextDays ?? scheduleDays, 10);
      await updateStore(token, storeId, {
        accepts_delivery: nextDelivery,
        accepts_pickup: nextPickup,
        schedule_days: Number.isFinite(days) ? Math.min(14, Math.max(1, days)) : 5,
      });
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao salvar configurações");
      loadData();
    }
  };

  const openForm = (slot?: StoreDeliverySlot) => {
    if (slot) {
      setEditingId(slot.id);
      setFormStart(slot.start_time);
      setFormEnd(slot.end_time);
      setFormFee(slot.fee.toFixed(2));
      setFormType(slot.fulfillment_type);
    } else {
      setEditingId(null);
      setFormStart("14:00");
      setFormEnd("15:00");
      setFormFee("10.00");
      setFormType("ambos");
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!token || !storeId) return;
    const fee = parseFloat(formFee.replace(",", "."));
    if (!formStart.trim() || !formEnd.trim()) {
      Alert.alert("Erro", "Informe horário de início e fim");
      return;
    }
    if (isNaN(fee) || fee < 0) {
      Alert.alert("Erro", "Taxa inválida");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateDeliverySlot(token, storeId, editingId, {
          start_time: formStart.trim(),
          end_time: formEnd.trim(),
          fee,
          fulfillment_type: formType,
        });
      } else {
        await createDeliverySlot(token, storeId, {
          start_time: formStart.trim(),
          end_time: formEnd.trim(),
          fee,
          fulfillment_type: formType,
          sort_order: slots.length,
        });
      }
      setShowForm(false);
      loadData();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao salvar horário");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (slot: StoreDeliverySlot) => {
    if (!token || !storeId) return;
    try {
      await updateDeliverySlot(token, storeId, slot.id, { is_active: !slot.is_active });
      loadData();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao atualizar");
    }
  };

  const handleDelete = (slot: StoreDeliverySlot) => {
    Alert.alert("Remover horário?", `${slot.start_time} - ${slot.end_time}`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          if (!token || !storeId) return;
          try {
            await deleteDeliverySlot(token, storeId, slot.id);
            loadData();
          } catch (err: any) {
            Alert.alert("Erro", err.message || "Falha ao remover");
          }
        },
      },
    ]);
  };

  const typeLabel = (t: SlotFulfillmentType) =>
    FULFILLMENT_OPTIONS.find((o) => o.value === t)?.label || t;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Entrega e Agendamento</Text>
        <TouchableOpacity onPress={() => openForm()} style={styles.backButton}>
          <Plus color={colors.headerText} size={24} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={slots}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={colors.tint}
          />
        }
        ListHeaderComponent={
          <View style={[styles.settingsCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.settingsTitle, { color: colors.text }]}>Opções da loja</Text>
            <View style={styles.switchRow}>
              <Text style={{ color: colors.text, flex: 1 }}>Aceitar entrega</Text>
              <Switch
                value={acceptsDelivery}
                onValueChange={(v) => {
                  setAcceptsDelivery(v);
                  saveStoreSettings(v, acceptsPickup);
                }}
                trackColor={{ true: colors.tint }}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={{ color: colors.text, flex: 1 }}>Aceitar retirada</Text>
              <Switch
                value={acceptsPickup}
                onValueChange={(v) => {
                  setAcceptsPickup(v);
                  saveStoreSettings(acceptsDelivery, v);
                }}
                trackColor={{ true: colors.tint }}
              />
            </View>
            <View style={styles.daysInputRow}>
              <Text style={{ color: colors.text, flex: 1 }}>Dias para agendar</Text>
              <TextInput
                style={[styles.daysInput, { color: colors.text, borderColor: colors.border }]}
                value={scheduleDays}
                onChangeText={setScheduleDays}
                onEndEditing={() => saveStoreSettings(acceptsDelivery, acceptsPickup, scheduleDays)}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Defina os horários abaixo. O cliente escolhe o dia e o intervalo no checkout.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border, opacity: item.is_active ? 1 : 0.55 }]}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Clock color={colors.tint} size={18} />
                <Text style={[styles.slotTime, { color: colors.text }]}>
                  {item.start_time} - {item.end_time}
                </Text>
              </View>
              <Switch
                value={item.is_active}
                onValueChange={() => handleToggleActive(item)}
                trackColor={{ true: colors.tint }}
              />
            </View>
            <Text style={{ color: colors.tint, fontWeight: "700", fontSize: 16, marginTop: 6 }}>
              R$ {item.fee.toFixed(2)}
            </Text>
            <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 13 }}>
              {typeLabel(item.fulfillment_type)}
            </Text>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => openForm(item)} style={styles.actionBtn}>
                <Edit3 color={colors.icon} size={18} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                <Trash2 color="#EF4444" size={18} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
              Nenhum horário cadastrado. Toque em + para adicionar.
            </Text>
          </View>
        }
      />

      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingId ? "Editar horário" : "Novo horário"}
              </Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <X color={colors.icon} size={24} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Início (HH:MM)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              value={formStart}
              onChangeText={setFormStart}
              placeholder="14:00"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Fim (HH:MM)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              value={formEnd}
              onChangeText={setFormEnd}
              placeholder="15:00"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Taxa de entrega (R$)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              value={formFee}
              onChangeText={setFormFee}
              keyboardType="decimal-pad"
              placeholder="10.00"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Disponível para</Text>
            <View style={styles.typeRow}>
              {FULFILLMENT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.typeChip,
                    {
                      borderColor: formType === opt.value ? colors.tint : colors.border,
                      backgroundColor: formType === opt.value ? `${colors.tint}15` : "transparent",
                    },
                  ]}
                  onPress={() => setFormType(opt.value)}
                >
                  <Text style={{ color: formType === opt.value ? colors.tint : colors.text, fontSize: 12, fontWeight: "600" }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.tint }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 50,
    paddingBottom: 12,
  },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "600", marginHorizontal: 8 },
  list: { padding: 16, paddingBottom: 40 },
  settingsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  settingsTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  daysInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  daysInput: {
    width: 56,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
  },
  hint: { fontSize: 12, marginTop: 12, lineHeight: 18 },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  slotTime: { fontSize: 16, fontWeight: "700" },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 10,
  },
  actionBtn: { padding: 6 },
  empty: { paddingVertical: 40 },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 13, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  typeChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveBtn: {
    marginTop: 20,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
