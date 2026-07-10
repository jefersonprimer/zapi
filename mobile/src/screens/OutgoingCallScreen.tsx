import React from "react";
import { View, Text, StyleSheet } from "react-native";
import EndCallButton from "../components/EndCallButton";
import ConnectionStatus from "../components/ConnectionStatus";
import { type CallState, useCallStore } from "../store/useCallStore";

interface OutgoingCallScreenProps {
  calleeUsername: string;
  callState: CallState;
  onCancel: () => void;
}

export default function OutgoingCallScreen({
  calleeUsername,
  callState,
  onCancel,
}: OutgoingCallScreenProps) {
  const isVideo = useCallStore((state) => state.isVideo);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.avatarContainer, isVideo && styles.videoAvatarContainer]}>
          <Text style={[styles.avatarText, isVideo && styles.videoAvatarText]}>
            {calleeUsername.slice(0, 2).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.calleeName}>{calleeUsername}</Text>
        <Text style={styles.callType}>
          {isVideo ? "Outgoing Video Call" : "Outgoing Voice Call"}
        </Text>
        <ConnectionStatus state={callState} />
      </View>

      <View style={styles.actionsContainer}>
        <EndCallButton onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0f19",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 100,
    paddingBottom: 80,
  },
  content: {
    alignItems: "center",
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  avatarText: {
    fontSize: 44,
    fontWeight: "bold",
    color: "#ffffff",
  },
  calleeName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  callType: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  videoAvatarContainer: {
    borderColor: "#10b981",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  videoAvatarText: {
    color: "#10b981",
  },
  actionsContainer: {
    alignItems: "center",
    width: "100%",
  },
});
