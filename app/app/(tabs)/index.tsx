import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { getChats, type ChatListItem } from "@/services/api";
import {
  Camera,
  MoreVertical,
  MessageSquarePlus,
  Sun,
  Moon,
  Laptop,
  Check,
  Lock,
  Mic,
  Video,
  FileText,
  Trash2,
} from "lucide-react-native";
import { wsClient } from "@/services/ws";
import { useAppTheme } from "@/context/ThemeContext";

export default function ChatListScreen() {
  const router = useRouter();
  const { signOut, token } = useAuth();
  const { colors, themePreference, setThemePreference } = useAppTheme();

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  const loadChats = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getChats(token);
      setChats(data.chats);
    } catch (err: any) {
      Alert.alert("Erro", err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats]),
  );

  useEffect(() => {
    if (!token) return;
    const unsub = wsClient.on("chat_list_update", () => {
      loadChats();
    });
    return unsub;
  }, [token, loadChats]);

  function formatTime(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { backgroundColor: colors.headerBackground }]}
      >
        <Text style={[styles.title, { color: colors.headerText }]}>Zapi</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => Alert.alert("Câmera", "Câmera em desenvolvimento.")}
          >
            <Camera color={colors.headerText} size={22} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => setMenuVisible(true)}
          >
            <MoreVertical color={colors.headerText} size={22} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Options Menu Dropdown */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View
            style={[
              styles.menuContainer,
              {
                backgroundColor: colors.menuBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setThemeModalVisible(true);
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Alterar Tema
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                router.push("/settings");
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Configurações
              </Text>
            </TouchableOpacity>

            <View
              style={[styles.menuDivider, { backgroundColor: colors.border }]}
            />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                signOut();
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.danger }]}>
                Sair
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Theme Choice Dialog Modal */}
      <Modal
        visible={themeModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <TouchableOpacity
          style={[
            styles.dialogOverlay,
            { backgroundColor: colors.modalOverlay },
          ]}
          activeOpacity={1}
          onPress={() => setThemeModalVisible(false)}
        >
          <View
            style={[
              styles.themeDialog,
              {
                backgroundColor: colors.menuBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.dialogTitle, { color: colors.text }]}>
              Escolher tema
            </Text>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={async () => {
                await setThemePreference("light");
                setThemeModalVisible(false);
              }}
            >
              <View style={styles.dialogOptionLabel}>
                <Sun
                  size={20}
                  color={
                    themePreference === "light"
                      ? colors.tint
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.dialogOptionText,
                    { color: colors.text },
                    themePreference === "light" && {
                      color: colors.tint,
                      fontWeight: "600",
                    },
                  ]}
                >
                  Claro
                </Text>
              </View>
              {themePreference === "light" && (
                <Check size={18} color={colors.tint} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={async () => {
                await setThemePreference("dark");
                setThemeModalVisible(false);
              }}
            >
              <View style={styles.dialogOptionLabel}>
                <Moon
                  size={20}
                  color={
                    themePreference === "dark"
                      ? colors.tint
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.dialogOptionText,
                    { color: colors.text },
                    themePreference === "dark" && {
                      color: colors.tint,
                      fontWeight: "600",
                    },
                  ]}
                >
                  Escuro
                </Text>
              </View>
              {themePreference === "dark" && (
                <Check size={18} color={colors.tint} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogOption}
              onPress={async () => {
                await setThemePreference("system");
                setThemeModalVisible(false);
              }}
            >
              <View style={styles.dialogOptionLabel}>
                <Laptop
                  size={20}
                  color={
                    themePreference === "system"
                      ? colors.tint
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.dialogOptionText,
                    { color: colors.text },
                    themePreference === "system" && {
                      color: colors.tint,
                      fontWeight: "600",
                    },
                  ]}
                >
                  Padrão do sistema
                </Text>
              </View>
              {themePreference === "system" && (
                <Check size={18} color={colors.tint} />
              )}
            </TouchableOpacity>

            <View
              style={[
                styles.menuDivider,
                { backgroundColor: colors.border, marginVertical: 8 },
              ]}
            />

            <TouchableOpacity
              style={styles.dialogCloseButton}
              onPress={() => setThemeModalVisible(false)}
            >
              <Text style={[styles.dialogCloseText, { color: colors.tint }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.tint}
          style={{ marginTop: 40 }}
        />
      ) : chats.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyContent}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Nenhuma conversa ainda
            </Text>
            <Text
              style={[styles.emptySubtext, { color: colors.textSecondary }]}
            >
              Toque no botão abaixo para iniciar
            </Text>
          </View>
          <View style={[styles.footerContainer, { marginBottom: 60 }]}>
            <Lock color={colors.textSecondary} size={13} />
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Suas mensagens estão protegidas por criptografia.
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListFooterComponent={
            <View style={styles.footerContainer}>
              <Lock color={colors.textSecondary} size={13} />
              <Text
                style={[styles.footerText, { color: colors.textSecondary }]}
              >
                Suas mensagens estão protegidas por criptografia.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chatItem, { borderBottomColor: colors.border }]}
              onPress={() =>
                router.push({
                  pathname: "/chat",
                  params: {
                    chatId: item.id,
                    participantId: item.participant_id || "",
                    participantUsername:
                      item.name ?? item.participant_username ?? "Unknown",
                  },
                })
              }
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: colors.tint },
                  item.is_group && styles.groupAvatar,
                ]}
              >
                <Text style={styles.avatarText}>
                  {item.is_group
                    ? (item.name ?? "G")[0].toUpperCase()
                    : (item.participant_username ?? "?")[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.chatInfo}>
                <Text style={[styles.chatName, { color: colors.text }]}>
                  {item.name ?? item.participant_username ?? "Unknown"}
                </Text>
                {(() => {
                  if (!item.last_message) {
                    return (
                      <Text
                        style={[
                          styles.lastMessage,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        Nenhuma mensagem ainda
                      </Text>
                    );
                  }

                  let iconElement = null;
                  let displayMessage = item.last_message;

                  if (item.last_message.startsWith("Audio")) {
                    let durationStr = "";
                    const parts = item.last_message.split("|duration:");
                    if (parts.length > 1) {
                      const secs = parseInt(parts[1], 10);
                      if (!isNaN(secs)) {
                        const m = Math.floor(secs / 60);
                        const s = secs % 60;
                        durationStr = ` (${m}:${s < 10 ? "0" : ""}${s})`;
                      }
                    }
                    displayMessage = `Mensagem de voz ${durationStr}`;
                    iconElement = (
                      <Mic
                        size={15}
                        color={colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    );
                  } else if (item.last_message === "Photo") {
                    displayMessage = "Photo";
                    iconElement = (
                      <Camera
                        size={15}
                        color={colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    );
                  } else if (item.last_message === "Video") {
                    displayMessage = "Video";
                    iconElement = (
                      <Video
                        size={15}
                        color={colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    );
                  } else if (item.last_message === "File") {
                    displayMessage = "File";
                    iconElement = (
                      <FileText
                        size={15}
                        color={colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    );
                  } else if (item.last_message === "Message deleted") {
                    displayMessage = "Message deleted";
                    iconElement = (
                      <Trash2
                        size={15}
                        color={colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    );
                  }

                  if (iconElement) {
                    return (
                      <View style={styles.lastMessageAudioContainer}>
                        {iconElement}
                        <Text
                          style={[
                            styles.lastMessage,
                            { color: colors.textSecondary, flex: 1 },
                            item.unread_count > 0 && styles.lastMessageUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {displayMessage}
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <Text
                      style={[
                        styles.lastMessage,
                        { color: colors.textSecondary },
                        item.unread_count > 0 && styles.lastMessageUnread,
                      ]}
                      numberOfLines={1}
                    >
                      {item.last_message}
                    </Text>
                  );
                })()}
              </View>
              <View style={styles.rightContainer}>
                <Text
                  style={[
                    styles.time,
                    { color: colors.textSecondary },
                    item.unread_count > 0 && [
                      styles.timeUnread,
                      { color: colors.tint },
                    ],
                  ]}
                >
                  {formatTime(item.last_message_at)}
                </Text>
                {item.unread_count > 0 && (
                  <View
                    style={[styles.badge, { backgroundColor: colors.badge }]}
                  >
                    <Text
                      style={[styles.badgeText, { color: colors.badgeText }]}
                    >
                      {item.unread_count}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.fab }]}
        onPress={() => router.push("/contacts")}
      >
        <MessageSquarePlus color="#fff" size={24} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  title: { fontSize: 22, fontWeight: "bold" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerIcon: {
    padding: 4,
  },
  groupAvatar: { backgroundColor: "#34C759" },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  chatInfo: { flex: 1 },
  chatName: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  lastMessage: { fontSize: 14 },
  lastMessageAudioContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  lastMessageUnread: { fontWeight: "700" },
  time: { fontSize: 12 },
  timeUnread: { fontWeight: "700" },
  rightContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 8,
  },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    marginTop: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  empty: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  emptySubtext: { fontSize: 14, textAlign: "center" },
  footerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 40,
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
    flexShrink: 1,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  dialogOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  menuContainer: {
    position: "absolute",
    top: 90,
    right: 16,
    borderRadius: 12,
    paddingVertical: 6,
    width: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
  },
  menuItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "500",
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
  themeDialog: {
    width: "80%",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  dialogOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  dialogOptionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dialogOptionText: {
    fontSize: 16,
  },
  dialogCloseButton: {
    alignItems: "flex-end",
    paddingTop: 8,
    paddingRight: 4,
  },
  dialogCloseText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
