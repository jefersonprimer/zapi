"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Users,
  BellOff,
  MoreHorizontal,
  Mic,
  Camera,
  Video,
  FileText,
  Ban,
  PhoneOutgoing,
  PhoneIncoming,
  PhoneMissed,
  User,
  QrCode,
  StickyNote,
  Pin,
} from "lucide-react";
import type { ChatListItem, UserSearchResult } from "@/lib/api";
import { ChatCardContextMenu } from "./ChatCardContextMenu";
import { getImageUrl } from "@/lib/utils";
import { resolveLastMessagePreview } from "@/lib/forwardMessage";

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

  const rawAvatarUrl =
    targetChat?.participant_avatar_url ||
    targetChat?.avatar_url ||
    userResult?.avatar_url;

  const avatarUrl = getImageUrl(rawAvatarUrl);

  const lastMessageAt = targetChat?.last_message_at;
  const timeStr = lastMessageAt ? formatChatTime(lastMessageAt) : null;

  const unreadCount = targetChat?.unread_count || 0;
  const isPinned = targetChat?.is_pinned || false;
  const isMuted =
    targetChat?.notification_muted_forever ||
    !!targetChat?.notification_muted_until;
  const isGroup = targetChat?.is_group || false;

  const hasActions = !!targetChat && !!onArchive;

  const renderLastMessage = () => {
    if (targetChat?.is_blocked_by_me) {
      return {
        icon: null,
        text: "Você bloqueou esse contato",
      };
    }

    if (!targetChat?.last_message) {
      const fallbackText =
        (userResult?.username ? `@${userResult.username}` : userResult?.email) ||
        "Nenhuma mensagem ainda";
      return {
        icon: null,
        text: fallbackText,
      };
    }

    const lastMessage = resolveLastMessagePreview(targetChat.last_message);
    let displayMessage = lastMessage;
    let iconElement: React.ReactNode = null;

    if (
      lastMessage.startsWith("Audio") ||
      lastMessage.startsWith("🎵 Áudio")
    ) {
      let durationStr = "";
      const parts = lastMessage.split("|duration:");
      if (parts.length > 1) {
        const secs = parseInt(parts[1], 10);
        if (!isNaN(secs)) {
          const m = Math.floor(secs / 60);
          const s = secs % 60;
          durationStr = ` (${m}:${s < 10 ? "0" : ""}${s})`;
        }
      }
      displayMessage = `Mensagem de voz${durationStr}`;
      iconElement = <Mic className="h-3.5 w-3.5 shrink-0 opacity-70" />;
    } else if (lastMessage === "Photo" || lastMessage === "📷 Foto") {
      displayMessage = "Foto";
      iconElement = <Camera className="h-3.5 w-3.5 shrink-0 opacity-70" />;
    } else if (lastMessage === "Video" || lastMessage === "🎥 Vídeo") {
      displayMessage = "Vídeo";
      iconElement = <Video className="h-3.5 w-3.5 shrink-0 opacity-70" />;
    } else if (
      lastMessage === "File" ||
      lastMessage.startsWith("File|") ||
      lastMessage === "📁 Arquivo" ||
      lastMessage.startsWith("📁 Arquivo|") ||
      lastMessage.startsWith("Arquivo|")
    ) {
      let fileName = "Arquivo";
      let rawFileName = "";
      if (lastMessage.startsWith("File|")) {
        rawFileName = lastMessage.substring(5);
      } else if (lastMessage.startsWith("📁 Arquivo|")) {
        rawFileName = lastMessage.substring(11);
      } else if (lastMessage.startsWith("Arquivo|")) {
        rawFileName = lastMessage.substring(8);
      }

      if (rawFileName) {
        const match = rawFileName.match(/^[^_]+_[0-9a-fA-F\-]{36}_(.+)$/);
        if (match) {
          fileName = match[1];
        } else {
          const oldMatch = rawFileName.match(/^[^_]+_([0-9a-fA-F\-]{36}\..+)$/);
          fileName = oldMatch ? oldMatch[1] : rawFileName;
        }
      }

      displayMessage = fileName;
      iconElement = <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />;
    } else if (lastMessage === "Message deleted") {
      displayMessage = "Mensagem apagada";
      iconElement = <Ban className="h-3.5 w-3.5 shrink-0 opacity-70" />;
    } else if (lastMessage === "Chamada efetuada") {
      displayMessage = "Chamada efetuada";
      iconElement = <PhoneOutgoing className="h-3.5 w-3.5 shrink-0 opacity-60" />;
    } else if (lastMessage === "Chamada recebida") {
      displayMessage = "Chamada recebida";
      iconElement = <PhoneIncoming className="h-3.5 w-3.5 shrink-0 opacity-60" />;
    } else if (lastMessage === "Chamada perdida") {
      displayMessage = "Chamada perdida";
      iconElement = <PhoneMissed className="h-3.5 w-3.5 shrink-0 opacity-60 text-neutral-400 dark:text-neutral-500" />;
    } else if (lastMessage.startsWith('{"type":"contact_share"')) {
      try {
        const parsed = JSON.parse(lastMessage);
        displayMessage = parsed.username;
      } catch {
        displayMessage = "Contato";
      }
      iconElement = <User className="h-3.5 w-3.5 shrink-0 opacity-60" />;
    } else if (
      lastMessage.startsWith("Pix:") ||
      targetChat.last_message?.trimStart().startsWith('{"type":"pix_share"')
    ) {
      displayMessage = lastMessage.startsWith("Pix:")
        ? lastMessage.slice(5).trimStart()
        : "Chave Pix";
      iconElement = <QrCode className="h-3.5 w-3.5 shrink-0 opacity-60" />;
    } else if (
      lastMessage.startsWith("Nota:") ||
      targetChat.last_message?.trimStart().startsWith('{"type":"note_share"')
    ) {
      displayMessage = lastMessage.startsWith("Nota:")
        ? lastMessage.slice(5).trimStart()
        : "Nota";
      iconElement = <StickyNote className="h-3.5 w-3.5 shrink-0 opacity-60" />;
    }

    return {
      icon: iconElement,
      text: displayMessage,
    };
  };

  const lastMsgData = renderLastMessage();

  return (
    <div className="relative group">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className={`w-full flex items-center gap-3.5 p-3 rounded-xl transition-all duration-300 ease-out cursor-pointer text-left relative overflow-hidden outline-none ${
          isSelected
            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-[0_4px_20px_rgba(0,0,0,0.08)] scale-[0.99]"
            : "hover:bg-neutral-100/70 dark:hover:bg-neutral-900/60 text-foreground hover:translate-x-0.5"
        }`}
      >
        {/* Elegant indicator line inside the button */}
        <div
          className={`absolute left-0 top-[25%] bottom-[25%] w-[3px] rounded-r-full transition-all duration-300 origin-left ${
            isSelected
              ? "bg-white dark:bg-neutral-900 scale-y-100"
              : "bg-neutral-900 dark:bg-white scale-y-0"
          }`}
        />

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="h-11 w-11 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-sm font-medium border border-neutral-200/40 dark:border-neutral-700/40 text-neutral-800 dark:text-neutral-200 transition-transform duration-300 group-hover:scale-[1.04]">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={44}
                height={44}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          {isGroup && (
            <div className="absolute -bottom-1 -right-1 bg-neutral-800 dark:bg-neutral-700 text-white p-0.5 rounded-md text-[9px] shadow-sm">
              <Users className="h-3 w-3" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <h3
              className={`text-sm font-medium truncate tracking-tight transition-colors duration-200 ${
                isSelected ? "text-white dark:text-neutral-900" : "text-neutral-900 dark:text-neutral-100"
              }`}
            >
              {displayName}
            </h3>
            {timeStr && (
              <span
                className={`text-[10px] tracking-wide transition-colors duration-200 ${
                  isSelected
                    ? "text-neutral-400 dark:text-neutral-500"
                    : "text-neutral-400 dark:text-neutral-500"
                }`}
              >
                {timeStr}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between min-w-0 relative">
            <div className="flex items-center gap-1.5 min-w-0 max-w-[180px]">
              {lastMsgData.icon}
              <span
                className={`text-[11px] truncate transition-colors duration-200 ${
                  isSelected
                    ? "text-neutral-300 dark:text-neutral-600"
                    : "text-neutral-500 dark:text-neutral-400"
                } ${
                  unreadCount > 0
                    ? "font-semibold text-neutral-900 dark:text-neutral-100"
                    : ""
                }`}
              >
                {lastMsgData.text}
              </span>
            </div>

            <div
              className={`flex items-center gap-1.5 shrink-0 ml-2 transition-transform duration-300 ease-out ${
                hasActions ? "group-hover:-translate-x-7" : ""
              }`}
            >
              {isPinned && (
                <Pin className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 fill-neutral-400 dark:fill-neutral-500 rotate-45" />
              )}
              {isMuted && (
                <BellOff className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
              )}
              {unreadCount > 0 && (
                <span
                  className={`min-w-[18px] h-[18px] flex items-center justify-center px-1.5 text-[9px] font-semibold rounded-full transition-all duration-300 ${
                    isSelected
                      ? "bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white"
                      : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </div>

            {/* More options button - visible on hover, aligned with the row items */}
            {hasActions && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowContextMenu(true);
                }}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 hover:scale-105 transition-all duration-200 cursor-pointer z-10"
              >
                <MoreHorizontal
                  className={`h-4 w-4 ${
                    isSelected
                      ? "text-white dark:text-neutral-900"
                      : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                  }`}
                />
              </button>
            )}
          </div>
        </div>
      </div>

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
