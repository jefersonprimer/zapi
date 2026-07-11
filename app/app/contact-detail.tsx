import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Phone,
  Video,
  Trash2,
  Shield,
  ShieldAlert,
  ArrowLeft,
  User,
  Mail,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getContacts,
  blockContact,
  unblockContact,
  clearChatMessages,
  type Contact,
} from "@/services/api";
import { voiceCallManager } from "@/services/voiceCallManager";

export default function ContactDetailScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const { participantId, participantUsername, chatId } = useLocalSearchParams<{
    participantId: string;
    participantUsername: string;
    chatId?: string;
  }>();

  const [contact, setContact] = useState<Contact | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchContactDetails = useCallback(async () => {
    if (!token || !participantId) return;
    try {
      setLoading(true);
      const contactsList = await getContacts(token);
      const found = contactsList.find((c) => c.contact_id === participantId);
      if (found) {
        setContact(found);
        setIsBlocked(found.is_blocked);
      }
    } catch (err: any) {
      console.error("Error fetching contact details:", err);
    } finally {
      setLoading(false);
    }
  }, [token, participantId]);

  useEffect(() => {
    fetchContactDetails();
  }, [fetchContactDetails]);

  const handleVoiceCall = () => {
    if (!participantId) return;
    voiceCallManager.startCall(
      participantId,
      participantUsername || contact?.username || "Contato"
    );
  };

  const handleVideoCall = () => {
    if (!participantId) return;
    voiceCallManager.startCall(
      participantId,
      participantUsername || contact?.username || "Contato",
      true
    );
  };

  const handleToggleBlock = async () => {
    if (!token || !participantId) return;
    setActionLoading(true);
    try {
      if (isBlocked) {
        await unblockContact(token, participantId);
        setIsBlocked(false);
        Alert.alert("Sucesso", "Contato desbloqueado com sucesso.");
      } else {
        await blockContact(token, participantId);
        setIsBlocked(true);
        Alert.alert("Sucesso", "Contato bloqueado com sucesso.");
      }
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Não foi possível alterar o status de bloqueio.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearChat = () => {
    if (!token || !chatId) {
      Alert.alert("Info", "Não há histórico de conversas para limpar.");
      return;
    }

    Alert.alert(
      "Limpar Conversa",
      "Deseja realmente apagar todo o histórico de mensagens deste chat? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpar",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await clearChatMessages(token, chatId);
              Alert.alert("Sucesso", "Histórico de conversa apagado.");
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Não foi possível limpar a conversa.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const nameInitial = (participantUsername || contact?.username || "?")[0]?.toUpperCase();
  const displayName = participantUsername || contact?.username || "Carregando...";
  const displayEmail = contact?.email || "Email indisponível";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Custom Header */}
      <View style={[styles.customHeader, { paddingTop: insets.top, backgroundColor: colors.headerBackground }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color={colors.headerText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>Detalhes do Contato</Text>
        </View>
      </View>

      {actionLoading && (
        <View style={[styles.overlayLoading, { backgroundColor: colors.modalOverlay }]}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={[styles.avatar, { backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA" }]}>
              <Text style={[styles.avatarText, { color: colors.text }]}>{nameInitial}</Text>
            </View>
            <Text style={[styles.displayName, { color: colors.text }]}>{displayName}</Text>
            {isBlocked && (
              <View style={[styles.blockedBadge, { backgroundColor: colors.danger }]}>
                <Text style={styles.blockedBadgeText}>BLOQUEADO</Text>
              </View>
            )}
          </View>

          {/* Quick Call Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface }]}
              onPress={handleVoiceCall}
            >
              <Phone size={24} color={colors.tint} />
              <Text style={[styles.actionButtonText, { color: colors.tint }]}>Ligar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface }]}
              onPress={handleVideoCall}
            >
              <Video size={24} color={colors.tint} />
              <Text style={[styles.actionButtonText, { color: colors.tint }]}>Vídeo</Text>
            </TouchableOpacity>
          </View>

          {/* Details Section */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Informações</Text>
            
            <View style={styles.infoRow}>
              <User size={20} color={colors.textSecondary} style={styles.infoIcon} />
              <View>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Nome</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{displayName}</Text>
              </View>
            </View>

            <View style={[styles.infoRow, styles.borderTop, { borderTopColor: colors.border }]}>
              <Mail size={20} color={colors.textSecondary} style={styles.infoIcon} />
              <View>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>E-mail</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{displayEmail}</Text>
              </View>
            </View>
          </View>

          {/* Danger Zone Options */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.danger }]}>Opções</Text>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={handleClearChat}
            >
              <Trash2 size={20} color={colors.danger} style={styles.infoIcon} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.danger }]}>Limpar conversa</Text>
                <Text style={[styles.optionSub, { color: colors.textSecondary }]}>
                  Apaga todas as mensagens e histórico deste chat.
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionRow, styles.borderTop, { borderTopColor: colors.border }]}
              onPress={handleToggleBlock}
            >
              {isBlocked ? (
                <>
                  <Shield size={20} color={colors.tint} style={styles.infoIcon} />
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, { color: colors.tint }]}>Desbloquear contato</Text>
                    <Text style={[styles.optionSub, { color: colors.textSecondary }]}>
                      Permite que este usuário envie mensagens para você novamente.
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <ShieldAlert size={20} color={colors.danger} style={styles.infoIcon} />
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, { color: colors.danger }]}>Bloquear contato</Text>
                    <Text style={[styles.optionSub, { color: colors.textSecondary }]}>
                      Impede que este usuário envie mensagens para você.
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  overlayLoading: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  customHeader: {
    paddingBottom: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: "center",
    marginVertical: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: "bold",
  },
  displayName: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  blockedBadge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  blockedBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 20,
  },
  actionButton: {
    width: "42%",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  infoIcon: {
    marginRight: 16,
  },
  infoLabel: {
    fontSize: 12,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 2,
  },
  borderTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    paddingTop: 20,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  optionSub: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
});
