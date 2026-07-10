import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Video as VideoIcon, FileText as FileIcon, X as XIcon } from "lucide-react-native";
import { Attachment } from "./AttachCameraButton";
import { AudioPlayer } from "./AudioPlayer";

interface AttachmentPreviewBarProps {
  attachment: Attachment;
  onClear: () => void;
}

export const AttachmentPreviewBar: React.FC<AttachmentPreviewBarProps> = ({
  attachment,
  onClear,
}) => {
  return (
    <View style={styles.previewAttachmentBar}>
      {attachment.type === "audio" ? (
        <View style={styles.audioPreviewContainer}>
          <View style={styles.audioPlayerWrapper}>
            <AudioPlayer uri={attachment.uri} isMine={false} />
          </View>
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={onClear}
          >
            <XIcon size={14} color="#666" />
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
              <View style={styles.previewIconContainer}>
                {attachment.type === "video" ? (
                  <VideoIcon size={20} color="#007AFF" />
                ) : (
                  <FileIcon size={20} color="#8e8e93" />
                )}
              </View>
            )}
            <View style={styles.previewTextContainer}>
              <Text style={styles.previewName} numberOfLines={1}>
                {attachment.name}
              </Text>
              <Text style={styles.previewType}>
                {attachment.type.toUpperCase()} ready to send
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={onClear}
          >
            <XIcon size={14} color="#666" />
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
    backgroundColor: "#f9f9f9",
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee",
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
    backgroundColor: "#eee",
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
    color: "#333",
  },
  previewType: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
  },
  previewCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
});
