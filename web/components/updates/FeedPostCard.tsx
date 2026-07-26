"use client";

import { useState } from "react";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreVertical,
  BadgeCheck,
  EyeOff,
  Trash2,
  BarChart2,
  CheckCircle2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { FeedPost } from "@/lib/updates-api";
import { getImageUrl } from "@/lib/utils";

interface FeedPostCardProps {
  post: FeedPost;
  currentUserId?: string;
  onLike: () => void;
  onSave: () => void;
  onComment: () => void;
  onVote: (optionId: string) => void;
  onHide?: () => void;
  onDelete?: () => void;
}

export default function FeedPostCard({
  post,
  currentUserId,
  onLike,
  onSave,
  onComment,
  onVote,
  onHide,
  onDelete,
}: FeedPostCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);

  const publisherAvatar = getImageUrl(post.publisher_avatar);
  const isMine = post.publisher_id === currentUserId;

  const formattedDate = new Date(post.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const profileHref = `/@${encodeURIComponent(post.publisher_name)}`;

  return (
    <div className="overflow-hidden max-w-[500px] mx-auto">
      {/* Post Header */}
      <div className="p-5 flex items-center justify-between border-b border-card-border/40">
        <div className="flex items-center gap-3">
          <Link
            href={profileHref}
            className="relative w-11 h-11 rounded-full overflow-hidden border border-card-border/60 bg-neutral-100 dark:bg-neutral-800 flex-shrink-0 hover:opacity-90 transition-opacity"
          >
            {publisherAvatar ? (
              <Image
                src={publisherAvatar}
                alt={post.publisher_name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full bg-neutral-800 dark:bg-neutral-200 text-white dark:text-black font-bold flex items-center justify-center text-sm">
                {post.publisher_name.charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
          <div>
            <div className="flex items-center gap-1.5">
              <Link
                href={profileHref}
                className="font-bold text-sm text-gray-900 dark:text-gray-100 hover:underline cursor-pointer"
              >
                {post.publisher_name}
              </Link>
              {post.is_verified && (
                <BadgeCheck className="w-4 h-4 text-black dark:text-white flex-shrink-0" />
              )}
              {post.publisher_type === "channel" && (
                <span className="text-[10px] font-semibold bg-neutral-100 dark:bg-white/10 text-neutral-800 dark:text-neutral-200 px-2 py-0.5 rounded-full">
                  Canal
                </span>
              )}
            </div>
            <p className="text-xs text-muted-text">{formattedDate}</p>
          </div>
        </div>

        {/* Menu button */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-muted-text hover:text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 z-30 w-44 bg-white dark:bg-[#151528] rounded-xl border border-card-border/60 shadow-xl py-1 animate-in fade-in zoom-in-95">
              {onHide && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onHide();
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                >
                  <EyeOff className="w-4 h-4" />
                  Ocultar post
                </button>
              )}

              {isMine && onDelete && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Text Content */}
      {post.content && (
        <div className="px-5 py-4 text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
          {post.content}
        </div>
      )}

      {/* Attachments Grid */}
      {post.attachments && post.attachments.length > 0 && (
        <div
          className={`px-5 py-2 grid gap-2 ${
            post.attachments.length === 1
              ? "grid-cols-1"
              : post.attachments.length === 2
                ? "grid-cols-2"
                : "grid-cols-2"
          }`}
        >
          {post.attachments.map((att) => {
            const fullUrl = getImageUrl(att.url);
            const isVideo = att.type === "video";

            return (
              <div
                key={att.id}
                onClick={() => !isVideo && setSelectedMedia(fullUrl)}
                className="relative rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 max-h-[600px] flex items-center justify-center border border-card-border/40 cursor-pointer group"
              >
                {isVideo ? (
                  <video
                    src={fullUrl}
                    controls
                    className="w-full h-full object-cover max-h-[400px]"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fullUrl}
                    alt="Anexo"
                    className="w-full h-full object-cover max-h-[600px]"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Poll Options */}
      {post.poll_options && post.poll_options.length > 0 && (
        <div className="px-5 py-3 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-text mb-1">
            <BarChart2 className="w-4 h-4 text-black dark:text-white" />
            <span>Enquete</span>
          </div>

          {(() => {
            const totalVotes = post.poll_options.reduce(
              (acc, o) => acc + o.votes_count,
              0,
            );

            return (
              <div className="space-y-2">
                {post.poll_options.map((option) => {
                  const isVoted = post.voted_option === option.id;
                  const pct =
                    totalVotes > 0
                      ? Math.round((option.votes_count / totalVotes) * 100)
                      : 0;

                  return (
                    <button
                      key={option.id}
                      onClick={() => onVote(option.id)}
                      className={`relative w-full text-left p-3 rounded-xl border transition-all overflow-hidden cursor-pointer ${
                        isVoted
                          ? "border-black dark:border-white bg-black/10 dark:bg-white/10 font-bold"
                          : "border-card-border/60 hover:border-black/50 dark:hover:border-white/50 bg-neutral-50 dark:bg-white/5"
                      }`}
                    >
                      {/* Vote percentage bar background */}
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-black/15 dark:bg-white/15 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />

                      <div className="relative z-10 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                          {isVoted && (
                            <CheckCircle2 className="w-4 h-4 text-black dark:text-white flex-shrink-0" />
                          )}
                          {option.label}
                        </span>
                        <span className="font-bold text-muted-text">
                          {pct}%
                        </span>
                      </div>
                    </button>
                  );
                })}
                <p className="text-[11px] text-muted-text text-right pt-1 font-medium">
                  {totalVotes} {totalVotes === 1 ? "voto" : "votos"}
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Footer Actions */}
      <div className="px-5 py-3  flex items-center justify-between text-xs text-muted-text">
        <div className="flex items-center gap-6">
          {/* Like */}
          <button
            onClick={onLike}
            className={`flex items-center gap-1.5 transition-colors cursor-pointer group ${
              post.liked_by_me
                ? "text-rose-500 font-bold"
                : "hover:text-rose-500"
            }`}
          >
            <Heart
              className={`w-5 h-5 transition-transform group-active:scale-125 ${
                post.liked_by_me ? "fill-rose-500 text-rose-500" : ""
              }`}
            />
            <span>{post.likes_count}</span>
          </button>

          {/* Comment */}
          <button
            onClick={onComment}
            className="flex items-center gap-1.5 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{post.comments_count}</span>
          </button>

          {/* Share */}
          <button
            onClick={() => {
              if (navigator.share) {
                navigator
                  .share({
                    title: post.publisher_name,
                    text: post.content || "Confira este post no Zapi!",
                    url: window.location.href,
                  })
                  .catch(() => {});
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert("Link copiado para a área de transferência!");
              }
            }}
            className="flex items-center gap-1.5 hover:text-blue-500 transition-colors cursor-pointer"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Save */}
        <button
          onClick={onSave}
          className={`flex items-center gap-1 transition-colors cursor-pointer ${
            post.saved_by_me
              ? "text-black dark:text-white font-bold"
              : "hover:text-black dark:hover:text-white"
          }`}
          title={post.saved_by_me ? "Salvo" : "Salvar"}
        >
          <Bookmark
            className={`w-5 h-5 ${
              post.saved_by_me
                ? "fill-black dark:fill-white text-black dark:text-white"
                : ""
            }`}
          />
        </button>
      </div>

      {/* Media Lightbox */}
      {selectedMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedMedia(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedMedia}
            alt="Enlarged media"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
