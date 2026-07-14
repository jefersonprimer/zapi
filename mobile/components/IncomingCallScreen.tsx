import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Phone, PhoneOff, Video } from "lucide-react-native";
import { useCallStore } from "../store/useCallStore";
import { API_URL } from "../services/api";

interface IncomingCallScreenProps {
  callerUsername: string;
  avatarUrl?: string | null;
  onAccept: () => void;
  onDecline: () => void;
}

function resolveAvatarUri(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  return avatarUrl.startsWith("http")
    ? avatarUrl
    : `${API_URL}${avatarUrl.startsWith("/") ? "" : "/"}${avatarUrl}`;
}

export default function IncomingCallScreen({
  callerUsername,
  avatarUrl,
  onAccept,
  onDecline,
}: IncomingCallScreenProps) {
  const isVideo = useCallStore((state) => state.isVideo);
  const avatarUri = resolveAvatarUri(avatarUrl);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.avatarContainer, isVideo && styles.videoAvatarContainer]}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarText, isVideo && styles.videoAvatarText]}>
              {callerUsername.slice(0, 2).toUpperCase()}
            </Text>
          )}
        </View>

        <Text style={styles.callerName}>{callerUsername}</Text>
        <Text style={styles.callType}>
          {isVideo ? "Incoming Video Call" : "Incoming Voice Call"}
        </Text>
      </View>

      <View style={styles.actionsContainer}>
        {/* Decline Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onDecline}
          style={[styles.actionButton, styles.declineButton]}
        >
          <PhoneOff size={28} color="#ffffff" />
        </TouchableOpacity>

        {/* Accept Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onAccept}
          style={[styles.actionButton, styles.acceptButton]}
        >
          {isVideo ? (
            <Video size={28} color="#ffffff" />
          ) : (
            <Phone size={28} color="#ffffff" />
          )}
        </TouchableOpacity>
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
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderWidth: 2,
    borderColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    overflow: "hidden",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 44,
    fontWeight: "bold",
    color: "#3b82f6",
  },
  callerName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  callType: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.5)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "70%",
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  declineButton: {
    backgroundColor: "#ef4444",
  },
  acceptButton: {
    backgroundColor: "#10b981",
  },
  videoAvatarContainer: {
    borderColor: "#10b981",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    shadowColor: "#10b981",
  },
  videoAvatarText: {
    color: "#10b981",
  },
});
