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
  isMuted: boolean;
  isSpeakerEnabled: boolean;
  localStream: any | null; // MediaStream from react-native-webrtc
  remoteStream: any | null; // MediaStream from react-native-webrtc
  error: string | null;

  // Actions
  setCallState: (state: CallState) => void;
  initiateCall: (callId: string, calleeId: string, calleeUsername: string) => void;
  receiveCall: (callId: string, callerId: string, callerUsername: string) => void;
  setStreams: (local: any | null, remote: any | null) => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
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
  isMuted: false,
  isSpeakerEnabled: false,
  localStream: null,
  remoteStream: null,
  error: null,

  setCallState: (callState) => set({ callState }),

  initiateCall: (callId, calleeId, calleeUsername) =>
    set({
      callState: "calling",
      callId,
      calleeId,
      calleeUsername,
      callerId: null,
      callerUsername: null,
      isMuted: false,
      isSpeakerEnabled: false,
      error: null,
    }),

  receiveCall: (callId, callerId, callerUsername) =>
    set({
      callState: "ringing",
      callId,
      callerId,
      callerUsername,
      calleeId: null,
      calleeUsername: null,
      isMuted: false,
      isSpeakerEnabled: false,
      error: null,
    }),

  setStreams: (localStream, remoteStream) => set({ localStream, remoteStream }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  toggleSpeaker: () => set((state) => ({ isSpeakerEnabled: !state.isSpeakerEnabled })),

  setError: (error) => set({ error }),

  resetCall: () =>
    set({
      callState: "idle",
      callId: null,
      callerId: null,
      callerUsername: null,
      calleeId: null,
      calleeUsername: null,
      isMuted: false,
      isSpeakerEnabled: false,
      localStream: null,
      remoteStream: null,
      error: null,
    }),
}));
