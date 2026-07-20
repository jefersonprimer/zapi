import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, Check, Camera, Image as ImageIcon } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import ImagePickerModal from "@/components/ImagePickerModal";
import { uploadImage } from "@/services/api";
import { getFullRemoteUrl } from "@/services/mediaCache";
import {
  createStore,
  updateStore,
  getVendorStore,
  STORE_CATEGORIES,
} from "@/services/deliveryApi";

const CATEGORIES = Object.entries(STORE_CATEGORIES);

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

interface StoreForm {
  name: string;
  description: string;
  phone: string;
  pix_key: string;
  category: string;
  delivery_fee: string;
  minimum_order: string;
  city: string;
  state: string;
  street: string;
  number: string;
  neighborhood: string;
  cep: string;
  prep_time_minutes: string;
}

function isLocalImageUri(uri: string): boolean {
  return (
    uri.startsWith("file://") ||
    uri.startsWith("content://") ||
    uri.startsWith("ph://") ||
    uri.startsWith("assets-library://")
  );
}

async function resolveImage(
  token: string,
  uri: string | null,
  removed: boolean
): Promise<string | null | undefined> {
  if (uri && isLocalImageUri(uri)) {
    const uploaded = await uploadImage(token, uri);
    return uploaded.url;
  }
  if (removed) return "";
  if (uri) return uri;
  return undefined;
}

export default function StoreFormScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isEdit = mode === "edit";

  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [form, setForm] = useState<StoreForm>({
    name: "",
    description: "",
    phone: "",
    pix_key: "",
    category: "restaurante",
    delivery_fee: "0",
    minimum_order: "0",
    city: "",
    state: "",
    street: "",
    number: "",
    neighborhood: "",
    cep: "",
    prep_time_minutes: "20",
  });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [bannerRemoved, setBannerRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"avatar" | "banner" | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!isEdit || !token) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      (async () => {
        try {
          const data = await getVendorStore(token);
          if (cancelled) return;
          if (!data.store) {
            Alert.alert("Erro", "Loja não encontrada", [
              { text: "OK", onPress: () => router.back() },
            ]);
            return;
          }
          const s = data.store;
          setStoreId(s.id);
          setForm({
            name: s.name,
            description: s.description || "",
            phone: s.phone || "",
            pix_key: s.pix_key,
            category: s.category,
            delivery_fee: String(s.delivery_fee),
            minimum_order: String(s.minimum_order),
            city: s.city,
            state: s.state,
            street: s.street || "",
            number: s.number || "",
            neighborhood: s.neighborhood || "",
            cep: s.cep || "",
            prep_time_minutes: String(s.prep_time_minutes ?? 20),
          });
          setAvatar(s.avatar);
          setBanner(s.image_banner);
          setAvatarRemoved(false);
          setBannerRemoved(false);
        } catch (err: any) {
          Alert.alert("Erro", err.message || "Falha ao carregar loja");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [isEdit, token, router])
  );

  const updateField = (field: keyof StoreForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const imageUri = (uri: string | null) => {
    if (!uri) return null;
    return isLocalImageUri(uri) ? uri : getFullRemoteUrl(uri);
  };

  const handleSave = async () => {
    if (!token) return;

    if (!form.name.trim()) {
      Alert.alert("Erro", "Nome da loja é obrigatório");
      return;
    }
    if (!form.pix_key.trim()) {
      Alert.alert("Erro", "Chave PIX é obrigatória");
      return;
    }
    if (!form.city.trim()) {
      Alert.alert("Erro", "Cidade é obrigatória");
      return;
    }
    if (!form.state.trim()) {
      Alert.alert("Erro", "Estado (UF) é obrigatório");
      return;
    }
    if (!form.street.trim() || !form.number.trim() || !form.neighborhood.trim() || !form.cep.trim()) {
      Alert.alert("Erro", "Preencha o endereço completo da loja (rua, número, bairro e CEP)");
      return;
    }

    setSaving(true);
    try {
      const [avatarUrl, bannerUrl] = await Promise.all([
        resolveImage(token, avatar, avatarRemoved),
        resolveImage(token, banner, bannerRemoved),
      ]);

      const prepTime = Math.max(1, parseInt(form.prep_time_minutes, 10) || 20);

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        phone: form.phone.trim() || undefined,
        pix_key: form.pix_key.trim(),
        category: form.category,
        delivery_fee: parseFloat(form.delivery_fee) || 0,
        minimum_order: parseFloat(form.minimum_order) || 0,
        city: form.city.trim(),
        state: form.state,
        street: form.street.trim(),
        number: form.number.trim(),
        neighborhood: form.neighborhood.trim(),
        cep: form.cep.trim(),
        prep_time_minutes: prepTime,
      };

      if (isEdit) {
        if (!storeId) return;
        await updateStore(token, storeId, {
          ...payload,
          description: form.description.trim() || null,
          phone: form.phone.trim() || null,
          ...(avatarUrl !== undefined ? { avatar: avatarUrl || "" } : {}),
          ...(bannerUrl !== undefined ? { image_banner: bannerUrl || "" } : {}),
        });
        Alert.alert("Sucesso!", "Loja atualizada", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        await createStore(token, {
          ...payload,
          ...(avatarUrl ? { avatar: avatarUrl } : {}),
          ...(bannerUrl ? { image_banner: bannerUrl } : {}),
        });
        Alert.alert("Sucesso!", "Sua loja foi criada", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      Alert.alert("Erro", err.message || (isEdit ? "Falha ao atualizar loja" : "Falha ao criar loja"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>
          {isEdit ? "Editar Loja" : "Criar Loja"}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.tint} />
          ) : (
            <Check color={colors.tint} size={24} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Banner</Text>
        <TouchableOpacity
          style={[styles.bannerPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setPickerTarget("banner")}
          activeOpacity={0.7}
        >
          {imageUri(banner) ? (
            <Image source={{ uri: imageUri(banner)! }} style={styles.bannerPreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <ImageIcon color={colors.icon} size={28} />
              <Text style={[styles.imagePlaceholderText, { color: colors.textSecondary }]}>
                Adicionar banner
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Logo</Text>
        <TouchableOpacity
          style={[styles.logoPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setPickerTarget("avatar")}
          activeOpacity={0.7}
        >
          {imageUri(avatar) ? (
            <Image source={{ uri: imageUri(avatar)! }} style={styles.logoPreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Camera color={colors.icon} size={28} />
              <Text style={[styles.imagePlaceholderText, { color: colors.textSecondary }]}>
                Adicionar logo
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nome da loja *</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={form.name}
          onChangeText={(t) => updateField("name", t)}
          placeholder="Minha Loja"
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Descrição</Text>
        <TextInput
          style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
          value={form.description}
          onChangeText={(t) => updateField("description", t)}
          placeholder="Descrição da loja (opcional)"
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={3}
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Telefone</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={form.phone}
          onChangeText={(t) => updateField("phone", t)}
          placeholder="(11) 99999-9999"
          placeholderTextColor={colors.textSecondary}
          keyboardType="phone-pad"
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Chave PIX *</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={form.pix_key}
          onChangeText={(t) => updateField("pix_key", t)}
          placeholder="email@exemplo.com"
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Categoria *</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: form.category === key ? colors.tint : colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => updateField("category", key)}
            >
              <Text style={{ color: form.category === key ? "#fff" : colors.text, fontSize: 13 }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Taxa de entrega (R$)</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={form.delivery_fee}
          onChangeText={(t) => updateField("delivery_fee", t)}
          placeholder="0.00"
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Pedido mínimo (R$)</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={form.minimum_order}
          onChangeText={(t) => updateField("minimum_order", t)}
          placeholder="0.00"
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tempo de preparo (min)</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={form.prep_time_minutes}
          onChangeText={(t) => updateField("prep_time_minutes", t.replace(/[^0-9]/g, ""))}
          placeholder="20"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
        />

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Endereço da loja</Text>

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>CEP *</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={form.cep}
          onChangeText={(t) => updateField("cep", t)}
          placeholder="00000-000"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={9}
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Rua *</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={form.street}
          onChangeText={(t) => updateField("street", t)}
          placeholder="Rua das Flores"
          placeholderTextColor={colors.textSecondary}
        />

        <View style={styles.row}>
          <View style={styles.rowHalf}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Número *</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              value={form.number}
              onChangeText={(t) => updateField("number", t)}
              placeholder="120"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={styles.rowHalf}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bairro *</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              value={form.neighborhood}
              onChangeText={(t) => updateField("neighborhood", t)}
              placeholder="Centro"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Estado (UF) *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ufScroll}>
          <View style={styles.ufRow}>
            {UFS.map((uf) => (
              <TouchableOpacity
                key={uf}
                style={[
                  styles.ufChip,
                  {
                    backgroundColor: form.state === uf ? colors.tint : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => updateField("state", uf)}
              >
                <Text style={{ color: form.state === uf ? "#fff" : colors.text, fontSize: 13, fontWeight: "500" }}>
                  {uf}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Cidade *</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={form.city}
          onChangeText={(t) => updateField("city", t)}
          placeholder="Frederico Westphalen"
          placeholderTextColor={colors.textSecondary}
        />

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: saving ? colors.surface : colors.tint }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{isEdit ? "Salvar alterações" : "Criar Loja"}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <ImagePickerModal
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onImageSelected={(uri) => {
          if (pickerTarget === "avatar") {
            setAvatar(uri);
            setAvatarRemoved(false);
          } else if (pickerTarget === "banner") {
            setBanner(uri);
            setBannerRemoved(false);
          }
        }}
        onRemoveImage={() => {
          if (pickerTarget === "avatar") {
            setAvatar(null);
            setAvatarRemoved(true);
          } else if (pickerTarget === "banner") {
            setBanner(null);
            setBannerRemoved(true);
          }
        }}
        hasImage={pickerTarget === "avatar" ? !!avatar : !!banner}
        title={pickerTarget === "banner" ? "Banner da loja" : "Logo da loja"}
        aspect={pickerTarget === "banner" ? [16, 9] : [1, 1]}
      />
    </KeyboardAvoidingView>
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
  content: { padding: 16, paddingBottom: 40 },
  fieldLabel: { fontSize: 13, fontWeight: "500", marginBottom: 6, marginTop: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 24 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", gap: 12 },
  rowHalf: { flex: 1 },
  bannerPicker: {
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerPreview: { width: "100%", height: "100%" },
  logoPicker: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoPreview: { width: "100%", height: "100%" },
  imagePlaceholder: { alignItems: "center", gap: 6 },
  imagePlaceholderText: { fontSize: 13, fontWeight: "500" },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
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
  saveButton: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
