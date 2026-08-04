import React, { useEffect } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";

interface UploadProgressLineProps {
  label: string;
  isMine: boolean;
  trackColor: string;
  accentColor: string;
}

export function UploadProgressLine({
  label,
  isMine,
  trackColor,
  accentColor,
}: UploadProgressLineProps) {
  const shimmer = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-56, 112],
  });

  return (
    <View
      style={[
        styles.uploadStatusContainer,
        isMine ? styles.uploadStatusMine : styles.uploadStatusTheirs,
      ]}
    >
      <Text
        style={[
          styles.uploadStatusText,
          { color: isMine ? "rgba(255,255,255,0.72)" : "#64748B" },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={[styles.uploadTrack, { backgroundColor: trackColor }]}>
        <Animated.View
          style={[
            styles.uploadShimmer,
            {
              backgroundColor: accentColor,
              transform: [{ translateX }],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  uploadStatusContainer: {
    alignSelf: "flex-end",
    width: 124,
    marginTop: 6,
    marginRight: 2,
  },
  uploadStatusMine: {},
  uploadStatusTheirs: {},
  uploadStatusText: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  uploadTrack: {
    height: 3,
    borderRadius: 999,
    overflow: "hidden",
    position: "relative",
  },
  uploadShimmer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 52,
    borderRadius: 999,
    opacity: 0.9,
  },
});
