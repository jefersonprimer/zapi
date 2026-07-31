import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Play as PlayIcon, Pause as PauseIcon } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface AudioPlayerProps {
  uri: string;
  isMine: boolean;
  onLongPress?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ uri, isMine, onLongPress }) => {
  const { colors, isDark } = useAppTheme();
  const [speed, setSpeed] = useState(1.0);

  // Initialize the audio player and status hook
  const player = useAudioPlayer(uri || null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);

  // Apply speed changes to player
  useEffect(() => {
    if (player) {
      player.setPlaybackRate(speed);
    }
  }, [speed, player]);

  // Reset playback to start on finish
  useEffect(() => {
    if (status.didJustFinish && player) {
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const audioDuration = (status.duration && isFinite(status.duration) && status.duration > 0)
    ? (status.duration * 1000)
    : 0;

  const currentPosition = (status.currentTime * 1000) || 0;

  const handleTimelinePress = (event: any) => {
    if (audioDuration <= 0 || !player) return;
    const { locationX } = event.nativeEvent;
    const timelineWidth = 150;
    let clickX = locationX;
    if (clickX < 0) clickX = 0;
    if (clickX > timelineWidth) clickX = timelineWidth;

    const newPos = (clickX / timelineWidth) * audioDuration;
    player.seekTo(newPos / 1000);
  };

  const changeSpeed = () => {
    let nextSpeed = 1.0;
    if (speed === 1.0) nextSpeed = 1.5;
    else if (speed === 1.5) nextSpeed = 2.0;
    else nextSpeed = 1.0;
    setSpeed(nextSpeed);
  };

  const formatTime = (millis: number) => {
    if (isNaN(millis) || millis <= 0) return "0:00";
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const progressPercent = audioDuration > 0 ? (currentPosition / audioDuration) * 100 : 0;

  return (
    <View
      style={[
        styles.container,
        isMine ? styles.containerMine : [styles.containerTheir, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)" }],
      ]}
    >
      <TouchableOpacity
        onPress={status.playing ? () => player.pause() : () => player.play()}
        onLongPress={onLongPress}
        style={[
          styles.playButton,
          isMine ? styles.playButtonMine : [styles.playButtonTheir, { backgroundColor: colors.tint }],
        ]}
      >
        {status.playing ? (
          <PauseIcon
            size={14}
            color={isMine ? colors.tint : "#fff"}
            fill={isMine ? colors.tint : "#fff"}
          />
        ) : (
          <PlayIcon
            size={14}
            color={isMine ? colors.tint : "#fff"}
            fill={isMine ? colors.tint : "#fff"}
            style={{ marginLeft: 2 }}
          />
        )}
      </TouchableOpacity>

      <View style={styles.timelineContainer}>
        {/* Seekable Progress Bar */}
        <TouchableOpacity
          activeOpacity={1}
          style={styles.timelineTouch}
          onPress={handleTimelinePress}
          onLongPress={onLongPress}
        >
          <View
            style={[
              styles.timelineBackground,
              isMine ? styles.timelineBgMine : [styles.timelineBgTheir, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.2)" : "#dcdcdc" }],
            ]}
          >
            <View
              style={[
                styles.timelineProgress,
                isMine ? styles.timelineProgressMine : [styles.timelineProgressTheir, { backgroundColor: colors.tint }],
                { width: `${progressPercent}%` },
              ]}
            />
            {/* Playback Thumb */}
            <View
              style={[
                styles.timelineThumb,
                isMine ? styles.timelineThumbMine : [styles.timelineThumbTheir, { backgroundColor: colors.tint }],
                { left: `${progressPercent}%` },
              ]}
            />
          </View>
        </TouchableOpacity>

        {/* Time text below bar */}
        <Text
          style={[
            styles.timeText,
            isMine ? styles.timeTextMine : [styles.timeTextTheir, { color: colors.textSecondary }],
          ]}
        >
          {formatTime(currentPosition)} / {formatTime(audioDuration)}
        </Text>
      </View>

      {/* Playback Speed Pill */}
      <TouchableOpacity
        style={[
          styles.speedButton,
          isMine ? styles.speedButtonMine : [styles.speedButtonTheir, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 122, 255, 0.1)", borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 122, 255, 0.2)" }],
        ]}
        onPress={changeSpeed}
        onLongPress={onLongPress}
      >
        <Text
          style={[
            styles.speedText,
            isMine ? styles.speedTextMine : [styles.speedTextTheir, { color: colors.tint }],
          ]}
        >
          {speed}x
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 14,
    marginVertical: 4,
    minWidth: 260,
  },
  containerMine: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  containerTheir: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  playButtonMine: {
    backgroundColor: "#fff",
  },
  playButtonTheir: {
    backgroundColor: "#007AFF",
  },
  timelineContainer: {
    flex: 1,
    justifyContent: "center",
    marginRight: 8,
  },
  timelineTouch: {
    height: 14,
    justifyContent: "center",
    width: 150,
  },
  timelineBackground: {
    height: 4,
    borderRadius: 2,
    width: 150,
    position: "relative",
  },
  timelineBgMine: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  timelineBgTheir: {
    backgroundColor: "#dcdcdc",
  },
  timelineProgress: {
    height: "100%",
    borderRadius: 2,
  },
  timelineProgressMine: {
    backgroundColor: "#fff",
  },
  timelineProgressTheir: {
    backgroundColor: "#007AFF",
  },
  timelineThumb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: "absolute",
    top: -3,
    marginLeft: -5,
  },
  timelineThumbMine: {
    backgroundColor: "#fff",
  },
  timelineThumbTheir: {
    backgroundColor: "#007AFF",
  },
  timeText: {
    fontSize: 10,
    marginTop: 2,
  },
  timeTextMine: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  timeTextTheir: {
    color: "#666",
  },
  speedButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  speedButtonMine: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  speedButtonTheir: {
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(0, 122, 255, 0.2)",
  },
  speedText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  speedTextMine: {
    color: "#fff",
  },
  speedTextTheir: {
    color: "#007AFF",
  },
});
