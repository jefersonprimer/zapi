import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useSyncExternalStore,
  type RefObject,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Keyboard,
  Alert,
  Dimensions,
  Pressable,
} from "react-native";
import { TextInput as GestureHandlerTextInput } from "react-native-gesture-handler";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import * as updatesApi from "@/services/updatesApi";
import { uploadFile } from "@/services/api";
import type { Comment, FeedPost, PostAttachment } from "@/services/updatesApi";
import { getFullRemoteUrl } from "@/services/mediaCache";
import { ChatMediaSelector } from "@/components/ChatMediaSelector";

const SCREEN_HEIGHT = Dimensions.get("window").height;
/** Fixed open height so comments are visible without dragging up first. */
const COMMENTS_SHEET_SIZE = "70%";
const OPEN_SHEET_TOP = SCREEN_HEIGHT * 0.3;

interface CommentsModalProps {
  postId: string;
  visible: boolean;
  onClose: () => void;
}

type PreviewMedia = { uri: string; type: "image" | "video" };

type ThemeColors = ReturnType<typeof useAppTheme>["colors"];

type CommentsSheetStoreState = {
  colors: ThemeColors | null;
  insetsBottom: number;
  animatedPosition: SharedValue<number> | null;
  preview: PreviewMedia | null;
  previewLoading: boolean;
  text: string;
  showEmojiPicker: boolean;
  replyTo: { id: string; name: string } | null;
  sendingMedia: boolean;
  commenterAvatarUri: string | null;
  userLabel: string;
  inputRef: RefObject<GestureHandlerTextInput | null> | null;
  onClosePreview: () => void;
  onToggleEmojiPicker: () => void;
  onSend: () => void;
  onSendMedia: (media: {
    uri: string;
    name: string;
    mimeType: string;
  }) => Promise<void>;
  setText: (value: string) => void;
  setShowEmojiPicker: (value: boolean | ((prev: boolean) => boolean)) => void;
  setReplyTo: (value: { id: string; name: string } | null) => void;
};

/**
 * External store so portal-rendered footer/backdrop can subscribe without React context.
 * Stable footer/backdrop component identities prevent TextInput remounts on each keystroke.
 */
function createCommentsSheetStore() {
  let state: CommentsSheetStoreState = {
    colors: null,
    insetsBottom: 0,
    animatedPosition: null,
    preview: null,
    previewLoading: false,
    text: "",
    showEmojiPicker: false,
    replyTo: null,
    sendingMedia: false,
    commenterAvatarUri: null,
    userLabel: "",
    inputRef: null,
    onClosePreview: () => {},
    onToggleEmojiPicker: () => {},
    onSend: () => {},
    onSendMedia: async () => {},
    setText: () => {},
    setShowEmojiPicker: () => {},
    setReplyTo: () => {},
  };
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setState: (partial: Partial<CommentsSheetStoreState>) => {
      state = { ...state, ...partial };
      listeners.forEach((listener) => listener());
    },
  };
}

const commentsSheetStore = createCommentsSheetStore();

function useCommentsSheetStore() {
  return useSyncExternalStore(
    commentsSheetStore.subscribe,
    commentsSheetStore.getSnapshot,
  );
}

function PreviewVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    try {
      player.play();
    } catch {
      // The player can be released during fast open/close cycles.
    }
  }, [player]);

  return (
    <VideoView
      player={player}
      style={styles.previewMedia}
      contentFit="contain"
      nativeControls={false}
      pointerEvents="none"
    />
  );
}

function OutsidePreview({
  preview,
  loading,
  animatedPosition,
  onPress,
}: {
  preview: PreviewMedia | null;
  loading: boolean;
  animatedPosition: SharedValue<number>;
  onPress: () => void;
}) {
  const containerStyle = useAnimatedStyle(() => {
    const height = Math.max(animatedPosition.value, 0);

    return {
      height,
      opacity: interpolate(height, [0, 24], [0, 1], Extrapolation.CLAMP),
    };
  });

  const mediaStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      animatedPosition.value,
      [OPEN_SHEET_TOP, SCREEN_HEIGHT],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      borderBottomLeftRadius: interpolate(
        progress,
        [0, 1],
        [18, 0],
        Extrapolation.CLAMP,
      ),
      borderBottomRightRadius: interpolate(
        progress,
        [0, 1],
        [18, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(progress, [0, 1], [1.06, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.outsidePreview, containerStyle]}
      pointerEvents="box-none"
    >
      <Pressable style={styles.outsidePreviewPressable} onPress={onPress}>
        <Animated.View style={[styles.outsidePreviewMediaWrap, mediaStyle]}>
          {loading && !preview ? (
            <View style={styles.previewLoading}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : preview ? (
            preview.type === "video" ? (
              <PreviewVideo uri={preview.uri} />
            ) : (
              <Image
                source={{ uri: preview.uri }}
                style={styles.previewMedia}
                resizeMode="contain"
              />
            )
          ) : (
            <View style={styles.previewEmptyOutside}>
              <Ionicons name="chatbubble-outline" size={22} color="rgba(255,255,255,0.7)" />
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Stable identity — must not be recreated or the sheet remounts and kills keyboard focus. */
function CommentsSheetBackdrop(props: BottomSheetBackdropProps) {
  const state = useCommentsSheetStore();
  if (!state.colors || !state.animatedPosition) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <OutsidePreview
        preview={state.preview}
        loading={state.previewLoading}
        animatedPosition={state.animatedPosition}
        onPress={state.onClosePreview}
      />
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.28}
      />
    </View>
  );
}

/** Stable identity — updates via external store so typing does not remount the TextInput. */
function CommentsSheetFooter(props: BottomSheetFooterProps) {
  const state = useCommentsSheetStore();
  const colors = state.colors;
  if (!colors) return null;

  const initial = state.userLabel.trim().charAt(0).toUpperCase() || "?";

  return (
    <BottomSheetFooter {...props} bottomInset={state.insetsBottom}>
      <View style={[styles.footerWrap, { backgroundColor: colors.surface }]}>
        {state.replyTo && (
          <View
            style={[
              styles.replyBar,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
              },
            ]}
          >
            <Text
              style={[styles.replyBarText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              Respondendo para {state.replyTo.name}
            </Text>
            <TouchableOpacity onPress={() => state.setReplyTo(null)}>
              <Ionicons name="close-outline" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        <View
          style={[
            styles.inputAreaContainer,
            {
              backgroundColor: colors.surface,
              paddingBottom: state.showEmojiPicker ? 8 : 10,
            },
          ]}
        >
          <View style={[styles.inputBar, { borderTopColor: colors.border }]}>
            {state.commenterAvatarUri ? (
              <Image
                source={{ uri: state.commenterAvatarUri }}
                style={styles.inputAvatar}
              />
            ) : (
              <View
                style={[
                  styles.inputAvatarFallback,
                  { backgroundColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.commentAvatarInitial,
                    { color: colors.textSecondary },
                  ]}
                >
                  {initial}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.inputPill,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <TouchableOpacity
                onPress={state.onToggleEmojiPicker}
                style={styles.pillActionButton}
              >
                <Ionicons
                  name="happy-outline"
                  size={18}
                  color={state.showEmojiPicker ? colors.tint : colors.icon}
                />
              </TouchableOpacity>
              <BottomSheetTextInput
                ref={state.inputRef ?? undefined}
                style={[styles.input, { color: colors.text }]}
                placeholder="Escreva um comentário..."
                placeholderTextColor={colors.textSecondary}
                value={state.text}
                onChangeText={state.setText}
                multiline
                onFocus={() => {
                  state.setShowEmojiPicker((prev) => (prev ? false : prev));
                }}
              />
            </View>

            {state.text.trim().length > 0 && (
              <TouchableOpacity
                onPress={state.onSend}
                disabled={state.sendingMedia}
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: colors.tint,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="send-outline" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {state.showEmojiPicker && (
          <ChatMediaSelector
            onEmojiSelected={(emojiObject) =>
              state.setText(
                `${commentsSheetStore.getSnapshot().text}${emojiObject.emoji}`,
              )
            }
            onSendMedia={state.onSendMedia}
            height={260}
          />
        )}
      </View>
    </BottomSheetFooter>
  );
}

export default function CommentsModal({
  postId,
  visible,
  onClose,
}: CommentsModalProps) {
  const { colors } = useAppTheme();
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const inputRef = useRef<GestureHandlerTextInput | null>(null);
  const animatedPosition = useSharedValue(SCREEN_HEIGHT);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [preview, setPreview] = useState<PreviewMedia | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const snapPoints = useMemo(() => [COMMENTS_SHEET_SIZE], []);

  const fetchComments = useCallback(async () => {
    if (!token) return;
    try {
      const data = await updatesApi.getComments(token, postId);
      setComments(data);
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoading(false);
    }
  }, [token, postId]);

  const fetchPostPreview = useCallback(async () => {
    if (!token) return;
    setPreviewLoading(true);
    try {
      const post = (await updatesApi.getPost(token, postId)) as FeedPost;
      const attachments: PostAttachment[] = post.attachments ?? [];

      const isVideoAttachment = (att: PostAttachment) =>
        att.type === "video" || att.mime_type?.startsWith("video/") === true;
      const isImageAttachment = (att: PostAttachment) =>
        att.type === "image" ||
        att.type === "gif" ||
        att.mime_type?.startsWith("image/") === true ||
        att.mime_type?.startsWith("gif/") === true;

      const videoAttachment = attachments.find(isVideoAttachment);
      const imageAttachment = attachments.find(isImageAttachment);

      if (videoAttachment) {
        setPreview({
          uri: getFullRemoteUrl(videoAttachment.url),
          type: "video",
        });
        return;
      }

      if (imageAttachment) {
        setPreview({
          uri: getFullRemoteUrl(imageAttachment.url),
          type: "image",
        });
        return;
      }

      if (attachments[0]) {
        setPreview({
          uri: getFullRemoteUrl(attachments[0].url),
          type: "image",
        });
      } else {
        setPreview(null);
      }
    } catch (err) {
      console.error("Failed to load post preview:", err);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [token, postId]);

  useEffect(() => {
    if (!visible) {
      sheetRef.current?.dismiss();
      return;
    }

    if (!token) {
      setLoading(false);
      setPreviewLoading(false);
      return;
    }

    setLoading(true);
    setPreviewLoading(true);
    setComments([]);
    setText("");
    setReplyTo(null);
    setPreview(null);
    setShowEmojiPicker(false);

    sheetRef.current?.present();
    void fetchComments();
    void fetchPostPreview();
  }, [visible, token, fetchComments, fetchPostPreview]);

  const handleDismiss = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  const updateText = useCallback((value: string) => {
    setText(value);
    // Sync immediately so the portaled footer does not reset a controlled input mid-keystroke.
    commentsSheetStore.setState({ text: value });
  }, []);

  const handleSend = useCallback(async () => {
    const content = commentsSheetStore.getSnapshot().text.trim();
    if (!token || !content) return;
    updateText("");

    try {
      const data: { content: string; parent_id?: string } = { content };
      const currentReply = commentsSheetStore.getSnapshot().replyTo;
      if (currentReply) data.parent_id = currentReply.id;
      await updatesApi.addComment(token, postId, data);
      setReplyTo(null);
      await fetchComments();
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  }, [token, postId, fetchComments, updateText]);

  const handleToggleEmojiPicker = useCallback(() => {
    setShowEmojiPicker((prev) => {
      if (prev) {
        requestAnimationFrame(() => inputRef.current?.focus());
        return false;
      }

      Keyboard.dismiss();
      return true;
    });
  }, []);

  const handleSendMedia = useCallback(
    async (media: { uri: string; name: string; mimeType: string }) => {
      if (!token || sendingMedia) return;
      try {
        setSendingMedia(true);
        const uploaded = await uploadFile(
          token,
          media.uri,
          media.name,
          media.mimeType,
        );
        const payload: { content: string; parent_id?: string } = {
          content: uploaded.url,
        };
        if (replyTo) payload.parent_id = replyTo.id;
        await updatesApi.addComment(token, postId, payload);
        setReplyTo(null);
        setShowEmojiPicker(false);
        await fetchComments();
      } catch (err) {
        console.error("Failed to send comment media:", err);
        Alert.alert("Erro", "Nao foi possivel enviar a midia no comentario.");
      } finally {
        setSendingMedia(false);
      }
    },
    [token, sendingMedia, replyTo, postId, fetchComments],
  );

  const handleLike = useCallback(
    async (commentId: string) => {
      if (!token) return;
      try {
        await updatesApi.toggleCommentLike(token, postId, commentId);
        setComments((prev) =>
          prev.map((comment) => {
            if (comment.id === commentId) {
              return {
                ...comment,
                liked_by_me: !comment.liked_by_me,
                likes_count: comment.liked_by_me
                  ? comment.likes_count - 1
                  : comment.likes_count + 1,
              };
            }

            return {
              ...comment,
              replies: comment.replies.map((reply) =>
                reply.id === commentId
                  ? {
                      ...reply,
                      liked_by_me: !reply.liked_by_me,
                      likes_count: reply.liked_by_me
                        ? reply.likes_count - 1
                        : reply.likes_count + 1,
                    }
                  : reply,
              ),
            };
          }),
        );
      } catch {
        // Ignore optimistic toggle failures.
      }
    },
    [token, postId],
  );

  const parseImageUrlFromComment = useCallback((content: string) => {
    const trimmed = content.trim();
    const isUrl = /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/");
    if (!isUrl) return null;

    if (
      /\.(gif|png|jpe?g|webp|bmp|heic|heif|avif)(\?.*)?$/i.test(trimmed) ||
      /giphy\.com|giphyusercontent\.com/i.test(trimmed) ||
      trimmed.includes("/upload") ||
      trimmed.includes("/uploads") ||
      trimmed.includes("/stickers")
    ) {
      return getFullRemoteUrl(trimmed);
    }
    return null;
  }, []);

  const getInitial = useCallback((name?: string | null) => {
    return name?.trim().charAt(0).toUpperCase() || "?";
  }, []);

  const commenterAvatarUri = user?.avatar_url
    ? getFullRemoteUrl(user.avatar_url)
    : null;

  // Keep portal children in sync without changing footer/backdrop component identity.
  useEffect(() => {
    commentsSheetStore.setState({
      colors,
      insetsBottom: insets.bottom,
      animatedPosition,
      preview,
      previewLoading,
      text,
      showEmojiPicker,
      replyTo,
      sendingMedia,
      commenterAvatarUri,
      userLabel: user?.name || user?.username || "",
      inputRef,
      onClosePreview: handleDismiss,
      onToggleEmojiPicker: handleToggleEmojiPicker,
      onSend: handleSend,
      onSendMedia: handleSendMedia,
      setText: updateText,
      setShowEmojiPicker,
      setReplyTo,
    });
  }, [
    colors,
    insets.bottom,
    animatedPosition,
    preview,
    previewLoading,
    text,
    showEmojiPicker,
    replyTo,
    sendingMedia,
    commenterAvatarUri,
    user?.name,
    user?.username,
    handleDismiss,
    handleToggleEmojiPicker,
    handleSend,
    handleSendMedia,
    updateText,
  ]);

  const renderComment = useCallback(
    ({ item }: { item: Comment }) => {
      const commentMediaUrl = parseImageUrlFromComment(item.content);

      return (
        <View style={styles.commentContainer}>
          <View style={styles.commentMain}>
            {item.user_avatar ? (
              <Image
                source={{ uri: getFullRemoteUrl(item.user_avatar) }}
                style={styles.commentAvatar}
              />
            ) : (
              <View
                style={[
                  styles.commentAvatarFallback,
                  { backgroundColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.commentAvatarInitial,
                    { color: colors.textSecondary },
                  ]}
                >
                  {getInitial(item.user_name)}
                </Text>
              </View>
            )}

            <View style={styles.commentBody}>
              <View style={styles.commentContent}>
                <Text style={[styles.commentUser, { color: colors.text }]}>
                  {item.user_name}
                </Text>
                {commentMediaUrl ? (
                  <Image
                    source={{ uri: commentMediaUrl }}
                    style={styles.commentMedia}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={[styles.commentText, { color: colors.text }]}>
                    {item.content}
                  </Text>
                )}
              </View>

              <View style={styles.commentActions}>
                <TouchableOpacity
                  onPress={() =>
                    setReplyTo({ id: item.id, name: item.user_name })
                  }
                >
                  <Text
                    style={[styles.replyBtn, { color: colors.textSecondary }]}
                  >
                    Responder
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleLike(item.id)}
                  style={styles.likeBtn}
                >
                  <Ionicons
                    name={item.liked_by_me ? "heart" : "heart-outline"}
                    size={14}
                    color={item.liked_by_me ? colors.danger : colors.icon}
                  />
                  {item.likes_count > 0 && (
                    <Text
                      style={[
                        styles.likeCount,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {item.likes_count}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {item.replies.length > 0 && (
            <View style={styles.replyGroup}>
              {item.replies.map((reply) => {
                const replyMediaUrl = parseImageUrlFromComment(reply.content);

                return (
                  <View key={reply.id} style={styles.replyContainer}>
                    <View
                      style={[
                        styles.replyLine,
                        { backgroundColor: colors.border },
                      ]}
                    />
                    {reply.user_avatar ? (
                      <Image
                        source={{ uri: getFullRemoteUrl(reply.user_avatar) }}
                        style={styles.replyAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.replyAvatarFallback,
                          { backgroundColor: colors.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.commentAvatarInitial,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {getInitial(reply.user_name)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.replyContent}>
                      <Text
                        style={[styles.commentUser, { color: colors.text }]}
                      >
                        {reply.user_name}
                      </Text>
                      {replyMediaUrl ? (
                        <Image
                          source={{ uri: replyMediaUrl }}
                          style={styles.replyMedia}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text
                          style={[styles.commentText, { color: colors.text }]}
                        >
                          {reply.content}
                        </Text>
                      )}

                      <View style={styles.commentActions}>
                        <TouchableOpacity
                          onPress={() =>
                            setReplyTo({ id: reply.id, name: reply.user_name })
                          }
                        >
                          <Text
                            style={[
                              styles.replyBtn,
                              { color: colors.textSecondary },
                            ]}
                          >
                            Responder
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleLike(reply.id)}
                          style={styles.likeBtn}
                        >
                          <Ionicons
                            name={reply.liked_by_me ? "heart" : "heart-outline"}
                            size={14}
                            color={
                              reply.liked_by_me ? colors.danger : colors.icon
                            }
                          />
                          {reply.likes_count > 0 && (
                            <Text
                              style={[
                                styles.likeCount,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {reply.likes_count}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      );
    },
    [colors, getInitial, handleLike, parseImageUrlFromComment],
  );

  if (!visible) return null;

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      animatedPosition={animatedPosition}
      backdropComponent={CommentsSheetBackdrop}
      onDismiss={onClose}
      footerComponent={CommentsSheetFooter}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enableBlurKeyboardOnGesture
    >
      <BottomSheetView
        style={[styles.sheetContent, { backgroundColor: colors.surface }]}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          {/* Left spacer to balance the close button on the right */}
          <View style={{ width: 22 }} />

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Comentários
              {comments.length > 0 && (
                <Text
                  style={[
                    styles.commentsCount,
                    { color: colors.textSecondary },
                  ]}
                >
                  {" "}
                  {comments.length}
                </Text>
              )}
            </Text>
          </View>

          <TouchableOpacity onPress={handleDismiss} hitSlop={12}>
            <Ionicons name="close-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={colors.tint} />
          </View>
        ) : (
          <BottomSheetFlatList
            style={styles.list}
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={renderComment}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  Nenhum comentário ainda. Seja o primeiro a comentar!
                </Text>
              </View>
            }
            ListFooterComponent={
              <View
                style={{
                  height:
                    80 +
                    (replyTo ? 40 : 0) +
                    (showEmojiPicker ? 260 : 0) +
                    insets.bottom,
                }}
              />
            }
          />
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "500",
  },
  commentsCount: {
    fontSize: 16,
    fontWeight: "500",
  },
  outsidePreview: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    overflow: "hidden",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  outsidePreviewPressable: {
    flex: 1,
  },
  outsidePreviewMediaWrap: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  previewMedia: {
    ...StyleSheet.absoluteFillObject,
  },
  previewLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  previewEmptyOutside: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  center: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  list: {
    flex: 1,
  },
  commentContainer: {
    marginBottom: 16,
  },
  commentMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  commentBody: {
    flex: 1,
  },
  commentContent: {
    marginBottom: 4,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginTop: 1,
  },
  commentAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  commentAvatarInitial: {
    fontSize: 12,
    fontWeight: "700",
  },
  commentUser: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentMedia: {
    width: 190,
    height: 190,
    borderRadius: 12,
    marginTop: 2,
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 4,
  },
  replyBtn: {
    fontSize: 13,
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  likeCount: {
    fontSize: 12,
  },
  replyGroup: {
    marginTop: 8,
    marginLeft: 16,
  },
  replyContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  replyLine: {
    width: 2,
    marginRight: 12,
    marginTop: 2,
    minHeight: 26,
  },
  replyAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginRight: 8,
    marginTop: 1,
  },
  replyAvatarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    marginTop: 1,
  },
  replyContent: {
    flex: 1,
  },
  replyMedia: {
    width: 150,
    height: 150,
    borderRadius: 10,
    marginTop: 2,
  },
  footerWrap: {
    width: "100%",
  },
  replyBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyBarText: {
    fontSize: 13,
    flex: 1,
    paddingRight: 12,
  },
  inputAreaContainer: {
    width: "100%",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  inputAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  inputPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 42,
    maxHeight: 110,
    paddingLeft: 4,
    paddingRight: 12,
  },
  pillActionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 2,
    fontSize: 14,
    maxHeight: 95,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
