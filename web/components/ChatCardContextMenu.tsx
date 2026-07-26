"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Pin,
  PinOff,
  Heart,
  HeartOff,
  ListPlus,
  Trash2,
  Bell,
  BellOff,
  Ban,
  ChevronLeft,
} from "lucide-react";
import type { ChatListItem } from "@/lib/api";

interface ChatCardContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  chat: ChatListItem;
  onArchive: () => void;
  onPin: () => void;
  onFavorite: () => void;
  onAddToList: () => void;
  onClear: () => void;
  onMute?: (unmute: boolean, forever?: boolean, hours?: number) => void;
  onBlock?: () => void;
}

export function ChatCardContextMenu({
  isOpen,
  onClose,
  chat,
  onArchive,
  onPin,
  onFavorite,
  onAddToList,
  onClear,
  onMute,
  onBlock,
}: ChatCardContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMuteOptions, setShowMuteOptions] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setShowMuteOptions(false), 0);
      return;
    }
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isArchived = !!chat.is_archived;
  const isPinned = !!chat.is_pinned;
  const isFavorite = !!chat.is_favorite;
  const isMuted = chat.notification_muted_forever || !!chat.notification_muted_until;

  const handleMuteOptionClick = (forever: boolean, hours?: number) => {
    onMute?.(false, forever, hours);
    onClose();
  };

  const menuItems = [
    {
      label: isPinned ? "Desafixar conversa" : "Fixar conversa",
      icon: isPinned ? PinOff : Pin,
      iconColor: "text-muted-text",
      onClick: () => {
        onPin();
        onClose();
      },
    },
    {
      label: isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos",
      icon: isFavorite ? HeartOff : Heart,
      iconColor: isFavorite
        ? "text-amber-500 fill-amber-500/20"
        : "text-muted-text",
      onClick: () => {
        onFavorite();
        onClose();
      },
    },
    {
      label: isArchived ? "Desarquivar conversa" : "Arquivar conversa",
      icon: isArchived ? ArchiveRestore : Archive,
      iconColor: "text-muted-text",
      onClick: () => {
        onArchive();
        onClose();
      },
    },
    {
      label: isMuted ? "Desativar silêncio" : "Silenciar notificações",
      icon: isMuted ? Bell : BellOff,
      iconColor: "text-muted-text",
      onClick: () => {
        if (isMuted) {
          onMute?.(true);
          onClose();
        } else {
          setShowMuteOptions(true);
        }
      },
    },
    {
      label: "Adicionar a lista",
      icon: ListPlus,
      iconColor: "text-muted-text",
      onClick: () => {
        onAddToList();
        onClose();
      },
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={menuRef}
        className="absolute right-0 mt-0 w-60 bg-card-bg border border-card-border rounded-2xl shadow-2xl z-50 py-2 backdrop-blur-md animate-fadeIn"
      >
        {showMuteOptions ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-card-border/50 text-xs font-semibold text-muted-text">
              <button
                onClick={() => setShowMuteOptions(false)}
                className="p-1 -ml-1 rounded-md hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>Silenciar por...</span>
            </div>
            <button
              onClick={() => handleMuteOptionClick(false, 8)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-left font-medium cursor-pointer"
            >
              <span>8 horas</span>
            </button>
            <button
              onClick={() => handleMuteOptionClick(false, 168)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-left font-medium cursor-pointer"
            >
              <span>1 semana</span>
            </button>
            <button
              onClick={() => handleMuteOptionClick(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-left font-medium cursor-pointer"
            >
              <span>Sempre</span>
            </button>
          </>
        ) : (
          <>
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-left font-medium cursor-pointer"
              >
                <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                <span>{item.label}</span>
              </button>
            ))}

            <div className="my-1.5 border-t border-card-border" />

            <button
              onClick={() => {
                onClear();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-left font-medium cursor-pointer"
            >
              <Trash2 className="h-4 w-4 text-muted-text" />
              <span>Limpar conversa</span>
            </button>

            {!chat.is_group && (
              <button
                onClick={() => {
                  onBlock?.();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-left font-medium cursor-pointer"
              >
                <Ban className="h-4 w-4 text-muted-text" />
                <span>{chat.is_blocked_by_me ? "Desbloquear contato" : "Bloquear contato"}</span>
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
