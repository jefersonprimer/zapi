"use client";

import { useEffect, useRef } from "react";
import {
  Archive,
  ArchiveRestore,
  Pin,
  PinOff,
  Star,
  StarOff,
  ListPlus,
  Trash2,
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
}: ChatCardContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
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

  const menuItems = [
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
      icon: isFavorite ? StarOff : Star,
      iconColor: isFavorite
        ? "text-amber-500 fill-amber-500/20"
        : "text-muted-text",
      onClick: () => {
        onFavorite();
        onClose();
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
      </div>
    </>
  );
}
