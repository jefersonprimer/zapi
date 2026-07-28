import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  Pressable,
  Image,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Volume2,
  VolumeX,
  Music,
  Play,
  Pause,
} from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface ReelsVideo {
  id: string;
  videoUrl: string;
  caption?: string;
  publisherId?: string;
  publisherName: string;
  publisherAvatar?: string | null;
  likesCount: number;
  commentsCount: number;
  sharesCount?: number;
  likedByMe?: boolean;
  savedByMe?: boolean;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onSave?: () => void;
  onProfilePress?: () => void;
}

interface ReelsItemProps {
  video: ReelsVideo;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}

export default function ReelsItem({
  video,
  isActive,
  isMuted,
  onToggleMute,
}: ReelsItemProps) {
  const { colors } = useAppTheme();
  const [isPlaying, setIsPlaying] = useState(false);

  const player = useVideoPlayer(video.videoUrl, (p) => {
    p.loop = true;
    p.muted = isMuted;
    if (isActive) {
      p.play();
      setIsPlaying(true);
    }
  });

  // Sync active state
  useEffect(() => {
    if (isActive) {
      player.play();
      setIsPlaying(true);
    } else {
      player.pause();
      setIsPlaying(false);
    }
  }, [isActive, player]);

  // Sync mute state
  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  const handlePressVideo = useCallback(() => {
    if (player.playing) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, [player]);

  return (
    <Pressable style={styles.container} onPress={handlePressVideo}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        pointerEvents="none"
      />

      {/* Mute status overlay indicator (briefly shown or absolute icon) */}
      <TouchableOpacity
        style={styles.muteButton}
        onPress={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
      >
        {isMuted ? (
          <VolumeX size={20} color="white" />
        ) : (
          <Volume2 size={20} color="white" />
        )}
      </TouchableOpacity>

      {/* Pause/Play overlay indicator */}
      {!isPlaying ? (
        <View style={styles.playPauseOverlay} pointerEvents="none">
          <View style={styles.playPauseCircle}>
            <Play size={28} color="white" fill="white" />
          </View>
        </View>
      ) : null}

      {/* Side Interactions (Like, Comment, Share, Save) */}
      <View style={styles.rightContainer}>
        {/* Publisher Avatar */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={(e) => {
            e.stopPropagation();
            video.onProfilePress?.();
          }}
        >
          {video.publisherAvatar ? (
            <Image
              source={{ uri: video.publisherAvatar }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.tint }]}>
              <Text style={styles.avatarInitial}>
                {video.publisherName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Like */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            video.onLike?.();
          }}
        >
          <Heart
            size={28}
            color={video.likedByMe ? "#FF3B30" : "white"}
            fill={video.likedByMe ? "#FF3B30" : "none"}
          />
          <Text style={styles.actionText}>{video.likesCount}</Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            video.onComment?.();
          }}
        >
          <MessageCircle size={28} color="white" />
          <Text style={styles.actionText}>{video.commentsCount}</Text>
        </TouchableOpacity>

        {/* Save */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            video.onSave?.();
          }}
        >
          <Bookmark
            size={28}
            color={video.savedByMe ? colors.tint : "white"}
            fill={video.savedByMe ? colors.tint : "none"}
          />
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            video.onShare?.();
          }}
        >
          <Share2 size={28} color="white" />
        </TouchableOpacity>
      </View>

      {/* Bottom Info Overlay */}
      <View style={styles.bottomContainer} pointerEvents="box-none">
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            video.onProfilePress?.();
          }}
        >
          <Text style={styles.publisherName}>@{video.publisherName}</Text>
        </TouchableOpacity>
        
        {video.caption ? (
          <Text style={styles.caption} numberOfLines={3}>
            {video.caption}
          </Text>
        ) : null}

        <View style={styles.musicContainer}>
          <Music size={14} color="white" style={styles.musicIcon} />
          <Text style={styles.musicText} numberOfLines={1}>
            Áudio original • {video.publisherName}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 120, // Adjust to leave space for tabs & statusbar/header
    backgroundColor: "black",
    justifyContent: "flex-end",
  },
  muteButton: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    padding: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  playPauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  playPauseCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  rightContainer: {
    position: "absolute",
    right: 12,
    bottom: 80,
    alignItems: "center",
    gap: 16,
    zIndex: 10,
  },
  avatarContainer: {
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "white",
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
  },
  actionButton: {
    alignItems: "center",
  },
  actionText: {
    color: "white",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  bottomContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxWidth: SCREEN_WIDTH - 80,
    zIndex: 10,
  },
  publisherName: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  caption: {
    color: "white",
    fontSize: 14,
    marginBottom: 12,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  musicContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  musicIcon: {
    marginRight: 6,
  },
  musicText: {
    color: "white",
    fontSize: 13,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
