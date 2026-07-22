"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Users,
  Star,
  BellOff,
  MoreVertical,
  MoreHorizontal,
} from "lucide-react";
import type { ChatListItem, UserSearchResult } from "@/lib/api";
import { ChatCardContextMenu } from "./ChatCardContextMenu";

const formatChatTime = (isoString: string | null) => {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return "Ontem";
    }

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return "";
  }
};

export interface ContactCardProps {
  chat?: ChatListItem;
  userResult?: UserSearchResult;
  existingChat?: ChatListItem;
  isSelected?: boolean;
  onClick: () => void;
  onArchive?: () => void;
  onPin?: () => void;
  onFavorite?: () => void;
  onAddToList?: () => void;
  onClear?: () => void;
}

export function ContactCard({
  chat,
  userResult,
  existingChat,
  isSelected = false,
  onClick,
  onArchive,
  onPin,
  onFavorite,
  onAddToList,
  onClear,
}: ContactCardProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const targetChat = chat || existingChat;

  const displayName =
    targetChat?.participant_name ||
    targetChat?.participant_username ||
    targetChat?.name ||
    userResult?.name ||
    userResult?.username ||
    "Contato";

  const avatarUrl =
    targetChat?.participant_avatar_url ||
    targetChat?.avatar_url ||
    userResult?.avatar_url;

  const subtitle =
    targetChat?.last_message ||
    (userResult?.username ? `@${userResult.username}` : userResult?.email) ||
    "Nenhuma mensagem";

  const lastMessageAt = targetChat?.last_message_at;
  const timeStr = lastMessageAt ? formatChatTime(lastMessageAt) : null;

  const unreadCount = targetChat?.unread_count || 0;
  const isFavorite = targetChat?.is_favorite || false;
  const isMuted =
    targetChat?.notification_muted_forever ||
    !!targetChat?.notification_muted_until;
  const isGroup = targetChat?.is_group || false;

  const hasActions = !!targetChat && !!onArchive;

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer text-left ${
          isSelected
            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-md"
            : "hover:bg-neutral-100 dark:hover:bg-white/5 text-foreground"
        }`}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="h-12 w-12 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-base font-bold shadow-inner">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={48}
                height={48}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          {isGroup && (
            <div className="absolute -bottom-1 -right-1 bg-neutral-800 text-white p-0.5 rounded-md text-[10px]">
              <Users className="h-3 w-3" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <h3
              className={`text-sm font-semibold truncate ${
                isSelected ? "text-white dark:text-neutral-900" : ""
              }`}
            >
              {displayName}
            </h3>
            {timeStr && (
              <span
                className={`text-[11px] ${
                  isSelected
                    ? "text-neutral-300 dark:text-neutral-600"
                    : "text-muted-text"
                }`}
              >
                {timeStr}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p
              className={`text-xs truncate max-w-[180px] ${
                isSelected
                  ? "text-neutral-300 dark:text-neutral-600"
                  : "text-muted-text"
              }`}
            >
              {subtitle}
            </p>

            <div className="flex items-center gap-1.5">
              {isFavorite && (
                <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
              )}
              {isMuted && (
                <BellOff className="h-3.5 w-3.5 text-muted-text opacity-70" />
              )}
              {unreadCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    isSelected
                      ? "bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white"
                      : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>

      {/* More options button - visible on hover */}
      {hasActions && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowContextMenu(true);
          }}
          className="absolute bottom-0 -translate-y-1/2 right-2 p-1.5 opacity-0 group-hover:opacity-100 cursor-pointer z-10"
        >
          <MoreHorizontal
            className={`h-4 w-4 ${isSelected ? "text-white dark:text-neutral-900" : "text-muted-text"}`}
          />
        </button>
      )}

      {/* Context Menu */}
      {targetChat && (
        <ChatCardContextMenu
          isOpen={showContextMenu}
          onClose={() => setShowContextMenu(false)}
          chat={targetChat}
          onArchive={() => onArchive?.()}
          onPin={() => onPin?.()}
          onFavorite={() => onFavorite?.()}
          onAddToList={() => onAddToList?.()}
          onClear={() => onClear?.()}
        />
      )}
    </div>
  );
}

export default ContactCard;
