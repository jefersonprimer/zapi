import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { X as XIcon } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import {
  type ForwardedMessageData,
  getForwardPreviewText,
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

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderLeftColor: colors.tint,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.tint }]}>
          Reencaminhar mensagem
        </Text>
        <Text style={[styles.sender, { color: colors.text }]} numberOfLines={1}>
          {forwarded.sender_username}
        </Text>
        <Text
          style={[styles.preview, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {getForwardPreviewText(forwarded)}
        </Text>
      </View>
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
  preview: {
    fontSize: 13,
    marginTop: 2,
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
