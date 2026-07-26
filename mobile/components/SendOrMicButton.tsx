import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Mic as MicIcon, SendHorizonal } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

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
  const { colors } = useAppTheme();

  if (hasContent) {
    return (
      <TouchableOpacity
        style={[
          styles.sendButtonCircle,
          { backgroundColor: "#07C160" },
          sending && styles.sendButtonCircleDisabled,
        ]}
        onPress={onSend}
        disabled={sending}
      >
        <SendHorizonal size={18} color="#f2f2f2" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.micButton, { backgroundColor: "#07C160" }]}
      onPress={onStartRecording}
    >
      <MicIcon size={20} color="#f2f2f2" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  sendButtonCircle: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonCircleDisabled: {
    opacity: 0.5,
  },
  micButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
});
