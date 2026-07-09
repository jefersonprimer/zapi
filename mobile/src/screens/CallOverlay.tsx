import React from "react";
import { StyleSheet, Modal, SafeAreaView } from "react-native";
import { useWebRTC } from "../hooks/useWebRTC";
import IncomingCallScreen from "./IncomingCallScreen";
import OutgoingCallScreen from "./OutgoingCallScreen";
import CallScreen from "./CallScreen";

export default function CallOverlay() {
  const {
    callState,
    callerId,
    callerUsername,
    calleeUsername,
    isMuted,
    isSpeakerEnabled,
    error,
    toggleMute,
    toggleSpeaker,
    acceptCall,
    rejectCall,
    endCall,
  } = useWebRTC();

  console.log(`[CallOverlay] Render - state: "${callState}", callerId: "${callerId}", callerUsername: "${callerUsername}", calleeUsername: "${calleeUsername}"`);

  if (callState === "idle") return null;

  const renderContent = () => {
    // If incoming call (ringing and Bob receives it -> callerId is not null)
    if (callState === "ringing" && callerId !== null) {
      console.log("[CallOverlay] renderContent: Rendering IncomingCallScreen");
      return (
        <IncomingCallScreen
          callerUsername={callerUsername || "Unknown User"}
          onAccept={acceptCall}
          onDecline={rejectCall}
        />
      );
    }

    // If outgoing call (calling or ringing, and Alice initiates it -> callerId is null)
    if (callState === "calling" || (callState === "ringing" && callerId === null)) {
      console.log("[CallOverlay] renderContent: Rendering OutgoingCallScreen");
      return (
        <OutgoingCallScreen
          calleeUsername={calleeUsername || "User"}
          callState={callState}
          onCancel={endCall}
        />
      );
    }

    // Active call screen (connecting, connected, ended, failed, rejected, busy)
    console.log("[CallOverlay] renderContent: Rendering CallScreen");
    return (
      <CallScreen
        participantUsername={callerUsername || calleeUsername || "User"}
        callState={callState}
        isMuted={isMuted}
        isSpeakerEnabled={isSpeakerEnabled}
        error={error}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
        onEndCall={endCall}
      />
    );
  };

  return (
    <Modal
      animationType="slide"
      visible={true}
      presentationStyle="fullScreen"
      onRequestClose={endCall}
    >
      <SafeAreaView style={styles.container}>{renderContent()}</SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0f19",
  },
});
