import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAppTheme } from "@/context/ThemeContext";
import { useUpdates } from "@/hooks/useUpdates";
import StoryBar from "@/components/StoryBar";
import FeedPost from "@/components/FeedPost";
import ReelsFeed from "@/components/ReelsFeed";
import type { StoryGroup } from "@/services/updatesApi";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ShareBottomSheet } from "@/components/ShareBottomSheet";
import SkeletonFeedPost from "@/components/SkeletonFeedPost";

export default function UpdatesScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const skipNextFocusRefresh = useRef(true);
  const [activeTab, setActiveTab] = useState<"feed" | "reels">("feed");
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const {
    storyGroups,
    feed,
    isLoading,
    isLoadingMore,
    refreshing,
    myAvatarUrl,
    refresh,
    loadMore,
    toggleLike,
    toggleSave,
    votePoll,
  } = useUpdates();

  useFocusEffect(
    useCallback(() => {
      if (skipNextFocusRefresh.current) {
        skipNextFocusRefresh.current = false;
        return;
      }
      refresh();
    }, [refresh]),
  );

  const handleStoryPress = useCallback(
    (group: StoryGroup) => {
      router.push({
        pathname: "/story-viewer",
        params: {
          publisherId: group.publisher_id,
          publisherName: group.publisher_name,
        },
      });
    },
    [router],
  );

  const handleMyStoryPress = useCallback(() => {
    router.push("/create-story");
  }, [router]);

  const handleCreateContent = useCallback(() => {
    router.push("/create-content");
  }, [router]);

  const renderScreenHeader = useCallback(
    () => (
      <View
        style={[
          styles.header,
          activeTab === "reels"
            ? styles.reelsHeader
            : { backgroundColor: colors.headerBackground },
        ]}
      >
        <View style={styles.tabContainer}>
          <TouchableOpacity
            onPress={() => setActiveTab("feed")}
            style={[
              styles.tabButton,
              activeTab === "feed" && styles.activeTabButton,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "feed"
                      ? activeTab === "feed" && colors.tint
                        ? colors.tint
                        : colors.text
                      : colors.textSecondary,
                },
                activeTab === "feed" && styles.activeTabText,
              ]}
            >
              Atualizações
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("reels")}
            style={[
              styles.tabButton,
              activeTab === "reels" && styles.activeTabButton,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === "reels" ? "white" : colors.textSecondary,
                },
                activeTab === "reels" && styles.activeTabText,
              ]}
            >
              Clips
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={handleCreateContent}
          hitSlop={12}
          accessibilityLabel="Criar conteúdo"
        >
          <MaterialCommunityIcons
            name="plus"
            size={28}
            color={activeTab === "reels" ? "white" : colors.text}
          />
        </TouchableOpacity>
      </View>
    ),
    [
      colors.text,
      colors.textSecondary,
      colors.tint,
      colors.headerBackground,
      handleCreateContent,
      activeTab,
    ],
  );

  const renderHeader = useCallback(
    () => (
      <StoryBar
        myAvatarUrl={myAvatarUrl}
        groups={storyGroups}
        onMyStoryPress={handleMyStoryPress}
        onStoryPress={handleStoryPress}
      />
    ),
    [storyGroups, myAvatarUrl, handleMyStoryPress, handleStoryPress],
  );

  const renderPost = useCallback(
    ({ item }: { item: (typeof feed)[0] }) => (
      <FeedPost
        post={item}
        onHeaderPress={() =>
          router.push({
            pathname: "/publisher-profile",
            params: { publisherId: item.publisher_id },
          })
        }
        onMenuPress={() => {}}
        onLike={() => toggleLike(item.id)}
        onComment={() =>
          router.push({
            pathname: "/comments-modal",
            params: { postId: item.id },
          })
        }
        onShare={() => {
          setActivePostId(item.id);
          requestAnimationFrame(() => {
            shareSheetRef.current?.present();
          });
        }}
        onSave={() => toggleSave(item.id)}
        onVote={(optionId) => votePoll(item.id, optionId)}
      />
    ),
    [router, toggleLike, toggleSave, votePoll, setActivePostId],
  );

  const renderFooter = useCallback(
    () =>
      isLoadingMore ? (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.tint} />
        </View>
      ) : null,
    [isLoadingMore, colors.tint],
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderScreenHeader()}
        <View style={styles.list}>
          <StoryBar
            myAvatarUrl={null}
            groups={[]}
            onMyStoryPress={handleMyStoryPress}
            onStoryPress={handleStoryPress}
          />
          <SkeletonFeedPost />
          <SkeletonFeedPost />
          <SkeletonFeedPost />
        </View>
      </View>
    );
  }

  const feedPostsOnly = feed.filter((post) => post.type !== "clip");

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: activeTab === "reels" ? "black" : colors.background,
        },
      ]}
    >
      {renderScreenHeader()}

      {activeTab === "reels" ? (
        <ReelsFeed />
      ) : feedPostsOnly.length === 0 && storyGroups.length === 0 ? (
        <View style={styles.container}>
          <StoryBar
            myAvatarUrl={myAvatarUrl}
            groups={[]}
            onMyStoryPress={handleMyStoryPress}
            onStoryPress={handleStoryPress}
          />
          <View style={styles.center}>
            <Text style={[styles.title, { color: colors.text }]}>
              Fique por dentro das novidades
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Toque em Seu status para publicar, ou siga contatos e canais para
              ver atualizações aqui.
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={feedPostsOnly}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          onRefresh={refresh}
          refreshing={refreshing}
          onEndReached={loadMore}
          onEndReachedThreshold={0.2}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={11}
          removeClippedSubviews={true}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      )}
      {activePostId !== null && (
        <ShareBottomSheet
          ref={shareSheetRef}
          clipId={activePostId}
          shareUrl={`https://zapi.app/post/${activePostId}`}
          onDismiss={() => setActivePostId(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  reelsHeader: {
    borderBottomWidth: 0,
    backgroundColor: "transparent",
    elevation: 0,
    shadowOpacity: 0,
  },
  tabContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  tabButton: {
    paddingVertical: 4,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: "#07C160",
  },
  tabText: {
    fontSize: 22,
    fontWeight: "400",
  },
  activeTabText: {
    fontWeight: "500",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  list: {
    paddingBottom: 20,
  },
  footer: {
    paddingVertical: 16,
  },
});
