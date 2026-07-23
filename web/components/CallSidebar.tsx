"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Search,
  ArrowLeft,
  PhoneCall,
  Trash2,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";
import Image from "next/image";
import { useCall } from "@/lib/call-context";
import {
  getCallHistory,
  deleteCallHistoryItem,
  getContacts,
  type CallHistoryItem,
  type Contact,
} from "@/lib/api";
import { getImageUrl } from "@/lib/utils";

interface CallSidebarProps {
  token: string | null;
  currentUserId?: string;
  onClose: () => void;
  onSelectChat?: (participantId: string) => void;
}

export default function CallSidebar({
  token,
  currentUserId,
  onClose,
  onSelectChat,
}: CallSidebarProps) {
  const { startCall } = useCall();
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "missed">("all");

  // New call modal state
  const [showNewCallModal, setShowNewCallModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  const fetchCalls = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await getCallHistory(token);
      setCalls(data || []);
    } catch (err) {
      console.error("Erro ao carregar histórico de chamadas:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const fetchContactsList = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingContacts(true);
      const data = await getContacts(token);
      setContacts(data || []);
    } catch (err) {
      console.error("Erro ao buscar contatos:", err);
    } finally {
      setLoadingContacts(false);
    }
  }, [token]);

  useEffect(() => {
    if (showNewCallModal && contacts.length === 0) {
      fetchContactsList();
    }
  }, [showNewCallModal, contacts.length, fetchContactsList]);

  const handleDeleteCall = async (e: React.MouseEvent, callId: string) => {
    e.stopPropagation();
    if (!token) return;
    try {
      setDeletingId(callId);
      await deleteCallHistoryItem(token, callId);
      setCalls((prev) => prev.filter((c) => c.id !== callId));
    } catch (err) {
      console.error("Erro ao excluir chamada:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartCall = (
    e: React.MouseEvent,
    targetUserId: string,
    targetUsername: string,
    isVideo: boolean,
    avatarUrl?: string | null,
  ) => {
    e.stopPropagation();
    setShowNewCallModal(false);
    startCall({
      targetUserId,
      targetUsername,
      isVideo,
      avatarUrl: avatarUrl || undefined,
    });
  };

  const formatDuration = (secs: number) => {
    if (!secs || secs === 0) return "";
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return mins > 0 ? `${mins}m ${remainingSecs}s` : `${remainingSecs}s`;
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return `Hoje, ${date.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}`;
      }
      if (diffDays === 1) {
        return `Ontem, ${date.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}`;
      }
      return date.toLocaleDateString("pt-BR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const filteredCalls = calls.filter((call) => {
    const isOutgoing = call.caller_id === currentUserId;
    const peerName = isOutgoing ? call.callee_username : call.caller_username;
    const matchesSearch = (peerName || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === "missed") {
      return (
        call.status === "missed" ||
        call.status === "rejected" ||
        call.status === "busy"
      );
    }
    return true;
  });

  const filteredContacts = contacts.filter((c) =>
    (c.name || c.username || "")
      .toLowerCase()
      .includes(contactSearch.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full w-full bg-surface animate-in slide-in-from-left duration-200">
      {/* Header Row */}
      <div className="py-4 px-2 border-b border-card-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 text-muted-text hover:text-foreground rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Voltar para conversas"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-bold">Ligações</h2>
        </div>

        <button
          onClick={() => setShowNewCallModal(true)}
          className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          title="Nova ligação"
        >
          <PhoneCall className="h-4 w-4" />
          <span>Nova chamada</span>
        </button>
      </div>

      {/* Search bar */}
      <div className="p-3 border-b border-card-border/60">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-muted-text" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar no histórico..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-card-border rounded-full bg-background text-foreground placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="px-3 py-2 border-b border-card-border/40 flex items-center gap-2">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeFilter === "all"
              ? "bg-emerald-600 text-white dark:bg-emerald-500 shadow-sm"
              : "bg-neutral-100 dark:bg-neutral-800 text-muted-text hover:text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700"
          }`}
        >
          Todas ({calls.length})
        </button>
        <button
          onClick={() => setActiveFilter("missed")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeFilter === "missed"
              ? "bg-emerald-600 text-white dark:bg-emerald-500 shadow-sm"
              : "bg-neutral-100 dark:bg-neutral-800 text-muted-text hover:text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700"
          }`}
        >
          Perdidas (
          {
            calls.filter(
              (c) =>
                c.status === "missed" ||
                c.status === "rejected" ||
                c.status === "busy",
            ).length
          }
          )
        </button>
      </div>

      {/* Call History List */}
      <div className="flex-1 overflow-y-auto divide-y divide-card-border/30 p-2 space-y-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-text space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            <span className="text-xs">Carregando histórico...</span>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <PhoneOff className="h-10 w-10 text-muted-text/40 mb-2" />
            <p className="text-sm font-semibold">Nenhuma chamada encontrada</p>
            <p className="text-xs text-muted-text mt-1">
              {activeFilter === "missed"
                ? "Você não possui chamadas perdidas no momento."
                : "Seu histórico de chamadas efetuadas e recebidas aparecerá aqui."}
            </p>
          </div>
        ) : (
          filteredCalls.map((call) => {
            const isOutgoing = call.caller_id === currentUserId;
            const peerId = isOutgoing ? call.callee_id : call.caller_id;
            const peerName = isOutgoing
              ? call.callee_username
              : call.caller_username;
            const peerAvatar = isOutgoing
              ? call.callee_avatar_url
              : call.caller_avatar_url;

            const isMissed =
              call.status === "missed" ||
              call.status === "rejected" ||
              call.status === "busy";

            return (
              <div
                key={call.id}
                onClick={() => onSelectChat?.(peerId)}
                className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {peerAvatar ? (
                      <Image
                        src={getImageUrl(peerAvatar)}
                        alt={peerName || "Usuário"}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover border border-card-border"
                        unoptimized
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                        {(peerName || "U")[0].toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold truncate ${
                        isMissed
                          ? "text-red-500 dark:text-red-400"
                          : "text-foreground"
                      }`}
                    >
                      {peerName || "Usuário"}
                    </p>

                    <div className="flex items-center gap-1.5 text-xs text-muted-text mt-0.5">
                      {/* Direction Icon */}
                      {isOutgoing ? (
                        <PhoneOutgoing className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      ) : isMissed ? (
                        <PhoneMissed className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                      ) : (
                        <PhoneIncoming className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      )}

                      <span className="truncate">
                        {formatDate(call.created_at)}
                      </span>

                      {call.duration > 0 && (
                        <span className="text-muted-text/80">
                          • {formatDuration(call.duration)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) =>
                      handleStartCall(e, peerId, peerName, false, peerAvatar)
                    }
                    className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors cursor-pointer"
                    title="Chamada de voz"
                  >
                    <Phone className="h-4 w-4" />
                  </button>

                  <button
                    onClick={(e) =>
                      handleStartCall(e, peerId, peerName, true, peerAvatar)
                    }
                    className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors cursor-pointer"
                    title="Chamada de vídeo"
                  >
                    <Video className="h-4 w-4" />
                  </button>

                  <button
                    onClick={(e) => handleDeleteCall(e, call.id)}
                    disabled={deletingId === call.id}
                    className="p-2 text-muted-text hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                    title="Excluir da lista"
                  >
                    {deletingId === call.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Call Contact Selector Modal */}
      {showNewCallModal && (
        <div className="absolute inset-0 bg-surface z-20 flex flex-col animate-in slide-in-from-bottom duration-200">
          <div className="p-4 border-b border-card-border flex items-center justify-between">
            <h3 className="font-bold text-lg">Nova Chamada</h3>
            <button
              onClick={() => setShowNewCallModal(false)}
              className="p-1.5 text-muted-text hover:text-foreground rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-3 border-b border-card-border/60">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-text" />
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Buscar contato..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-card-border rounded-full bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 divide-y divide-card-border/30">
            {loadingContacts ? (
              <div className="flex items-center justify-center py-10 text-muted-text gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs">Carregando contatos...</span>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-text flex items-center justify-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-muted-text/60" />
                Nenhum contato encontrado
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const name = contact.name || contact.username;
                return (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-3 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {contact.avatar_url ? (
                        <Image
                          src={getImageUrl(contact.avatar_url)}
                          alt={name}
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-xs">
                          {name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {name}
                        </p>
                        <p className="text-xs text-muted-text">
                          @{contact.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) =>
                          handleStartCall(
                            e,
                            contact.contact_id,
                            name,
                            false,
                            contact.avatar_url,
                          )
                        }
                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Iniciar chamada de áudio"
                      >
                        <Phone className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) =>
                          handleStartCall(
                            e,
                            contact.contact_id,
                            name,
                            true,
                            contact.avatar_url,
                          )
                        }
                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Iniciar chamada de vídeo"
                      >
                        <Video className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
