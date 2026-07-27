import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth, getStorageItem, setStorageItem } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { updateProfile } from "@/services/api";

const ACTIVE_GREEN = "#34C759"; // iOS Active Green

interface RadioButtonProps {
  selected: boolean;
  activeColor: string;
  isDark: boolean;
}

const RadioButton = ({ selected, activeColor, isDark }: RadioButtonProps) => (
  <View style={[styles.radioOuter, { borderColor: selected ? activeColor : (isDark ? "#48484A" : "#C7C7CC") }]}>
    {selected && <View style={[styles.radioInner, { backgroundColor: activeColor }]} />}
  </View>
);

export default function PrivacyScreen() {
  const router = useRouter();
  const { user, token, updateUser } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [isUpdating, setIsUpdating] = useState(false);

  // Privacy states
  const [readReceipts, setReadReceipts] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [keepChatsArchived, setKeepChatsArchived] = useState(false);

  const [privacyMessages, setPrivacyMessages] = useState<string>("all");
  const [privacyCalls, setPrivacyCalls] = useState<string>("contacts");

  // Load database/user privacy settings
  useEffect(() => {
    if (user) {
      setPrivacyMessages(user.privacy_messages || "all");
      setPrivacyCalls(user.privacy_calls || "contacts");
    }
  }, [user]);

  // Load keep archived settings
  useEffect(() => {
    (async () => {
      try {
        const savedKeepArchived = await getStorageItem("keep_chats_archived");
        if (savedKeepArchived !== null) {
          setKeepChatsArchived(savedKeepArchived === "true");
        }
      } catch (e) {
        console.warn("Error loading keep_chats_archived preference:", e);
      }
    })();
  }, []);

  const handleKeepChatsArchivedChange = async (value: boolean) => {
    setKeepChatsArchived(value);
    try {
      await setStorageItem("keep_chats_archived", value ? "true" : "false");
      if (token) {
        await updateProfile(token, undefined, value);
      }
    } catch (err) {
      console.warn("Failed to update keep_chats_archived setting:", err);
    }
  };

  const handleSavePrivacy = async () => {
    if (!token) return;
    setIsUpdating(true);
    try {
      await updateProfile(
        token,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        privacyMessages,
        privacyCalls
      );
      await updateUser({
        privacy_messages: privacyMessages,
        privacy_calls: privacyCalls,
      });
      router.back();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao salvar configurações de privacidade");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Custom Clean Header */}
      <View
        style={[
          styles.customHeader,
          {
            paddingTop: insets.top,
            backgroundColor: colors.headerBackground,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={24} color={colors.headerText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.headerText, flex: 1 }]}>
            Privacidade
          </Text>
          <TouchableOpacity 
            onPress={handleSavePrivacy} 
            disabled={isUpdating}
            activeOpacity={0.7}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <Text style={[styles.saveText, { color: colors.tint }]}>Salvar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Seção Mensagens */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            MENSAGENS
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Defina quem tem permissão para enviar novas mensagens diretas para você.
          </Text>
          <View style={[styles.card, { backgroundColor: colors.menuBackground, borderColor: colors.border }]}>
            {[
              { value: "all", label: "Todos" },
              { value: "contacts", label: "Somente contatos" },
              { value: "nobody", label: "Ninguém" },
            ].map((opt, index, arr) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionRow,
                  { borderBottomColor: colors.border },
                  index === arr.length - 1 && { borderBottomWidth: 0 }
                ]}
                activeOpacity={0.7}
                onPress={() => setPrivacyMessages(opt.value)}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>
                  {opt.label}
                </Text>
                <RadioButton 
                  selected={privacyMessages === opt.value} 
                  activeColor={ACTIVE_GREEN} 
                  isDark={isDark}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Seção Ligações */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            LIGAÇÕES
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Escolha quem pode iniciar chamadas de voz ou vídeo com você.
          </Text>
          <View style={[styles.card, { backgroundColor: colors.menuBackground, borderColor: colors.border }]}>
            {[
              { value: "all", label: "Todos" },
              { value: "contacts", label: "Somente contatos" },
              { value: "nobody", label: "Ninguém" },
            ].map((opt, index, arr) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionRow,
                  { borderBottomColor: colors.border },
                  index === arr.length - 1 && { borderBottomWidth: 0 }
                ]}
                activeOpacity={0.7}
                onPress={() => setPrivacyCalls(opt.value)}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>
                  {opt.label}
                </Text>
                <RadioButton 
                  selected={privacyCalls === opt.value} 
                  activeColor={ACTIVE_GREEN} 
                  isDark={isDark}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Seção Confirmações e Status */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            SEGURANÇA E VISIBILIDADE
          </Text>
          <View style={[styles.card, { backgroundColor: colors.menuBackground, borderColor: colors.border }]}>
            {/* Toggle Read Receipts */}
            <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>
                  Confirmações de leitura
                </Text>
                <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                  Se desativado, você não poderá ver nem enviar as confirmações de leitura (dois risquinhos azuis).
                </Text>
              </View>
              <Switch
                value={readReceipts}
                onValueChange={setReadReceipts}
                trackColor={{
                  false: isDark ? "#2C2C2E" : "#E5E5EA",
                  true: ACTIVE_GREEN,
                }}
                thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
              />
            </View>

            {/* Toggle Online status */}
            <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>
                  Visto por último e online
                </Text>
                <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                  Permite que outros contatos vejam se você está ativo ou a última vez que abriu o app.
                </Text>
              </View>
              <Switch
                value={onlineStatus}
                onValueChange={setOnlineStatus}
                trackColor={{
                  false: isDark ? "#2C2C2E" : "#E5E5EA",
                  true: ACTIVE_GREEN,
                }}
                thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
              />
            </View>

            {/* Toggle Keep chats archived */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>
                  Manter conversas arquivadas
                </Text>
                <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                  As conversas arquivadas continuarão ocultas e silenciadas mesmo ao receber novas mensagens.
                </Text>
              </View>
              <Switch
                value={keepChatsArchived}
                onValueChange={handleKeepChatsArchivedChange}
                trackColor={{
                  false: isDark ? "#2C2C2E" : "#E5E5EA",
                  true: ACTIVE_GREEN,
                }}
                thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customHeader: {
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerContent: {
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
  },
  saveText: {
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 8,
  },
  scrollContent: {
    paddingTop: 20,
  },
  section: {
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    fontSize: 16,
    fontWeight: "400",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  toggleSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
  },
});
