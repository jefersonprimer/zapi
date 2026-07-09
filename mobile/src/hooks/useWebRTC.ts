import { useCallback } from "react";
import { useCallStore } from "../store/useCallStore";
import { voiceCallManager } from "../services/voiceCallManager";

export function useWebRTC() {
  const {
    callState,
    callId,
    callerId,
    callerUsername,
    calleeId,
    calleeUsername,
    isMuted,
    isSpeakerEnabled,
    localStream,
    remoteStream,
    error,
    toggleMute: toggleMuteStore,
    toggleSpeaker: toggleSpeakerStore,
  } = useCallStore();

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    voiceCallManager.setMute(nextMuted);
    toggleMuteStore();
  }, [isMuted, toggleMuteStore]);

  const toggleSpeaker = useCallback(async () => {
    const nextSpeaker = !isSpeakerEnabled;
    await voiceCallManager.setSpeaker(nextSpeaker);
    toggleSpeakerStore();
  }, [isSpeakerEnabled, toggleSpeakerStore]);

  const startCall = useCallback((targetUserId: string, targetUsername: string) => {
    voiceCallManager.startCall(targetUserId, targetUsername);
  }, []);

  const acceptCall = useCallback(() => {
    voiceCallManager.acceptCall();
  }, []);

  const rejectCall = useCallback(() => {
    voiceCallManager.rejectCall();
  }, []);

  const endCall = useCallback(() => {
    voiceCallManager.endCall();
  }, []);

  return {
    callState,
    callId,
    callerId,
    callerUsername,
    calleeId,
    calleeUsername,
    isMuted,
    isSpeakerEnabled,
    localStream,
    remoteStream,
    error,
    toggleMute,
    toggleSpeaker,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}
