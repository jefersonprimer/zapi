import { Platform } from "react-native";

let _RTCPeerConnection: any;
let _RTCIceCandidate: any;
let _RTCSessionDescription: any;
let _mediaDevices: any;
let _RTCView: any;

if (Platform.OS === "web" && typeof window !== "undefined") {
  _RTCPeerConnection = (window as any).RTCPeerConnection || (window as any).webkitRTCPeerConnection;
  _RTCIceCandidate = (window as any).RTCIceCandidate;
  _RTCSessionDescription = (window as any).RTCSessionDescription;
  _mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _RTCView = require("react-native").View; // Fallback to View on Web (handled via custom VideoView)
} else {
  try {
    // Dynamic require prevents bundling crash on web when react-native-webrtc tries to access native links
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WebRTC = require("react-native-webrtc");
    _RTCPeerConnection = WebRTC.RTCPeerConnection;
    _RTCIceCandidate = WebRTC.RTCIceCandidate;
    _RTCSessionDescription = WebRTC.RTCSessionDescription;
    _mediaDevices = WebRTC.mediaDevices;
    _RTCView = WebRTC.RTCView;
  } catch (e) {
    console.warn("Failed to load native react-native-webrtc modules, falling back to browser API if on web", e);
  }
}

export {
  _RTCPeerConnection as RTCPeerConnection,
  _RTCIceCandidate as RTCIceCandidate,
  _RTCSessionDescription as RTCSessionDescription,
  _mediaDevices as mediaDevices,
  _RTCView as RTCView,
};
