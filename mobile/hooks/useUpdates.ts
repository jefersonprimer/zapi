import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import * as updatesApi from "@/services/updatesApi";
import type { StoryGroup, FeedPost } from "@/services/updatesApi";

export function useUpdates() {
  const { token } = useAuth();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);

  const fetchStories = useCallback(async () => {
    if (!token) return;
    try {
      const groups = await updatesApi.getStories(token);
      setStoryGroups(groups);
    } catch (e: any) {
      console.error("Failed to fetch stories:", e);
    }
  }, [token]);

  const fetchFeed = useCallback(async (page: number, replace: boolean) => {
    if (!token) return;
    try {
      const posts = await updatesApi.getFeed(token, page, 20);
      if (replace) {
        setFeed(posts);
      } else {
        setFeed((prev) => [...prev, ...posts]);
      }
      hasMoreRef.current = posts.length === 20;
      pageRef.current = page;
    } catch (e: any) {
      setError(e.message || "Failed to load feed");
    }
  }, [token]);

  const loadInitial = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const [publisher] = await Promise.all([
        updatesApi.getMyPublisher(token).catch(() => null),
      ]);
      setMyAvatarUrl(publisher?.avatar_url ?? null);
    } catch {}
    await Promise.all([fetchStories(), fetchFeed(1, true)]);
    setIsLoading(false);
  }, [token, fetchStories, fetchFeed]);

  useEffect(() => {
    if (token) loadInitial();
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    setError(null);
    await Promise.all([fetchStories(), fetchFeed(1, true)]);
    setRefreshing(false);
  }, [token, fetchStories, fetchFeed]);

  const loadMore = useCallback(async () => {
    if (!token || isLoadingMore || !hasMoreRef.current) return;
    setIsLoadingMore(true);
    await fetchFeed(pageRef.current + 1, false);
    setIsLoadingMore(false);
  }, [token, isLoadingMore, fetchFeed]);

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!token) return;
      const prev = feed.find((p) => p.id === postId);
      setFeed((prevFeed) =>
        prevFeed.map((p) =>
          p.id === postId
            ? {
                ...p,
                liked_by_me: !p.liked_by_me,
                likes_count: p.liked_by_me ? p.likes_count - 1 : p.likes_count + 1,
              }
            : p
        )
      );
      try {
        await updatesApi.toggleLike(token, postId);
      } catch {
        if (prev) {
          setFeed((prevFeed) =>
            prevFeed.map((p) =>
              p.id === postId ? prev : p
            )
          );
        }
      }
    },
    [token, feed]
  );

  const toggleSave = useCallback(
    async (postId: string) => {
      if (!token) return;
      const prev = feed.find((p) => p.id === postId);
      setFeed((prevFeed) =>
        prevFeed.map((p) =>
          p.id === postId ? { ...p, saved_by_me: !p.saved_by_me } : p
        )
      );
      try {
        await updatesApi.toggleSave(token, postId);
      } catch {
        if (prev) {
          setFeed((prevFeed) =>
            prevFeed.map((p) => (p.id === postId ? prev : p))
          );
        }
      }
    },
    [token, feed]
  );

  const votePoll = useCallback(
    async (postId: string, optionId: string) => {
      if (!token) return;
      setFeed((prevFeed) =>
        prevFeed.map((p) =>
          p.id === postId ? { ...p, voted_option: optionId } : p
        )
      );
      try {
        await updatesApi.votePoll(token, postId, { option_id: optionId });
        await fetchFeed(1, true);
      } catch {
        setFeed((prevFeed) =>
          prevFeed.map((p) =>
            p.id === postId ? { ...p, voted_option: null } : p
          )
        );
      }
    },
    [token, fetchFeed]
  );

  const hidePost = useCallback(
    async (postId: string) => {
      if (!token) return;
      setFeed((prev) => prev.filter((p) => p.id !== postId));
      try {
        await updatesApi.hidePost(token, postId);
      } catch {
        await fetchFeed(1, true);
      }
    },
    [token, fetchFeed]
  );

  const toggleFollow = useCallback(
    async (publisherId: string) => {
      if (!token) return false;
      try {
        const res = await updatesApi.toggleFollow(token, publisherId);
        await fetchStories();
        return res.following;
      } catch (e: any) {
        console.error("Failed to toggle follow:", e);
        return false;
      }
    },
    [token, fetchStories]
  );

  const toggleFollowByUser = useCallback(
    async (userId: string) => {
      if (!token) return false;
      try {
        const res = await updatesApi.toggleFollowByUser(token, userId);
        await fetchStories();
        return res.following;
      } catch (e: any) {
        console.error("Failed to toggle follow by user:", e);
        return false;
      }
    },
    [token, fetchStories]
  );

  const toggleBlock = useCallback(
    async (publisherId: string) => {
      if (!token) return;
      try {
        await updatesApi.toggleBlock(token, publisherId);
      } catch (e: any) {
        console.error("Failed to toggle block:", e);
      }
    },
    [token]
  );

  const toggleMute = useCallback(
    async (publisherId: string) => {
      if (!token) return;
      try {
        await updatesApi.toggleMute(token, publisherId);
      } catch (e: any) {
        console.error("Failed to toggle mute:", e);
      }
    },
    [token]
  );

  const createReport = useCallback(
    async (data: {
      source_type: string;
      source_id: string;
      reason: string;
      description?: string | null;
    }) => {
      if (!token) return;
      try {
        await updatesApi.createReport(token, data);
      } catch (e: any) {
        console.error("Failed to create report:", e);
      }
    },
    [token]
  );

  const markStoryViewed = useCallback(
    async (storyId: string) => {
      if (!token) return;
      try {
        await updatesApi.markStoryViewed(token, storyId);
      } catch {}
    },
    [token]
  );

  return {
    storyGroups,
    feed,
    isLoading,
    isLoadingMore,
    refreshing,
    error,
    myAvatarUrl,
    refresh,
    loadMore,
    toggleLike,
    toggleSave,
    votePoll,
    hidePost,
    toggleFollow,
    toggleFollowByUser,
    toggleBlock,
    toggleMute,
    createReport,
    markStoryViewed,
  };
}
