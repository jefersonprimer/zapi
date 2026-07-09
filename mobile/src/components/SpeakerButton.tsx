import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Volume2, Volume1 } from "lucide-react-native";

interface SpeakerButtonProps {
  isSpeakerEnabled: boolean;
  onPress: () => void;
  size?: number;
}

export default function SpeakerButton({ isSpeakerEnabled, onPress, size = 24 }: SpeakerButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.button, isSpeakerEnabled ? styles.buttonEnabled : styles.buttonDisabled]}
    >
      {isSpeakerEnabled ? (
        <Volume2 size={size} color="#ffffff" />
      ) : (
        <Volume1 size={size} color="rgba(255, 255, 255, 0.6)" />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  buttonEnabled: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
});
