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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, Plus, Trash2, Edit3, X, Check, Tag, ToggleLeft, ToggleRight } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import {
  getVendorStore,
  listStoreCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  listProducts,
  StoreCoupon,
  StoreProduct,
  PRODUCT_CATEGORIES,
} from "@/services/deliveryApi";

export default function VendorCouponsScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();

  const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formCode, setFormCode] = useState("");
  const [formDiscountType, setFormDiscountType] = useState("percentage");
  const [formDiscountValue, setFormDiscountValue] = useState("");
  const [formMinOrder, setFormMinOrder] = useState("");
  const [formMaxUses, setFormMaxUses] = useState("");
  const [formAppliesTo, setFormAppliesTo] = useState("all");
  const [formProductId, setFormProductId] = useState<string | null>(null);
  const [formCategory, setFormCategory] = useState<string | null>(null);
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const storeData = await getVendorStore(token);
      if (storeData.store) {
        setStoreId(storeData.store.id);
        const [couponData, prodData] = await Promise.all([
          listStoreCoupons(token, storeData.store.id),
          listProducts(token, storeData.store.id),
        ]);
        setCoupons(couponData.coupons);
        setProducts(prodData.products);
      }
    } catch (err) {
      console.error("Failed to load coupons:", err);
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

  const openForm = (coupon?: StoreCoupon) => {
    if (coupon) {
      setEditingId(coupon.id);
      setFormCode(coupon.code);
      setFormDiscountType(coupon.discount_type);
      setFormDiscountValue(coupon.discount_value.toString());
      setFormMinOrder(coupon.min_order.toString());
      setFormMaxUses(coupon.max_uses?.toString() || "");
      setFormAppliesTo(coupon.applies_to);
      setFormProductId(coupon.product_id);
      setFormCategory(coupon.category);
      setFormExpiresAt(coupon.expires_at ? coupon.expires_at.slice(0, 16) : "");
    } else {
      setEditingId(null);
      setFormCode("");
      setFormDiscountType("percentage");
      setFormDiscountValue("");
      setFormMinOrder("");
      setFormMaxUses("");
      setFormAppliesTo("all");
      setFormProductId(null);
      setFormCategory(null);
      setFormExpiresAt("");
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!token || !storeId) return;
    if (!formCode.trim()) {
      Alert.alert("Erro", "Código do cupom é obrigatório");
      return;
    }
    const value = parseFloat(formDiscountValue);
    if (isNaN(value) || value <= 0) {
      Alert.alert("Erro", "Valor do desconto deve ser maior que 0");
      return;
    }

    setSaving(true);
    try {
      const data: any = {
        code: formCode.trim(),
        discount_type: formDiscountType,
        discount_value: value,
        min_order: parseFloat(formMinOrder) || 0,
        applies_to: formAppliesTo,
      };
      if (formMaxUses) data.max_uses = parseInt(formMaxUses);
      if (formAppliesTo === "product" && formProductId) data.product_id = formProductId;
      if (formAppliesTo === "category" && formCategory) data.category = formCategory;
      if (formExpiresAt) data.expires_at = formExpiresAt + ":00";

      if (editingId) {
        await updateCoupon(token, editingId, data);
      } else {
        await createCoupon(token, storeId, data);
      }
      setShowForm(false);
      loadData();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao salvar cupom");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (coupon: StoreCoupon) => {
    if (!token) return;
    try {
      await updateCoupon(token, coupon.id, { is_active: !coupon.is_active });
      loadData();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao atualizar");
    }
  };

  const handleDelete = (coupon: StoreCoupon) => {
    Alert.alert("Deletar cupom?", `Cupom "${coupon.code}" será removido.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Deletar",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          try {
            await deleteCoupon(token, coupon.id);
            loadData();
          } catch (err: any) {
            Alert.alert("Erro", err.message || "Falha ao deletar");
          }
        },
      },
    ]);
  };

  const renderCoupon = ({ item }: { item: StoreCoupon }) => (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Tag color={colors.tint} size={18} />
          <Text style={[styles.couponCode, { color: colors.text }]}>{item.code}</Text>
        </View>
        <TouchableOpacity onPress={() => handleToggleActive(item)}>
          {item.is_active ? (
            <ToggleRight color={colors.tint} size={32} />
          ) : (
            <ToggleLeft color={colors.icon} size={32} />
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.couponDetails}>
        <Text style={{ color: colors.tint, fontSize: 18, fontWeight: "700" }}>
          {item.discount_type === "percentage" ? `${item.discount_value}%` : `R$ ${item.discount_value.toFixed(2)}`}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
          {item.applies_to === "all" ? "Todos os produtos" : item.applies_to === "category" ? `Categoria: ${PRODUCT_CATEGORIES[item.category || ""] || item.category}` : "Produto específico"}
        </Text>
        {item.min_order > 0 && (
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Mínimo: R$ {item.min_order.toFixed(2)}</Text>
        )}
        {item.max_uses && (
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Usos: {item.current_uses}/{item.max_uses}</Text>
        )}
        {item.expires_at && (
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            Expira: {new Date(item.expires_at).toLocaleDateString("pt-BR")}
          </Text>
        )}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface }]} onPress={() => openForm(item)}>
          <Edit3 color={colors.tint} size={14} />
          <Text style={[styles.actionText, { color: colors.tint }]}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface }]} onPress={() => handleDelete(item)}>
          <Trash2 color={colors.danger} size={14} />
          <Text style={[styles.actionText, { color: colors.danger }]}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Cupons</Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.tint }]} onPress={() => openForm()}>
          <Plus color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList
          data={coupons}
          keyExtractor={(item) => item.id}
          renderItem={renderCoupon}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.tint} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Tag color={colors.icon} size={48} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum cupom</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Crie cupons de desconto para sua loja</Text>
              <TouchableOpacity style={[styles.emptyAddBtn, { backgroundColor: colors.tint }]} onPress={() => openForm()}>
                <Plus color="#fff" size={18} />
                <Text style={{ color: "#fff", fontWeight: "600" }}>Criar cupom</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <X color={colors.text} size={24} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingId ? "Editar cupom" : "Novo cupom"}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.tint} /> : <Check color={colors.tint} size={24} />}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} keyboardShouldPersistTaps="handled">
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Código *</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={formCode}
                onChangeText={(t) => setFormCode(t.toUpperCase())}
                placeholder="Ex: DESCONTO10"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tipo de desconto *</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["percentage", "fixed"] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeBtn, { backgroundColor: formDiscountType === type ? colors.tint : colors.surface, borderColor: colors.border }]}
                    onPress={() => setFormDiscountType(type)}
                  >
                    <Text style={{ color: formDiscountType === type ? "#fff" : colors.text, fontWeight: "500" }}>
                      {type === "percentage" ? "Porcentagem" : "Valor fixo"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Valor do desconto {formDiscountType === "percentage" ? "(%)" : "(R$)"} *
              </Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={formDiscountValue}
                onChangeText={setFormDiscountValue}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Aplicar em</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["all", "product", "category"] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeBtn, { backgroundColor: formAppliesTo === type ? colors.tint : colors.surface, borderColor: colors.border, flex: 1 }]}
                    onPress={() => { setFormAppliesTo(type); setFormProductId(null); setFormCategory(null); }}
                  >
                    <Text style={{ color: formAppliesTo === type ? "#fff" : colors.text, fontWeight: "500", fontSize: 12 }}>
                      {type === "all" ? "Todos" : type === "product" ? "Produto" : "Categoria"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {formAppliesTo === "product" && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Selecionar produto</Text>
                  <TouchableOpacity
                    style={[styles.input, { borderColor: colors.border }]}
                    onPress={() => setShowProductPicker(true)}
                  >
                    <Text style={{ color: formProductId ? colors.text : colors.textSecondary, padding: 0 }}>
                      {formProductId ? products.find((p) => p.id === formProductId)?.name || "Produto" : "Selecionar..."}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {formAppliesTo === "category" && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Categoria</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {Object.entries(PRODUCT_CATEGORIES).map(([key, label]) => (
                      <TouchableOpacity
                        key={key}
                        style={[styles.typeBtn, { backgroundColor: formCategory === key ? colors.tint : colors.surface, borderColor: colors.border }]}
                        onPress={() => setFormCategory(key)}
                      >
                        <Text style={{ color: formCategory === key ? "#fff" : colors.text, fontSize: 12 }}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Pedido mínimo (R$)</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={formMinOrder}
                onChangeText={setFormMinOrder}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Limite de usos</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={formMaxUses}
                onChangeText={setFormMaxUses}
                placeholder="Ilimitado"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Data de expiração</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={formExpiresAt}
                onChangeText={setFormExpiresAt}
                placeholder="AAAA-MM-DDTHH:MM"
                placeholderTextColor={colors.textSecondary}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showProductPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                <X color={colors.text} size={24} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Selecionar produto</Text>
              <View style={{ width: 24 }} />
            </View>
            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.productOption, { backgroundColor: formProductId === item.id ? `${colors.tint}15` : colors.cardBackground, borderColor: formProductId === item.id ? colors.tint : colors.border }]}
                  onPress={() => { setFormProductId(item.id); setShowProductPicker(false); }}
                >
                  <Text style={{ color: colors.text, flex: 1 }}>{item.name}</Text>
                  <Text style={{ color: colors.tint }}>R$ {item.price.toFixed(2)}</Text>
                  {formProductId === item.id && <Check color={colors.tint} size={18} style={{ marginLeft: 8 }} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 50, paddingBottom: 12 },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "600", marginHorizontal: 8 },
  addButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, paddingBottom: 32 },
  card: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  couponCode: { fontSize: 16, fontWeight: "700", letterSpacing: 1 },
  couponDetails: { marginTop: 10 },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionText: { fontSize: 12, fontWeight: "500" },
  emptyContainer: { alignItems: "center", paddingTop: 64 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 12 },
  emptySubtitle: { fontSize: 14, marginTop: 4 },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 16 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { flex: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  modalBody: { flex: 1 },
  modalBodyContent: { padding: 16, paddingBottom: 40 },
  fieldLabel: { fontSize: 13, fontWeight: "500", marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  typeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  productOption: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
});
