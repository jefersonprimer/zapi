"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff, Search, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useCall } from "@/lib/call-context";
import { useAuth } from "@/lib/auth-context";
import { getCallHistory, deleteCallHistoryItem, getContacts, type CallHistoryItem, type Contact } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";

export default function CallsPage() {
  const { token, user } = useAuth();
  const { startCall } = useCall();
  const router = useRouter();

  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "missed">("all");
  const [showCallModal, setShowCallModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [modalSearch, setModalSearch] = useState("");

  useEffect(() => {
    if (!token) {
      router.replace("/login");
    }
  }, [token, router]);

  const fetchCalls = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await getCallHistory(token);
      setCalls(data);
    } catch (err) {
      console.error("Failed to fetch call history:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      await Promise.resolve();
      if (active) fetchCalls();
    };
    init();
    return () => { active = false; };
  }, [fetchCalls]);

  const fetchContacts = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingContacts(true);
      const data = await getContacts(token);
      setContacts(data);
    } catch (err) {
      console.error("Failed to fetch contacts:", err);
    } finally {
      setLoadingContacts(false);
    }
  }, [token]);

  useEffect(() => {
    if (showCallModal && contacts.length === 0) {
      fetchContacts();
    }
  }, [showCallModal, contacts.length, fetchContacts]);

  const formatDuration = (secs: number) => {
    if (secs === 0) return "";
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return mins > 0 ? `${mins}m ${remainingSecs}s` : `${remainingSecs}s`;
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Hoje, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (diffDays === 1) {
      return `Ontem, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return date.toLocaleDateString("pt-BR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDeleteCall = async (callId: string) => {
    if (!token) return;
    try {
      setDeleting(callId);
      await deleteCallHistoryItem(token, callId);
      setCalls((prev) => prev.filter((c) => c.id !== callId));
    } catch (err) {
      console.error("Failed to delete call:", err);
    } finally {
      setDeleting(null);
    }
  };

  const handleStartCall = (targetUserId: string, targetUsername: string, avatarUrl?: string | null) => {
    setShowCallModal(false);
    setModalSearch("");
    startCall({
      targetUserId,
      targetUsername,
      isVideo: false,
      avatarUrl: avatarUrl || undefined,
    });
  };

  const filteredCalls = calls.filter((call) => {
    const isOutgoing = call.caller_id === user?.user_id;
    const peerName = isOutgoing ? call.callee_username : call.caller_username;
    const matchesSearch = peerName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === "missed") {
      return call.status === "missed" || call.status === "rejected" || call.status === "busy";
    }
    return true;
  });

  const recentContacts = calls.slice(0, 5).reduce<{ id: string; name: string; avatar: string | null }[]>((acc, call) => {
    const isOutgoing = call.caller_id === user?.user_id;
    const peerId = isOutgoing ? call.callee_id : call.caller_id;
    const peerName = isOutgoing ? call.callee_username : call.caller_username;
    const peerAvatar = isOutgoing ? call.callee_avatar_url : call.caller_avatar_url;
    if (!acc.find((c) => c.id === peerId)) {
      acc.push({ id: peerId, name: peerName, avatar: peerAvatar || null });
    }
    return acc;
  }, []);

  const filteredContacts = contacts.filter((c) =>
    (c.name || c.username).toLowerCase().includes(modalSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#fafafa] dark:bg-[#0c0c14] items-center justify-center">
        <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-text text-sm mt-3">Carregando histórico...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#fafafa] dark:bg-[#0c0c14] overflow-y-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-8 text-white relative overflow-hidden shadow-lg">
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-12 translate-y-12">
          <Phone className="h-64 w-64 rotate-12 animate-pulse" style={{ animationDuration: "4s" }} />
        </div>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Histórico de Ligações</h1>
            <p className="text-emerald-100 mt-1 text-sm md:text-base">
              Acompanhe e faça chamadas de voz e vídeo com seus contatos instantaneamente.
            </p>
          </div>
          <button
            onClick={() => setShowCallModal(true)}
            className="self-start md:self-auto flex items-center gap-2 bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nova Chamada
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl w-full mx-auto px-4 py-8 flex-grow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left Column: Quick Actions & Search */}
          <div className="md:col-span-1 space-y-6">
            {/* Search */}
            <div className="bg-white dark:bg-[#11111e] rounded-2xl p-4 border border-card-border/60 shadow-sm">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-text" />
                <input
                  type="text"
                  placeholder="Buscar no histórico..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-white/5 border-0 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-[#151528] transition-all outline-none"
                />
              </div>
            </div>

            {/* Quick Contacts to Call card */}
            <div className="bg-white dark:bg-[#11111e] rounded-2xl p-5 border border-card-border/60 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">Contatos Recentes</h3>
              {recentContacts.length === 0 ? (
                <p className="text-xs text-muted-text">Nenhum contato recente</p>
              ) : (
                <div className="space-y-3">
                  {recentContacts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {c.avatar ? (
                          <Image
                            src={getImageUrl(c.avatar)}
                            alt={c.name}
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                            {c.name[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{c.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleStartCall(c.id, c.name, c.avatar)}
                          className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/5 text-emerald-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setShowCallModal(false);
                            startCall({
                              targetUserId: c.id,
                              targetUsername: c.name,
                              isVideo: true,
                              avatarUrl: c.avatar || undefined,
                            });
                          }}
                          className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/5 text-emerald-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <Video className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Call Logs List */}
          <div className="md:col-span-2 space-y-6">
            {/* Filter Tabs */}
            <div className="flex border-b border-card-border/60 gap-6">
              <button
                onClick={() => setActiveFilter("all")}
                className={`pb-3 text-sm font-semibold relative transition-all cursor-pointer ${
                  activeFilter === "all"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-text hover:text-foreground"
                }`}
              >
                Todas as chamadas
                {activeFilter === "all" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded" />
                )}
              </button>
              <button
                onClick={() => setActiveFilter("missed")}
                className={`pb-3 text-sm font-semibold relative transition-all cursor-pointer ${
                  activeFilter === "missed"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-text hover:text-foreground"
                }`}
              >
                Perdidas
                {activeFilter === "missed" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded" />
                )}
              </button>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-[#11111e] rounded-2xl border border-card-border/60 shadow-sm overflow-hidden divide-y divide-card-border/40">
              {filteredCalls.length === 0 ? (
                <div className="py-12 text-center">
                  <Phone className="h-10 w-10 text-gray-300 dark:text-neutral-700 mx-auto mb-3 animate-pulse" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {searchQuery || activeFilter === "missed"
                      ? "Nenhuma chamada encontrada."
                      : "Nenhuma ligação no histórico."}
                  </p>
                </div>
              ) : (
                filteredCalls.map((call) => {
                  const isOutgoing = call.caller_id === user?.user_id;
                  const peerName = isOutgoing ? call.callee_username : call.caller_username;
                  const peerId = isOutgoing ? call.callee_id : call.caller_id;
                  const peerAvatar = isOutgoing ? call.callee_avatar_url : call.caller_avatar_url;
                  const avatarUrl = getImageUrl(peerAvatar);

                  if (!peerName) return null;

                  let StatusIcon = PhoneIncoming;
                  let iconColor = "#34C759";

                  if (isOutgoing) {
                    StatusIcon = PhoneOutgoing;
                  }

                  const isMissed =
                    call.status === "missed" ||
                    call.status === "rejected" ||
                    call.status === "busy";

                  if (isMissed) {
                    StatusIcon = PhoneMissed;
                    iconColor = "#FF3B30";
                  } else if (call.status === "failed") {
                    StatusIcon = PhoneOff;
                    iconColor = "#FF9500";
                  }

                  const isDeleting = deleting === call.id;

                  return (
                    <div
                      key={call.id}
                      className="p-4 flex items-center justify-between group hover:bg-neutral-50 dark:hover:bg-white/5 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        {/* Avatar */}
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={peerName}
                            width={44}
                            height={44}
                            className="h-11 w-11 rounded-full object-cover border border-neutral-200 dark:border-neutral-800"
                            unoptimized
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold border border-neutral-200 dark:border-neutral-800">
                            {peerName[0]?.toUpperCase()}
                          </div>
                        )}

                        {/* Call Details */}
                        <div className="space-y-1">
                          <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{peerName}</h4>
                          <div className="flex items-center gap-1.5 text-xs text-muted-text">
                            <StatusIcon className="h-3.5 w-3.5" style={{ color: iconColor }} />
                            <span className={isMissed ? "text-red-500 font-semibold" : ""}>
                              {isMissed
                                ? "Perdida"
                                : isOutgoing
                                ? "Efetuada"
                                : "Recebida"}
                            </span>
                            <span>•</span>
                            <span>{formatDate(call.created_at)}</span>
                            {call.duration > 0 && (
                              <>
                                <span>•</span>
                                <span>{formatDuration(call.duration)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartCall(peerId, peerName, peerAvatar)}
                          className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600 rounded-xl transition-all cursor-pointer active:scale-95"
                          title="Ligar novamente"
                        >
                          <Phone className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCall(call.id)}
                          disabled={isDeleting}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded-xl transition-all cursor-pointer opacity-0 group-hover:opacity-100 active:scale-95 disabled:opacity-50"
                          title="Remover do histórico"
                        >
                          {isDeleting ? (
                            <div className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
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
          </div>
        </div>
      </div>

      {/* Start Call Modal */}
      {showCallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setShowCallModal(false); setModalSearch(""); }}
          />
          <div className="relative bg-white dark:bg-[#11111e] rounded-2xl border border-card-border/60 w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Iniciar Nova Chamada</h3>
            
            {/* Search in modal */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-text" />
              <input
                type="text"
                placeholder="Buscar contatos..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="w-full bg-neutral-100 dark:bg-white/5 border-0 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-[#151528] transition-all outline-none"
              />
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {loadingContacts ? (
                <div className="py-6 text-center">
                  <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-muted-text mt-2">Carregando contatos...</p>
                </div>
              ) : filteredContacts.length === 0 ? (
                <p className="text-xs text-muted-text text-center py-6">
                  {modalSearch ? "Nenhum contato encontrado" : "Nenhum contato disponível"}
                </p>
              ) : (
                filteredContacts.map((c) => (
                  <div
                    key={c.contact_id}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {c.avatar_url ? (
                        <Image
                          src={getImageUrl(c.avatar_url)}
                          alt={c.name || c.username}
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                          {(c.name || c.username)[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                          {c.name || c.username}
                        </h4>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          {c.about || c.username}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartCall(c.contact_id, c.name || c.username, c.avatar_url)}
                        className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 hover:bg-emerald-200 dark:hover:bg-emerald-950/60 rounded-xl transition-all cursor-pointer active:scale-95"
                      >
                        <Phone className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setShowCallModal(false);
                          setModalSearch("");
                          startCall({
                            targetUserId: c.contact_id,
                            targetUsername: c.name || c.username,
                            isVideo: true,
                            avatarUrl: c.avatar_url || undefined,
                          });
                        }}
                        className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 hover:bg-emerald-200 dark:hover:bg-emerald-950/60 rounded-xl transition-all cursor-pointer active:scale-95"
                      >
                        <Video className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => { setShowCallModal(false); setModalSearch(""); }}
              className="mt-6 w-full bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 font-bold py-2.5 rounded-xl text-sm transition-all active:scale-95 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
