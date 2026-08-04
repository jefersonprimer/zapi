import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import {
  type ForwardedMessageData,
  getForwardPreviewText,
  parseNoteShareContent,
} from "@/utils/forwardMessage";

interface ForwardPreviewBarProps {
  forwarded: ForwardedMessageData;
  onClear: () => void;
}

export const ForwardPreviewBar: React.FC<ForwardPreviewBarProps> = ({
  forwarded,
  onClear,
}) => {
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const noteShare = parseNoteShareContent(forwarded.content);

  const isMe = forwarded.sender_id === user?.user_id;
  const displayName = isMe ? "Você" : forwarded.sender_username;

  // Determine icon based on attachment type
  let iconName = "chatbubble-outline";
  let iconLibrary: "ionicons" | "mci" = "ionicons";
  const hasAttachment = !!(
    forwarded.attachment_type ||
    forwarded.image_url ||
    forwarded.local_file_path
  );

  if (forwarded.attachment_type === "image") {
    iconName = "camera-outline";
  } else if (forwarded.attachment_type === "video") {
    iconName = "videocam-outline";
  } else if (forwarded.attachment_type === "audio") {
    iconName = "musical-notes-outline";
  } else if (forwarded.attachment_type === "document") {
    iconName = "document-text-outline";
  } else if (forwarded.image_url || forwarded.local_file_path) {
    iconName = "paperclip";
    iconLibrary = "mci";
  }

  const getThemeColors = () => {
    if (noteShare) {
      return {
        border: isDark ? "rgba(245, 166, 35, 0.4)" : "rgba(217, 119, 6, 0.4)", // Amber/Orange
        bg: isDark ? "rgba(245, 166, 35, 0.08)" : "rgba(217, 119, 6, 0.08)",
        text: isDark ? "#F5A623" : "#D97706",
      };
    }
    // Default forward
    const tintColor = colors.tint || "#007AFF";
    return {
      border: isDark ? "rgba(59, 130, 246, 0.4)" : "rgba(37, 99, 235, 0.4)",
      bg: isDark ? "rgba(59, 130, 246, 0.08)" : "rgba(37, 99, 235, 0.08)",
      text: tintColor,
    };
  };

  const themeColors = getThemeColors();

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: themeColors.border,
          backgroundColor: themeColors.bg,
        },
      ]}
    >
      {noteShare ? (
        <View style={styles.noteRow}>
          <View style={[styles.noteIconCircle, { backgroundColor: isDark ? "rgba(245, 166, 35, 0.15)" : "#FFF3B0" }]}>
            <MaterialCommunityIcons name="note-outline" size={18} color="#F5A623" />
          </View>
          <View style={styles.content}>
            <Text
              style={[styles.sender, { color: colors.text }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text
              style={[styles.noteTitle, { color: themeColors.text }]}
              numberOfLines={1}
            >
              {noteShare.title}
            </Text>
            {noteShare.content ? (
              <Text
                style={[styles.preview, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {noteShare.content}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <Text
            style={[styles.sender, { color: colors.text }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <View style={styles.previewRow}>
            {hasAttachment && (
              iconLibrary === "ionicons" ? (
                <Ionicons
                  name={iconName}
                  size={14}
                  color={colors.textSecondary}
                  style={styles.previewIcon}
                />
              ) : (
                <MaterialCommunityIcons
                  name={iconName}
                  size={14}
                  color={colors.textSecondary}
                  style={styles.previewIcon}
                />
              )
            )}
            <Text
              style={[styles.preview, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {getForwardPreviewText(forwarded)}
            </Text>
          </View>
        </View>
      )}
      <TouchableOpacity
        style={[
          styles.closeBtn,
          { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" },
        ]}
        onPress={onClear}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="close-outline" size={14} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignSelf: "stretch",
    marginVertical: 8,
    marginHorizontal: 12,
  },
  noteRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  noteIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  sender: {
    fontSize: 13,
    fontWeight: "600",
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  previewIcon: {
    marginRight: 4,
  },
  preview: {
    fontSize: 13,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
});
