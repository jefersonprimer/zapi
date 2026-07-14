import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Camera, CameraOff, RefreshCw, Mic, MicOff, Volume2, VolumeX, PhoneOff } from "lucide-react-native";
import MuteButton from "../components/MuteButton";
import SpeakerButton from "../components/SpeakerButton";
import EndCallButton from "../components/EndCallButton";
import CallTimer from "../components/CallTimer";
import ConnectionStatus from "../components/ConnectionStatus";
import { type CallState } from "../store/useCallStore";
import VideoView from "../components/VideoView";
import { API_URL } from "../services/api";

interface CallScreenProps {
  participantUsername: string;
  avatarUrl?: string | null;
  callState: CallState;
  isMuted: boolean;
  isSpeakerEnabled: boolean;
  isVideo: boolean;
  isCameraEnabled: boolean;
  isFrontCamera: boolean;
  localStream: any;
  remoteStream: any;
  error: string | null;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onEndCall: () => void;
}

function resolveAvatarUri(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  return avatarUrl.startsWith("http")
    ? avatarUrl
    : `${API_URL}${avatarUrl.startsWith("/") ? "" : "/"}${avatarUrl}`;
}

export default function CallScreen({
  participantUsername,
  avatarUrl,
  callState,
  isMuted,
  isSpeakerEnabled,
  isVideo,
  isCameraEnabled,
  isFrontCamera,
  localStream,
  remoteStream,
  error,
  onToggleMute,
  onToggleSpeaker,
  onToggleCamera,
  onSwitchCamera,
  onEndCall,
}: CallScreenProps) {
  const isConnected = callState === "connected";
  const avatarUri = resolveAvatarUri(avatarUrl);

  if (isVideo) {
    return (
      <View style={styles.videoContainer}>
        {/* Remote Video Stream */}
        {remoteStream && isConnected ? (
          <VideoView stream={remoteStream} style={StyleSheet.absoluteFillObject} />
        ) : (
          <View style={styles.remotePlaceholder}>
            <View style={styles.avatarContainer}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {participantUsername.slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <Text style={styles.username}>{participantUsername}</Text>
            <ConnectionStatus state={callState} />
          </View>
        )}

        {/* Local Stream (PiP) */}
        {localStream && isCameraEnabled && (
          <View style={styles.localPipContainer}>
            <VideoView
              stream={localStream}
              mirror={isFrontCamera}
              style={styles.localPipVideo}
            />
          </View>
        )}

        {/* Overlay Headers */}
        <View style={styles.overlayHeader}>
          <Text style={styles.videoUsername}>{participantUsername}</Text>
          {isConnected ? (
            <View style={styles.timerRow}>
              <View style={styles.liveDot} />
              <CallTimer />
            </View>
          ) : (
            <ConnectionStatus state={callState} />
          )}
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {/* Floating controls */}
        <View style={styles.videoControls}>
          {/* Toggle Camera */}
          <TouchableOpacity
            onPress={onToggleCamera}
            style={[styles.controlButton, !isCameraEnabled && styles.disabledButton]}
          >
            {isCameraEnabled ? (
              <Camera size={22} color="#ffffff" />
            ) : (
              <CameraOff size={22} color="#ef4444" />
            )}
          </TouchableOpacity>

          {/* Switch Camera */}
          {isCameraEnabled && (
            <TouchableOpacity onPress={onSwitchCamera} style={styles.controlButton}>
              <RefreshCw size={22} color="#ffffff" />
            </TouchableOpacity>
          )}

          {/* Toggle Mute */}
          <TouchableOpacity
            onPress={onToggleMute}
            style={[styles.controlButton, isMuted && styles.disabledButton]}
          >
            {isMuted ? (
              <MicOff size={22} color="#ef4444" />
            ) : (
              <Mic size={22} color="#ffffff" />
            )}
          </TouchableOpacity>

          {/* Toggle Speaker */}
          <TouchableOpacity
            onPress={onToggleSpeaker}
            style={[styles.controlButton, isSpeakerEnabled && styles.activeSpeakerButton]}
          >
            {isSpeakerEnabled ? (
              <Volume2 size={22} color="#10b981" />
            ) : (
              <VolumeX size={22} color="#ffffff" />
            )}
          </TouchableOpacity>

          {/* End Call */}
          <TouchableOpacity
            onPress={onEndCall}
            style={[styles.controlButton, styles.endButton]}
          >
            <PhoneOff size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Voice Call View (original)
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {participantUsername.slice(0, 2).toUpperCase()}
            </Text>
          )}
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
  videoContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  remotePlaceholder: {
    flex: 1,
    backgroundColor: "#0b0f19",
    justifyContent: "center",
    alignItems: "center",
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
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
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
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
  localPipContainer: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.3)",
    backgroundColor: "#1a1a1a",
    elevation: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    zIndex: 10,
  },
  localPipVideo: {
    width: "100%",
    height: "100%",
  },
  overlayHeader: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 5,
  },
  videoUsername: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginBottom: 4,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
    marginRight: 6,
  },
  videoControls: {
    position: "absolute",
    bottom: 40,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    width: "90%",
    alignSelf: "center",
    backgroundColor: "rgba(11, 15, 25, 0.8)",
    paddingVertical: 12,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    zIndex: 5,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderWidth: 1,
  },
  activeSpeakerButton: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderWidth: 1,
  },
  endButton: {
    backgroundColor: "#ef4444",
  },
});
