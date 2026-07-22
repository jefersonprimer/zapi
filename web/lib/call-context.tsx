"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useAuth } from "./auth-context";

export type CallState =
  | "idle"
  | "calling"
  | "ringing"
  | "connecting"
  | "connected"
  | "ended"
  | "failed"
  | "rejected"
  | "busy";

export interface StartCallParams {
  targetUserId: string;
  targetUsername: string;
  isVideo?: boolean;
  avatarUrl?: string | null;
}

export type WSMessageData = Record<string, unknown> & {
  type: string;
  [key: string]: unknown;
};

interface CallContextType {
  callState: CallState;
  callId: string | null;
  callerId: string | null;
  callerUsername: string | null;
  calleeId: string | null;
  calleeUsername: string | null;
  remoteAvatarUrl: string | null;
  isVideo: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  error: string | null;
  callDuration: number;
  startCall: (params: StartCallParams) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  sendWSMessage: (msg: WSMessageData) => void;
  addWSListener: (listener: (msg: WSMessageData) => void) => () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();

  // Call State
  const [callState, setCallState] = useState<CallState>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [callerId, setCallerId] = useState<string | null>(null);
  const [callerUsername, setCallerUsername] = useState<string | null>(null);
  const [calleeId, setCalleeId] = useState<string | null>(null);
  const [calleeUsername, setCalleeUsername] = useState<string | null>(null);
  const [remoteAvatarUrl, setRemoteAvatarUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  // Refs for WebRTC & WebSocket
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsListenersRef = useRef<Set<(msg: WSMessageData) => void>>(new Set());
  const callIdRef = useRef<string | null>(null);
  const callStateRef = useRef<CallState>("idle");
  const isVideoRef = useRef<boolean>(false);
  const calleeUsernameRef = useRef<string | null>(null);
  const remoteAvatarUrlRef = useRef<string | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneAudioCtxRef = useRef<AudioContext | null>(null);
  const ringtoneOscillatorRef = useRef<OscillatorNode | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    isVideoRef.current = isVideo;
  }, [isVideo]);

  useEffect(() => {
    calleeUsernameRef.current = calleeUsername;
  }, [calleeUsername]);

  useEffect(() => {
    remoteAvatarUrlRef.current = remoteAvatarUrl;
  }, [remoteAvatarUrl]);

  // Audio ringtone helper using Web Audio API
  const stopRingtone = useCallback(() => {
    if (ringtoneOscillatorRef.current) {
      try {
        ringtoneOscillatorRef.current.stop();
        ringtoneOscillatorRef.current.disconnect();
      } catch {}
      ringtoneOscillatorRef.current = null;
    }
    if (ringtoneAudioCtxRef.current) {
      try {
        ringtoneAudioCtxRef.current.close();
      } catch {}
      ringtoneAudioCtxRef.current = null;
    }
  }, []);

  const playRingtone = useCallback((type: "outgoing" | "incoming") => {
    stopRingtone();
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      ringtoneAudioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(type === "incoming" ? 440 : 350, ctx.currentTime);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      ringtoneOscillatorRef.current = osc;
    } catch (e) {
      console.warn("Could not play ringtone audio", e);
    }
  }, [stopRingtone]);

  // Clean up WebRTC peer connection & media tracks
  const cleanupCall = useCallback(() => {
    stopRingtone();

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
  }, [stopRingtone]);

  const resetCallState = useCallback(() => {
    cleanupCall();
    setCallState("idle");
    setCallId(null);
    setCallerId(null);
    setCallerUsername(null);
    setCalleeId(null);
    setCalleeUsername(null);
    setRemoteAvatarUrl(null);
    setIsVideo(false);
    setIsMuted(false);
    setIsCameraOff(false);
    setError(null);
    setCallDuration(0);
  }, [cleanupCall]);

  // Timer for connected state
  useEffect(() => {
    if (callState === "connected") {
      stopRingtone();
      timerIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }, [callState, stopRingtone]);

  // Send WS message helper
  const sendWSMessage = useCallback((msg: WSMessageData) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn("[WS] Socket not open, cannot send:", msg);
    }
  }, []);

  // Register WS message listener
  const addWSListener = useCallback((listener: (msg: WSMessageData) => void) => {
    wsListenersRef.current.add(listener);
    return () => {
      wsListenersRef.current.delete(listener);
    };
  }, []);

  // WebRTC initialization
  const initializeWebRTC = useCallback(async (isCaller: boolean): Promise<boolean> => {
    const currentCallId = callIdRef.current;
    if (!currentCallId) return false;

    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: isVideoRef.current
          ? { width: { ideal: 1280 }, height: { ideal: 720 } }
          : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle remote track
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && callIdRef.current) {
          sendWSMessage({
            type: "iceCandidate",
            call_id: callIdRef.current,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // ICE connection state
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "connected") {
          setCallDuration(0);
          setCallState("connected");
        } else if (
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "disconnected"
        ) {
          console.warn("[WebRTC] ICE state changed to:", pc.iceConnectionState);
        }
      };

      if (isCaller) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWSMessage({
          type: "offer",
          call_id: currentCallId,
          sdp: offer.sdp,
        });
      }

      return true;
    } catch (err: unknown) {
      console.error("[WebRTC] Error accessing media devices:", err);
      const errorObj = err as { name?: string };
      const errorMsg =
        errorObj?.name === "NotAllowedError" || errorObj?.name === "PermissionDeniedError"
          ? "Permissão de microfone/câmera negada no navegador."
          : "Não foi possível acessar a câmera ou microfone.";

      setError(errorMsg);
      setCallState("failed");
      if (currentCallId) {
        sendWSMessage({
          type: "call:failed",
          call_id: currentCallId,
          reason: errorMsg,
        });
      }
      cleanupCall();
      setTimeout(resetCallState, 3000);
      return false;
    }
  }, [sendWSMessage, cleanupCall, resetCallState]);

  // Handle Signaling WS messages
  const handleSignalingMessage = useCallback(
    async (msg: WSMessageData) => {
      console.log("[CallProvider WS Signal]", msg.type, msg);

      switch (msg.type) {
        case "call:start": {
          const isVideoCall = !!msg.is_video;
          const targetCallId = (msg.call_id as string) || null;
          const targetUserId = (msg.target_user_id as string) || "";
          const callerName = (msg.caller_username as string) || `Usuário_${targetUserId.slice(0, 4)}`;
          const avatar = (msg.caller_avatar_url as string) || null;

          if (callStateRef.current === "calling") {
            // I am the caller: store call_id from server
            if (targetCallId) setCallId(targetCallId);
            setCallState("ringing");
            playRingtone("outgoing");
          } else {
            // I am the callee: incoming call
            if (callStateRef.current !== "idle") {
              if (targetCallId) {
                sendWSMessage({ type: "call:busy", call_id: targetCallId });
              }
              return;
            }
            if (targetCallId) setCallId(targetCallId);
            setCallerId(targetUserId);
            setCallerUsername(callerName);
            setRemoteAvatarUrl(avatar);
            setIsVideo(isVideoCall);
            setCallState("ringing");
            playRingtone("incoming");
            if (targetCallId) {
              sendWSMessage({
                type: "call:ringing",
                call_id: targetCallId,
                caller_id: targetUserId,
              });
            }
          }
          break;
        }

        case "call:ringing": {
          if (callStateRef.current === "calling") {
            setCallState("ringing");
          }
          break;
        }

        case "call:accepted": {
          if (callIdRef.current === msg.call_id) {
            stopRingtone();
            setCallState("connecting");
            await initializeWebRTC(true);
          }
          break;
        }

        case "call:rejected": {
          if (callIdRef.current === msg.call_id) {
            stopRingtone();
            setCallState("rejected");
            cleanupCall();
            setTimeout(resetCallState, 2000);
          }
          break;
        }

        case "call:busy": {
          if (callIdRef.current === msg.call_id) {
            stopRingtone();
            setCallState("busy");
            cleanupCall();
            setTimeout(resetCallState, 2000);
          }
          break;
        }

        case "call:ended": {
          if (callIdRef.current === msg.call_id) {
            stopRingtone();
            setCallState("ended");
            cleanupCall();
            setTimeout(resetCallState, 2000);
          }
          break;
        }

        case "call:failed": {
          if (callIdRef.current === msg.call_id || callStateRef.current === "calling") {
            stopRingtone();
            setCallState("failed");
            setError((msg.reason as string) || "Falha na chamada");
            cleanupCall();
            setTimeout(resetCallState, 3000);
          }
          break;
        }

        case "offer": {
          if (callIdRef.current === msg.call_id) {
            stopRingtone();
            setCallState("connecting");
            const success = await initializeWebRTC(false);
            if (!success || !pcRef.current) return;
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription({ type: "offer", sdp: msg.sdp as string })
            );
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            sendWSMessage({
              type: "answer",
              call_id: msg.call_id,
              sdp: answer.sdp,
            });
          }
          break;
        }

        case "answer": {
          if (callIdRef.current === msg.call_id && pcRef.current) {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription({ type: "answer", sdp: msg.sdp as string })
            );
          }
          break;
        }

        case "iceCandidate": {
          if (callIdRef.current === msg.call_id && msg.candidate && pcRef.current) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
            } catch (e) {
              console.warn("Failed to add ICE candidate:", e);
            }
          }
          break;
        }
      }
    },
    [sendWSMessage, playRingtone, stopRingtone, initializeWebRTC, cleanupCall, resetCallState]
  );

  // Global WebSocket Connection setup
  useEffect(() => {
    if (!token || !user) return;

    const baseApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const wsUrl =
      baseApiUrl.replace(/^http/, "ws") + `/ws?token=${encodeURIComponent(token)}`;

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("[CallProvider WS] Connected");
      heartbeatIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 10000);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessageData;

        // Process call signaling message
        handleSignalingMessage(data);

        // Broadcast to external listeners (e.g., chat message list)
        wsListenersRef.current.forEach((listener) => {
          try {
            listener(data);
          } catch (err) {
            console.error("Error in WS listener callback:", err);
          }
        });
      } catch (err) {
        console.error("[CallProvider WS] Error parsing message:", err);
      }
    };

    socket.onclose = () => {
      console.log("[CallProvider WS] Closed");
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      socket.close();
    };
  }, [token, user, handleSignalingMessage]);

  // Actions
  const startCall = useCallback(
    ({ targetUserId, targetUsername, isVideo = false, avatarUrl }: StartCallParams) => {
      if (!targetUserId) return;

      cleanupCall();
      setCalleeId(targetUserId);
      setCalleeUsername(targetUsername);
      setRemoteAvatarUrl(avatarUrl || null);
      setIsVideo(isVideo);
      setCallDuration(0);
      setCallState("calling");
      playRingtone("outgoing");

      sendWSMessage({
        type: "call:start",
        target_user_id: targetUserId,
        is_video: isVideo,
        caller_username: user?.username,
        caller_avatar_url: user?.avatar_url,
      });
    },
    [cleanupCall, playRingtone, sendWSMessage, user]
  );

  const acceptCall = useCallback(() => {
    const currentCallId = callIdRef.current;
    if (!currentCallId) return;

    stopRingtone();
    sendWSMessage({ type: "call:accepted", call_id: currentCallId });
    setCallDuration(0);
    setCallState("connecting");
  }, [stopRingtone, sendWSMessage]);

  const rejectCall = useCallback(() => {
    const currentCallId = callIdRef.current;
    stopRingtone();
    if (currentCallId) {
      sendWSMessage({ type: "call:rejected", call_id: currentCallId });
    }
    setCallState("rejected");
    cleanupCall();
    setTimeout(resetCallState, 1500);
  }, [stopRingtone, sendWSMessage, cleanupCall, resetCallState]);

  const endCall = useCallback(() => {
    const currentCallId = callIdRef.current;
    stopRingtone();
    if (currentCallId) {
      sendWSMessage({ type: "call:ended", call_id: currentCallId });
    }
    setCallState("ended");
    cleanupCall();
    setTimeout(resetCallState, 1500);
  }, [stopRingtone, sendWSMessage, cleanupCall, resetCallState]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = isMuted; // toggle
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = isCameraOff; // toggle
      });
      setIsCameraOff(!isCameraOff);
    }
  }, [isCameraOff]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callId,
        callerId,
        callerUsername,
        calleeId,
        calleeUsername,
        remoteAvatarUrl,
        isVideo,
        isMuted,
        isCameraOff,
        localStream,
        remoteStream,
        error,
        callDuration,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
        sendWSMessage,
        addWSListener,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}
