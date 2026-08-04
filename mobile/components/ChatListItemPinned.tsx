import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ChatListItem as ChatListItemType, API_URL } from "@/services/api";
import { useAppTheme } from "@/context/ThemeContext";
import { resolveLastMessagePreview } from "@/utils/forwardMessage";

interface ChatListItemPinnedProps {
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

export default function ChatListItemPinned({
  item,
  isSelected,
  onPress,
  onLongPress,
}: ChatListItemPinnedProps) {
  const { colors } = useAppTheme();

  const name =
    item.name ??
    item.participant_name ??
    item.participant_username ??
    "Unknown";

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSelected && {
          backgroundColor: colors.tint + "22",
        },
      ]}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item.id)}
    >
      {/* Avatar on top */}
      <View style={styles.avatarWrapper}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.tint },
            item.is_group && styles.groupAvatar,
          ]}
        >
          {item.is_group && item.avatar_url ? (
            <Image
              source={{
                uri: item.avatar_url.startsWith("http")
                  ? item.avatar_url
                  : `${API_URL}${item.avatar_url}`,
              }}
              style={styles.avatarImage}
            />
          ) : !item.is_group && item.participant_avatar_url ? (
            <Image
              source={{
                uri: item.participant_avatar_url.startsWith("http")
                  ? item.participant_avatar_url
                  : `${API_URL}${item.participant_avatar_url}`,
              }}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.avatarText}>
              {item.is_group
                ? (item.name ?? "G")[0].toUpperCase()
                : (item.participant_name ??
                    item.participant_username ??
                    "?")[0].toUpperCase()}
            </Text>
          )}
        </View>

        {/* Unread badge absolute positioned on the avatar */}
        {item.unread_count > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.badge }]}>
            <Text style={[styles.badgeText, { color: colors.badgeText }]}>
              {item.unread_count}
            </Text>
          </View>
        )}

        {/* Status icons row */}
        <View style={styles.statusRow}>
          {isChatMuted(item) && (
            <View
              style={[
                styles.statusIconBg,
                { backgroundColor: colors.background },
              ]}
            >
              <Ionicons
                name="notifications-off-outline"
                color={colors.textSecondary}
                size={10}
              />
            </View>
          )}
        </View>

        {/* Last message bubble */}
        {(() => {
          let displayMessage = "";
          if (item.is_blocked_by_me) {
            displayMessage = "Bloqueado";
          } else if (!item.last_message) {
            displayMessage = "";
          } else {
            const lastMessage = resolveLastMessagePreview(item.last_message);
            if (
              lastMessage.startsWith("Audio") ||
              lastMessage.startsWith("🎵 Áudio")
            ) {
              displayMessage = "🎙️ Áudio";
            } else if (lastMessage === "Photo" || lastMessage === "📷 Foto") {
              displayMessage = "📷 Foto";
            } else if (lastMessage === "Video" || lastMessage === "🎥 Vídeo") {
              displayMessage = "🎥 Vídeo";
            } else if (
              lastMessage === "File" ||
              lastMessage.startsWith("File|") ||
              lastMessage === "📁 Arquivo" ||
              lastMessage.startsWith("📁 Arquivo|") ||
              lastMessage.startsWith("Arquivo|")
            ) {
              displayMessage = "📁 Doc";
            } else if (lastMessage === "Message deleted") {
              displayMessage = "🚫 Apagada";
            } else if (lastMessage === "Chamada efetuada") {
              displayMessage = "📞 Ligação";
            } else if (lastMessage === "Chamada recebida") {
              displayMessage = "📞 Ligação";
            } else if (lastMessage === "Chamada perdida") {
              displayMessage = "📞 Perdida";
            } else if (
              lastMessage.startsWith('{"type":"location"') ||
              item.last_message?.trimStart().startsWith('{"type":"location"')
            ) {
              displayMessage = "📍 Local";
            } else if (lastMessage.startsWith('{"type":"contact_share"')) {
              displayMessage = "👤 Contato";
            } else if (
              lastMessage.startsWith("Pix:") ||
              item.last_message?.trimStart().startsWith('{"type":"pix_share"')
            ) {
              displayMessage = "💸 Pix";
            } else if (
              lastMessage.startsWith("Nota:") ||
              item.last_message?.trimStart().startsWith('{"type":"note_share"')
            ) {
              displayMessage = "📝 Nota";
            } else {
              displayMessage = lastMessage;
            }
          }

          if (!displayMessage) return null;

          return (
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[styles.bubbleText, { color: colors.text }]}
                numberOfLines={3}
                ellipsizeMode="tail"
              >
                {displayMessage}
              </Text>
              <View
                style={[
                  styles.bubbleTail,
                  {
                    backgroundColor: colors.surface,
                    borderRightColor: colors.border,
                    borderBottomColor: colors.border,
                  },
                ]}
              />
            </View>
          );
        })()}
      </View>

      {/* Name below the avatar */}
      <Text
        style={[styles.chatName, { color: colors.text }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 4,
    flex: 1,
    maxWidth: "33.3%",
    borderRadius: 24,
    marginVertical: 4,
  },
  chatName: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 16,
    textAlign: "center",
    maxWidth: 100,
  },
  avatarWrapper: {
    position: "relative",
    width: 100,
    height: 100,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  groupAvatar: {
    backgroundColor: "#34C759",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "500",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "bold",
  },
  statusRow: {
    position: "absolute",
    bottom: -4,
    right: -4,
    flexDirection: "row",
    gap: 2,
  },
  statusIconBg: {
    borderRadius: 8,
    padding: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  bubble: {
    position: "absolute",
    bottom: -12,
    left: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  bubbleText: {
    fontSize: 12,
    fontWeight: "400",
    textAlign: "center",
  },
  bubbleTail: {
    position: "absolute",
    bottom: -5,
    right: 15,
    width: 8,
    height: 8,
    transform: [{ rotate: "45deg" }],
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },
});
