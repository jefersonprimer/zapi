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
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ShareBottomSheet } from "./ShareBottomSheet";

export default function ReelsFeed() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { feed, toggleLike, toggleSave } = useUpdates();
  const [reelsList, setReelsList] = useState<ReelsVideo[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

  const shareSheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    const clipPosts: ReelsVideo[] = feed
      .filter((post) => post.type === "clip")
      .map((post) => {
        const videoAttachment = post.attachments?.find(
          (att) =>
            att.type === "video" ||
            att.mime_type?.startsWith("video/") === true
        );
        const imageAttachment = post.attachments?.find(
          (att) =>
            att.type === "image" ||
            att.type === "gif" ||
            att.mime_type?.startsWith("image/") === true
        );
        const mediaAttachment = videoAttachment ?? imageAttachment;
        const mediaType: "video" | "image" = videoAttachment ? "video" : "image";

        return {
          id: post.id,
          mediaUrl: mediaAttachment ? getFullRemoteUrl(mediaAttachment.url) : "",
          mediaType,
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
          onShare: () => {
            setActiveClipId(post.id);
            shareSheetRef.current?.present();
          },
          onProfilePress: () =>
            router.push({
              pathname: "/publisher-profile",
              params: { publisherId: post.publisher_id },
            }),
        };
      })
      .filter((item) => !!item.mediaUrl);

    setReelsList(clipPosts);
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
      <ShareBottomSheet ref={shareSheetRef} clipId={activeClipId || ""} />
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
