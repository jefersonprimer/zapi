"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Grid,
  Bookmark,
  BadgeCheck,
  UserPlus,
  UserCheck,
  Loader2,
  Sparkles,
  RefreshCw,
  Rss,
  Share2,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as updatesApi from "@/lib/updates-api";
import type { Publisher, FeedPost } from "@/lib/updates-api";
import FeedPostCard from "@/components/updates/FeedPostCard";
import CommentsModal from "@/components/updates/CommentsModal";
import { getImageUrl } from "@/lib/utils";

interface PageProps {
  params: Promise<{
    username: string;
  }>;
}

export default function UserProfilePage({ params }: PageProps) {
  const { username: rawUsername } = React.use(params);
  const cleanUsername = decodeURIComponent(rawUsername).replace(/^@/, "");

  const { user, token } = useAuth();

  const [publisher, setPublisher] = useState<Publisher | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [savedPosts, setSavedPosts] = useState<FeedPost[]>([]);
  const [activeTab, setActiveTab] = useState<"posts" | "saved">("posts");
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(
    null
  );

  const isOwnProfile =
    user?.username?.toLowerCase() === cleanUsername.toLowerCase() ||
    publisher?.ref_id === user?.user_id;

  // Load publisher profile and posts
  const loadData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);

    try {
      let pubData: Publisher | null = null;

      // Check if viewing own profile
      if (user?.username?.toLowerCase() === cleanUsername.toLowerCase()) {
        try {
          pubData = await updatesApi.getMyPublisher(token);
        } catch {
          // Fallback if me publisher fails
        }
      }

      if (!pubData) {
        try {
          pubData = await updatesApi.getPublisherByUsername(token, cleanUsername);
        } catch {
          // Fallback mock/constructed publisher if endpoint is missing or returns 404
        }
      }

      // Fallback publisher if not found
      const currentPublisher: Publisher = pubData || {
        id: `pub-${cleanUsername}`,
        type: "user",
        ref_id: cleanUsername,
        name: cleanUsername,
        username: cleanUsername,
        avatar_url: null,
        is_verified: false,
        created_at: new Date().toISOString(),
        is_following: false,
        followers_count: 0,
        following_count: 0,
      };

      setPublisher(currentPublisher);
      setIsFollowing(!!currentPublisher.is_following);
      setFollowersCount(currentPublisher.followers_count || 0);
      setFollowingCount(currentPublisher.following_count || 0);

      // Load publisher posts
      try {
        const pubPosts = await updatesApi.getPublisherPosts(
          token,
          currentPublisher.id
        );
        setPosts(Array.isArray(pubPosts) ? pubPosts : []);
      } catch {
        setPosts([]);
      }

      // Load saved posts if own profile
      if (isOwnProfile) {
        try {
          const saved = await updatesApi.getSavedPosts(token);
          setSavedPosts(Array.isArray(saved) ? saved : []);
        } catch {
          setSavedPosts([]);
        }
      }
    } catch (err) {
      console.error("Error loading user profile:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token, user?.username, cleanUsername, isOwnProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle follow action
  const handleToggleFollow = async () => {
    if (!token || !publisher || isOwnProfile) return;
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);
    setFollowersCount((prev) => (nextFollowing ? prev + 1 : Math.max(0, prev - 1)));

    try {
      await updatesApi.toggleFollow(token, publisher.id);
    } catch {
      // Revert state on error
      setIsFollowing(!nextFollowing);
      setFollowersCount((prev) => (nextFollowing ? Math.max(0, prev - 1) : prev + 1));
    }
  };

  // Post Action Handlers
  const handleLike = async (postId: string) => {
    if (!token) return;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const liked = !p.liked_by_me;
          return {
            ...p,
            liked_by_me: liked,
            likes_count: liked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1),
          };
        }
        return p;
      })
    );
    try {
      await updatesApi.toggleLike(token, postId);
    } catch {
      // Revert if error
    }
  };

  const handleSave = async (postId: string) => {
    if (!token) return;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          return { ...p, saved_by_me: !p.saved_by_me };
        }
        return p;
      })
    );
    try {
      await updatesApi.toggleSave(token, postId);
    } catch {
      // Revert
    }
  };

  const handleVotePoll = async (postId: string, optionId: string) => {
    if (!token) return;
    try {
      await updatesApi.votePoll(token, postId, { option_id: optionId });
      loadData();
    } catch {
      // Ignore
    }
  };

  const handleHidePost = async (postId: string) => {
    if (!token) return;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await updatesApi.hidePost(token, postId);
    } catch {
      // Ignore
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!token) return;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await updatesApi.deletePost(token, postId);
    } catch {
      // Ignore
    }
  };

  const displayPosts = activeTab === "posts" ? posts : savedPosts;
  const avatarSrc = publisher ? getImageUrl(publisher.avatar_url) : null;

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto min-h-screen">
      {/* Main Content Container */}
      <div className="max-w-2xl w-full mx-auto px-4 py-8 flex-grow space-y-6">
        {/* Navigation Top Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-card-border/40">
          <Link
            href="/atualizacoes"
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-foreground bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 px-3.5 py-2 rounded-xl border border-card-border/60 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Atualizações
          </Link>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-muted-text hover:text-black dark:hover:text-white rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Atualizar"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin text-black dark:text-white" : ""}`}
            />
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-white dark:bg-[#11111e] rounded-2xl p-6 border border-card-border/60 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-card-border/60 bg-neutral-100 dark:bg-neutral-900 flex-shrink-0 shadow-md">
              {avatarSrc ? (
                <Image
                  src={avatarSrc}
                  alt={publisher?.name || cleanUsername}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-neutral-800 dark:bg-neutral-200 text-white dark:text-black font-extrabold text-3xl flex items-center justify-center">
                  {(publisher?.name || cleanUsername).charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* User Details & Action */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-1.5">
                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
                      {publisher?.name || cleanUsername}
                    </h2>
                    {publisher?.is_verified && (
                      <BadgeCheck className="w-5 h-5 text-black dark:text-white flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-muted-text">
                    @{cleanUsername}
                  </p>
                </div>

                {/* Follow / Edit Profile Action */}
                <div>
                  {isOwnProfile ? (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-white/10 text-gray-800 dark:text-gray-200 border border-card-border/60">
                      Seu Perfil
                    </span>
                  ) : (
                    <button
                      onClick={handleToggleFollow}
                      className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold shadow transition-all cursor-pointer active:scale-95 ${
                        isFollowing
                          ? "bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/20 text-gray-800 dark:text-gray-200 border border-card-border/60"
                          : "bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200"
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-4 h-4" />
                          Seguindo
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Seguir
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Bio / Info */}
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed pt-1">
                {publisher?.type === "channel"
                  ? "Canal oficial de atualizações no Zapi."
                  : publisher?.type === "business"
                    ? "Perfil comercial oficial no Zapi."
                    : "Perfil e publicações do usuário no Zapi."}
              </p>

              {/* Joined Date if available */}
              {publisher?.created_at && (
                <div className="flex items-center justify-center sm:justify-start gap-1 text-[11px] text-muted-text pt-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    No Zapi desde{" "}
                    {new Date(publisher.created_at).toLocaleDateString("pt-BR", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-card-border/40 text-center">
            <div className="p-3 bg-neutral-50 dark:bg-white/5 rounded-xl border border-card-border/40">
              <span className="block text-base font-extrabold text-gray-900 dark:text-gray-100">
                {posts.length}
              </span>
              <span className="text-[11px] text-muted-text font-medium uppercase tracking-wider">
                Publicações
              </span>
            </div>

            <div className="p-3 bg-neutral-50 dark:bg-white/5 rounded-xl border border-card-border/40">
              <span className="block text-base font-extrabold text-gray-900 dark:text-gray-100">
                {followersCount}
              </span>
              <span className="text-[11px] text-muted-text font-medium uppercase tracking-wider">
                Seguidores
              </span>
            </div>

            <div className="p-3 bg-neutral-50 dark:bg-white/5 rounded-xl border border-card-border/40">
              <span className="block text-base font-extrabold text-gray-900 dark:text-gray-100">
                {followingCount}
              </span>
              <span className="text-[11px] text-muted-text font-medium uppercase tracking-wider">
                Seguindo
              </span>
            </div>
          </div>
        </div>

        {/* Profile Tabs */}
        <div className="bg-white dark:bg-[#11111e] rounded-2xl p-2 border border-card-border/60 shadow-sm flex items-center gap-2">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "posts"
                ? "bg-black dark:bg-white text-white dark:text-black shadow-md"
                : "text-muted-text hover:text-foreground hover:bg-neutral-100 dark:hover:bg-white/5"
            }`}
          >
            <Grid className="w-4 h-4" />
            Publicações ({posts.length})
          </button>

          {isOwnProfile && (
            <button
              onClick={() => setActiveTab("saved")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "saved"
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-md"
                  : "text-muted-text hover:text-foreground hover:bg-neutral-100 dark:hover:bg-white/5"
              }`}
            >
              <Bookmark className="w-4 h-4" />
              Salvos ({savedPosts.length})
            </button>
          )}
        </div>

        {/* Posts List Section */}
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-20 space-y-3 bg-white dark:bg-[#11111e] rounded-2xl border border-card-border/60">
            <Loader2 className="h-10 w-10 text-black dark:text-white animate-spin" />
            <p className="text-xs text-muted-text font-medium">
              Carregando perfil e publicações...
            </p>
          </div>
        ) : displayPosts.length === 0 ? (
          <div className="py-16 px-6 text-center bg-white dark:bg-[#11111e] rounded-2xl border border-card-border/60 shadow-sm space-y-4">
            <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-white/10 text-black dark:text-white flex items-center justify-center mx-auto">
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">
                Nenhuma publicação encontrada
              </h3>
              <p className="text-xs text-muted-text mt-1 max-w-md mx-auto">
                {activeTab === "saved"
                  ? "Você ainda não salvou nenhuma publicação."
                  : `@${cleanUsername} ainda não fez nenhuma publicação no feed.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {displayPosts.map((post) => (
              <FeedPostCard
                key={post.id}
                post={post}
                currentUserId={user?.user_id}
                onLike={() => handleLike(post.id)}
                onSave={() => handleSave(post.id)}
                onComment={() => setActiveCommentPostId(post.id)}
                onVote={(optionId) => handleVotePoll(post.id, optionId)}
                onHide={() => handleHidePost(post.id)}
                onDelete={() => handleDeletePost(post.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Comments Modal */}
      <CommentsModal
        postId={activeCommentPostId}
        isOpen={!!activeCommentPostId}
        onClose={() => setActiveCommentPostId(null)}
      />
    </div>
  );
}
