import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { type CallState } from "../store/useCallStore";

interface ConnectionStatusProps {
  state: CallState;
}

export default function ConnectionStatus({ state }: ConnectionStatusProps) {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (state === "calling" || state === "ringing" || state === "connecting") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state, pulseAnim]);

  const getStatusText = () => {
    switch (state) {
      case "calling":
        return "Calling...";
      case "ringing":
        return "Ringing...";
      case "connecting":
        return "Connecting...";
      case "connected":
        return "Connected";
      case "ended":
        return "Call Ended";
      case "failed":
        return "Call Failed";
      case "missed":
        return "Missed Call";
      case "rejected":
        return "Call Declined";
      case "busy":
        return "User Busy";
      default:
        return "";
    }
  };

  const getStatusColor = () => {
    switch (state) {
      case "connected":
        return "#10b981"; // Emerald green
      case "failed":
      case "rejected":
      case "busy":
        return "#ef4444"; // Red
      default:
        return "#3b82f6"; // Blue
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: getStatusColor(),
            opacity: pulseAnim,
          },
        ]}
      />
      <Text style={styles.text}>{getStatusText()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignSelf: "center",
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.9)",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
});
