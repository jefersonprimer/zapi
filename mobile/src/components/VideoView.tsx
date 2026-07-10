import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { RTCView } from "../services/webrtcShim";

interface VideoViewProps {
  stream: any;
  style?: any;
  mirror?: boolean;
  objectFit?: "contain" | "cover";
}

export default function VideoView({
  stream,
  style,
  mirror = false,
  objectFit = "cover",
}: VideoViewProps) {
  if (!stream) return null;

  if (Platform.OS === "web") {
    return <WebVideo stream={stream} style={style} mirror={mirror} />;
  }

  const streamUrl = typeof stream.toURL === "function" ? stream.toURL() : "";

  return (
    <RTCView
      streamURL={streamUrl}
      style={[styles.rtcView, style]}
      mirror={mirror}
      objectFit={objectFit}
    />
  );
}

function WebVideo({ stream, style, mirror }: { stream: any; style?: any; mirror?: boolean }) {
  const videoRef = useRef<any>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <View style={[styles.webContainer, style]}>
      {/* @ts-ignore */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={mirror}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: mirror ? "scaleX(-1)" : undefined,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rtcView: {
    width: "100%",
    height: "100%",
  },
  webContainer: {
    overflow: "hidden",
    width: "100%",
    height: "100%",
  },
});
