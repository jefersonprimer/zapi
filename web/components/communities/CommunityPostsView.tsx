"use client";

import React, { useState } from "react";
import { MessageSquare, Pin, Plus, MessageCircle } from "lucide-react";
import Image from "next/image";
import { getImageUrl } from "@/lib/utils";
import { CommunityPost } from "@/lib/community-types";

interface CommunityPostsViewProps {
  posts: CommunityPost[];
  onSelectPost: (post: CommunityPost) => void;
  onOpenCreatePostModal: () => void;
}

export const CommunityPostsView: React.FC<CommunityPostsViewProps> = ({
  posts,
  onSelectPost,
  onOpenCreatePostModal,
}) => {
  const [filter, setFilter] = useState<"all" | "pinned">("all");

  const filteredPosts = posts.filter((post) => {
    if (filter === "pinned") return post.pinned;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Header Banner for Forum */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-zinc-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-zinc-300" />
            Fórum de Discussões & Tópicos
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Crie tópicos estruturados, tire dúvidas da comunidade e debata arquitetura.
          </p>
        </div>

        <button
          onClick={onOpenCreatePostModal}
          className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-black px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Novo Tópico</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-3 bg-zinc-950 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filter === "all"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Todos os Tópicos ({posts.length})
          </button>

          <button
            onClick={() => setFilter("pinned")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              filter === "pinned"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Pin className="w-3 h-3" />
            <span>Fixados ({posts.filter((p) => p.pinned).length})</span>
          </button>
        </div>
      </div>

      {/* Posts List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl">
            <MessageSquare className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-400">
              Nenhum tópico encontrado
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Seja o primeiro a publicar um tópico nesta comunidade!
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div
              key={post.id}
              onClick={() => onSelectPost(post)}
              className="bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-5 transition-all duration-200 cursor-pointer space-y-3 group shadow-sm"
            >
              {/* Header: Pinned tag + Author info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center">
                    {post.author_avatar_url ? (
                      <Image
                        src={getImageUrl(post.author_avatar_url)}
                        alt={post.author_username || "Author"}
                        width={28}
                        height={28}
                        className="w-full h-full object-cover grayscale"
                        unoptimized
                      />
                    ) : (
                      <span className="font-bold text-[10px] text-zinc-300">
                        {(post.author_username || "A")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-zinc-300">
                    {post.author_username || "Autor"}
                  </span>
                  <span className="text-[10px] text-zinc-400">•</span>
                  <span className="text-[10px] text-zinc-400">
                    {new Date(post.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                </div>

                {post.pinned && (
                  <span className="flex items-center gap-1 bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded-md text-[10px] font-bold border border-zinc-700">
                    <Pin className="w-3 h-3 text-zinc-300" /> Fixado
                  </span>
                )}
              </div>

              {/* Title & Body preview */}
              <div>
                <h3 className="text-base font-bold text-zinc-100 group-hover:text-zinc-50 transition-colors">
                  {post.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                  {post.content}
                </p>
              </div>

              {/* Footer stats */}
              <div className="pt-2 border-t border-zinc-800/50 flex items-center gap-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 hover:text-zinc-200">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{post.comment_count} respostas</span>
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
