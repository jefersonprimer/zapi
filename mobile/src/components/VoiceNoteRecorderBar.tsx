import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Trash2 as TrashIcon, Square as SquareIcon } from "lucide-react-native";

interface VoiceNoteRecorderBarProps {
  recordingDuration: number;
  onStopRecording: (save: boolean) => void;
}

export const VoiceNoteRecorderBar: React.FC<VoiceNoteRecorderBarProps> = ({
  recordingDuration,
  onStopRecording,
}) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <View style={styles.recordingContainer}>
      <Text style={styles.recordingText}>
        🔴 Recording: {formatDuration(recordingDuration)}
      </Text>
      <TouchableOpacity
        style={styles.cancelRecordBtn}
        onPress={() => onStopRecording(false)}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TrashIcon
            size={16}
            color="#FF3B30"
            style={{ marginRight: 4 }}
          />
          <Text style={styles.cancelRecordText}>Cancel</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.stopRecordBtn}
        onPress={() => onStopRecording(true)}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <SquareIcon
            size={12}
            color="#fff"
            fill="#fff"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.stopRecordText}>Stop</Text>
        </View>
      </TouchableOpacity>
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
    fontSize: 16,
    color: "#FF3B30",
    fontWeight: "600",
    flex: 1,
  },
  cancelRecordBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  cancelRecordText: { color: "#FF3B30", fontSize: 15, fontWeight: "500" },
  stopRecordBtn: {
    backgroundColor: "#FF3B30",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  stopRecordText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
