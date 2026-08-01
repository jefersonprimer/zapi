import { useState, useCallback } from "react";
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  FlatList,
  Dimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import type { PostAttachment } from "@/services/updatesApi";
import { getFullRemoteUrl } from "@/services/mediaCache";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const SCREEN_WIDTH = Dimensions.get("window").width;

// Instagram feed limits: portrait up to 4:5, landscape up to 1.91:1
const MIN_ASPECT_RATIO = 4 / 5;
const MAX_ASPECT_RATIO = 1.91;

interface AttachmentGridProps {
  attachments: PostAttachment[];
}

interface FullscreenState {
  uri: string;
  isVideo: boolean;
}

interface MediaVideoProps {
  uri: string;
  isFullScreen: boolean;
}

function mediaUri(url: string) {
  return getFullRemoteUrl(url);
}

function isVideoAttachment(att: PostAttachment) {
  return att.type === "video" || att.mime_type?.startsWith("video/") === true;
}

function getInstagramAspectRatio(att: PostAttachment): number {
  const isVideo = isVideoAttachment(att);
  if (att.width && att.height && att.height > 0) {
    const raw = att.width / att.height;
    const minRatio = isVideo ? 1.0 : MIN_ASPECT_RATIO;
    return Math.min(Math.max(raw, minRatio), MAX_ASPECT_RATIO);
  }
  return isVideo ? 16 / 9 : 1;
}

function MediaVideo({ uri, isFullScreen }: MediaVideoProps) {
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = false;
    if (isFullScreen) {
      playerInstance.play();
    } else {
      playerInstance.pause();
    }
  });

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit={isFullScreen ? "contain" : "cover"}
      nativeControls={isFullScreen}
    />
  );
}

interface MediaTileProps {
  attachment: PostAttachment;
  width: number;
  aspectRatio: number;
  onPress: () => void;
}

function MediaTile({
  attachment,
  width,
  aspectRatio,
  onPress,
}: MediaTileProps) {
  const isVideo = isVideoAttachment(attachment);
  const fullUri = mediaUri(attachment.url);
  const previewUri = mediaUri(
    isVideo && attachment.thumbnail_url
      ? attachment.thumbnail_url
      : attachment.url,
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.95}
      style={[styles.mediaTile, { width, aspectRatio }]}
    >
      {isVideo ? (
        <>
          {attachment.thumbnail_url ? (
            <Image
              source={{ uri: previewUri }}
              style={styles.fill}
              resizeMode="cover"
            />
          ) : (
            <MediaVideo uri={fullUri} isFullScreen={false} />
          )}
          <View style={styles.playOverlay}>
            <MaterialCommunityIcons
              name="play"
              size={36}
              color="#fff"
              fill="#fff"
            />
          </View>
        </>
      ) : (
        <Image
          source={{ uri: previewUri }}
          style={styles.fill}
          resizeMode="cover"
        />
      )}
    </TouchableOpacity>
  );
}

export default function AttachmentGrid({ attachments }: AttachmentGridProps) {
  const [fullscreen, setFullscreen] = useState<FullscreenState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const openFullscreen = (attachment: PostAttachment) => {
    setFullscreen({
      uri: mediaUri(attachment.url),
      isVideo: isVideoAttachment(attachment),
    });
  };

  const onCarouselScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setActiveIndex(index);
    },
    [],
  );

  if (attachments.length === 0) return null;

  const carouselAspectRatio = getInstagramAspectRatio(attachments[0]);

  if (attachments.length === 1) {
    const att = attachments[0];
    return (
      <>
        <MediaTile
          attachment={att}
          width={SCREEN_WIDTH}
          aspectRatio={getInstagramAspectRatio(att)}
          onPress={() => openFullscreen(att)}
        />
        <MediaFullscreenModal
          fullscreen={fullscreen}
          onClose={() => setFullscreen(null)}
        />
      </>
    );
  }

  return (
    <>
      <View style={styles.carouselWrap}>
        <FlatList
          data={attachments}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          onMomentumScrollEnd={onCarouselScroll}
          renderItem={({ item }) => (
            <MediaTile
              attachment={item}
              width={SCREEN_WIDTH}
              aspectRatio={carouselAspectRatio}
              onPress={() => openFullscreen(item)}
            />
          )}
        />
        <View style={styles.dots} pointerEvents="none">
          {attachments.map((att, i) => (
            <View
              key={att.id}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      </View>
      <MediaFullscreenModal
        fullscreen={fullscreen}
        onClose={() => setFullscreen(null)}
      />
    </>
  );
}

function MediaFullscreenModal({
  fullscreen,
  onClose,
}: {
  fullscreen: FullscreenState | null;
  onClose: () => void;
}) {
  if (!fullscreen) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBackground}>
          <SafeAreaView style={styles.modalSafeArea}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                {fullscreen.isVideo ? (
                  <MediaVideo uri={fullscreen.uri} isFullScreen />
                ) : (
                  <Image
                    source={{ uri: fullscreen.uri }}
                    style={styles.fullImage}
                    resizeMode="contain"
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </SafeAreaView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mediaTile: {
    overflow: "hidden",
    backgroundColor: "#000",
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  carouselWrap: {
    position: "relative",
  },
  dots: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  dotActive: {
    backgroundColor: "#fff",
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalSafeArea: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 20 : 40,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 10,
    borderRadius: 25,
  },
  modalContent: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
});
