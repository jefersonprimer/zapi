"use client";

import React, { useState } from "react";
import { X, Send, Pin } from "lucide-react";
import Image from "next/image";
import { getImageUrl } from "@/lib/utils";
import { CommunityPost, CommunityComment } from "@/lib/community-types";

interface CommunityPostDetailModalProps {
  post: CommunityPost | null;
  comments: CommunityComment[];
  onClose: () => void;
  onSendComment: (postId: string, content: string) => void;
}

export const CommunityPostDetailModal: React.FC<CommunityPostDetailModalProps> = ({
  post,
  comments,
  onClose,
  onSendComment,
}) => {
  const [commentText, setCommentText] = useState("");

  if (!post) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    onSendComment(post.id, commentText.trim());
    setCommentText("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[600px] relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-200 p-1 rounded-lg z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Post Content Header */}
        <div className="p-6 bg-zinc-900 border-b border-zinc-800 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center">
              {post.author_avatar_url ? (
                <Image
                  src={getImageUrl(post.author_avatar_url)}
                  alt={post.author_username || "Author"}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover grayscale"
                  unoptimized
                />
              ) : (
                <span className="font-bold text-xs text-zinc-300">
                  {(post.author_username || "A")[0].toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <span className="text-xs font-bold text-zinc-200">
                {post.author_username || "Autor"}
              </span>
              <span className="text-[10px] text-zinc-400 block">
                {new Date(post.created_at).toLocaleString("pt-BR")}
              </span>
            </div>

            {post.pinned && (
              <span className="ml-auto flex items-center gap-1 bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded text-[10px] font-bold border border-zinc-700">
                <Pin className="w-3 h-3 text-zinc-300" /> Fixado
              </span>
            )}
          </div>

          <h2 className="text-xl font-extrabold text-zinc-100">{post.title}</h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
            {post.content}
          </p>
        </div>

        {/* Comments Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
            Respostas ({comments.length})
          </h4>

          {comments.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-4 text-center">
              Nenhuma resposta ainda. Seja o primeiro a comentar!
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-200">
                      {comment.author_username || "Membro"}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(comment.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  {comment.content}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Add Comment Input Form */}
        <form
          onSubmit={handleSubmit}
          className="p-4 bg-zinc-950 border-t border-zinc-800/80 flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Escreva sua resposta para este tópico..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />

          <button
            type="submit"
            disabled={!commentText.trim()}
            className="p-2.5 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 text-black rounded-xl transition-all cursor-pointer shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
