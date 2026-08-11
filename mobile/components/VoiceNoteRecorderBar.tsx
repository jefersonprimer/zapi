import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useAppTheme } from "@/context/ThemeContext";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface VoiceNoteRecorderBarProps {
  recordingDuration: number;
  isPaused: boolean;
  onPauseResumeRecording: () => void;
  onStopRecording: () => void; // Discards/trashes recording

  // Preview/Send props
  recordedUri?: string | null;
  onStopAndPreview?: () => void;
  onSendAudio?: () => void;
}

export const VoiceNoteRecorderBar: React.FC<VoiceNoteRecorderBarProps> = ({
  recordingDuration,
  isPaused,
  onPauseResumeRecording,
  onStopRecording,
  recordedUri,
  onStopAndPreview,
  onSendAudio,
}) => {
  const { colors, isDark } = useAppTheme();

  // Preview Player State using Expo Audio hooks
  const player = useAudioPlayer(recordedUri || null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);

  const [timelineWidth, setTimelineWidth] = useState(0);

  // Trigger LayoutAnimation on recordedUri state changes for super smooth UX transitions
  // and auto-play when preview is ready
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (recordedUri && player) {
      player.play();
    }
  }, [recordedUri, player]);

  // Reset to start on finish
  useEffect(() => {
    if (status.didJustFinish && player) {
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const audioDuration =
    status.duration && isFinite(status.duration) && status.duration > 0
      ? status.duration * 1000
      : recordingDuration * 1000;

  const handleTimelinePress = (event: any) => {
    if (audioDuration <= 0 || timelineWidth <= 0 || !player) return;
    const { locationX } = event.nativeEvent;
    let clickX = locationX;
    if (clickX < 0) clickX = 0;
    if (clickX > timelineWidth) clickX = timelineWidth;

    const newPos = (clickX / timelineWidth) * audioDuration;
    player.seekTo(newPos / 1000);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const formatTime = (millis: number) => {
    if (isNaN(millis) || millis <= 0) return "0:00";
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const currentPosition = status.currentTime * 1000 || 0;
  const progressPercent =
    audioDuration > 0 ? (currentPosition / audioDuration) * 100 : 0;

  // Render Recording State (No recorded URI yet)
  if (!recordedUri) {
    return (
      <View
        style={[
          styles.mainContainer,
          {
            backgroundColor: isDark ? "rgba(30, 30, 30, 0.85)" : "rgba(255, 255, 255, 0.85)",
            borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
          },
        ]}
      >
        <View
          style={[
            styles.rowContainer,
            { paddingVertical: 8, paddingHorizontal: 12 },
          ]}
        >
          {/* Left: Beautiful Soundwave / Recording graphic */}
          <View style={styles.waveformContainer}>
            {Array.from({ length: 26 }).map((_, i) => {
              const heights = [
                4, 10, 16, 22, 14, 8, 12, 18, 24, 20, 12, 6, 10, 16, 22, 14, 8,
                12, 18, 24, 20, 12, 6, 8, 4,
              ];
              const height = heights[i % heights.length];
              return (
                <View
                  key={i}
                  style={[
                    styles.waveformBar,
                    {
                      height,
                      backgroundColor: colors.tint,
                      opacity: isPaused ? 0.4 : 1,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Middle-Right: Timer */}
          <Text style={[styles.timerText, { color: colors.text }]}>
            {formatDuration(recordingDuration)}
          </Text>

          {/* Right: Stop Recording Button */}
          <TouchableOpacity
            style={[styles.stopBtn, { backgroundColor: colors.danger }]}
            onPress={onStopAndPreview}
          >
            <Ionicons name="stop" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render Preview/Send State (recordedUri is set)
  return (
    <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
      {/* 1st: Close Button to discard (with its own border and style matching CreateListModal.tsx) */}
      <TouchableOpacity
        style={[
          styles.closeBtn,
          {
            borderColor: colors.border,
          },
        ]}
        onPress={onStopRecording}
      >
        <Ionicons name="close" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Main controls container */}
      <View
        style={[
          styles.mainContainer,
          {
            flex: 1,
            backgroundColor: isDark ? "rgba(30, 30, 30, 0.85)" : "rgba(255, 255, 255, 0.85)",
            borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
          },
        ]}
      >
        <View
          style={[
            styles.rowContainer,
            { paddingVertical: 8, paddingHorizontal: 12 },
          ]}
        >
          {/* 2nd: Play/Pause Button to listen */}
          <TouchableOpacity
            style={[styles.playPauseBtn, { backgroundColor: colors.tint }]}
            onPress={
              status.playing ? () => player.pause() : () => player.play()
            }
          >
            {status.playing ? (
              <Ionicons name="pause" size={16} color="#fff" />
            ) : (
              <Ionicons
                name="play"
                size={16}
                color="#fff"
                style={{ marginLeft: 1 }}
              />
            )}
          </TouchableOpacity>

          {/* 3rd: Timeline Waveform Line / Progress */}
          <TouchableOpacity
            activeOpacity={1}
            style={styles.timelineTouch}
            onPress={handleTimelinePress}
          >
            <View
              style={styles.waveformContainer}
              onLayout={(e) => setTimelineWidth(e.nativeEvent.layout.width)}
            >
              {Array.from({ length: 26 }).map((_, i) => {
                const heights = [
                  4, 10, 16, 22, 14, 8, 12, 18, 24, 20, 12, 6, 10, 16, 22, 14,
                  8, 12, 18, 24, 20, 12, 6, 8, 4,
                ];
                const height = heights[i % heights.length];
                const isActive = progressPercent >= (i / 25) * 100;
                return (
                  <View
                    key={i}
                    style={[
                      styles.waveformBar,
                      {
                        height,
                        backgroundColor: isActive
                          ? colors.tint
                          : isDark
                            ? "rgba(255, 255, 255, 0.2)"
                            : "#dcdcdc",
                      },
                    ]}
                  />
                );
              })}
            </View>
          </TouchableOpacity>

          {/* 4th: Timer (current / total) */}
          <Text
            style={[styles.timerTextPreview, { color: colors.textSecondary }]}
          >
            {formatTime(currentPosition)}
          </Text>

          {/* 5th: Send Audio Button */}
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: "#34C759" }]}
            onPress={onSendAudio}
          >
            <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 1 }} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    borderRadius: 50,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
    padding: 2,
  },
  rowContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  waveformContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 16,
    height: 32,
  },
  waveformBar: {
    width: 2.5,
    borderRadius: 1.25,
  },
  timerText: {
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    marginRight: 16,
  },
  timerTextPreview: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    marginRight: 12,
    minWidth: 32,
    textAlign: "right",
  },
  stopBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  playPauseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timelineTouch: {
    flex: 1,
    height: 44,
    justifyContent: "center",
    marginRight: 12,
  },
  timelineBackground: {
    height: 4,
    borderRadius: 2,
    width: "100%",
    position: "relative",
  },
  timelineProgress: {
    height: "100%",
    borderRadius: 2,
    position: "absolute",
    left: 0,
    top: 0,
  },
  timelineThumb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: "absolute",
    top: -3,
    marginLeft: -5,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
