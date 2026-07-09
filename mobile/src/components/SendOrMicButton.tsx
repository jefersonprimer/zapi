import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Send as SendIcon, Mic as MicIcon } from "lucide-react-native";

interface SendOrMicButtonProps {
  hasContent: boolean;
  sending: boolean;
  onSend: () => void;
  onStartRecording: () => void;
}

export const SendOrMicButton: React.FC<SendOrMicButtonProps> = ({
  hasContent,
  sending,
  onSend,
  onStartRecording,
}) => {
  if (hasContent) {
    return (
      <TouchableOpacity
        style={[
          styles.sendButtonCircle,
          sending && styles.sendButtonCircleDisabled,
        ]}
        onPress={onSend}
        disabled={sending}
      >
        <SendIcon size={18} color="#f2f2f2" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.micButton} onPress={onStartRecording}>
      <MicIcon size={20} color="#f2f2f2" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  sendButtonCircle: {
    backgroundColor: "#007AFF",
    width: 50,
    height: 50,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonCircleDisabled: {
    opacity: 0.5,
  },
  micButton: {
    backgroundColor: "#34C759",
    width: 50,
    height: 50,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
