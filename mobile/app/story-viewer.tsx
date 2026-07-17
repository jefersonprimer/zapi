import { useEffect, useState, useCallback } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import StoryViewer from "@/components/StoryViewer";
import * as updatesApi from "@/services/updatesApi";
import type { Story } from "@/services/updatesApi";

export default function StoryViewerScreen() {
  const { publisherId, storyId } = useLocalSearchParams<{
    publisherId: string;
    storyId?: string;
  }>();
  const { token } = useAuth();
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !publisherId) return;
    (async () => {
      try {
        const data = await updatesApi.getPublisherStories(token, publisherId);
        setStories(data);
      } catch (err) {
        console.error("Failed to load stories:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, publisherId]);

  const initialIndex = storyId
    ? stories.findIndex((s) => s.id === storyId)
    : 0;

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleStoryViewed = useCallback(
    async (storyId: string) => {
      if (!token) return;
      try {
        await updatesApi.markStoryViewed(token, storyId);
      } catch {}
    },
    [token]
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  if (stories.length === 0) {
    router.back();
    return null;
  }

  return (
    <StoryViewer
      stories={stories}
      initialIndex={Math.max(0, initialIndex)}
      onClose={handleClose}
      onStoryViewed={handleStoryViewed}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
});
