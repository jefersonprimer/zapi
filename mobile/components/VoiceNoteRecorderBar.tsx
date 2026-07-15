import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, LayoutAnimation, UIManager } from "react-native";
import { Trash2 as TrashIcon, Pause as PauseIcon, Play as PlayIcon, Send as SendIcon } from "lucide-react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useAppTheme } from "@/context/ThemeContext";

// Enable LayoutAnimation for Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
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

  const audioDuration = (status.duration && isFinite(status.duration) && status.duration > 0)
    ? (status.duration * 1000)
    : (recordingDuration * 1000);

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

  const currentPosition = (status.currentTime * 1000) || 0;
  const progressPercent = audioDuration > 0 ? (currentPosition / audioDuration) * 100 : 0;

  return (
    <View style={styles.recordingContainer}>
      {/* 1. Preview Player (Visible when paused or recordedUri is set) */}
      {(isPaused || recordedUri) && (
        <View style={[styles.previewContainer, { marginBottom: 12 }]}>
          <TouchableOpacity
            onPress={status.playing ? () => player.pause() : (recordedUri ? () => player.play() : onStopAndPreview)}
            style={[styles.previewPlayBtn, { backgroundColor: colors.tint }]}
          >
            {status.playing ? (
              <PauseIcon size={14} color="#fff" fill="#fff" />
            ) : (
              <PlayIcon size={14} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={1}
            style={styles.timelineTouch}
            onPress={recordedUri ? handleTimelinePress : onStopAndPreview}
          >
            <View
              style={[
                styles.timelineBackground,
                { backgroundColor: isDark ? "rgba(255, 255, 255, 0.2)" : "#dcdcdc" }
              ]}
              onLayout={(e) => setTimelineWidth(e.nativeEvent.layout.width)}
            >
              <View
                style={[
                  styles.timelineProgress,
                  { backgroundColor: colors.tint, width: `${progressPercent}%` }
                ]}
              />
              <View
                style={[
                  styles.timelineThumb,
                  { backgroundColor: colors.tint, left: `${progressPercent}%` }
                ]}
              />
            </View>
          </TouchableOpacity>

          <Text style={[styles.previewTimeText, { color: colors.textSecondary }]}>
            {formatTime(currentPosition)} / {formatTime(audioDuration)}
          </Text>
        </View>
      )}

      {/* 2. Status Row */}
      <View style={[styles.statusContainer, { marginBottom: 8 }]}>
        <View style={styles.statusInfo}>
          <View 
            style={[
              styles.statusDot, 
              isPaused || recordedUri ? styles.statusDotPaused : [styles.statusDotActive, { backgroundColor: colors.danger }]
            ]} 
          />
          <Text 
            style={[
              styles.recordingText, 
              { color: isPaused || recordedUri ? colors.textSecondary : colors.danger }
            ]}
          >
            {isPaused || recordedUri ? "Gravação pausada" : "Gravando áudio"}
          </Text>
        </View>
        <Text style={[styles.timerText, { color: colors.text }]}>
          {formatDuration(recordingDuration)}
        </Text>
      </View>

      {/* Bottom Action Row */}
      <View style={styles.bottomRow}>
        {/* Left: Trash Button with background */}
        <TouchableOpacity
          style={[
            styles.circleBtn,
            { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.08)" }
          ]}
          onPress={onStopRecording}
        >
          <TrashIcon size={18} color="#EF4444" />
        </TouchableOpacity>

        {/* Middle Pause/Resume/Continue Button */}
        {!recordedUri && (
          <TouchableOpacity
            style={[
              styles.pillBtn,
              { 
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.06)",
                borderWidth: 1,
              }
            ]}
            onPress={onPauseResumeRecording}
          >
            {isPaused ? (
              <>
                <PlayIcon size={16} color={colors.tint} fill={colors.tint} />
                <Text style={[styles.pillBtnText, { color: colors.tint }]}>Continuar</Text>
              </>
            ) : (
              <>
                <PauseIcon size={16} color={colors.tint} fill={colors.tint} />
                <Text style={[styles.pillBtnText, { color: colors.tint }]}>Pausar</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Right Send Button */}
        <TouchableOpacity
          style={[
            styles.circleBtn,
            { backgroundColor: colors.tint }
          ]}
          onPress={onSendAudio}
        >
          <SendIcon size={18} color="#fff" style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  recordingContainer: {
    flexDirection: "column",
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  topRow: {
    width: "100%",
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 8,
  },
  statusInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusDotActive: {
    backgroundColor: "#EF4444",
  },
  statusDotPaused: {
    backgroundColor: "#8E8E93",
  },
  recordingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  timerText: {
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 4,
  },
  previewPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  timelineTouch: {
    flex: 1,
    height: 20,
    justifyContent: "center",
    marginRight: 10,
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
  previewTimeText: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    minWidth: 75,
    textAlign: "right",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 8,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  pillBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  pillBtnText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
  },
});
