"use client";

import React from "react";
import {
  Hash,
  MessageSquare,
  Calendar,
  Users,
  Search,
  Plus,
} from "lucide-react";
import { CommunityChannel } from "@/lib/community-types";

interface CommunityHeaderProps {
  currentChannel: CommunityChannel | null;
  activeView: "chat" | "posts" | "events";
  showMemberList: boolean;
  onToggleMemberList: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenCreateActionModal: () => void;
}

export const CommunityHeader: React.FC<CommunityHeaderProps> = ({
  currentChannel,
  activeView,
  showMemberList,
  onToggleMemberList,
  searchQuery,
  onSearchChange,
  onOpenCreateActionModal,
}) => {
  const getIcon = () => {
    if (!currentChannel) return <Hash className="w-5 h-5 text-zinc-400" />;
    switch (currentChannel.type) {
      case "forum":
        return <MessageSquare className="w-5 h-5 text-zinc-400" />;
      case "event":
        return <Calendar className="w-5 h-5 text-zinc-400" />;
      default:
        return <Hash className="w-5 h-5 text-zinc-400" />;
    }
  };

  return (
    <header className="h-14 bg-zinc-950 border-b border-zinc-800/80 px-4 flex items-center justify-between z-10 shrink-0 select-none">
      {/* Channel Title & Description */}
      <div className="flex items-center gap-2 overflow-hidden">
        {getIcon()}
        <span className="font-bold text-sm text-zinc-100 truncate">
          {currentChannel ? currentChannel.name : "geral"}
        </span>

        {currentChannel?.description && (
          <>
            <div className="w-[1px] h-4 bg-zinc-800 mx-2 hidden md:block" />
            <span className="text-xs text-zinc-400 truncate hidden md:block max-w-xs lg:max-w-md">
              {currentChannel.description}
            </span>
          </>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Create Action Button based on View */}
        {activeView === "posts" && (
          <button
            onClick={onOpenCreateActionModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-black rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Criar Tópico</span>
          </button>
        )}

        {activeView === "events" && (
          <button
            onClick={onOpenCreateActionModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-black rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Evento</span>
          </button>
        )}

        {/* Search Bar */}
        <div className="relative hidden sm:block">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-36 lg:w-48 bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-all"
          />
        </div>

        {/* Member List Toggle */}
        <button
          onClick={onToggleMemberList}
          title="Lista de Membros"
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            showMemberList
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
          }`}
        >
          <Users className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
