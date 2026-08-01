import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import FeedPostCard from "@/components/FeedPost";
import * as updatesApi from "@/services/updatesApi";
import type { FeedPost } from "@/services/updatesApi";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function SavedPostsScreen() {
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await updatesApi.getSavedPosts(token);
        setPosts(data);
      } catch (err) {
        console.error("Failed to load saved posts:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const renderPost = useCallback(
    ({ item }: { item: FeedPost }) => (
      <FeedPostCard
        post={item}
        onHeaderPress={() => {}}
        onMenuPress={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onShare={() => {}}
        onSave={() => {}}
        onVote={() => {}}
      />
    ),
    [],
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
        <MaterialCommunityIcons
          name="arrow-left"
          size={24}
          color={colors.text}
          onPress={() => router.back()}
        />
        <Text style={[styles.title, { color: colors.text }]}>Posts salvos</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons
            name="bookmark"
            size={48}
            color={colors.icon}
          />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Nenhum post salvo
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { fontSize: 16 },
  list: { paddingVertical: 8 },
});
