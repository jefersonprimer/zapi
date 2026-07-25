"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useUpdates } from "@/hooks/useUpdates";
import StoryBar from "@/components/updates/StoryBar";
import FeedPostCard from "@/components/updates/FeedPostCard";
import StoryViewerModal from "@/components/updates/StoryViewerModal";
import CreateStoryModal from "@/components/updates/CreateStoryModal";
import CreatePostModal from "@/components/updates/CreatePostModal";
import CommentsModal from "@/components/updates/CommentsModal";
import type { StoryGroup } from "@/lib/updates-api";

export default function UpdatesPage() {
  const { user } = useAuth();
  const {
    storyGroups,
    feed,
    isLoading,
    isLoadingMore,
    hasMore,
    myAvatarUrl,
    refresh,
    loadMore,
    toggleLike,
    toggleSave,
    votePoll,
    hidePost,
    deletePost,
    markStoryViewed,
  } = useUpdates();

  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(
    null,
  );
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(
    null,
  );

  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  // Infinite Scroll Observer
  useEffect(() => {
    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "250px" },
    );

    observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [loadMore, isLoadingMore, hasMore]);

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto min-h-screen">
      {/* Main Content */}
      <div className="max-w-2xl w-full mx-auto px-4 py-8 flex-grow space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-card-border/40">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              Atualizações
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowCreatePost(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Nova Publicação
            </button>
          </div>
        </div>

        {/* StoryBar widget */}
        <StoryBar
          myAvatarUrl={myAvatarUrl}
          groups={storyGroups}
          onMyStoryPress={() => setShowCreateStory(true)}
          onStoryPress={(group) => setActiveStoryGroup(group)}
        />

        {/* Posts List */}
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-20 space-y-3">
            <Loader2 className="h-10 w-10 text-black dark:text-white animate-spin" />
            <p className="text-xs text-muted-text font-medium">
              Carregando atualizações...
            </p>
          </div>
        ) : feed.length === 0 ? (
          <div className="py-16 px-6 text-center bg-white dark:bg-[#11111e] rounded-2xl border border-card-border/60 shadow-sm space-y-4">
            <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-white/10 text-black dark:text-white flex items-center justify-center mx-auto">
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">
                Nenhuma publicação encontrada
              </h3>
              <p className="text-xs text-muted-text mt-1 max-w-md mx-auto">
                Publique uma atualização ou siga contatos para acompanhar o
                feed.
              </p>
            </div>
            <button
              onClick={() => setShowCreatePost(true)}
              className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 font-bold px-5 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Criar Primeira Publicação
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {feed.map((post) => (
              <FeedPostCard
                key={post.id}
                post={post}
                currentUserId={user?.user_id}
                onLike={() => toggleLike(post.id)}
                onSave={() => toggleSave(post.id)}
                onComment={() => setActiveCommentPostId(post.id)}
                onVote={(optionId) => votePoll(post.id, optionId)}
                onHide={() => hidePost(post.id)}
                onDelete={() => deletePost(post.id)}
              />
            ))}

            {/* Infinite Scroll Target & Loading Indicator */}
            <div
              ref={observerTargetRef}
              className="py-6 text-center flex flex-col items-center justify-center min-h-[40px]"
            >
              {isLoadingMore && (
                <div className="flex items-center gap-2.5 text-xs font-semibold text-muted-text">
                  <Loader2 className="w-5 h-5 animate-spin text-black dark:text-white" />
                  <span>Carregando mais publicações...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Story Viewer Modal */}
      {activeStoryGroup && (
        <StoryViewerModal
          stories={activeStoryGroup.stories}
          onClose={() => setActiveStoryGroup(null)}
          onStoryViewed={markStoryViewed}
        />
      )}

      {/* Create Story Modal */}
      <CreateStoryModal
        isOpen={showCreateStory}
        onClose={() => setShowCreateStory(false)}
        onSuccess={refresh}
      />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onSuccess={refresh}
      />

      {/* Comments Modal */}
      <CommentsModal
        postId={activeCommentPostId}
        isOpen={!!activeCommentPostId}
        onClose={() => setActiveCommentPostId(null)}
      />
    </div>
  );
}
