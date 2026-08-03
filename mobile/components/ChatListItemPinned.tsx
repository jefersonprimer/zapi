import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { BellOff, Pin } from "lucide-react-native";
import { ChatListItem as ChatListItemType, API_URL } from "@/services/api";
import { useAppTheme } from "@/context/ThemeContext";

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
              <BellOff color={colors.textSecondary} size={10} />
            </View>
          )}
          {item.is_pinned && (
            <View
              style={[
                styles.statusIconBg,
                { backgroundColor: colors.background },
              ]}
            >
              <Pin
                color={colors.tint}
                size={10}
                style={{ transform: [{ rotate: "45deg" }] }}
              />
            </View>
          )}
        </View>
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
    marginTop: 6,
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
});
