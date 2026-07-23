"use client";

import React, { useState } from "react";
import {
  Hash,
  MessageSquare,
  Calendar,
  ChevronDown,
  Plus,
  Settings,
  UserPlus,
  LogOut,
  Mic,
  MicOff,
} from "lucide-react";
import { Community, CommunityChannel } from "@/lib/community-types";

interface CommunitySidebarProps {
  community: Community;
  channels: CommunityChannel[];
  selectedChannelId: string | null;
  activeView: "chat" | "posts" | "events";
  onSelectChannel: (channel: CommunityChannel) => void;
  onOpenCreateChannelModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenInviteModal: () => void;
  onLeaveCommunity: () => void;
}

export const CommunitySidebar: React.FC<CommunitySidebarProps> = ({
  community,
  channels,
  selectedChannelId,
  activeView,
  onSelectChannel,
  onOpenCreateChannelModal,
  onOpenSettingsModal,
  onOpenInviteModal,
  onLeaveCommunity,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const textChannels = channels.filter((c) => c.type === "text");
  const forumChannels = channels.filter((c) => c.type === "forum");
  const eventChannels = channels.filter((c) => c.type === "event");

  return (
    <div className="w-60 md:w-64 bg-zinc-950 border-r border-zinc-800/80 flex flex-col h-full select-none shrink-0 relative">
      {/* Community Header Banner & Name */}
      <div className="relative border-b border-zinc-800/80">
        <div
          onClick={() => setShowMenu(!showMenu)}
          className="h-14 px-4 flex items-center justify-between cursor-pointer hover:bg-zinc-900/60 transition-colors"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="font-bold text-sm text-zinc-100 truncate">
              {community.name}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
              showMenu ? "rotate-180 text-zinc-100" : ""
            }`}
          />
        </div>

        {/* Dropdown Menu */}
        {showMenu && (
          <div className="absolute top-16 left-3 right-3 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 shadow-2xl z-30 space-y-1 animate-in fade-in zoom-in-95">
            <button
              onClick={() => {
                setShowMenu(false);
                onOpenInviteModal();
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <span>Convidar Pessoas</span>
              <UserPlus className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            <button
              onClick={() => {
                setShowMenu(false);
                onOpenSettingsModal();
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <span>Configurações do Servidor</span>
              <Settings className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            <button
              onClick={() => {
                setShowMenu(false);
                onOpenCreateChannelModal();
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <span>Criar Canal</span>
              <Plus className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            <div className="h-[1px] bg-zinc-800 my-1" />

            <button
              onClick={() => {
                setShowMenu(false);
                onLeaveCommunity();
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
            >
              <span>Sair da Comunidade</span>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 no-scrollbar">
        {/* Text Channels Group */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-400">
              Canais de Texto ({textChannels.length})
            </span>
            <button
              onClick={onOpenCreateChannelModal}
              title="Criar canal de texto"
              className="text-zinc-400 hover:text-zinc-200 p-0.5 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {textChannels.map((channel) => {
              const isSelected = selectedChannelId === channel.id && activeView === "chat";
              return (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "bg-zinc-800 text-zinc-100 font-semibold border-l-2 border-zinc-200"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <Hash className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{channel.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Forum / Discussion Channels Group */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-400">
              Fóruns & Tópicos ({forumChannels.length})
            </span>
            <button
              onClick={onOpenCreateChannelModal}
              title="Criar fórum"
              className="text-zinc-400 hover:text-zinc-200 p-0.5 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {forumChannels.map((channel) => {
              const isSelected = selectedChannelId === channel.id && activeView === "posts";
              return (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "bg-zinc-800 text-zinc-100 font-semibold border-l-2 border-zinc-200"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{channel.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Events Channels Group */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-400">
              Eventos ({eventChannels.length})
            </span>
            <button
              onClick={onOpenCreateChannelModal}
              title="Criar canal de eventos"
              className="text-zinc-400 hover:text-zinc-200 p-0.5 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {eventChannels.map((channel) => {
              const isSelected = selectedChannelId === channel.id && activeView === "events";
              return (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "bg-zinc-800 text-zinc-100 font-semibold border-l-2 border-zinc-200"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{channel.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* User Footer Controls Bar */}
      <div className="h-14 bg-black border-t border-zinc-800/80 px-3 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-200 shrink-0">
            Z
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-semibold text-zinc-200 truncate">
              Meu Usuário
            </span>
            <span className="text-[10px] text-zinc-400 truncate">Online</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
            title={isMuted ? "Desmutar microfone" : "Mutar microfone"}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={onOpenSettingsModal}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
            title="Configurações do Servidor"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
