import { Platform, Alert } from "react-native";
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
} from "./webrtcShim";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useCallStore } from "../store/useCallStore";
import { wsClient } from "./ws";

class VoiceCallManager {
  private pc: any = null;
  private localStream: any = null;
  private userId: string | null = null;
  private unsubscribers: (() => void)[] = [];

  init(token: string, userId: string) {
    this.userId = userId;

    const eventTypes = [
      "call:start",
      "call:ringing",
      "call:accepted",
      "call:rejected",
      "call:busy",
      "call:ended",
      "call:failed",
      "offer",
      "answer",
      "iceCandidate",
    ];

    // Unsubscribe from any previous handlers just in case
    this.unsubscribers.forEach((unsub) => unsub());

    this.unsubscribers = eventTypes.map((type) =>
      wsClient.on(type, (msg) => this.handleSignalingMessage(msg))
    );
  }

  disconnect() {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    this.cleanupCall();
  }

  private send(msg: any) {
    wsClient.send(msg);
  }

  // Handle Signaling Messages
  private async handleSignalingMessage(msg: any) {
    const store = useCallStore.getState();
    console.log("[VoiceCallManager] WS Received:", msg.type, msg);
    console.log("[VoiceCallManager] Current Store State:", store.callState, "callId:", store.callId);

    switch (msg.type) {
      case "call:start":
        // Distinguish between caller and callee based on local store callState
        const isVideoCall = !!msg.is_video;
        if (store.callState === "calling") {
          // I am the caller: Server generated a call_id, let's update it
          store.initiateCall(msg.call_id, msg.target_user_id, store.calleeUsername || "User", isVideoCall);
        } else {
          // I am the callee: This is an incoming call alert
          if (store.callState !== "idle") {
            this.send({ type: "call:busy", call_id: msg.call_id });
            return;
          }
          // Shift to ringing state and display incoming calling screen
          const callerName = msg.caller_username || `User_${msg.target_user_id.slice(0, 4)}`;
          store.receiveCall(msg.call_id, msg.target_user_id, callerName, isVideoCall);
          this.send({ type: "call:ringing", call_id: msg.call_id, caller_id: msg.target_user_id });
        }
        break;

      case "call:ringing":
        if (store.callState === "calling") {
          store.setCallState("ringing");
        }
        break;

      case "call:accepted":
        if (store.callId === msg.call_id) {
          store.setCallState("connecting");
          // Alice starts negotiation as Caller
          await this.initializeWebRTC(true);
        }
        break;

      case "call:rejected":
        if (store.callId === msg.call_id) {
          store.setCallState("rejected");
          this.cleanupCall();
          setTimeout(() => store.resetCall(), 2000);
        }
        break;

      case "call:busy":
        if (store.callId === msg.call_id) {
          store.setCallState("busy");
          this.cleanupCall();
          setTimeout(() => store.resetCall(), 2000);
        }
        break;

      case "call:ended":
        if (store.callId === msg.call_id) {
          store.setCallState("ended");
          this.cleanupCall();
          setTimeout(() => store.resetCall(), 2000);
        }
        break;

      case "call:failed":
        if (store.callId === msg.call_id) {
          store.setCallState("failed");
          store.setError(msg.reason);
          this.cleanupCall();
          setTimeout(() => store.resetCall(), 3000);
        }
        break;

      case "offer":
        if (store.callId === msg.call_id) {
          store.setCallState("connecting");
          // Bob sets Remote Offer and responds with Answer
          const success = await this.initializeWebRTC(false);
          if (!success) return;
          await this.pc?.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: msg.sdp }));
          const answer = await this.pc?.createAnswer();
          await this.pc?.setLocalDescription(answer);
          this.send({ type: "answer", call_id: msg.call_id, sdp: answer?.sdp });
        }
        break;

      case "answer":
        if (store.callId === msg.call_id) {
          await this.pc?.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: msg.sdp }));
        }
        break;

      case "iceCandidate":
        if (store.callId === msg.call_id && msg.candidate) {
          try {
            await this.pc?.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {
            console.warn("Failed to add ICE candidate", e);
          }
        }
        break;
    }
  }

  // Initiate calling Bob
  async startCall(targetUserId: string, targetUsername: string, isVideo: boolean = false) {
    const store = useCallStore.getState();

    if (Platform.OS !== "web") {
      try {
        const audioPermission = await Audio.requestPermissionsAsync();
        if (audioPermission.status !== "granted") {
          Alert.alert(
            "Permissão Negada",
            "O acesso ao microfone é necessário para realizar chamadas de voz."
          );
          return;
        }
        if (isVideo) {
          const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
          if (cameraPermission.status !== "granted") {
            Alert.alert(
              "Permissão Negada",
              "O acesso à câmera é necessário para realizar chamadas de vídeo."
            );
            return;
          }
        }
      } catch (err) {
        console.error("Error requesting permissions to start call:", err);
        return;
      }
    }

    store.initiateCall("", targetUserId, targetUsername, isVideo);
    this.send({ type: "call:start", target_user_id: targetUserId, is_video: isVideo });
  }

  // Accept incoming call
  async acceptCall() {
    const store = useCallStore.getState();
    if (!store.callId) return;

    if (Platform.OS !== "web") {
      try {
        const audioPermission = await Audio.requestPermissionsAsync();
        if (audioPermission.status !== "granted") {
          Alert.alert(
            "Permissão Negada",
            "O acesso ao microfone é necessário para aceitar a chamada."
          );
          return;
        }
        if (store.isVideo) {
          const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
          if (cameraPermission.status !== "granted") {
            Alert.alert(
              "Permissão Negada",
              "O acesso à câmera é necessário para aceitar a chamada de vídeo."
            );
            return;
          }
        }
      } catch (err) {
        console.error("Error requesting permissions to accept call:", err);
        return;
      }
    }

    this.send({ type: "call:accepted", call_id: store.callId });
    store.setCallState("connecting");
  }

  // Decline incoming call
  rejectCall() {
    const store = useCallStore.getState();
    if (!store.callId) return;
    this.send({ type: "call:rejected", call_id: store.callId });
    store.setCallState("rejected");
    this.cleanupCall();
    setTimeout(() => store.resetCall(), 1500);
  }

  // Terminate active call
  endCall() {
    const store = useCallStore.getState();
    if (!store.callId) return;
    this.send({ type: "call:ended", call_id: store.callId });
    store.setCallState("ended");
    this.cleanupCall();
    setTimeout(() => store.resetCall(), 1500);
  }

  // Toggle microphone muting
  setMute(mute: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = !mute;
      });
    }
  }

  // Toggle local camera
  setCameraEnabled(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track: any) => {
        track.enabled = enabled;
      });
    }
  }

  // Flip between front and back camera
  switchCamera() {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track: any) => {
        if (typeof track._switchCamera === "function") {
          track._switchCamera();
        }
      });
    }
  }

  // Toggle audio output routing via expo-av
  async setSpeaker(speaker: boolean) {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: !speaker, // False routes to speaker
      });
    } catch (e) {
      console.warn("Failed to toggle speaker route", e);
    }
  }

  // WebRTC Connection Setup
  private async initializeWebRTC(isCaller: boolean): Promise<boolean> {
    const store = useCallStore.getState();
    const callId = store.callId;
    if (!callId) return false;

    if (!mediaDevices) {
      let errorMsg = "WebRTC mediaDevices support not found on this platform.";
      if (Platform.OS === "web") {
        if (!window.isSecureContext) {
          errorMsg = "WebRTC requires a Secure Context (HTTPS or localhost) to access camera/microphone.";
        }
      } else {
        errorMsg = "Expo Go does not support react-native-webrtc native modules. Please use a Development Build (npx expo run:android or run:ios).";
      }
      console.error(errorMsg);
      this.send({ type: "call:failed", call_id: callId, reason: errorMsg });
      store.setCallState("failed");
      store.setError(errorMsg);
      this.cleanupCall();
      setTimeout(() => store.resetCall(), 3000);
      return false;
    }

    try {
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: store.isVideo ? {
          facingMode: store.isFrontCamera ? "user" : "environment"
        } : false,
      });
    } catch (e: any) {
      console.error("Microphone/Camera access denied", e);
      let errorMsg = "Microphone/Camera permission denied";
      if (Platform.OS === "web" && !window.isSecureContext) {
        errorMsg = "WebRTC requires a Secure Context (HTTPS or localhost) to access camera/microphone.";
      }
      this.send({ type: "call:failed", call_id: callId, reason: errorMsg });
      store.setCallState("failed");
      store.setError(errorMsg);
      this.cleanupCall();
      setTimeout(() => store.resetCall(), 3000);
      return false;
    }

    const config = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    this.pc = new RTCPeerConnection(config);

    // Add local audio tracks to the peer connection
    this.localStream.getTracks().forEach((track: any) => {
      this.pc?.addTrack(track, this.localStream);
    });

    store.setStreams(this.localStream, null);

    // Collect ICE Candidates
    this.pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        this.send({
          type: "iceCandidate",
          call_id: callId,
          candidate: event.candidate,
        });
      }
    };

    // Listen for remote tracks
    this.pc.ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        store.setStreams(this.localStream, event.streams[0]);
      }
    };

    // ICE status monitor
    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState;
      if (state === "connected") {
        store.setCallState("connected");
      } else if (state === "failed") {
        this.send({ type: "call:failed", call_id: callId, reason: "ICE negotiation failed" });
        store.setCallState("failed");
        this.cleanupCall();
        setTimeout(() => store.resetCall(), 3000);
      }
    };

    // If we are the initiating caller, generate Offer
    if (isCaller) {
      const offer = await this.pc.createOffer({});
      await this.pc.setLocalDescription(offer);
      this.send({ type: "offer", call_id: callId, sdp: offer.sdp });
    }

    return true;
  }

  // Cleanup WebRTC instances
  private cleanupCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => track.stop());
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }
}

export const voiceCallManager = new VoiceCallManager();
