import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
} from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { voiceCallManager } from "@/services/voiceCallManager";
import { getDateLabel } from "@/utils/date";
import type { CallHistoryItem } from "@/services/callApi";

interface CallBubbleProps {
  call: CallHistoryItem;
  currentUserId?: string;
  participantId: string;
  participantUsername: string;
  participantAvatarUrl?: string;
  showDateHeader?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  selectedBackgroundColor?: string;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function CallBubble({
  call,
  currentUserId,
  participantId,
  participantUsername,
  participantAvatarUrl,
  showDateHeader = false,
  selectionMode = false,
  isSelected = false,
  selectedBackgroundColor,
  onPress,
  onLongPress,
}: CallBubbleProps) {
  const { colors, isDark } = useAppTheme();
  const isOutgoing = call.caller_id === currentUserId;

  let StatusIcon = PhoneIncoming;
  let iconColor = "#34C759"; // Green
  let statusText = isOutgoing ? "Ligação efetuada" : "Ligação recebida";
  let bubbleBg = isDark ? "#1E293B" : "#f1f0f0";
  let textColor = colors.text;
  let timeColor = colors.textSecondary;

  if (isOutgoing) {
    StatusIcon = PhoneOutgoing;
    bubbleBg = isDark ? "#1E293B" : "#e1f5fe"; // light blue
    textColor = isDark ? "#0A84FF" : "#01579b";
    timeColor = isDark
      ? "rgba(10, 132, 255, 0.7)"
      : "rgba(1, 87, 155, 0.6)";
  } else {
    if (call.status === "completed") {
      bubbleBg = isDark ? "#1E293B" : "#e8f5e9"; // light green
      textColor = isDark ? "#30D158" : "#1b5e20";
      timeColor = isDark
        ? "rgba(48, 209, 88, 0.7)"
        : "rgba(27, 94, 32, 0.6)";
    } else {
      StatusIcon = PhoneMissed;
      iconColor = "#FF3B30"; // Red
      statusText = "Chamada perdida";
      if (call.status === "failed") {
        StatusIcon = PhoneOff;
        iconColor = "#FF9500"; // Orange
      }
      bubbleBg = isDark ? "#1E293B" : "#ffebee"; // light red
      textColor = isDark ? "#FF453A" : "#b71c1c";
      timeColor = isDark
        ? "rgba(255, 69, 58, 0.7)"
        : "rgba(183, 28, 28, 0.6)";
    }
  }

  const formattedTime = new Date(call.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const formatDuration = (secs: number) => {
    if (secs === 0) return "";
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    if (mins > 0) {
      return `${mins}m ${remainingSecs}s`;
    }
    return `${remainingSecs}s`;
  };

  const durationStr = call.duration > 0 ? ` (${formatDuration(call.duration)})` : "";

  return (
    <View>
      {showDateHeader && (
        <View style={styles.dateHeaderContainer}>
          <View
            style={[
              styles.dateHeaderBackground,
              { backgroundColor: isDark ? "#1E293B" : "#eaeaea" },
            ]}
          >
            <Text style={[styles.dateHeaderText, { color: colors.textSecondary }]}>
              {getDateLabel(call.created_at)}
            </Text>
          </View>
        </View>
      )}
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={500}
        activeOpacity={0.8}
        style={[
          isSelected && selectedBackgroundColor
            ? { backgroundColor: selectedBackgroundColor }
            : undefined,
        ]}
      >
        <View style={[styles.messageRow, isOutgoing ? styles.myCallRow : styles.theirCallRow]}>
          <View style={[styles.callBubble, { backgroundColor: bubbleBg }]}>
            <View style={styles.callBubbleContent}>
              <View style={styles.callIconContainer}>
                <StatusIcon size={20} color={iconColor} />
              </View>
              <View style={styles.callTextContainer}>
                <Text style={[styles.callStatusText, { color: textColor }]} numberOfLines={1}>
                  {statusText}
                  {durationStr}
                </Text>
                <TouchableOpacity
                  style={styles.callbackButton}
                  disabled={selectionMode}
                  onPress={() => {
                    if (selectionMode) return;
                    voiceCallManager.startCall(
                      participantId,
                      participantUsername || "User",
                      false,
                      participantAvatarUrl || null,
                    );
                  }}
                >
                  <Text
                    style={[
                      styles.callbackButtonText,
                      {
                        color: selectionMode
                          ? colors.textSecondary
                          : colors.tint,
                      },
                    ]}
                  >
                    Retornar ligação
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[styles.callTimeText, { color: timeColor }]}>
              {formattedTime}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  dateHeaderContainer: {
    alignItems: "center",
    marginVertical: 12,
  },
  dateHeaderBackground: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateHeaderText: {
    fontSize: 11,
    fontWeight: "600",
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  myCallRow: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  theirCallRow: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  callBubble: {
    width: "75%",
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  callBubbleContent: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    width: "100%",
  },
  callIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  callTextContainer: {
    flex: 1,
    minWidth: 120,
  },
  callStatusText: {
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
  callbackButton: {
    marginTop: 4,
  },
  callbackButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  callTimeText: {
    fontSize: 10,
    textAlign: "right",
    marginTop: 4,
  },
});
