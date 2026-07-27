import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  ActivityIndicator,
  ViewToken,
} from "react-native";
import { useRouter } from "expo-router";
import { useUpdates } from "@/hooks/useUpdates";
import ReelsItem, { ReelsVideo } from "./ReelsItem";
import { getFullRemoteUrl } from "@/services/mediaCache";
import { useAppTheme } from "@/context/ThemeContext";

// Reliable fallback videos for Reels presentation
const MOCK_REELS: ReelsVideo[] = [
  {
    id: "mock-1",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-in-tokyo-39740-large.mp4",
    caption: "Explorando as luzes de Tokyo! 🗼✨ #travel #tokyo #neon",
    publisherName: "tokyotraveller",
    publisherAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop",
    likesCount: 1240,
    commentsCount: 89,
    sharesCount: 45,
    likedByMe: false,
    savedByMe: false,
  },
  {
    id: "mock-2",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-holding-a-smartphone-showing-a-social-media-app-51787-large.mp4",
    caption: "Conectando pessoas através de experiências digitais! 📱💡 #design #ux #mobile",
    publisherName: "uxdesigner",
    publisherAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop",
    likesCount: 948,
    commentsCount: 42,
    sharesCount: 12,
    likedByMe: false,
    savedByMe: false,
  },
  {
    id: "mock-3",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-man-dancing-under-neon-lights-40075-large.mp4",
    caption: "Sinta a batida! Dança sob as luzes neon. 🕺🔥 #dance #neon #vibes",
    publisherName: "dance_creators",
    publisherAvatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&auto=format&fit=crop",
    likesCount: 2043,
    commentsCount: 154,
    likedByMe: false,
    savedByMe: false,
  },
];

export default function ReelsFeed() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { feed, toggleLike, toggleSave } = useUpdates();
  const [reelsList, setReelsList] = useState<ReelsVideo[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    // Extract feed posts containing videos
    const videoPosts: ReelsVideo[] = feed
      .filter((post) => {
        return post.type === "clip";
      })
      .map((post) => {
        const videoAttachment = post.attachments?.find(
          (att) =>
            att.type === "video" ||
            att.mime_type?.startsWith("video/") === true
        );
        return {
          id: post.id,
          videoUrl: videoAttachment ? getFullRemoteUrl(videoAttachment.url) : "",
          caption: post.content || undefined,
          publisherId: post.publisher_id,
          publisherName: post.publisher_name,
          publisherAvatar: post.publisher_avatar
            ? getFullRemoteUrl(post.publisher_avatar)
            : null,
          likesCount: post.likes_count,
          commentsCount: post.comments_count,
          likedByMe: post.liked_by_me,
          savedByMe: post.saved_by_me,
          onLike: () => toggleLike(post.id),
          onSave: () => toggleSave(post.id),
          onComment: () =>
            router.push({
              pathname: "/comments-modal",
              params: { postId: post.id },
            }),
          onProfilePress: () =>
            router.push({
              pathname: "/publisher-profile",
              params: { publisherId: post.publisher_id },
            }),
        };
      });

    // Merge backend video posts first, then fallback mocks
    // Also attach interaction functions for mock posts
    const mappedMocks: ReelsVideo[] = MOCK_REELS.map((mock) => {
      return {
        ...mock,
        onLike: () => {
          setReelsList((prev) =>
            prev.map((item) =>
              item.id === mock.id
                ? {
                    ...item,
                    likedByMe: !item.likedByMe,
                    likesCount: item.likedByMe
                      ? item.likesCount - 1
                      : item.likesCount + 1,
                  }
                : item
            )
          );
        },
        onSave: () => {
          setReelsList((prev) =>
            prev.map((item) =>
              item.id === mock.id
                ? { ...item, savedByMe: !item.savedByMe }
                : item
            )
          );
        },
        onComment: () => {
          // Open comments for this mock or show a standard view
          router.push({
            pathname: "/comments-modal",
            params: { postId: mock.id },
          });
        },
        onProfilePress: () => {
          // Standard dummy profile action
        },
      };
    });

    setReelsList([...videoPosts, ...mappedMocks]);
  }, [feed, toggleLike, toggleSave, router]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: ReelsVideo; index: number }) => (
      <ReelsItem
        video={item}
        isActive={index === activeIndex}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />
    ),
    [activeIndex, isMuted, handleToggleMute]
  );

  if (reelsList.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reelsList}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={1}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
