import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Trash2 as TrashIcon, Square as SquareIcon, Pause as PauseIcon, Play as PlayIcon } from "lucide-react-native";

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
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <View style={styles.recordingContainer}>
      <Text style={[styles.recordingText, isPaused && styles.pausedText]}>
        {isPaused ? "⏸️ Pausado" : "🔴 Gravando"}: {formatDuration(recordingDuration)}
      </Text>
      
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onStopRecording(false)}
        >
          <TrashIcon size={18} color="#FF3B30" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.pauseResumeBtn]}
          onPress={onPauseResumeRecording}
        >
          {isPaused ? (
            <PlayIcon size={18} color="#34C759" fill="#34C759" />
          ) : (
            <PauseIcon size={18} color="#007AFF" fill="#007AFF" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.stopRecordBtn}
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
    color: "#FF3B30",
    fontWeight: "600",
    flex: 1,
  },
  pausedText: {
    color: "#8e8e93",
  },
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
    backgroundColor: "#eee",
    borderRadius: 16,
    width: 32,
    height: 32,
  },
  stopRecordBtn: {
    backgroundColor: "#FF3B30",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  stopRecordText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
