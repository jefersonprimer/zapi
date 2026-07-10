import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Trash2 as TrashIcon, Square as SquareIcon, Pause as PauseIcon, Play as PlayIcon } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface VoiceNoteRecorderBarProps {
  recordingDuration: number;
  onStopRecording: (save: boolean) => void;
  isPaused: boolean;
  onPauseResumeRecording: () => void;
}

export const VoiceNoteRecorderBar: React.FC<VoiceNoteRecorderBarProps> = ({
  recordingDuration,
  onStopRecording,
  isPaused,
  onPauseResumeRecording,
}) => {
  const { colors, isDark } = useAppTheme();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <View style={styles.recordingContainer}>
      <Text style={[styles.recordingText, { color: colors.danger }, isPaused && [styles.pausedText, { color: colors.textSecondary }]]}>
        {isPaused ? "⏸️ Pausado" : "🔴 Gravando"}: {formatDuration(recordingDuration)}
      </Text>
      
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onStopRecording(false)}
        >
          <TrashIcon size={18} color={colors.danger} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.pauseResumeBtn, { backgroundColor: isDark ? "#2C2C2E" : "#eee" }]}
          onPress={onPauseResumeRecording}
        >
          {isPaused ? (
            <PlayIcon size={18} color={colors.badge} fill={colors.badge} />
          ) : (
            <PauseIcon size={18} color={colors.tint} fill={colors.tint} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.stopRecordBtn, { backgroundColor: colors.danger }]}
          onPress={() => onStopRecording(true)}
        >
          <SquareIcon size={12} color="#fff" fill="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.stopRecordText}>Parar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  recordingContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  recordingText: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  pausedText: {},
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionBtn: {
    padding: 8,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  pauseResumeBtn: {
    borderRadius: 16,
    width: 32,
    height: 32,
  },
  stopRecordBtn: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  stopRecordText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
