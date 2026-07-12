import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { createAudioPlayer, AudioPlayer as ExpoAudioPlayer, AudioStatus } from "expo-audio";
import { Play as PlayIcon, Pause as PauseIcon } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface AudioPlayerProps {
  uri: string;
  isMine: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ uri, isMine }) => {
  const { colors, isDark } = useAppTheme();
  const [player, setPlayer] = useState<ExpoAudioPlayer | null>(null);
  const [webAudio, setWebAudio] = useState<any>(null);
  const subscriptionRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1.0);


  // Web Audio Lifecycle
  useEffect(() => {
    if (Platform.OS === "web") {
      const audio = new (window as any).Audio(uri);
      
      const onTimeUpdate = () => {
        setPosition(audio.currentTime * 1000);
      };
      
      const onLoadedMetadata = () => {
        setDuration(audio.duration * 1000);
      };
      
      const onEnded = () => {
        setIsPlaying(false);
        setPosition(0);
      };

      const onError = (e: any) => {
        console.error("Web audio load error:", e);
      };
      
      audio.addEventListener("timeupdate", onTimeUpdate);
      audio.addEventListener("loadedmetadata", onLoadedMetadata);
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
      
      audio.load();
      if (audio.duration) {
        setDuration(audio.duration * 1000);
      }
      
      setWebAudio(audio);
      
      return () => {
        audio.pause();
        audio.removeEventListener("timeupdate", onTimeUpdate);
        audio.removeEventListener("loadedmetadata", onLoadedMetadata);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
      };
    }
  }, [uri]);

  // Native Sound Lifecycle
  useEffect(() => {
    return () => {
      if (player) {
        player.remove();
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, [player]);

  async function playSound() {
    if (Platform.OS === "web") {
      if (webAudio) {
        try {
          webAudio.playbackRate = speed;
          await webAudio.play();
          setIsPlaying(true);
        } catch (err) {
          console.log("Web audio play failed:", err);
        }
      }
      return;
    }

    try {
      if (player) {
        player.setPlaybackRate(speed);
        player.play();
        setIsPlaying(true);
      } else {
        const newPlayer = createAudioPlayer(uri);
        newPlayer.setPlaybackRate(speed);
        if (subscriptionRef.current) {
          subscriptionRef.current.remove();
        }
        subscriptionRef.current = newPlayer.addListener("playbackStatusUpdate", (status: AudioStatus) => {
          setPosition(status.currentTime * 1000);
          setDuration(status.duration * 1000 || 0);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
          }
        });
        setPlayer(newPlayer);
        newPlayer.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.log("Error playing native sound:", error);
    }
  }

  async function pauseSound() {
    if (Platform.OS === "web") {
      if (webAudio) {
        webAudio.pause();
        setIsPlaying(false);
      }
      return;
    }

    if (player) {
      player.pause();
      setIsPlaying(false);
    }
  }

  const seekWeb = (posMs: number) => {
    if (webAudio) {
      webAudio.currentTime = posMs / 1000;
      setPosition(posMs);
    }
  };

  const seekNative = async (posMs: number) => {
    if (player) {
      await player.seekTo(posMs / 1000);
      setPosition(posMs);
    }
  };

  const handleTimelinePress = (event: any) => {
    if (duration <= 0) return;
    const { locationX } = event.nativeEvent;
    const timelineWidth = 120;
    let clickX = locationX;
    if (clickX < 0) clickX = 0;
    if (clickX > timelineWidth) clickX = timelineWidth;

    const newPos = (clickX / timelineWidth) * duration;
    if (Platform.OS === "web") {
      seekWeb(newPos);
    } else {
      seekNative(newPos);
    }
  };

  const changeSpeed = async () => {
    let nextSpeed = 1.0;
    if (speed === 1.0) nextSpeed = 1.5;
    else if (speed === 1.5) nextSpeed = 2.0;
    else nextSpeed = 1.0;

    setSpeed(nextSpeed);

    if (Platform.OS === "web") {
      if (webAudio) {
        webAudio.playbackRate = nextSpeed;
      }
    } else {
      if (player) {
        player.setPlaybackRate(nextSpeed);
      }
    }
  };

  const formatTime = (millis: number) => {
    if (isNaN(millis) || millis <= 0) return "0:00";
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View
      style={[
        styles.container,
        isMine ? styles.containerMine : [styles.containerTheir, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)" }],
      ]}
    >
      <TouchableOpacity
        onPress={isPlaying ? pauseSound : playSound}
        style={[
          styles.playButton,
          isMine ? styles.playButtonMine : [styles.playButtonTheir, { backgroundColor: colors.tint }],
        ]}
      >
        {isPlaying ? (
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
          {formatTime(position)} / {formatTime(duration)}
        </Text>
      </View>

      {/* Playback Speed Pill */}
      <TouchableOpacity
        style={[
          styles.speedButton,
          isMine ? styles.speedButtonMine : [styles.speedButtonTheir, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 122, 255, 0.1)", borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 122, 255, 0.2)" }],
        ]}
        onPress={changeSpeed}
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
    minWidth: 230,
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
    width: 120,
  },
  timelineBackground: {
    height: 4,
    borderRadius: 2,
    width: 120,
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
