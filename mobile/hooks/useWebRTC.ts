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
    isVideo,
    isCameraEnabled,
    isFrontCamera,
    localStream,
    remoteStream,
    error,
    toggleMute: toggleMuteStore,
    toggleSpeaker: toggleSpeakerStore,
    toggleCamera: toggleCameraStore,
    switchCamera: switchCameraStore,
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

  const toggleCamera = useCallback(() => {
    const nextCamera = !isCameraEnabled;
    voiceCallManager.setCameraEnabled(nextCamera);
    toggleCameraStore();
  }, [isCameraEnabled, toggleCameraStore]);

  const switchCamera = useCallback(() => {
    voiceCallManager.switchCamera();
    switchCameraStore();
  }, [switchCameraStore]);

  const startCall = useCallback((targetUserId: string, targetUsername: string, isVideo: boolean = false) => {
    voiceCallManager.startCall(targetUserId, targetUsername, isVideo);
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
    isVideo,
    isCameraEnabled,
    isFrontCamera,
    localStream,
    remoteStream,
    error,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    switchCamera,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}
