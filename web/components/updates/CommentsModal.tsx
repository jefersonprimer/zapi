"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Send, Heart, Trash2, CornerDownRight, Loader2, MessageSquare } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import * as updatesApi from "@/lib/updates-api";
import type { Comment } from "@/lib/updates-api";
import { getImageUrl } from "@/lib/utils";

interface CommentsModalProps {
  postId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function CommentsModal({
  postId,
  isOpen,
  onClose,
}: CommentsModalProps) {
  const { token, user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [isSending, setIsSending] = useState(false);

  const loadComments = useCallback(async () => {
    if (!token || !postId) return;
    setIsLoading(true);
    try {
      const data = await updatesApi.getComments(token, postId);
      setComments(data);
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token, postId]);

  useEffect(() => {
    if (!isOpen || !postId || !token) return;
    let isMounted = true;
    Promise.resolve().then(() => {
      if (!isMounted) return;
      setReplyTo(null);
      setContent("");
      loadComments();
    });
    return () => {
      isMounted = false;
    };
  }, [isOpen, postId, token, loadComments]);

  if (!isOpen || !postId) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !content.trim() || isSending) return;

    setIsSending(true);
    try {
      const payload: { content: string; parent_id?: string } = { content: content.trim() };
      if (replyTo) payload.parent_id = replyTo.id;

      await updatesApi.addComment(token, postId, payload);
      setContent("");
      setReplyTo(null);
      await loadComments();
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleLike = async (commentId: string) => {
    if (!token) return;
    try {
      await updatesApi.toggleCommentLike(token, postId, commentId);
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return {
              ...c,
              liked_by_me: !c.liked_by_me,
              likes_count: c.liked_by_me ? c.likes_count - 1 : c.likes_count + 1,
            };
          }
          return {
            ...c,
            replies: c.replies.map((r) =>
              r.id === commentId
                ? {
                    ...r,
                    liked_by_me: !r.liked_by_me,
                    likes_count: r.liked_by_me ? r.likes_count - 1 : r.likes_count + 1,
                  }
                : r
            ),
          };
        })
      );
    } catch {}
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!token) return;
    try {
      await updatesApi.deleteComment(token, postId, commentId);
      await loadComments();
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#11111e] rounded-2xl border border-card-border/60 shadow-2xl overflow-hidden flex flex-col h-[80vh] max-h-[700px]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border/60">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-black dark:text-white" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Comentários
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-text hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comment List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 text-black dark:text-white animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12 text-muted-text space-y-2">
              <MessageSquare className="w-10 h-10 mx-auto opacity-40 mb-2" />
              <p className="text-sm font-medium">Nenhum comentário ainda.</p>
              <p className="text-xs">Seja o primeiro a deixar um comentário!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="space-y-3">
                {/* Main comment */}
                <div className="flex items-start gap-3 group">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden border border-card-border/60 bg-neutral-200 dark:bg-neutral-800 flex-shrink-0">
                    {comment.user_avatar ? (
                      <Image
                        src={getImageUrl(comment.user_avatar)}
                        alt={comment.user_name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-800 dark:bg-neutral-200 text-white dark:text-black font-bold flex items-center justify-center text-xs">
                        {comment.user_name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 bg-neutral-50 dark:bg-white/5 p-3 rounded-2xl border border-card-border/40">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        {comment.user_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-text">
                          {new Date(comment.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {user?.user_id === comment.user_id && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-muted-text hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-800 dark:text-gray-200 leading-normal">
                      {comment.content}
                    </p>

                    <div className="flex items-center gap-4 mt-2 pt-1 text-[11px] font-semibold text-muted-text">
                      <button
                        onClick={() =>
                          setReplyTo({ id: comment.id, name: comment.user_name })
                        }
                        className="hover:text-black dark:hover:text-white cursor-pointer"
                      >
                        Responder
                      </button>
                      <button
                        onClick={() => handleToggleLike(comment.id)}
                        className={`flex items-center gap-1 cursor-pointer ${
                          comment.liked_by_me ? "text-rose-500" : "hover:text-rose-500"
                        }`}
                      >
                        <Heart
                          className={`w-3 h-3 ${
                            comment.liked_by_me ? "fill-rose-500" : ""
                          }`}
                        />
                        {comment.likes_count > 0 && comment.likes_count}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Nested Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="pl-8 space-y-2 border-l-2 border-black/20 dark:border-white/20 ml-4">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="flex items-start gap-2.5 group">
                        <CornerDownRight className="w-4 h-4 text-black dark:text-white opacity-60 flex-shrink-0 mt-2" />
                        <div className="flex-1 bg-neutral-100 dark:bg-white/[0.03] p-2.5 rounded-xl border border-card-border/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                              {reply.user_name}
                            </span>
                            {user?.user_id === reply.user_id && (
                              <button
                                onClick={() => handleDeleteComment(reply.id)}
                                className="text-muted-text hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-gray-800 dark:text-gray-200">
                            {reply.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          className="p-4 border-t border-card-border/60 bg-neutral-50 dark:bg-white/5 space-y-2"
        >
          {replyTo && (
            <div className="flex items-center justify-between text-xs bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white px-3 py-1.5 rounded-lg font-semibold">
              <span>Respondendo a @{replyTo.name}</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="hover:underline cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Escreva um comentário..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 bg-white dark:bg-[#151528] border border-card-border/60 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
            <button
              type="submit"
              disabled={!content.trim() || isSending}
              className="p-2.5 bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 rounded-xl shadow transition-all cursor-pointer"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
