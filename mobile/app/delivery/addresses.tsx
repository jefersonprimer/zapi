import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { getCurrentUserAddress } from "@/utils/location";
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  UserAddress,
} from "@/services/deliveryApi";

const LABELS = [
  { value: "casa", label: "Casa" },
  { value: "trabalho", label: "Trabalho" },
  { value: "outro", label: "Outro" },
];

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

interface AddressForm {
  label: string;
  estado: string;
  cidade: string;
  bairro: string;
  cep: string;
  rua: string;
  numero: string;
  ponto_referencia: string;
  is_default: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

const emptyForm: AddressForm = {
  label: "casa",
  estado: "",
  cidade: "",
  bairro: "",
  cep: "",
  rua: "",
  numero: "",
  ponto_referencia: "",
  is_default: false,
  latitude: null,
  longitude: null,
};

export default function AddressesScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const loadAddresses = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listAddresses(token);
      setAddresses(data.addresses);
    } catch (err) {
      console.error("Failed to load addresses:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [loadAddresses])
  );

  const openForm = (addr?: UserAddress) => {
    if (addr) {
      setEditingId(addr.id);
      setForm({
        label: addr.label,
        estado: addr.estado,
        cidade: addr.cidade,
        bairro: addr.bairro,
        cep: addr.cep,
        rua: addr.rua,
        numero: addr.numero,
        ponto_referencia: addr.ponto_referencia || "",
        is_default: addr.is_default,
        latitude: addr.latitude,
        longitude: addr.longitude,
      });
    } else {
      setEditingId(null);
      setForm(emptyForm);
    }
    setShowForm(true);
  };

  const handleUseLocation = async () => {
    setGettingLocation(true);
    try {
      const loc = await getCurrentUserAddress();
      setForm((prev) => ({
        ...prev,
        estado: loc.estado || prev.estado,
        cidade: loc.cidade || prev.cidade,
        bairro: loc.bairro || prev.bairro,
        cep: loc.cep || prev.cep,
        rua: loc.rua || prev.rua,
        numero: loc.numero || prev.numero,
        latitude: loc.latitude,
        longitude: loc.longitude,
      }));
      Alert.alert(
        "Localização obtida!",
        "Os campos do seu endereço foram preenchidos automaticamente com base na sua localização atual. Confira os dados e ajuste o número ou complemento se necessário."
      );
    } catch (err: any) {
      Alert.alert(
        "Erro ao obter localização",
        err.message || "Não foi possível obter sua localização atual."
      );
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    if (!form.rua.trim() || !form.numero.trim() || !form.cidade.trim() || !form.estado.trim() || !form.bairro.trim() || !form.cep.trim()) {
      Alert.alert("Erro", "Preencha todos os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        ponto_referencia: form.ponto_referencia || undefined,
      };

      if (editingId) {
        await updateAddress(token, editingId, payload);
      } else {
        await createAddress(token, payload);
      }
      setShowForm(false);
      loadAddresses();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao salvar endereço");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (addr: UserAddress) => {
    Alert.alert("Deletar endereço?", "Esta ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Deletar",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          try {
            await deleteAddress(token, addr.id);
            loadAddresses();
          } catch (err: any) {
            Alert.alert("Erro", err.message || "Falha ao deletar");
          }
        },
      },
    ]);
  };

  const renderAddress = ({ item }: { item: UserAddress }) => (
    <View style={[styles.addrCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <View style={styles.addrHeader}>
        <View style={styles.addrLabelRow}>
          <MaterialCommunityIcons name="map-marker" color={item.is_default ? colors.tint : colors.icon} size={18} />
          <Text style={[styles.addrLabel, { color: colors.text }]}>
            {LABELS.find((l) => l.value === item.label)?.label || item.label}
          </Text>
          {item.is_default && (
            <View style={[styles.defaultBadge, { backgroundColor: `${colors.tint}20` }]}>
              <Text style={[styles.defaultText, { color: colors.tint }]}>Padrão</Text>
            </View>
          )}
        </View>
        <View style={styles.addrActions}>
          <TouchableOpacity onPress={() => openForm(item)} style={styles.addrAction}>
            <Text style={[styles.addrActionText, { color: colors.tint }]}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.addrAction}>
            <MaterialCommunityIcons name="trash-can-outline" color={colors.danger} size={16} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={[styles.addrText, { color: colors.textSecondary }]} numberOfLines={3}>
        {item.rua}, {item.numero} - {item.bairro}
        {"\n"}{item.cidade}/{item.estado} - CEP: {item.cep}
        {item.ponto_referencia ? `\nRef: ${item.ponto_referencia}` : ""}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Endereços</Text>
        <TouchableOpacity onPress={() => openForm()} style={[styles.addButton, { backgroundColor: colors.tint }]}>
          <MaterialCommunityIcons name="plus" color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          renderItem={renderAddress}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAddresses(); }} tintColor={colors.tint} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="map-marker" color={colors.icon} size={64} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Nenhum endereço cadastrado
              </Text>
              <TouchableOpacity
                style={[styles.emptyAddButton, { backgroundColor: colors.tint }]}
                onPress={() => openForm()}
              >
                <Text style={styles.emptyAddButtonText}>Adicionar endereço</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <MaterialCommunityIcons name="close" color={colors.text} size={24} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingId ? "Editar endereço" : "Novo endereço"}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={colors.tint} />
                ) : (
                  <MaterialCommunityIcons name="check" color={colors.tint} size={24} />
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              <TouchableOpacity
                style={[styles.locationBtn, { backgroundColor: `${colors.tint}15`, borderColor: colors.tint }]}
                onPress={handleUseLocation}
                disabled={gettingLocation}
              >
                {gettingLocation ? (
                  <ActivityIndicator size="small" color={colors.tint} />
                ) : (
                  <MaterialCommunityIcons name="crosshairs-gps" color={colors.tint} size={18} />
                )}
                <Text style={[styles.locationBtnText, { color: colors.tint }]}>
                  {gettingLocation ? "Buscando localização..." : "Usar minha localização atual"}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tipo *</Text>
              <View style={styles.labelRow}>
                {LABELS.map((l) => (
                  <TouchableOpacity
                    key={l.value}
                    style={[
                      styles.labelChip,
                      {
                        backgroundColor: form.label === l.value ? colors.tint : colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setForm({ ...form, label: l.value })}
                  >
                    <Text style={{ color: form.label === l.value ? "#fff" : colors.text, fontSize: 14 }}>
                      {l.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>UF *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ufScroll}>
                <View style={styles.ufRow}>
                  {UFS.map((uf) => (
                    <TouchableOpacity
                      key={uf}
                      style={[
                        styles.ufChip,
                        {
                          backgroundColor: form.estado === uf ? colors.tint : colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => setForm({ ...form, estado: uf })}
                    >
                      <Text style={{ color: form.estado === uf ? "#fff" : colors.text, fontSize: 13, fontWeight: "500" }}>
                        {uf}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Cidade *</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={form.cidade}
                onChangeText={(t) => setForm({ ...form, cidade: t })}
                placeholder="São Paulo"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bairro *</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={form.bairro}
                onChangeText={(t) => setForm({ ...form, bairro: t })}
                placeholder="Centro"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>CEP *</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={form.cep}
                onChangeText={(t) => setForm({ ...form, cep: t })}
                placeholder="01234-567"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Rua *</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={form.rua}
                onChangeText={(t) => setForm({ ...form, rua: t })}
                placeholder="Rua Exemplo"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Número *</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={form.numero}
                onChangeText={(t) => setForm({ ...form, numero: t })}
                placeholder="123"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Ponto de referência</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={form.ponto_referencia}
                onChangeText={(t) => setForm({ ...form, ponto_referencia: t })}
                placeholder="Em frente à padaria"
                placeholderTextColor={colors.textSecondary}
              />

              <TouchableOpacity
                style={styles.defaultRow}
                onPress={() => setForm({ ...form, is_default: !form.is_default })}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: form.is_default ? colors.tint : "transparent",
                      borderColor: form.is_default ? colors.tint : colors.border,
                    },
                  ]}
                >
                  {form.is_default && <MaterialCommunityIcons name="check" color="#fff" size={14} />}
                </View>
                <Text style={[styles.defaultLabel, { color: colors.text }]}>Definir como padrão</Text>
              </TouchableOpacity>
            </ScrollView>
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
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 50,
    paddingBottom: 12,
  },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "600", marginHorizontal: 8 },
  addButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, paddingBottom: 32 },
  addrCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  addrHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  addrLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  addrLabel: { fontSize: 15, fontWeight: "600" },
  defaultBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  defaultText: { fontSize: 11, fontWeight: "600" },
  addrActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  addrAction: { padding: 4 },
  addrActionText: { fontSize: 13, fontWeight: "500" },
  addrText: { fontSize: 13, lineHeight: 18 },
  emptyContainer: { alignItems: "center", paddingTop: 64 },
  emptyText: { fontSize: 16, marginTop: 12, marginBottom: 16 },
  emptyAddButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  emptyAddButtonText: { color: "#fff", fontWeight: "600" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  modalBody: { flex: 1 },
  modalBodyContent: { padding: 16, paddingBottom: 40 },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  locationBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  fieldLabel: { fontSize: 13, fontWeight: "500", marginBottom: 6, marginTop: 12 },
  labelRow: { flexDirection: "row", gap: 8 },
  labelChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  ufScroll: { marginBottom: 4 },
  ufRow: { flexDirection: "row", gap: 6 },
  ufChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  defaultLabel: { fontSize: 14 },
});
