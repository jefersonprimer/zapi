"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import * as updatesApi from "@/lib/updates-api";
import type { StoryGroup, FeedPost } from "@/lib/updates-api";

export function useUpdates() {
  const { token } = useAuth();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [savedPosts, setSavedPosts] = useState<FeedPost[]>([]);
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

  const fetchSavedPosts = useCallback(async () => {
    if (!token) return;
    try {
      const saved = await updatesApi.getSavedPosts(token, 1);
      setSavedPosts(saved);
    } catch (e: any) {
      console.error("Failed to fetch saved posts:", e);
    }
  }, [token]);

  const loadInitial = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const publisher = await updatesApi.getMyPublisher(token).catch(() => null);
      setMyAvatarUrl(publisher?.avatar_url ?? null);
    } catch {}
    await Promise.all([fetchStories(), fetchFeed(1, true), fetchSavedPosts()]);
    setIsLoading(false);
  }, [token, fetchStories, fetchFeed, fetchSavedPosts]);

  useEffect(() => {
    if (token) {
      loadInitial();
    } else {
      setIsLoading(false);
    }
  }, [token, loadInitial]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    setError(null);
    await Promise.all([fetchStories(), fetchFeed(1, true), fetchSavedPosts()]);
    setRefreshing(false);
  }, [token, fetchStories, fetchFeed, fetchSavedPosts]);

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
                likes_count: p.liked_by_me ? Math.max(0, p.likes_count - 1) : p.likes_count + 1,
              }
            : p
        )
      );
      try {
        await updatesApi.toggleLike(token, postId);
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
        await fetchSavedPosts();
      } catch {
        if (prev) {
          setFeed((prevFeed) =>
            prevFeed.map((p) => (p.id === postId ? prev : p))
          );
        }
      }
    },
    [token, feed, fetchSavedPosts]
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

  const deletePost = useCallback(
    async (postId: string) => {
      if (!token) return;
      setFeed((prev) => prev.filter((p) => p.id !== postId));
      try {
        await updatesApi.deletePost(token, postId);
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

  const markStoryViewed = useCallback(
    async (storyId: string) => {
      if (!token) return;
      try {
        await updatesApi.markStoryViewed(token, storyId);
        await fetchStories();
      } catch {}
    },
    [token, fetchStories]
  );

  return {
    storyGroups,
    feed,
    savedPosts,
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
    deletePost,
    toggleFollow,
    markStoryViewed,
  };
}
