"use client";

import React from "react";
import { Plus, Compass, Hash } from "lucide-react";
import Image from "next/image";
import { getImageUrl } from "@/lib/utils";
import { Community } from "@/lib/community-types";

interface CommunityServerListProps {
  communities: Community[];
  selectedCommunityId: string | null;
  onSelectCommunity: (id: string | null) => void;
  onOpenCreateModal: () => void;
  onOpenJoinModal: () => void;
}

export const CommunityServerList: React.FC<CommunityServerListProps> = ({
  communities,
  selectedCommunityId,
  onSelectCommunity,
  onOpenCreateModal,
  onOpenJoinModal,
}) => {
  return (
    <aside className="w-18 md:w-20 bg-black border-r border-zinc-800/80 flex flex-col items-center py-4 gap-3 select-none z-20 shrink-0">
      {/* Zapi Communities Home / Discover Icon */}
      <div className="relative group">
        <button
          onClick={() => onSelectCommunity(null)}
          title="Explorar Comunidades"
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
            selectedCommunityId === null
              ? "bg-zinc-100 text-black shadow-lg shadow-white/5 scale-105"
              : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 hover:rounded-xl"
          }`}
        >
          <Compass className="w-6 h-6" />
        </button>
        {/* Active Pill Indicator */}
        {selectedCommunityId === null && (
          <div className="absolute -left-3 top-2.5 w-1.5 h-7 bg-zinc-100 rounded-r-full" />
        )}
      </div>

      <div className="w-8 h-[1px] bg-zinc-800 my-1" />

      {/* Community Server Icons List */}
      <div className="flex-1 w-full flex flex-col items-center gap-2.5 overflow-y-auto no-scrollbar px-2">
        {communities.map((community) => {
          const isSelected = selectedCommunityId === community.id;
          const initial = community.name.substring(0, 2).toUpperCase();

          return (
            <div key={community.id} className="relative group w-full flex justify-center">
              {/* Left active Pill */}
              <div
                className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 rounded-r-full bg-zinc-100 transition-all duration-200 ${
                  isSelected ? "h-8" : "h-0 group-hover:h-4"
                }`}
              />

              <button
                onClick={() => onSelectCommunity(community.id)}
                title={community.name}
                className={`relative w-12 h-12 overflow-hidden flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? "rounded-xl border-2 border-zinc-100 shadow-md shadow-white/5"
                    : "rounded-2xl hover:rounded-xl bg-zinc-900 hover:bg-zinc-800"
                }`}
              >
                {community.icon_url ? (
                  <Image
                    src={getImageUrl(community.icon_url)}
                    alt={community.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover grayscale brightness-90 contrast-125 group-hover:grayscale-0 transition-all duration-300"
                    unoptimized
                  />
                ) : (
                  <span className="font-bold text-xs text-zinc-200 tracking-wider">
                    {initial}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="w-8 h-[1px] bg-zinc-800 my-1" />

      {/* Action Buttons: Add Community & Join Code */}
      <div className="flex flex-col items-center gap-2.5">
        <button
          onClick={onOpenCreateModal}
          title="Criar nova comunidade"
          className="w-12 h-12 rounded-2xl bg-zinc-900 text-zinc-400 hover:bg-zinc-100 hover:text-black hover:rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer shadow-sm"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          onClick={onOpenJoinModal}
          title="Entrar com Código de Convite"
          className="w-12 h-12 rounded-2xl bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 hover:rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer"
        >
          <Hash className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
};
