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
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAppTheme } from "@/context/ThemeContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface ReelsVideo {
  id: string;
  mediaUrl: string;
  mediaType: "video" | "image";
  caption?: string;
  publisherId?: string;
  publisherName: string;
  publisherAvatar?: string | null;
  likesCount: number;
  commentsCount: number;
  sharesCount?: number;
  likedByMe?: boolean;
  savedByMe?: boolean;
  isFollowing?: boolean;
  isOwnProfile?: boolean;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onSave?: () => void;
  onFollow?: () => void;
  onProfilePress?: () => void;
}

interface ReelsItemProps {
  video: ReelsVideo;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}

function ReelsVideoPlayer({
  uri,
  isActive,
  isMuted,
  onPlayingChange,
}: {
  uri: string;
  isActive: boolean;
  isMuted: boolean;
  onPlayingChange: (playing: boolean) => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = isMuted;
    if (isActive) {
      p.play();
    }
  });

  useEffect(() => {
    if (isActive) {
      player.play();
      onPlayingChange(true);
    } else {
      player.pause();
      onPlayingChange(false);
    }
  }, [isActive, player, onPlayingChange]);

  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  const handlePress = useCallback(() => {
    if (player.playing) {
      player.pause();
      onPlayingChange(false);
    } else {
      player.play();
      onPlayingChange(true);
    }
  }, [player, onPlayingChange]);

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={handlePress}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        pointerEvents="none"
      />
    </Pressable>
  );
}

export default function ReelsItem({
  video,
  isActive,
  isMuted,
  onToggleMute,
}: ReelsItemProps) {
  const { colors } = useAppTheme();
  const isImage = video.mediaType === "image";
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  return (
    <View style={styles.container}>
      {isImage ? (
        <Image
          source={{ uri: video.mediaUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : isActive ? (
        <ReelsVideoPlayer
          uri={video.mediaUrl}
          isActive={isActive}
          isMuted={isMuted}
          onPlayingChange={handlePlayingChange}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "black" }]} />
      )}



      {!isImage && !isPlaying ? (
        <View style={styles.playPauseOverlay} pointerEvents="none">
          <View style={styles.playPauseCircle}>
            <MaterialCommunityIcons name="play" size={32} color="white" />
          </View>
        </View>
      ) : null}

      {/* Side Interactions (Like, Comment, Save, Share) */}
      <View style={styles.rightContainer}>
        <View style={styles.avatarWrapper}>
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
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: colors.tint },
                ]}
              >
                <Text style={styles.avatarInitial}>
                  {video.publisherName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {video.onFollow && !video.isFollowing && !video.isOwnProfile && (
            <TouchableOpacity
              style={[
                styles.followIconContainer,
                { backgroundColor: colors.tint },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                video.onFollow?.();
              }}
            >
              <MaterialCommunityIcons name="plus" size={14} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {/* Curtidas */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            video.onLike?.();
          }}
        >
          <MaterialCommunityIcons
            name={video.likedByMe ? "heart" : "heart-outline"}
            size={28}
            color={video.likedByMe ? "#FF3B30" : "white"}
          />
          <Text style={styles.actionText}>{video.likesCount}</Text>
        </TouchableOpacity>

        {/* Mensagem / Comentários */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            video.onComment?.();
          }}
        >
          <MaterialCommunityIcons
            name="message-text-outline"
            size={28}
            color="white"
          />
          <Text style={styles.actionText}>{video.commentsCount}</Text>
        </TouchableOpacity>

        {/* Bookmark / Salvos */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            video.onSave?.();
          }}
        >
          <MaterialCommunityIcons
            name={video.savedByMe ? "bookmark" : "bookmark-outline"}
            size={28}
            color={video.savedByMe ? colors.tint : "white"}
          />
          <Text style={styles.actionText}>{video.savedByMe ? 1 : 0}</Text>
        </TouchableOpacity>

        {/* Compartilhar */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            video.onShare?.();
          }}
        >
          <MaterialCommunityIcons
            name="share-outline"
            size={28}
            color="white"
          />
          <Text style={styles.actionText}>Compartilhar</Text>
        </TouchableOpacity>
      </View>

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

        {!isImage ? (
          <View style={styles.musicContainer}>
            <MaterialCommunityIcons
              name="music"
              size={14}
              color="white"
              style={styles.musicIcon}
            />
            <Text style={styles.musicText} numberOfLines={1}>
              Áudio original • {video.publisherName}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 120, // Adjust to leave space for tabs & statusbar/header
    backgroundColor: "black",
    justifyContent: "flex-end",
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
    right: 6,
    bottom: 80,
    alignItems: "center",
    gap: 16,
    zIndex: 10,
  },
  avatarWrapper: {
    position: "relative",
    alignItems: "center",
    paddingBottom: 6,
    marginBottom: 8,
  },
  avatarContainer: {},
  followIconContainer: {
    position: "absolute",
    bottom: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "black",
    zIndex: 11,
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
