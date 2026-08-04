import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import {
  getMyPixKey,
  createOrUpdatePixKey,
  deletePixKey,
  PIX_TYPE_LABELS,
  type PixKeyData,
} from "@/services/pixApi";

interface PixKeyModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (pixKey: PixKeyData) => void;
}

const PIX_TYPES = [
  { key: "celular", label: "Celular", placeholder: "(11) 99999-9999" },
  { key: "cpf", label: "CPF", placeholder: "000.000.000-00" },
  { key: "email", label: "E-mail", placeholder: "email@exemplo.com" },
  { key: "aleatoria", label: "Chave aleatória", placeholder: "Gerada pelo banco" },
];

const VISIBILITY_OPTIONS = [
  { key: "todos", label: "Todos" },
  { key: "contatos", label: "Meus contatos" },
  { key: "ninguem", label: "Ninguém" },
];

export default function PixKeyModal({ visible, onClose, onSaved }: PixKeyModalProps) {
  const { colors } = useAppTheme();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pixData, setPixData] = useState<PixKeyData | null>(null);

  const [selectedType, setSelectedType] = useState<string>("celular");
  const [pixValue, setPixValue] = useState("");
  const [fullName, setFullName] = useState("");
  const [visibility, setVisibility] = useState<string>("contatos");

  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showVisibilitySelector, setShowVisibilitySelector] = useState(false);

  const loadPixKey = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getMyPixKey(token);
      if (res.pix_key) {
        setPixData(res.pix_key);
        setSelectedType(res.pix_key.pix_type);
        setPixValue(res.pix_key.pix_value);
        setFullName(res.pix_key.full_name);
        setVisibility(res.pix_key.visibility);
      } else {
        setPixData(null);
        setSelectedType("celular");
        setPixValue("");
        setFullName("");
        setVisibility("contatos");
      }
    } catch (err) {
      console.error("Error loading pix key:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (visible && token) {
      loadPixKey();
    }
  }, [visible, token, loadPixKey]);

  const handleSave = async () => {
    if (!token) return;

    if (!pixValue.trim()) {
      Alert.alert("Erro", "Preencha a chave Pix.");
      return;
    }
    if (!fullName.trim()) {
      Alert.alert("Erro", "Preencha o nome completo na conta.");
      return;
    }

    setSaving(true);
    try {
      const res = await createOrUpdatePixKey(token, selectedType, pixValue.trim(), fullName.trim(), visibility);
      onSaved?.(res.pix_key);
      onClose();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao salvar chave Pix.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Excluir Chave Pix",
      "Tem certeza que deseja excluir sua chave Pix? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            setSaving(true);
            try {
              await deletePixKey(token);
              setPixData(null);
              setPixValue("");
              setFullName("");
              setSelectedType("celular");
              setVisibility("contatos");
              onClose();
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Falha ao excluir chave Pix.");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheet,
            { backgroundColor: colors.menuBackground },
          ]}
        >
          <View style={[styles.indicator, { backgroundColor: colors.border }]} />

          <Text style={[styles.title, { color: colors.text }]}>
            {pixData ? "Editar Chave Pix" : "Nova Chave Pix"}
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Tipo de chave
              </Text>
              <TouchableOpacity
                style={[styles.selector, { backgroundColor: colors.background }]}
                onPress={() => {
                  setShowTypeSelector(!showTypeSelector);
                  setShowVisibilitySelector(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.selectorText, { color: colors.text }]}>
                  {PIX_TYPE_LABELS[selectedType] || "Tipo"}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={colors.textSecondary}
                  style={{ transform: [{ rotate: showTypeSelector ? "180deg" : "0deg" }] }}
                />
              </TouchableOpacity>

              {showTypeSelector && (
                <View style={[styles.dropdown, { backgroundColor: colors.background }]}>
                  {PIX_TYPES.map((type) => {
                    const isSelected = selectedType === type.key;
                    return (
                      <TouchableOpacity
                        key={type.key}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedType(type.key);
                          setShowTypeSelector(false);
                        }}
                        activeOpacity={0.6}
                      >
                        <View
                          style={[
                            styles.radio,
                            { borderColor: isSelected ? colors.tint : colors.textSecondary },
                          ]}
                        >
                          {isSelected && <View style={[styles.radioDot, { backgroundColor: colors.tint }]} />}
                        </View>
                        <Text
                          style={[
                            styles.dropdownText,
                            { color: colors.text },
                            isSelected && { fontWeight: "600" },
                          ]}
                        >
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 20 }]}>
                Chave Pix
              </Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
                value={pixValue}
                onChangeText={setPixValue}
                placeholder={PIX_TYPES.find((t) => t.key === selectedType)?.placeholder || "Sua chave"}
                placeholderTextColor={colors.textSecondary + "80"}
                autoCapitalize="none"
                keyboardType={selectedType === "email" ? "email-address" : selectedType === "celular" ? "phone-pad" : "default"}
              />

              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 20 }]}>
                Nome na conta
              </Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Como está no banco"
                placeholderTextColor={colors.textSecondary + "80"}
              />

              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 20 }]}>
                Quem pode ver
              </Text>
              <TouchableOpacity
                style={[styles.selector, { backgroundColor: colors.background }]}
                onPress={() => {
                  setShowVisibilitySelector(!showVisibilitySelector);
                  setShowTypeSelector(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.selectorText, { color: colors.text }]}>
                  {VISIBILITY_OPTIONS.find((o) => o.key === visibility)?.label || "Meus contatos"}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={colors.textSecondary}
                  style={{ transform: [{ rotate: showVisibilitySelector ? "180deg" : "0deg" }] }}
                />
              </TouchableOpacity>

              {showVisibilitySelector && (
                <View style={[styles.dropdown, { backgroundColor: colors.background }]}>
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const isSelected = visibility === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setVisibility(opt.key);
                          setShowVisibilitySelector(false);
                        }}
                        activeOpacity={0.6}
                      >
                        <View
                          style={[
                            styles.radio,
                            { borderColor: isSelected ? colors.tint : colors.textSecondary },
                          ]}
                        >
                          {isSelected && <View style={[styles.radioDot, { backgroundColor: colors.tint }]} />}
                        </View>
                        <Text
                          style={[
                            styles.dropdownText,
                            { color: colors.text },
                            isSelected && { fontWeight: "600" },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.tint }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {pixData ? "Salvar" : "Adicionar"}
                  </Text>
                )}
              </TouchableOpacity>

              {pixData && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDelete}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.deleteButtonText, { color: colors.danger }]}>
                    Excluir chave
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: "88%",
  },
  indicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 24,
  },
  loadingContainer: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  selectorText: {
    fontSize: 15,
    flex: 1,
  },
  dropdown: {
    borderRadius: 12,
    marginTop: 6,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dropdownText: {
    fontSize: 15,
  },
  saveButton: {
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
  deleteButton: {
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  cancelButton: {
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
