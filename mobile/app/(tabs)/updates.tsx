import { useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus, Sparkles } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { useUpdates } from "@/hooks/useUpdates";
import StoryBar from "@/components/StoryBar";
import FeedPost from "@/components/FeedPost";
import type { StoryGroup } from "@/services/updatesApi";

export default function UpdatesScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const skipNextFocusRefresh = useRef(true);
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

  const handleCreatePost = useCallback(() => {
    router.push("/create-post");
  }, [router]);

  const renderScreenHeader = useCallback(
    () => (
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Atualizações
        </Text>
        <TouchableOpacity
          onPress={handleCreatePost}
          hitSlop={12}
          accessibilityLabel="Criar post"
        >
          <Plus size={28} color={colors.tint} />
        </TouchableOpacity>
      </View>
    ),
    [colors.text, colors.tint, handleCreatePost],
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
        onShare={() => {}}
        onSave={() => toggleSave(item.id)}
        onVote={(optionId) => votePoll(item.id, optionId)}
      />
    ),
    [router, toggleLike, toggleSave, votePoll],
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

  if (feed.length === 0 && storyGroups.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderScreenHeader()}
        <StoryBar
          myAvatarUrl={myAvatarUrl}
          groups={[]}
          onMyStoryPress={handleMyStoryPress}
          onStoryPress={handleStoryPress}
        />
        <View style={styles.center}>
          <Sparkles
            size={56}
            color={colors.tint}
            style={{ marginBottom: 20 }}
          />
          <Text style={[styles.title, { color: colors.text }]}>
            Fique por dentro das novidades
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Toque em Seu status para publicar, ou siga contatos e canais para
            ver atualizações aqui.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderScreenHeader()}
      <FlatList
        data={feed}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        onRefresh={refresh}
        refreshing={refreshing}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
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
