"use client";

import React, { useState } from "react";
import { Shield, VolumeX, UserX, Crown } from "lucide-react";
import Image from "next/image";
import { getImageUrl } from "@/lib/utils";
import { CommunityMember, MemberRole } from "@/lib/community-types";

interface CommunityMemberListProps {
  members: CommunityMember[];
  currentUserId: string;
  onUpdateRole: (userId: string, role: MemberRole) => void;
  onToggleMute: (userId: string) => void;
  onRemoveMember: (userId: string) => void;
}

export const CommunityMemberList: React.FC<CommunityMemberListProps> = ({
  members,
  currentUserId: _currentUserId,
  onUpdateRole,
  onToggleMute,
  onRemoveMember,
}) => {
  const [selectedMember, setSelectedMember] = useState<CommunityMember | null>(null);

  const owners = members.filter((m) => m.role === "owner");
  const admins = members.filter((m) => m.role === "admin");
  const regularMembers = members.filter((m) => m.role === "member");

  const renderMemberSection = (title: string, memberList: CommunityMember[]) => {
    if (memberList.length === 0) return null;

    return (
      <div className="mb-4">
        <h4 className="text-[11px] font-bold tracking-wider uppercase text-zinc-400 px-2 mb-2">
          {title} — {memberList.length}
        </h4>

        <div className="space-y-1">
          {memberList.map((member) => (
            <div
              key={member.user_id}
              onClick={() => setSelectedMember(selectedMember?.user_id === member.user_id ? null : member)}
              className="relative flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-zinc-900 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="relative w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
                  {member.avatar_url ? (
                    <Image
                      src={getImageUrl(member.avatar_url)}
                      alt={member.nickname || member.username || "User"}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover grayscale"
                      unoptimized
                    />
                  ) : (
                    <span className="font-bold text-xs text-zinc-300">
                      {(member.nickname || member.username || "U")[0].toUpperCase()}
                    </span>
                  )}

                  {/* Online dot */}
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${
                      member.online ? "bg-zinc-100" : "bg-zinc-600"
                    }`}
                  />
                </div>

                <div className="flex flex-col overflow-hidden">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-zinc-200 truncate">
                      {member.nickname || member.username || "Membro"}
                    </span>

                    {member.role === "owner" && (
                      <span title="Dono">
                        <Crown className="w-3 h-3 text-zinc-200 shrink-0" />
                      </span>
                    )}
                    {member.role === "admin" && (
                      <span title="Admin">
                        <Shield className="w-3 h-3 text-zinc-400 shrink-0" />
                      </span>
                    )}
                  </div>
                  {member.muted && (
                    <span className="text-[10px] text-zinc-400 font-medium">Mutado</span>
                  )}
                </div>
              </div>

              {/* Popup Menu */}
              {selectedMember?.user_id === member.user_id && (
                <div className="absolute right-2 top-10 w-44 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 shadow-2xl z-40 space-y-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMute(member.user_id);
                      setSelectedMember(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 rounded-lg"
                  >
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>{member.muted ? "Desmutar" : "Mutar Membro"}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateRole(member.user_id, member.role === "admin" ? "member" : "admin");
                      setSelectedMember(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 rounded-lg"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>{member.role === "admin" ? "Remover Admin" : "Tornar Admin"}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveMember(member.user_id);
                      setSelectedMember(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-lg"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Expulsar Membro</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <aside className="w-60 bg-zinc-950 border-l border-zinc-800/80 h-full p-3 select-none shrink-0 overflow-y-auto hidden lg:block no-scrollbar">
      {renderMemberSection("Proprietário", owners)}
      {renderMemberSection("Administradores", admins)}
      {renderMemberSection("Membros da Comunidade", regularMembers)}
    </aside>
  );
};
