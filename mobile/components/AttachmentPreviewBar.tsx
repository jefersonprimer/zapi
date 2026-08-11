import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Attachment } from "./AttachCameraButton";
import { AudioPlayer } from "./AudioPlayer";
import { useAppTheme } from "@/context/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";

interface AttachmentPreviewBarProps {
  attachment: Attachment;
  onClear: () => void;
}

export const AttachmentPreviewBar: React.FC<AttachmentPreviewBarProps> = ({
  attachment,
  onClear,
}) => {
  const { colors, isDark } = useAppTheme();

  // For image and video, show only the thumbnail without text/name
  if (attachment.type === "image" || attachment.type === "video") {
    return (
      <View style={styles.mediaContainer}>
        <View style={styles.mediaWrapper}>
          {attachment.mimeType === "image/svg+xml" && attachment.previewSvg ? (
            <View style={styles.svgPreviewWrap}>
              <SvgXml xml={attachment.previewSvg} width="100%" height="100%" />
            </View>
          ) : (
            <Image
              source={{ uri: attachment.uri }}
              style={[
                styles.mediaImage,
                (attachment.isSticker ||
                  attachment.name?.toLowerCase().includes("sticker") ||
                  attachment.mimeType === "image/webp") && {
                  resizeMode: "contain",
                },
              ]}
            />
          )}
          {attachment.type === "video" && (
            <View style={styles.playIconOverlay}>
              <MaterialCommunityIcons name="play" size={20} color="#FFF" />
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.mediaCloseBtn,
              {
                backgroundColor: isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.6)",
              },
            ]}
            onPress={onClear}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialCommunityIcons name="close" size={14} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Pick a color based on attachment type for a premium look (audio & documents)
  const getThemeColors = () => {
    if (attachment.type === "audio") {
      return {
        border: isDark ? "rgba(16, 185, 129, 0.4)" : "rgba(5, 150, 105, 0.4)", // Green
        bg: isDark ? "rgba(16, 185, 129, 0.08)" : "rgba(5, 150, 105, 0.08)",
        text: isDark ? "#34D399" : "#059669",
        icon: "microphone-outline" as const,
      };
    }
    // Default / document / file
    return {
      border: isDark ? "rgba(59, 130, 246, 0.4)" : "rgba(37, 99, 235, 0.4)", // Blue
      bg: isDark ? "rgba(59, 130, 246, 0.08)" : "rgba(37, 99, 235, 0.08)",
      text: isDark ? "#60A5FA" : "#2563EB",
      icon: "file-document-outline" as const,
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
      {attachment.type === "audio" ? (
        <View style={styles.audioPreviewContainer}>
          <View style={styles.audioPlayerWrapper}>
            <AudioPlayer uri={attachment.uri} isMine={false} />
          </View>
          <TouchableOpacity
            style={[
              styles.closeBtn,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.05)",
              },
            ]}
            onPress={onClear}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialCommunityIcons
              name="close"
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.content}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
            >
              <MaterialCommunityIcons
                name={themeColors.icon}
                size={20}
                color={themeColors.text}
              />
            </View>
            <View style={styles.textContainer}>
              <Text
                style={[styles.nameText, { color: colors.text }]}
                numberOfLines={1}
              >
                {attachment.name}
              </Text>
              <Text style={[styles.typeText, { color: themeColors.text }]}>
                {attachment.type.toUpperCase()} • Pronto para enviar
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.closeBtn,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.05)",
              },
            ]}
            onPress={onClear}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialCommunityIcons
              name="close"
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </>
      )}
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
  mediaContainer: {
    paddingTop: 10,
    paddingLeft: 14,
    paddingBottom: 4,
    alignSelf: "flex-start",
  },
  mediaWrapper: {
    position: "relative",
    width: 120,
    height: 120,
  },
  mediaImage: {
    width: 120,
    height: 120,
    borderRadius: 10,
  },
  svgPreviewWrap: {
    width: 120,
    height: 120,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  mediaCloseBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
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
  content: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  nameText: {
    fontSize: 14,
    fontWeight: "600",
  },
  typeText: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
});
