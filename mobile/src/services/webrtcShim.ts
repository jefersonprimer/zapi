import { Platform } from "react-native";

let _RTCPeerConnection: any;
let _RTCIceCandidate: any;
let _RTCSessionDescription: any;
let _mediaDevices: any;

if (Platform.OS === "web") {
  _RTCPeerConnection = (window as any).RTCPeerConnection || (window as any).webkitRTCPeerConnection;
  _RTCIceCandidate = (window as any).RTCIceCandidate;
  _RTCSessionDescription = (window as any).RTCSessionDescription;
  _mediaDevices = navigator.mediaDevices;
} else {
  try {
    // Dynamic require prevents bundling crash on web when react-native-webrtc tries to access native links
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WebRTC = require("react-native-webrtc");
    _RTCPeerConnection = WebRTC.RTCPeerConnection;
    _RTCIceCandidate = WebRTC.RTCIceCandidate;
    _RTCSessionDescription = WebRTC.RTCSessionDescription;
    _mediaDevices = WebRTC.mediaDevices;
  } catch (e) {
    console.warn("Failed to load native react-native-webrtc modules, falling back to browser API if on web", e);
  }
}

export {
  _RTCPeerConnection as RTCPeerConnection,
  _RTCIceCandidate as RTCIceCandidate,
  _RTCSessionDescription as RTCSessionDescription,
  _mediaDevices as mediaDevices,
};
