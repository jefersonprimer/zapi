import React from "react";
import { View, Text, StyleSheet } from "react-native";
import MuteButton from "../components/MuteButton";
import SpeakerButton from "../components/SpeakerButton";
import EndCallButton from "../components/EndCallButton";
import CallTimer from "../components/CallTimer";
import ConnectionStatus from "../components/ConnectionStatus";
import { type CallState } from "../store/useCallStore";

interface CallScreenProps {
  participantUsername: string;
  callState: CallState;
  isMuted: boolean;
  isSpeakerEnabled: boolean;
  error: string | null;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
}

export default function CallScreen({
  participantUsername,
  callState,
  isMuted,
  isSpeakerEnabled,
  error,
  onToggleMute,
  onToggleSpeaker,
  onEndCall,
}: CallScreenProps) {
  const isConnected = callState === "connected";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {participantUsername.slice(0, 2).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.username}>{participantUsername}</Text>
        
        {isConnected ? (
          <CallTimer />
        ) : (
          <ConnectionStatus state={callState} />
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <View style={styles.controlsContainer}>
        {/* Speaker Toggle Button */}
        <SpeakerButton
          isSpeakerEnabled={isSpeakerEnabled}
          onPress={onToggleSpeaker}
        />

        {/* End Call Button */}
        <EndCallButton onPress={onEndCall} />

        {/* Microphone Mute Button */}
        <MuteButton
          isMuted={isMuted}
          onPress={onToggleMute}
        />
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
  header: {
    alignItems: "center",
    width: "100%",
  },
  avatarContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  avatarText: {
    fontSize: 50,
    fontWeight: "bold",
    color: "#ffffff",
  },
  username: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 12,
  },
  errorText: {
    marginTop: 16,
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "500",
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: "80%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingVertical: 20,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
});
