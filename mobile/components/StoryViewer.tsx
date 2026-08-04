import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import type { Story } from "@/services/updatesApi";
import { getFullRemoteUrl } from "@/services/mediaCache";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface StoryViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
  onStoryViewed: (storyId: string) => void;
}

function StoryVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={styles.media}
      contentFit="contain"
      nativeControls={false}
      pointerEvents="none"
    />
  );
}

export default function StoryViewer({ stories, initialIndex = 0, onClose, onStoryViewed }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentStory = stories[currentIndex];
  const attachment = currentStory?.attachments?.[0];
  const mediaUrl = attachment?.url ? getFullRemoteUrl(attachment.url) : null;
  const isVideo =
    attachment?.type === "video" ||
    attachment?.mime_type?.startsWith("video/") === true;
  const storyDurationMs = isVideo
    ? Math.max((attachment?.duration ?? 15) * 1000, 5000)
    : 5000;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    setProgress(0);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(elapsed / storyDurationMs, 1);
      setProgress(pct);
      if (pct >= 1) {
        clearTimer();
        if (currentIndex < stories.length - 1) {
          setCurrentIndex((i) => i + 1);
        } else {
          onClose();
        }
      }
    }, 50);
  }, [currentIndex, stories.length, clearTimer, onClose, storyDurationMs]);

  useEffect(() => {
    if (currentStory && !currentStory.viewed) {
      onStoryViewed(currentStory.id);
    }
    startTimer();
    return clearTimer;
  }, [currentIndex, currentStory, onStoryViewed, startTimer, clearTimer]);

  const goNext = useCallback(() => {
    clearTimer();
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, clearTimer, onClose]);

  const goPrev = useCallback(() => {
    clearTimer();
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex, clearTimer]);

  if (!currentStory) return null;

  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        {stories.map((_, i) => (
          <View key={i} style={[styles.progressBar, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: "white",
                  width: i < currentIndex ? "100%" : i === currentIndex ? `${progress * 100}%` : "0%",
                },
              ]}
            />
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close" size={24} color="white" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.contentArea}
        activeOpacity={1}
        onPress={(e) => {
          const x = e.nativeEvent.locationX;
          if (x < SCREEN_WIDTH * 0.3) goPrev();
          else if (x > SCREEN_WIDTH * 0.7) goNext();
        }}
      >
        {mediaUrl ? (
          isVideo ? (
            <StoryVideo key={mediaUrl} uri={mediaUrl} />
          ) : (
            <Image
              source={{ uri: mediaUrl }}
              style={styles.media}
              resizeMode="contain"
            />
          )
        ) : currentStory.content ? (
          <View
            style={[
              styles.textContainer,
              {
                backgroundColor: currentStory.background_color || "#000000",
              },
            ]}
          >
            <Text
              style={[
                styles.storyText,
                { color: currentStory.font_color || "#FFFFFF" },
              ]}
            >
              {currentStory.content}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerName}>{currentStory.publisher_name}</Text>
        {currentStory.content && attachment ? (
          <Text style={styles.footerCaption}>{currentStory.content}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  progressContainer: {
    flexDirection: "row",
    position: "absolute",
    top: 50,
    left: 12,
    right: 12,
    zIndex: 10,
    gap: 4,
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  closeButton: {
    position: "absolute",
    top: 60,
    left: 12,
    zIndex: 10,
    padding: 4,
  },
  contentArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  media: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  textContainer: {
    width: SCREEN_WIDTH - 80,
    minHeight: 200,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    padding: 24,
  },
  storyText: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 32,
  },
  footer: {
    padding: 16,
    alignItems: "center",
    paddingBottom: 40,
    gap: 6,
  },
  footerName: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  footerCaption: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    textAlign: "center",
  },
});
