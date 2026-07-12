import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Video as VideoIcon, FileText as FileIcon, X as XIcon } from "lucide-react-native";
import { Attachment } from "./AttachCameraButton";
import { AudioPlayer } from "./AudioPlayer";
import { useAppTheme } from "@/context/ThemeContext";

interface AttachmentPreviewBarProps {
  attachment: Attachment;
  onClear: () => void;
}

export const AttachmentPreviewBar: React.FC<AttachmentPreviewBarProps> = ({
  attachment,
  onClear,
}) => {
  const { colors, isDark } = useAppTheme();

  return (
    <View style={[styles.previewAttachmentBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {attachment.type === "audio" ? (
        <View style={styles.audioPreviewContainer}>
          <View style={styles.audioPlayerWrapper}>
            <AudioPlayer uri={attachment.uri} isMine={false} />
          </View>
          <TouchableOpacity
            style={[styles.previewCloseBtn, { backgroundColor: isDark ? "#2C2C2E" : "#e0e0e0" }]}
            onPress={onClear}
          >
            <XIcon size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.previewAttachmentContent}>
            {attachment.type === "image" ? (
              <Image
                source={{ uri: attachment.uri }}
                style={styles.previewImage}
              />
            ) : (
              <View style={[styles.previewIconContainer, { backgroundColor: isDark ? "#2C2C2E" : "#eee" }]}>
                {attachment.type === "video" ? (
                  <VideoIcon size={20} color={colors.tint} />
                ) : (
                  <FileIcon size={20} color={colors.textSecondary} />
                )}
              </View>
            )}
            <View style={styles.previewTextContainer}>
              <Text style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>
                {attachment.name}
              </Text>
              <Text style={[styles.previewType, { color: colors.textSecondary }]}>
                {attachment.type.toUpperCase()} pronto para enviar
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.previewCloseBtn, { backgroundColor: isDark ? "#2C2C2E" : "#e0e0e0" }]}
            onPress={onClear}
          >
            <XIcon size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  previewAttachmentBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  audioPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  audioPlayerWrapper: {
    flex: 1,
    marginRight: 6,
  },
  previewAttachmentContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  previewImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
  },
  previewIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  previewTextContainer: {
    flex: 1,
  },
  previewName: {
    fontSize: 14,
    fontWeight: "600",
  },
  previewType: {
    fontSize: 11,
    marginTop: 2,
  },
  previewCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
});
