import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CheckCircle, Play, FileText } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useUpdates } from "@/hooks/useUpdates";
import FeedPost from "@/components/FeedPost";
import * as updatesApi from "@/services/updatesApi";
import type {
  Publisher,
  FeedPost as FeedPostType,
} from "@/services/updatesApi";
import { getFullRemoteUrl } from "@/services/mediaCache";

const PAGE_SIZE = 12;
const COLS = 3;
const GAP = 2;
const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - GAP * (COLS + 1)) / COLS;
const GRID_ITEM_HEIGHT = GRID_ITEM_SIZE * 1.35;

function formatFollowers(count: number): string {
  if (count === 1) return "1 seguidor";
  return `${count.toLocaleString("pt-BR")} seguidores`;
}

function formatFollowing(count: number): string {
  if (count === 1) return "1 seguindo";
  return `${count.toLocaleString("pt-BR")} seguindo`;
}

function formatPostsCount(count: number): string {
  if (count === 1) return "1 publicação";
  return `${count} publicações`;
}

function getPreviewAttachment(post: FeedPostType) {
  return post.attachments.find(
    (a) =>
      a.type === "image" ||
      a.type === "gif" ||
      a.type === "video" ||
      a.mime_type?.startsWith("image/") ||
      a.mime_type?.startsWith("video/"),
  );
}

function isVideoAttachment(type: string, mimeType: string | null) {
  return type === "video" || mimeType?.startsWith("video/") === true;
}

function PostGridItem({
  post,
  onPress,
  colors,
}: {
  post: FeedPostType;
  onPress: () => void;
  colors: { textSecondary: string; surface: string };
}) {
  const att = getPreviewAttachment(post);
  const isVideo = att ? isVideoAttachment(att.type, att.mime_type) : false;
  const previewUri = att
    ? getFullRemoteUrl(
        isVideo && att.thumbnail_url ? att.thumbnail_url : att.url,
      )
    : null;

  return (
    <TouchableOpacity
      style={[
        styles.gridItem,
        { width: GRID_ITEM_SIZE, height: GRID_ITEM_HEIGHT },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {previewUri ? (
        <>
          <Image
            source={{ uri: previewUri }}
            style={styles.gridImage}
            resizeMode="cover"
          />
          {isVideo && (
            <View style={styles.videoBadge}>
              <Play size={16} color="#fff" fill="#fff" />
            </View>
          )}
          {post.attachments.length > 1 && (
            <View style={styles.multiBadge}>
              <Text style={styles.multiBadgeText}>
                {post.attachments.length}
              </Text>
            </View>
          )}
        </>
      ) : (
        <View
          style={[styles.textPlaceholder, { backgroundColor: colors.surface }]}
        >
          <FileText size={24} color={colors.textSecondary} />
          {post.content ? (
            <Text
              style={[
                styles.textPlaceholderLabel,
                { color: colors.textSecondary },
              ]}
              numberOfLines={4}
            >
              {post.content}
            </Text>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function PublisherProfileScreen() {
  const { publisherId } = useLocalSearchParams<{ publisherId: string }>();
  const { colors, isDark } = useAppTheme();
  const { token, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toggleFollow } = useUpdates();
  const [publisher, setPublisher] = useState<Publisher | null>(null);
  const [posts, setPosts] = useState<FeedPostType[]>([]);
  const [selectedPost, setSelectedPost] = useState<FeedPostType | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<"posts" | "clips">("posts");

  const loadPosts = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (!token || !publisherId) return;
      if (pageNum > 1) setLoadingMore(true);
      try {
        const data = await updatesApi.getPublisherPosts(
          token,
          publisherId,
          pageNum,
          PAGE_SIZE,
        );
        setPosts((prev) => (replace ? data : [...prev, ...data]));
        setHasMore(data.length === PAGE_SIZE);
        setPage(pageNum);
      } catch (err) {
        console.error("Failed to load publisher posts:", err);
      } finally {
        setLoadingMore(false);
      }
    },
    [token, publisherId],
  );

  useEffect(() => {
    if (!token || !publisherId) return;
    (async () => {
      try {
        const data = await updatesApi.getPublisher(token, publisherId);
        setPublisher(data);
        setIsFollowing(!!data.is_following);
        await loadPosts(1, true);
      } catch (err) {
        console.error("Failed to load publisher:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, publisherId, loadPosts]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    loadPosts(page + 1, false);
  }, [loadingMore, hasMore, loading, page, loadPosts]);

  const handleFollow = async () => {
    if (!publisherId || toggling) return;
    const prev = isFollowing;
    setIsFollowing(!prev);
    setToggling(true);
    try {
      const following = await toggleFollow(publisherId);
      setIsFollowing(following);
      if (publisher) {
        setPublisher({
          ...publisher,
          followers_count: Math.max(
            0,
            (publisher.followers_count ?? 0) + (following ? 1 : -1),
          ),
        });
      }
    } catch {
      setIsFollowing(prev);
    } finally {
      setToggling(false);
    }
  };

  const handlePostLike = async (postId: string) => {
    if (!token) return;
    const prev = posts.find((p) => p.id === postId);
    if (!prev) return;
    const nextLiked = !prev.liked_by_me;
    setPosts((list) =>
      list.map((p) =>
        p.id === postId
          ? {
              ...p,
              liked_by_me: nextLiked,
              likes_count: p.likes_count + (nextLiked ? 1 : -1),
            }
          : p,
      ),
    );
    if (selectedPost?.id === postId) {
      setSelectedPost((p) =>
        p
          ? {
              ...p,
              liked_by_me: nextLiked,
              likes_count: p.likes_count + (nextLiked ? 1 : -1),
            }
          : p,
      );
    }
    try {
      await updatesApi.toggleLike(token, postId);
    } catch {
      setPosts((list) => list.map((p) => (p.id === postId ? prev : p)));
      if (selectedPost?.id === postId) setSelectedPost(prev);
    }
  };

  const handlePostSave = async (postId: string) => {
    if (!token) return;
    const prev = posts.find((p) => p.id === postId);
    if (!prev) return;
    const nextSaved = !prev.saved_by_me;
    setPosts((list) =>
      list.map((p) => (p.id === postId ? { ...p, saved_by_me: nextSaved } : p)),
    );
    if (selectedPost?.id === postId) {
      setSelectedPost((p) => (p ? { ...p, saved_by_me: nextSaved } : p));
    }
    try {
      await updatesApi.toggleSave(token, postId);
    } catch {
      setPosts((list) => list.map((p) => (p.id === postId ? prev : p)));
      if (selectedPost?.id === postId) setSelectedPost(prev);
    }
  };

  const displayedPosts = useMemo(() => {
    return posts.filter((p) => {
      if (activeTab === "clips") {
        return p.type === "clip";
      }
      return p.type !== "clip";
    });
  }, [posts, activeTab]);

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!publisher) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={{ color: colors.text }}>Publisher não encontrado</Text>
      </View>
    );
  }

  const avatarUri = publisher.avatar_url
    ? getFullRemoteUrl(publisher.avatar_url)
    : null;

  const isOwnProfile =
    publisher.type === "user" &&
    !!user?.user_id &&
    publisher.ref_id === user.user_id;

  const renderHeader = () => (
    <View style={styles.profileSection}>
      <Image
        source={
          avatarUri ? { uri: avatarUri } : require("@/assets/images/icon.png")
        }
        style={styles.avatar}
      />
      <View style={styles.nameRow}>
        <Text style={[styles.name, { color: colors.text }]}>
          {publisher.name}
        </Text>
        <Text style={[styles.username, { color: colors.textSecondary }]}>
          @{publisher.username}
        </Text>
        {publisher.is_verified && (
          <CheckCircle size={20} color={isDark ? "#60A5FA" : "#3B82F6"} />
        )}
      </View>
      <Text style={[styles.typeLabel, { color: colors.textSecondary }]}>
        {publisher.type === "channel"
          ? "Canal"
          : publisher.type === "business"
            ? "Loja"
            : ""}
      </Text>
      <Text style={[styles.followersCount, { color: colors.text }]}>
        {formatPostsCount(posts.length)} ·{" "}
        {formatFollowers(publisher.followers_count ?? 0)} ·{" "}
        {formatFollowing(publisher.following_count ?? 0)}
      </Text>
      {!isOwnProfile && (
        <TouchableOpacity
          style={[
            styles.followButton,
            {
              backgroundColor: isFollowing ? colors.surface : colors.tint,
              borderColor: isFollowing ? colors.border : "transparent",
            },
          ]}
          onPress={handleFollow}
          disabled={toggling}
        >
          <Text
            style={[
              styles.followText,
              { color: isFollowing ? colors.text : "white" },
            ]}
          >
            {isFollowing ? "Seguindo" : "Seguir"}
          </Text>
        </TouchableOpacity>
      )}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "posts" && styles.activeTabItem]}
          onPress={() => setActiveTab("posts")}
        >
          <Text style={[styles.tabText, { color: activeTab === "posts" ? colors.text : colors.textSecondary }]}>
            Publicações
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "clips" && styles.activeTabItem]}
          onPress={() => setActiveTab("clips")}
        >
          <Text style={[styles.tabText, { color: activeTab === "clips" ? colors.text : colors.textSecondary }]}>
            Clips
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.headerBackground,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Perfil</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={displayedPosts}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        columnWrapperStyle={displayedPosts.length > 0 ? styles.gridRow : undefined}
        renderItem={({ item }) => (
          <PostGridItem
            post={item}
            colors={colors}
            onPress={() => setSelectedPost(item)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <Text style={[styles.emptyPosts, { color: colors.textSecondary }]}>
            {activeTab === "posts" ? "Nenhuma publicação ainda" : "Nenhum clip ainda"}
          </Text>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.tint} />
            </View>
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />

      <Modal
        visible={!!selectedPost}
        animationType="slide"
        onRequestClose={() => setSelectedPost(null)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              {
                paddingTop: insets.top + 8,
                backgroundColor: colors.headerBackground,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity onPress={() => setSelectedPost(null)}>
              <ArrowLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>
              Publicação
            </Text>
            <View style={{ width: 24 }} />
          </View>
          {selectedPost && (
            <FeedPost
              post={selectedPost}
              onHeaderPress={() => {}}
              onMenuPress={() => {}}
              onLike={() => handlePostLike(selectedPost.id)}
              onComment={() =>
                router.push({
                  pathname: "/comments-modal",
                  params: { postId: selectedPost.id },
                })
              }
              onShare={() => {}}
              onSave={() => handlePostSave(selectedPost.id)}
              onVote={() => {}}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "600" },
  listContent: { paddingHorizontal: GAP, paddingBottom: 24 },
  profileSection: { alignItems: "center", paddingTop: 24, gap: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  nameRow: { flexDirection: "column", alignItems: "center", gap: 6 },
  name: { fontSize: 22, fontWeight: "bold" },
  username: { fontSize: 15 },
  typeLabel: { fontSize: 14 },
  followersCount: { fontSize: 16, fontWeight: "600" },
  followButton: {
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 4,
  },
  followText: { fontSize: 15, fontWeight: "600" },
  tabBar: {
    flexDirection: "row",
    width: "100%",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  activeTabItem: {
    borderBottomWidth: 2,
    borderBottomColor: "#07C160",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: GAP,
    marginBottom: GAP,
  },
  gridItem: {
    overflow: "hidden",
    backgroundColor: "#000",
    borderRadius: 8,
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  videoBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    padding: 4,
  },
  multiBadge: {
    position: "absolute",
    top: 8,
    right: 32,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  multiBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  textPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
    gap: 6,
  },
  textPlaceholderLabel: { fontSize: 11, textAlign: "center" },
  emptyPosts: {
    textAlign: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  footerLoader: { paddingVertical: 20 },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
