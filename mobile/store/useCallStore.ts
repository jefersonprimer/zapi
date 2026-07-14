import { create } from "zustand";

export type CallState =
  | "idle"
  | "calling"
  | "ringing"
  | "connecting"
  | "connected"
  | "ended"
  | "failed"
  | "missed"
  | "rejected"
  | "busy";

interface CallStoreState {
  callState: CallState;
  callId: string | null;
  callerId: string | null;
  callerUsername: string | null;
  calleeId: string | null;
  calleeUsername: string | null;
  remoteAvatarUrl: string | null;
  isMuted: boolean;
  isSpeakerEnabled: boolean;
  isVideo: boolean;
  isCameraEnabled: boolean;
  isFrontCamera: boolean;
  localStream: any | null; // MediaStream from react-native-webrtc
  remoteStream: any | null; // MediaStream from react-native-webrtc
  error: string | null;

  // Actions
  setCallState: (state: CallState) => void;
  initiateCall: (
    callId: string,
    calleeId: string,
    calleeUsername: string,
    isVideo?: boolean,
    avatarUrl?: string | null,
  ) => void;
  receiveCall: (
    callId: string,
    callerId: string,
    callerUsername: string,
    isVideo?: boolean,
    avatarUrl?: string | null,
  ) => void;
  setStreams: (local: any | null, remote: any | null) => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
  setError: (error: string | null) => void;
  resetCall: () => void;
}

export const useCallStore = create<CallStoreState>((set) => ({
  callState: "idle",
  callId: null,
  callerId: null,
  callerUsername: null,
  calleeId: null,
  calleeUsername: null,
  remoteAvatarUrl: null,
  isMuted: false,
  isSpeakerEnabled: false,
  isVideo: false,
  isCameraEnabled: true,
  isFrontCamera: true,
  localStream: null,
  remoteStream: null,
  error: null,

  setCallState: (callState) => set({ callState }),

  initiateCall: (callId, calleeId, calleeUsername, isVideo = false, avatarUrl = null) =>
    set({
      callState: "calling",
      callId,
      calleeId,
      calleeUsername,
      callerId: null,
      callerUsername: null,
      remoteAvatarUrl: avatarUrl || null,
      isMuted: false,
      isSpeakerEnabled: isVideo, // Route to speaker by default for video calls
      isVideo,
      isCameraEnabled: isVideo,
      isFrontCamera: true,
      error: null,
    }),

  receiveCall: (callId, callerId, callerUsername, isVideo = false, avatarUrl = null) =>
    set({
      callState: "ringing",
      callId,
      callerId,
      callerUsername,
      calleeId: null,
      calleeUsername: null,
      remoteAvatarUrl: avatarUrl || null,
      isMuted: false,
      isSpeakerEnabled: isVideo, // Route to speaker by default for video calls
      isVideo,
      isCameraEnabled: isVideo,
      isFrontCamera: true,
      error: null,
    }),

  setStreams: (localStream, remoteStream) => set({ localStream, remoteStream }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  toggleSpeaker: () => set((state) => ({ isSpeakerEnabled: !state.isSpeakerEnabled })),

  toggleCamera: () => set((state) => ({ isCameraEnabled: !state.isCameraEnabled })),

  switchCamera: () => set((state) => ({ isFrontCamera: !state.isFrontCamera })),

  setError: (error) => set({ error }),

  resetCall: () =>
    set({
      callState: "idle",
      callId: null,
      callerId: null,
      callerUsername: null,
      calleeId: null,
      calleeUsername: null,
      remoteAvatarUrl: null,
      isMuted: false,
      isSpeakerEnabled: false,
      isVideo: false,
      isCameraEnabled: true,
      isFrontCamera: true,
      localStream: null,
      remoteStream: null,
      error: null,
    }),
}));
