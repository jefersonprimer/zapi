"use client";

import { Plus, Check, BadgeCheck } from "lucide-react";
import Image from "next/image";
import type { StoryGroup } from "@/lib/updates-api";
import { getImageUrl } from "@/lib/utils";

interface StoryBarProps {
  myAvatarUrl: string | null;
  groups: StoryGroup[];
  onMyStoryPress: () => void;
  onStoryPress: (group: StoryGroup) => void;
}

export default function StoryBar({
  myAvatarUrl,
  groups,
  onMyStoryPress,
  onStoryPress,
}: StoryBarProps) {
  return (
    <div className="w-full bg-white dark:bg-[#11111e] rounded-2xl border border-card-border/60 p-4 shadow-sm">
      <div className="flex items-center gap-4 overflow-x-auto pb-2 pt-1 scrollbar-none">
        {/* My Story item */}
        <div className="flex flex-col items-center flex-shrink-0 group cursor-pointer" onClick={onMyStoryPress}>
          <div className="relative mb-1.5">
            <div className="w-16 h-16 rounded-full p-0.5 border-2 border-dashed border-emerald-500/60 dark:border-emerald-400/60 group-hover:border-emerald-500 transition-all duration-300 transform group-hover:scale-105">
              <div className="w-full h-full rounded-full overflow-hidden relative bg-neutral-200 dark:bg-neutral-800">
                {myAvatarUrl ? (
                  <Image
                    src={getImageUrl(myAvatarUrl)}
                    alt="Meu Status"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
                    M
                  </div>
                )}
              </div>
            </div>
            <div className="absolute right-0 bottom-0 bg-emerald-600 text-white p-1 rounded-full border-2 border-white dark:border-[#11111e] shadow-md group-hover:scale-110 transition-transform">
              <Plus className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[72px] text-center">
            Seu status
          </span>
          <span className="text-[10px] text-muted-text">Adicionar</span>
        </div>

        <div className="h-10 w-[1px] bg-card-border/60 mx-1 flex-shrink-0" />

        {/* Story Groups list */}
        {groups.map((group) => {
          const avatarSrc = getImageUrl(group.publisher_avatar);
          const hasUnseen = !group.all_viewed;

          return (
            <div
              key={group.publisher_id}
              onClick={() => onStoryPress(group)}
              className="flex flex-col items-center flex-shrink-0 group cursor-pointer select-none"
            >
              <div className="relative mb-1.5">
                <div
                  className={`w-16 h-16 rounded-full p-[2.5px] transition-all duration-300 transform group-hover:scale-105 ${
                    hasUnseen
                      ? "bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 shadow-md shadow-emerald-500/20"
                      : "bg-neutral-300 dark:bg-neutral-700 opacity-80"
                  }`}
                >
                  <div className="w-full h-full rounded-full overflow-hidden relative bg-neutral-100 dark:bg-neutral-900 border-2 border-white dark:border-[#11111e]">
                    {avatarSrc ? (
                      <Image
                        src={avatarSrc}
                        alt={group.publisher_name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-sm">
                        {group.publisher_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5 max-w-[76px]">
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate text-center">
                  {group.publisher_name}
                </span>
                {group.is_verified && (
                  <BadgeCheck className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                )}
              </div>
              <span className="text-[10px] text-muted-text">
                {group.stories.length} {group.stories.length === 1 ? "novo" : "novos"}
              </span>
            </div>
          );
        })}

        {groups.length === 0 && (
          <div className="flex items-center text-xs text-muted-text py-2 px-3 italic">
            Nenhuma atualização recente de contatos
          </div>
        )}
      </div>
    </div>
  );
}
