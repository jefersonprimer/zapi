import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  StickyNote,
  X as XIcon,
  Camera,
  Video,
  Music,
  FileText,
  Paperclip,
  MessageSquare,
} from "lucide-react-native";
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
  let IconComponent = MessageSquare;
  const hasAttachment = !!(
    forwarded.attachment_type ||
    forwarded.image_url ||
    forwarded.local_file_path
  );

  if (forwarded.attachment_type === "image") {
    IconComponent = Camera;
  } else if (forwarded.attachment_type === "video") {
    IconComponent = Video;
  } else if (forwarded.attachment_type === "audio") {
    IconComponent = Music;
  } else if (forwarded.attachment_type === "document") {
    IconComponent = FileText;
  } else if (forwarded.image_url || forwarded.local_file_path) {
    IconComponent = Paperclip;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderLeftColor: noteShare ? "#F5A623" : colors.tint,
        },
      ]}
    >
      {noteShare ? (
        <View style={styles.noteRow}>
          <View style={[styles.noteIconCircle, { backgroundColor: "#FFF3B0" }]}>
            <StickyNote size={18} color="#F5A623" />
          </View>
          <View style={styles.content}>
            <Text
              style={[styles.sender, { color: colors.text }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text
              style={[styles.noteTitle, { color: colors.text }]}
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
              <IconComponent
                size={14}
                color={colors.textSecondary}
                style={styles.previewIcon}
              />
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
          { backgroundColor: isDark ? "#2C2C2E" : "#e0e0e0" },
        ]}
        onPress={onClear}
      >
        <XIcon size={14} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
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
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
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
