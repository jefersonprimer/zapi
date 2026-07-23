"use client";

import React, { useState } from "react";
import { Compass, Search, Users, Plus } from "lucide-react";
import Image from "next/image";
import { getImageUrl } from "@/lib/utils";
import { Community } from "@/lib/community-types";

interface CommunityExploreViewProps {
  communities: Community[];
  onSelectCommunity: (id: string) => void;
  onJoinCommunity: (id: string) => void;
  onOpenCreateModal: () => void;
}

const CATEGORIES = ["Todos", "Tecnologia", "Design", "Engenharia", "Negócios", "Geral"];

export const CommunityExploreView: React.FC<CommunityExploreViewProps> = ({
  communities,
  onSelectCommunity,
  onJoinCommunity,
  onOpenCreateModal,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  const filteredCommunities = communities.filter((comm) => {
    const matchesSearch =
      comm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (comm.description && comm.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === "Todos" || comm.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-y-auto no-scrollbar">
      {/* Hero Header Banner */}
      <div className="relative bg-zinc-900 border-b border-zinc-800 p-8 sm:p-12 overflow-hidden">
        <div className="max-w-4xl mx-auto space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-xs font-semibold text-zinc-300">
            <Compass className="w-3.5 h-3.5" />
            <span>Descubra Comunidades Zapi</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-zinc-100 tracking-tight">
            Encontre seu grupo no ecossistema
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
            Conecte-se com desenvolvedores, designers e entusiastas. Participe de canais de texto, fóruns de debate e eventos em tempo real.
          </p>

          {/* Search bar inside Hero */}
          <div className="pt-4 flex flex-col sm:flex-row gap-3 max-w-lg">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar comunidades por nome ou interesse..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-all shadow-inner"
              />
            </div>

            <button
              onClick={onOpenCreateModal}
              className="flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-black px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Comunidade</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl w-full mx-auto p-6 sm:p-8 space-y-6">
        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedCategory === cat
                  ? "bg-zinc-100 text-black shadow-sm"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Communities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCommunities.map((community) => (
            <div
              key={community.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all duration-200 flex flex-col justify-between group shadow-sm"
            >
              <div>
                {/* Banner */}
                <div className="h-28 bg-zinc-950 relative border-b border-zinc-800/80">
                  {community.banner_url && (
                    <Image
                      src={getImageUrl(community.banner_url)}
                      alt={community.name}
                      width={400}
                      height={120}
                      className="w-full h-full object-cover grayscale brightness-75 group-hover:brightness-90 transition-all"
                      unoptimized
                    />
                  )}

                  {/* Icon floating */}
                  <div className="absolute -bottom-5 left-4 w-12 h-12 rounded-2xl bg-zinc-900 border-2 border-zinc-950 overflow-hidden flex items-center justify-center shadow-lg">
                    {community.icon_url ? (
                      <Image
                        src={getImageUrl(community.icon_url)}
                        alt={community.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover grayscale"
                        unoptimized
                      />
                    ) : (
                      <span className="font-bold text-xs text-zinc-200">
                        {community.name.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="p-5 pt-8 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                      {community.category || "Geral"}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <Users className="w-3 h-3" /> {community.member_count} membros
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-zinc-100 group-hover:text-zinc-50 transition-colors">
                    {community.name}
                  </h3>

                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {community.description || "Sem descrição disponível."}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-5 pt-0 flex items-center gap-2">
                <button
                  onClick={() => onSelectCommunity(community.id)}
                  className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Visualizar
                </button>

                <button
                  onClick={() => onJoinCommunity(community.id)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-black rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  Entrar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
