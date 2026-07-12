import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Mic, MicOff } from "lucide-react-native";

interface MuteButtonProps {
  isMuted: boolean;
  onPress: () => void;
  size?: number;
}

export default function MuteButton({ isMuted, onPress, size = 24 }: MuteButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.button, isMuted ? styles.buttonMuted : styles.buttonActive]}
    >
      {isMuted ? (
        <MicOff size={size} color="#ffffff" />
      ) : (
        <Mic size={size} color="#ffffff" />
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
  buttonActive: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  buttonMuted: {
    backgroundColor: "#ef4444",
  },
});
