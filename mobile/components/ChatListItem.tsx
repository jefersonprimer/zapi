import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { ChatListItem as ChatListItemType, API_URL } from "@/services/api";
import { useAppTheme } from "@/context/ThemeContext";
import { resolveLastMessagePreview } from "@/utils/forwardMessage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface ChatListItemProps {
  item: ChatListItemType;
  isSelected: boolean;
  onPress: (item: ChatListItemType) => void;
  onLongPress: (chatId: string) => void;
}

const isChatMuted = (chat: ChatListItemType) => {
  if (chat.notification_muted_forever) return true;
  if (chat.notification_muted_until) {
    return new Date(chat.notification_muted_until) > new Date();
  }
  return false;
};

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatListItem({
  item,
  isSelected,
  onPress,
  onLongPress,
}: ChatListItemProps) {
  const { colors } = useAppTheme();

  return (
    <TouchableOpacity
      style={[
        styles.chatItem,
        { borderBottomColor: colors.border },
        isSelected && {
          backgroundColor: colors.tint + "22",
        },
      ]}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item.id)}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: colors.tint },
          item.is_group && styles.groupAvatar,
          {
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
          },
        ]}
      >
        {item.is_group && item.avatar_url ? (
          <Image
            source={{
              uri: item.avatar_url.startsWith("http")
                ? item.avatar_url
                : `${API_URL}${item.avatar_url}`,
            }}
            style={{ width: "100%", height: "100%" }}
          />
        ) : !item.is_group && item.participant_avatar_url ? (
          <Image
            source={{
              uri: item.participant_avatar_url.startsWith("http")
                ? item.participant_avatar_url
                : `${API_URL}${item.participant_avatar_url}`,
            }}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <Text style={styles.avatarText}>
            {item.is_group
              ? (item.name ?? "G")[0].toUpperCase()
              : (item.participant_custom_name ??
                  (item as any).custom_name ??
                  item.participant_name ??
                  item.participant_username ??
                  "?")[0].toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.headerRow}>
          <Text
            style={[styles.chatName, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.is_group
              ? (item.name ?? "Group")
              : (item.participant_custom_name ??
                  (item as any).custom_name ??
                  item.name ??
                  item.participant_name ??
                  item.participant_username ??
                  "Unknown")}
          </Text>
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
        </View>
        <View style={styles.bodyRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            {(() => {
              if (item.is_blocked_by_me) {
                return (
                  <Text
                    style={[
                      styles.lastMessage,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    Você bloqueou esse contato
                  </Text>
                );
              }

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
              const lastMessage = resolveLastMessagePreview(item.last_message);
              let displayMessage = lastMessage;

              if (
                lastMessage.startsWith("Audio") ||
                lastMessage.startsWith("🎵 Áudio")
              ) {
                let durationStr = "";
                const parts = lastMessage.split("|duration:");
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
                  <Ionicons
                    name="mic-outline"
                    size={15}
                    color={colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                );
              } else if (lastMessage === "Photo" || lastMessage === "📷 Foto") {
                displayMessage = "Foto";
                iconElement = (
                  <Ionicons
                    name="camera-outline"
                    size={15}
                    color={colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                );
              } else if (
                lastMessage === "Video" ||
                lastMessage === "🎥 Vídeo"
              ) {
                displayMessage = "Vídeo";
                iconElement = (
                  <Ionicons
                    name="videocam-outline"
                    size={15}
                    color={colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                );
              } else if (
                lastMessage === "File" ||
                lastMessage.startsWith("File|") ||
                lastMessage === "📁 Arquivo" ||
                lastMessage.startsWith("📁 Arquivo|") ||
                lastMessage.startsWith("Arquivo|")
              ) {
                let fileName = "Arquivo";
                let rawFileName = "";
                if (lastMessage.startsWith("File|")) {
                  rawFileName = lastMessage.substring(5);
                } else if (lastMessage.startsWith("📁 Arquivo|")) {
                  rawFileName = lastMessage.substring(11);
                } else if (lastMessage.startsWith("Arquivo|")) {
                  rawFileName = lastMessage.substring(8);
                }

                if (rawFileName) {
                  const match = rawFileName.match(
                    /^[^_]+_[0-9a-fA-F\-]{36}_(.+)$/,
                  );
                  if (match) {
                    fileName = match[1];
                  } else {
                    const oldMatch = rawFileName.match(
                      /^[^_]+_([0-9a-fA-F\-]{36}\..+)$/,
                    );
                    fileName = oldMatch ? oldMatch[1] : rawFileName;
                  }
                }

                displayMessage = fileName;
                iconElement = (
                  <Ionicons
                    name="document-text-outline"
                    size={15}
                    color={colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                );
              } else if (lastMessage === "Message deleted") {
                displayMessage = "Mensagem apagada";
                iconElement = (
                  <MaterialCommunityIcons
                    name="cancel"
                    size={15}
                    color={colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                );
              } else if (lastMessage === "Chamada efetuada") {
                displayMessage = "Chamada efetuada";
                iconElement = (
                  <MaterialCommunityIcons
                    name="phone-outgoing"
                    size={15}
                    color={colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                );
              } else if (lastMessage === "Chamada recebida") {
                displayMessage = "Chamada recebida";
                iconElement = (
                  <MaterialCommunityIcons
                    name="phone-incoming"
                    size={15}
                    color={colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                );
              } else if (lastMessage === "Chamada perdida") {
                displayMessage = "Chamada perdida";
                iconElement = (
                  <MaterialCommunityIcons
                    name="phone-missed"
                    size={15}
                    color={colors.danger}
                    style={{ marginRight: 4 }}
                  />
                );
              } else if (
                lastMessage.startsWith('{"type":"location"') ||
                item.last_message?.trimStart().startsWith('{"type":"location"')
              ) {
                try {
                  const parsed = JSON.parse(
                    lastMessage.startsWith('{"type":"location"')
                      ? lastMessage
                      : item.last_message || "",
                  );
                  displayMessage = parsed.name || "Localização";
                } catch {
                  displayMessage = "Localização";
                }
                iconElement = (
                  <Ionicons
                    name="location-outline"
                    size={15}
                    color={colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                );
              } else if (lastMessage.startsWith('{"type":"contact_share"')) {
                try {
                  const parsed = JSON.parse(lastMessage);
                  displayMessage = parsed.username;
                } catch {
                  displayMessage = "Contato";
                }
                iconElement = (
                  <Ionicons
                    name="person-outline"
                    size={15}
                    color={colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                );
              } else if (
                lastMessage.startsWith("Pix:") ||
                item.last_message?.trimStart().startsWith('{"type":"pix_share"')
              ) {
                // resolveLastMessagePreview turns pix_share JSON into "Pix: Label: value"
                displayMessage = lastMessage.startsWith("Pix:")
                  ? lastMessage.slice(5).trimStart()
                  : "Chave Pix";
                iconElement = (
                  <MaterialIcons
                    name="pix"
                    size={15}
                    color="#32BCAD"
                    style={{ marginRight: 4 }}
                  />
                );
              } else if (
                lastMessage.startsWith("Nota:") ||
                item.last_message
                  ?.trimStart()
                  .startsWith('{"type":"note_share"')
              ) {
                displayMessage = lastMessage.startsWith("Nota:")
                  ? lastMessage.slice(5).trimStart()
                  : "Nota";
                iconElement = (
                  <MaterialCommunityIcons
                    name="note-outline"
                    size={15}
                    color="#F5A623"
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
                  {displayMessage}
                </Text>
              );
            })()}
          </View>
          <View style={styles.rightIconsRow}>
            {isChatMuted(item) && (
              <Ionicons
                name="notifications-off-outline"
                color={colors.textSecondary}
                size={14}
              />
            )}
            {item.is_pinned && (
              <Ionicons
                name="pin-outline"
                color={colors.textSecondary}
                size={14}
                style={[styles.pinIcon, { transform: [{ rotate: "45deg" }] }]}
              />
            )}
            {item.unread_count > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.badge }]}>
                <Text style={[styles.badgeText, { color: colors.badgeText }]}>
                  {item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingHorizontal: 22,
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
  groupAvatar: { backgroundColor: "#34C759" },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  chatInfo: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  bodyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatName: { fontSize: 16, fontWeight: "600", flex: 1, marginRight: 8 },
  lastMessage: { fontSize: 14 },
  lastMessageAudioContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  lastMessageUnread: { fontWeight: "700" },
  time: { fontSize: 12 },
  timeUnread: { fontWeight: "700" },
  rightIconsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pinIcon: {
    marginRight: 2,
  },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
});
