"use client";

import { useState } from "react";
import {
  CircleDotDashed,
  Plus,
  Search,
  Sparkles,
  RefreshCw,
  FileText,
  Bookmark,
  TrendingUp,
  Rss,
  Loader2,
  Users,
} from "lucide-react";
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
    savedPosts,
    isLoading,
    isLoadingMore,
    refreshing,
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

  const [activeTab, setActiveTab] = useState<"feed" | "saved">("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);

  const displayPosts = activeTab === "feed" ? feed : savedPosts;

  const filteredPosts = displayPosts.filter((post) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const matchesContent = post.content?.toLowerCase().includes(query);
    const matchesPublisher = post.publisher_name.toLowerCase().includes(query);
    return matchesContent || matchesPublisher;
  });

  return (
    <div className="flex flex-col h-full bg-[#fafafa] dark:bg-[#0c0c14] overflow-y-auto min-h-screen">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 px-6 py-8 text-white relative overflow-hidden shadow-lg">
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-12 translate-y-12">
          <CircleDotDashed
            className="h-64 w-64 rotate-45 animate-spin"
            style={{ animationDuration: "35s" }}
          />
        </div>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-white/20 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Atualizações
              </span>
              <span className="text-emerald-200 text-xs">
                Stories, Enquetes & Feed de Canais
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Atualizações do Zapi
            </h1>
            <p className="text-emerald-100 mt-1 text-sm md:text-base">
              Acompanhe o dia a dia, novidades, stories e enquete de seus contatos e canais.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateStory(true)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/30 px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Novo Status
            </button>
            <button
              onClick={() => setShowCreatePost(true)}
              className="flex items-center gap-2 bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <FileText className="h-4 w-4" />
              Criar Post
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl w-full mx-auto px-4 py-8 flex-grow">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Feed Column (2 cols on lg) */}
          <div className="lg:col-span-2 space-y-6">
            {/* StoryBar widget */}
            <StoryBar
              myAvatarUrl={myAvatarUrl}
              groups={storyGroups}
              onMyStoryPress={() => setShowCreateStory(true)}
              onStoryPress={(group) => setActiveStoryGroup(group)}
            />

            {/* Filter Tabs & Search Bar */}
            <div className="bg-white dark:bg-[#11111e] rounded-2xl p-4 border border-card-border/60 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap border-b border-card-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("feed")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "feed"
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                        : "text-muted-text hover:text-foreground hover:bg-neutral-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <Rss className="w-4 h-4" />
                    Feed Principal
                  </button>
                  <button
                    onClick={() => setActiveTab("saved")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "saved"
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                        : "text-muted-text hover:text-foreground hover:bg-neutral-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <Bookmark className="w-4 h-4" />
                    Salvos ({savedPosts.length})
                  </button>
                </div>

                <button
                  onClick={refresh}
                  disabled={refreshing}
                  className="p-2 text-muted-text hover:text-emerald-500 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  title="Atualizar"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-500" : ""}`} />
                </button>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-text" />
                <input
                  type="text"
                  placeholder="Buscar no feed ou por autor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-white/5 border border-card-border/40 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Posts List */}
            {isLoading ? (
              <div className="flex flex-col justify-center items-center py-20 space-y-3 bg-white dark:bg-[#11111e] rounded-2xl border border-card-border/60">
                <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
                <p className="text-xs text-muted-text font-medium">Carregando atualizações...</p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="py-16 px-6 text-center bg-white dark:bg-[#11111e] rounded-2xl border border-card-border/60 shadow-sm space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  <Sparkles className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">
                    Nenhuma publicação encontrada
                  </h3>
                  <p className="text-xs text-muted-text mt-1 max-w-md mx-auto">
                    {searchQuery
                      ? "Nenhum resultado corresponde à sua busca."
                      : activeTab === "saved"
                      ? "Você ainda não salvou nenhuma publicação."
                      : "Publique uma atualização ou siga contatos para acompanhar o feed."}
                  </p>
                </div>
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Criar Primeira Publicação
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredPosts.map((post) => (
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

                {/* Load More Button */}
                {activeTab === "feed" && (
                  <div className="text-center pt-4">
                    <button
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="inline-flex items-center gap-2 bg-white dark:bg-[#11111e] hover:bg-neutral-50 dark:hover:bg-white/5 border border-card-border/60 px-6 py-3 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                          Carregando mais...
                        </>
                      ) : (
                        "Carregar mais publicações"
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar Widgets */}
          <div className="space-y-6 hidden lg:block">
            {/* Quick Profile Summary */}
            <div className="bg-white dark:bg-[#11111e] rounded-2xl p-5 border border-card-border/60 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold flex items-center justify-center text-lg shadow-md">
                  {user?.username?.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                    {user?.name || user?.username || "Você"}
                  </h3>
                  <p className="text-xs text-muted-text">@{user?.username}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-card-border/40 text-center">
                <div className="bg-neutral-50 dark:bg-white/5 p-3 rounded-xl">
                  <span className="block text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                    {feed.length}
                  </span>
                  <span className="text-[10px] text-muted-text uppercase font-semibold">
                    No Feed
                  </span>
                </div>
                <div className="bg-neutral-50 dark:bg-white/5 p-3 rounded-xl">
                  <span className="block text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                    {storyGroups.length}
                  </span>
                  <span className="text-[10px] text-muted-text uppercase font-semibold">
                    Status Ativos
                  </span>
                </div>
              </div>
            </div>

            {/* Information & Channel Promo */}
            <div className="bg-gradient-to-br from-emerald-950/20 via-teal-950/10 to-transparent p-5 rounded-2xl border border-emerald-500/20 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <TrendingUp className="w-4 h-4" />
                <span>Canais no Zapi</span>
              </div>
              <h4 className="font-extrabold text-gray-900 dark:text-gray-100 text-sm">
                Fique atualizado em tempo real
              </h4>
              <p className="text-xs text-muted-text leading-relaxed">
                Você pode seguir canais oficiais de empresas, criadores e lojas no Zapi para receber ofertas, comunicados e enquetes exclusivas no seu feed.
              </p>
            </div>
          </div>
        </div>
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
