import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Audio } from "expo-av";
import { Play as PlayIcon, Pause as PauseIcon } from "lucide-react-native";

interface AudioPlayerProps {
  uri: string;
  isMine: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ uri, isMine }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis || 0);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  async function playSound() {
    try {
      if (sound) {
        await sound.playAsync();
        setIsPlaying(true);
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          onPlaybackStatusUpdate,
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (error) {
      console.log("Error playing sound:", error);
    }
  }

  async function pauseSound() {
    if (sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
    }
  }

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const formatTime = (millis: number) => {
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <View
      style={[
        styles.container,
        isMine ? styles.containerMine : styles.containerTheir,
      ]}
    >
      <TouchableOpacity
        onPress={isPlaying ? pauseSound : playSound}
        style={[
          styles.playButton,
          isMine ? styles.playButtonMine : styles.playButtonTheir,
        ]}
      >
        {isPlaying ? (
          <PauseIcon
            size={14}
            color={isMine ? "#007AFF" : "#fff"}
            fill={isMine ? "#007AFF" : "#fff"}
          />
        ) : (
          <PlayIcon
            size={14}
            color={isMine ? "#007AFF" : "#fff"}
            fill={isMine ? "#007AFF" : "#fff"}
            style={{ marginLeft: 2 }}
          />
        )}
      </TouchableOpacity>
      <View style={styles.progressContainer}>
        <Text
          style={[
            styles.timeText,
            isMine ? styles.timeTextMine : styles.timeTextTheir,
          ]}
        >
          {isPlaying
            ? `${formatTime(position)} / ${formatTime(duration)}`
            : `Voice Message (${formatTime(duration || 0)})`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 12,
    marginVertical: 4,
    minWidth: 180,
  },
  containerMine: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  containerTheir: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  playButtonMine: {
    backgroundColor: "#fff",
  },
  playButtonTheir: {
    backgroundColor: "#007AFF",
  },
  progressContainer: {
    flex: 1,
  },
  timeText: {
    fontSize: 12,
  },
  timeTextMine: {
    color: "#fff",
  },
  timeTextTheir: {
    color: "#333",
  },
});
