import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Clipboard,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMyPixKey, deletePixKey, type PixKeyData } from "@/services/pixApi";
import PixKeyModal from "@/components/PixKeyModal";

export default function PaymentsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [pixKey, setPixKey] = useState<PixKeyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchPixKey = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getMyPixKey(token);
      setPixKey(res.pix_key);
    } catch (err) {
      console.error("Failed to fetch pix key:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchPixKey();
    }, [fetchPixKey]),
  );

  function handleCopy() {
    if (!pixKey) return;
    Clipboard.setString(pixKey.pix_value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDelete() {
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
            setDeleting(true);
            try {
              await deletePixKey(token);
              setPixKey(null);
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Falha ao excluir chave Pix.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, backgroundColor: colors.headerBackground },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons
              name="chevron-back-outline"
              size={24}
              color={colors.headerText}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>
            Pagamentos
          </Text>
          <View style={styles.headerRight} />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + (pixKey ? 100 : 24) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {pixKey ? (
            <View style={styles.centeredContent}>
              <TouchableOpacity
                style={[
                  styles.pixCard,
                  { backgroundColor: colors.cardBackground },
                ]}
                onPress={handleCopy}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: "#32BCAD" + "18" },
                  ]}
                >
                  <MaterialIcons name="pix" size={48} color="#32BCAD" />
                </View>

                <Text
                  style={[styles.fullName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {pixKey.full_name}
                </Text>

                <View style={styles.keyContainer}>
                  <Text
                    style={[
                      styles.pixKeyValue,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {pixKey.pix_value}
                  </Text>
                </View>

                <View style={styles.copiedBadge}>
                  <MaterialIcons
                    name={copied ? "check-circle" : "content-copy"}
                    size={14}
                    color={copied ? "#32BCAD" : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.copiedText,
                      { color: copied ? "#32BCAD" : colors.textSecondary },
                    ]}
                  >
                    {copied ? "Copiado!" : "Toque para copiar"}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.subActions}>
                <TouchableOpacity
                  style={[
                    styles.subActionBtn,
                    { backgroundColor: colors.cardBackground },
                  ]}
                  onPress={() => setModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="pencil"
                    size={18}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.subActionText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Editar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.subActionBtn,
                    { backgroundColor: colors.cardBackground },
                  ]}
                  onPress={handleDelete}
                  disabled={deleting}
                  activeOpacity={0.7}
                >
                  {deleting ? (
                    <ActivityIndicator size={16} color={colors.danger} />
                  ) : (
                    <MaterialCommunityIcons
                      name="delete-outline"
                      size={18}
                      color={colors.danger}
                    />
                  )}
                  <Text
                    style={[styles.subActionText, { color: colors.danger }]}
                  >
                    Excluir
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIconContainer,
                  { backgroundColor: "#32BCAD" + "18" },
                ]}
              >
                <MaterialIcons name="pix" size={40} color="#32BCAD" />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Nenhuma chave Pix
              </Text>
              <Text
                style={[styles.emptySubtext, { color: colors.textSecondary }]}
              >
                Adicione sua chave Pix para receber pagamentos de contatos no
                Zapi.
              </Text>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.tint }]}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                <Text style={styles.addBtnText}>Adicionar chave Pix</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      <PixKeyModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          fetchPixKey();
        }}
        onSaved={(saved) => {
          setPixKey(saved);
          setLoading(false);
        }}
      />

      {pixKey && (
        <TouchableOpacity
          style={[
            styles.fab,
            {
              backgroundColor: colors.fab,
              bottom: insets.bottom + 24,
              shadowColor: colors.shadow,
            },
          ]}
          onPress={() =>
            router.push({
              pathname: "/share-contact",
              params: { mode: "pix" },
            })
          }
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons
            name="hand-coin"
            size={20}
            color={isDark ? "#121212" : "#FFFFFF"}
          />
          <Text
            style={[styles.fabLabel, { color: isDark ? "#121212" : "#FFFFFF" }]}
          >
            Cobrar
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingBottom: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  backBtn: {
    padding: 4,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
  },
  headerRight: {
    width: 32,
  },
  content: {
    padding: 16,
  },
  centeredContent: {
    alignItems: "center",
    marginTop: 32,
  },
  pixCard: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  fullName: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  keyContainer: {
    marginBottom: 16,
  },
  pixKeyValue: {
    fontSize: 15,
    textAlign: "center",
  },
  copiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  copiedText: {
    fontSize: 13,
    fontWeight: "500",
  },
  subActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    width: "100%",
  },
  subActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  subActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 80,
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  fab: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  fabLabel: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
