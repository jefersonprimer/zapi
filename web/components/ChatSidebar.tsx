"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  MessageSquare,
  Loader2,
  AlertCircle,
  MessageSquarePlus,
  ArrowLeft,
  UserPlus,
  Users,
  Plus,
  X,
  Archive,
  Phone,
} from "lucide-react";
import ContactCard from "@/components/ContactCard";
import CallSidebar from "@/components/CallSidebar";
import ListSidebar from "@/components/ListSidebar";
import { ListSelectorModal } from "@/components/ListSelectorModal";
import {
  getContacts,
  searchUsers,
  getChatLists,
  deleteChatList,
  type ChatListItem,
  type UserSearchResult,
  type ChatListResponse,
} from "@/lib/api";

interface ChatSidebarProps {
  chats: ChatListItem[];
  loadingChats: boolean;
  selectedChat: ChatListItem | null;
  onSelectChat: (chat: ChatListItem) => void;
  onStartChat: (participantId: string) => Promise<void>;
  token: string | null;
  currentUserId?: string;
  onArchiveChat?: (chatId: string) => void;
  onPinChat?: (chatId: string) => void;
  onFavoriteChat?: (chatId: string) => void;
  onClearChat?: (chatId: string) => void;
  onMuteChat?: (
    chatId: string,
    unmute?: boolean,
    forever?: boolean,
    hours?: number,
  ) => void;
  onBlockChat?: (chatId: string) => void;
  onRefreshChats?: () => void;
}

export default function ChatSidebar({
  chats,
  loadingChats,
  selectedChat,
  onSelectChat,
  onStartChat,
  token,
  currentUserId,
  onArchiveChat,
  onPinChat,
  onFavoriteChat,
  onClearChat,
  onMuteChat,
  onBlockChat,
  onRefreshChats,
}: ChatSidebarProps) {
  const [showNewChatSidebar, setShowNewChatSidebar] = useState(false);
  const [showArchivedSidebar, setShowArchivedSidebar] = useState(false);
  const [showCallSidebar, setShowCallSidebar] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [archivedSearchQuery, setArchivedSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("tab") === "calls") {
      Promise.resolve().then(() => setShowCallSidebar(true));
    }
  }, [searchParams]);

  // List management state
  const [userLists, setUserLists] = useState<ChatListResponse[]>([]);
  const [activeFilterId, setActiveFilterId] = useState<string>("all");

  const [listSelectorChatId, setListSelectorChatId] = useState<string | null>(
    null,
  );
  const [showListSelector, setShowListSelector] = useState(false);

  // Create List Sidebar state
  const [showListSidebar, setShowListSidebar] = useState(false);

  // Fetch custom chat lists
  const fetchLists = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getChatLists(token);
      setUserLists(res.lists || []);
    } catch (err) {
      console.error("Error fetching chat lists:", err);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    getChatLists(token)
      .then((res) => {
        if (active) setUserLists(res.lists || []);
      })
      .catch((err) => {
        console.error("Error fetching chat lists:", err);
      });
    return () => {
      active = false;
    };
  }, [token]);

  // Search users / fetch contacts for new chat sidebar panel
  useEffect(() => {
    let active = true;
    if (!token || !showNewChatSidebar) return;

    const query = userSearchQuery.trim();

    if (!query) {
      getContacts(token)
        .then((contactsList) => {
          if (!active) return;
          const mapped: UserSearchResult[] = (contactsList || []).map((c) => ({
            id: c.contact_id,
            username: c.username,
            email: c.email,
            avatar_url: c.avatar_url,
            name: c.name,
            about: c.about,
          }));
          setSearchResults(mapped);
          setSearchingUsers(false);
        })
        .catch(() => {
          if (!active) return;
          setSearchResults([]);
          setSearchingUsers(false);
        });
      return () => {
        active = false;
      };
    }

    const timer = setTimeout(() => {
      setSearchingUsers(true);
      searchUsers(token, query)
        .then((res) => {
          if (!active) return;
          const filtered = (res.users || []).filter(
            (u) => u.id !== currentUserId,
          );
          setSearchResults(filtered);
          setSearchingUsers(false);
        })
        .catch((err) => {
          if (!active) return;
          console.error("Error searching users:", err);
          setSearchResults([]);
          setSearchingUsers(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [userSearchQuery, token, currentUserId, showNewChatSidebar]);

  // Separate active and archived chats
  const archivedChats = chats.filter((c) => !!c.is_archived);
  const activeChats = chats.filter((c) => !c.is_archived);

  // Unread count in archived chats
  const unreadArchivedCount = archivedChats.reduce(
    (acc, c) => acc + (c.unread_count || 0),
    0,
  );

  // Filtered list of active chats (Search query + Active List filter)
  const filteredChats = activeChats.filter((c) => {
    const name = c.participant_name || c.participant_username || c.name || "";
    const matchesSearch = name
      .toLowerCase()
      .includes(chatSearchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeFilterId === "all") return true;
    if (activeFilterId === "unread") return (c.unread_count || 0) > 0;
    if (activeFilterId === "favorites") return !!c.is_favorite;
    if (activeFilterId === "groups") return !!c.is_group;

    const customList = userLists.find((l) => l.id === activeFilterId);
    if (customList) {
      return (customList.chat_ids || []).includes(c.id);
    }

    return true;
  });

  // Filtered list of archived chats
  const filteredArchivedChats = archivedChats.filter((c) => {
    const name = c.participant_name || c.participant_username || c.name || "";
    return name.toLowerCase().includes(archivedSearchQuery.toLowerCase());
  });

  const handleOpenListSelector = (chatId: string) => {
    setListSelectorChatId(chatId);
    setShowListSelector(true);
  };

  const handleDeleteList = async (listId: string) => {
    if (!token) return;
    if (!confirm("Deseja realmente excluir esta lista?")) return;
    try {
      await deleteChatList(token, listId);
      if (activeFilterId === listId) {
        setActiveFilterId("all");
      }
      await fetchLists();
    } catch (err) {
      console.error("Error deleting list:", err);
    }
  };

  return (
    <div className="w-100 w-full md:w-[380px] px-4 py-3 flex flex-col border-r border-card-border bg-surface flex-shrink-0 relative overflow-hidden h-full">
      {/* 1. Main Chat Sidebar View */}
      <div
        className={`flex flex-col h-full w-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          showCallSidebar ||
          showNewChatSidebar ||
          showArchivedSidebar ||
          showListSidebar
            ? "opacity-0 -translate-x-4 pointer-events-none scale-98"
            : "opacity-100 translate-x-0"
        }`}
      >
        {/* Header Row of Sidebar */}
        <div className="py-2 px-1 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Conversas
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setShowCallSidebar(true);
                setShowNewChatSidebar(false);
                setShowArchivedSidebar(false);
              }}
              className="p-2 text-muted-text hover:text-foreground rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
              title="Histórico de Ligações"
            >
              <Phone className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowNewChatSidebar(true)}
              className="p-2 text-muted-text hover:text-foreground rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
              title="Nova Conversa"
            >
              <MessageSquarePlus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search bar inside Sidebar */}
        <div className="mt-2">
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Search className="h-4 w-4 text-muted-text group-focus-within:text-foreground transition-colors duration-200" />
            </span>
            <input
              type="text"
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-card-border rounded-full bg-background text-foreground placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white focus:border-neutral-950 dark:focus:border-white transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            />
          </div>
        </div>

        {/* List Filters System Bar */}
        <div className="py-3 border-b border-card-border/40">
          <div
            className="flex items-center gap-1.5 overflow-x-auto px-0.5 scrollbar-none"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {/* All / Tudo */}
            <button
              onClick={() => setActiveFilterId("all")}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 ${
                activeFilterId === "all"
                  ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 shadow-sm font-semibold scale-102"
                  : "bg-neutral-100/70 dark:bg-neutral-800/60 text-muted-text hover:text-foreground hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
              }`}
            >
              Tudo
            </button>

            {/* Unread / Não lidas */}
            <button
              onClick={() => setActiveFilterId("unread")}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 ${
                activeFilterId === "unread"
                  ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 shadow-sm font-semibold scale-102"
                  : "bg-neutral-100/70 dark:bg-neutral-800/60 text-muted-text hover:text-foreground hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
              }`}
            >
              Não lidas
            </button>

            {/* Favorites / Favoritas */}
            <button
              onClick={() => setActiveFilterId("favorites")}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 ${
                activeFilterId === "favorites"
                  ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 shadow-sm font-semibold scale-102"
                  : "bg-neutral-100/70 dark:bg-neutral-800/60 text-muted-text hover:text-foreground hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
              }`}
            >
              Favoritas
            </button>

            {/* Groups / Grupos */}
            <button
              onClick={() => setActiveFilterId("groups")}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 ${
                activeFilterId === "groups"
                  ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 shadow-sm font-semibold scale-102"
                  : "bg-neutral-100/70 dark:bg-neutral-800/60 text-muted-text hover:text-foreground hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
              }`}
            >
              Grupos
            </button>

            {/* Custom User Lists */}
            {userLists.map((list) => {
              const isActive = activeFilterId === list.id;
              const hasColor = !!list.color;

              // Custom styles for colored chips: 12% opacity background when inactive, full background when active
              const colorVal = list.color || "";
              const chipStyle = hasColor
                ? {
                    backgroundColor: isActive ? colorVal : `${colorVal}20`,
                    color: isActive ? "#ffffff" : colorVal,
                    border: isActive
                      ? "1px solid transparent"
                      : `1px solid ${colorVal}35`,
                  }
                : undefined;

              return (
                <div
                  key={list.id}
                  className="relative group/chip flex-shrink-0"
                >
                  <button
                    onClick={() => setActiveFilterId(list.id)}
                    style={chipStyle}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                      !hasColor
                        ? isActive
                          ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 shadow-sm font-semibold scale-102"
                          : "bg-neutral-100/70 dark:bg-neutral-800/60 text-muted-text hover:text-foreground hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
                        : ""
                    }`}
                  >
                    {list.icon && <span className="text-xs">{list.icon}</span>}
                    <span>{list.name}</span>
                    {isActive && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteList(list.id);
                        }}
                        title="Excluir lista"
                        className={`ml-1 p-0.5 rounded-full transition-colors ${
                          hasColor
                            ? "hover:bg-white/20 text-white"
                            : "hover:bg-neutral-850 dark:hover:bg-neutral-200 hover:text-white dark:hover:text-black text-muted-text"
                        }`}
                      >
                        <X className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                </div>
              );
            })}

            {/* Add New List Button (+) */}
            <button
              onClick={() => setShowListSidebar(true)}
              title="Criar nova lista"
              className="h-7 px-2.5 rounded-full bg-neutral-100/70 dark:bg-neutral-800/60 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/85 text-muted-text hover:text-foreground flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer text-xs gap-1 font-medium active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Chats List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-1.5 scrollbar-thin">
          {/* Archived Chats Card Button */}
          {archivedChats.length > 0 &&
            !chatSearchQuery &&
            activeFilterId === "all" && (
              <button
                onClick={() => setShowArchivedSidebar(true)}
                className="w-full flex items-center justify-between px-3 py-3 rounded-2xl hover:bg-neutral-100/70 dark:hover:bg-white/5 transition-all cursor-pointer group text-left border-b border-card-border/30 mb-1 active:scale-99"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-neutral-100/70 dark:bg-neutral-800/70 border border-card-border text-neutral-800 dark:text-neutral-200 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                    <Archive className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Arquivadas
                    </p>
                    <p className="text-xs text-muted-text">
                      Conversas arquivadas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {unreadArchivedCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">
                      {unreadArchivedCount}
                    </span>
                  )}
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-neutral-200 dark:bg-neutral-800/80 text-muted-text group-hover:text-foreground transition-colors duration-200">
                    {archivedChats.length}
                  </span>
                </div>
              </button>
            )}

          {loadingChats ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2 text-muted-text animate-pulse">
              <Loader2 className="h-7 w-7 animate-spin text-neutral-400 dark:text-neutral-600" />
              <span className="text-xs font-medium">
                Carregando conversas...
              </span>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4 animate-in fade-in duration-300">
              <MessageSquare className="h-9 w-9 text-muted-text/40 mb-2" />
              <p className="text-sm font-medium">Nenhuma conversa encontrada</p>
              <p className="text-xs text-muted-text mt-1 max-w-[200px]">
                {activeFilterId !== "all"
                  ? "Nenhuma conversa nesta lista."
                  : 'Comece clicando no ícone "+" acima.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 animate-in fade-in duration-300">
              {filteredChats.map((chat) => (
                <ContactCard
                  key={chat.id}
                  chat={chat}
                  isSelected={selectedChat?.id === chat.id}
                  onClick={() => onSelectChat(chat)}
                  onArchive={() => onArchiveChat?.(chat.id)}
                  onPin={() => onPinChat?.(chat.id)}
                  onFavorite={() => onFavoriteChat?.(chat.id)}
                  onAddToList={() => handleOpenListSelector(chat.id)}
                  onClear={() => onClearChat?.(chat.id)}
                  onMute={(unmute, forever, hours) =>
                    onMuteChat?.(chat.id, unmute, forever, hours)
                  }
                  onBlock={() => onBlockChat?.(chat.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. New Chat Sub-sidebar Panel (Slide Over) */}
      <div
        className={`absolute inset-0 px-4 py-3 bg-surface z-20 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          showNewChatSidebar
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-full opacity-0 pointer-events-none"
        }`}
      >
        {/* Header Row */}
        <div className="py-2 px-1 border-b border-card-border/50 flex items-center gap-3">
          <button
            onClick={() => {
              setShowNewChatSidebar(false);
              setUserSearchQuery("");
              setSearchResults([]);
            }}
            className="p-2 text-muted-text hover:text-foreground rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold text-foreground">Nova conversa</h2>
        </div>

        {/* Search bar inside Nova Conversa */}
        <div className="py-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Search className="h-4 w-4 text-muted-text" />
            </span>
            <input
              type="text"
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              placeholder="Pesquisar nome de usuário..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-card-border rounded-full bg-background text-foreground placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white focus:border-neutral-950 dark:focus:border-white transition-all duration-300"
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-1 space-y-3">
          {/* Options: Novo grupo & Novo contato */}
          <div className="space-y-1">
            <button
              onClick={() => {
                /* Group creation handler placeholder */
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-neutral-100/70 dark:hover:bg-white/5 text-left transition-all duration-200 cursor-pointer active:scale-99"
            >
              <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-102">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Novo grupo
                </p>
                <p className="text-xs text-muted-text">
                  Criar um novo grupo com participantes
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                /* New contact handler placeholder */
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-neutral-100/70 dark:hover:bg-white/5 text-left transition-all duration-200 cursor-pointer active:scale-99"
            >
              <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-102">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Novo contato
                </p>
                <p className="text-xs text-muted-text">
                  Adicionar um novo contato
                </p>
              </div>
            </button>
          </div>

          {/* Contacts / Users List Section */}
          <div className="pt-2 border-t border-card-border/40">
            <h3 className="px-2 pb-2 text-xs font-semibold text-muted-text uppercase tracking-wider">
              Contatos no Zapi
            </h3>

            <div className="space-y-1.5 mt-1">
              {searchingUsers ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-text space-y-2 animate-pulse">
                  <Loader2 className="h-5 w-5 animate-spin text-neutral-400 dark:text-neutral-600" />
                  <span className="text-xs font-medium">
                    Buscando contatos...
                  </span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-text flex items-center justify-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-muted-text/60" />
                  Nenhum contato encontrado
                </div>
              ) : (
                searchResults.map((userResult) => {
                  const existingChat = chats.find(
                    (c) => c.participant_id === userResult.id,
                  );

                  return (
                    <ContactCard
                      key={userResult.id}
                      userResult={userResult}
                      existingChat={existingChat}
                      isSelected={selectedChat?.id === existingChat?.id}
                      onClick={() => {
                        if (existingChat) {
                          onSelectChat(existingChat);
                          setShowNewChatSidebar(false);
                        } else {
                          onStartChat(userResult.id);
                          setShowNewChatSidebar(false);
                        }
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Archived Sub-sidebar Panel (Slide Over) */}
      <div
        className={`absolute inset-0 px-4 py-3 bg-surface z-20 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          showArchivedSidebar
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-full opacity-0 pointer-events-none"
        }`}
      >
        {/* Header Row */}
        <div className="py-2 px-1 border-b border-card-border/50 flex items-center gap-3">
          <button
            onClick={() => {
              setShowArchivedSidebar(false);
              setArchivedSearchQuery("");
            }}
            className="p-2 text-muted-text hover:text-foreground rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold text-foreground">Arquivadas</h2>
        </div>

        {/* Search bar inside Archived */}
        <div className="py-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Search className="h-4 w-4 text-muted-text" />
            </span>
            <input
              type="text"
              value={archivedSearchQuery}
              onChange={(e) => setArchivedSearchQuery(e.target.value)}
              placeholder="Pesquisar conversas arquivadas..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-card-border rounded-full bg-background text-foreground placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white focus:border-neutral-950 dark:focus:border-white transition-all duration-300"
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-1.5 py-1">
          {filteredArchivedChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4 animate-in fade-in duration-300">
              <Archive className="h-9 w-9 text-muted-text/40 mb-2" />
              <p className="text-sm font-medium">Nenhuma conversa arquivada</p>
              <p className="text-xs text-muted-text mt-1 max-w-[200px]">
                As conversas que você arquivar aparecerão aqui.
              </p>
            </div>
          ) : (
            filteredArchivedChats.map((chat) => (
              <ContactCard
                key={chat.id}
                chat={chat}
                isSelected={selectedChat?.id === chat.id}
                onClick={() => onSelectChat(chat)}
                onArchive={() => onArchiveChat?.(chat.id)}
                onPin={() => onPinChat?.(chat.id)}
                onFavorite={() => onFavoriteChat?.(chat.id)}
                onAddToList={() => handleOpenListSelector(chat.id)}
                onClear={() => onClearChat?.(chat.id)}
                onMute={(unmute, forever, hours) =>
                  onMuteChat?.(chat.id, unmute, forever, hours)
                }
                onBlock={() => onBlockChat?.(chat.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* 4. Call History Sub-sidebar Panel (Slide Over) */}
      <div
        className={`absolute inset-0 px-4 py-3 bg-surface z-20 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          showCallSidebar
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-full opacity-0 pointer-events-none"
        }`}
      >
        <CallSidebar
          token={token}
          currentUserId={currentUserId}
          onClose={() => setShowCallSidebar(false)}
          onSelectChat={(participantId) => {
            setShowCallSidebar(false);
            const chat = chats.find((c) => c.participant_id === participantId);
            if (chat) {
              onSelectChat(chat);
            } else {
              onStartChat(participantId);
            }
          }}
        />
      </div>

      {/* List Selector Modal for adding chats to lists */}
      {showListSelector && listSelectorChatId && token && (
        <ListSelectorModal
          isOpen={showListSelector}
          onClose={() => {
            setShowListSelector(false);
            setListSelectorChatId(null);
          }}
          chatId={listSelectorChatId}
          token={token}
          onUpdate={() => {
            onRefreshChats?.();
            fetchLists();
          }}
        />
      )}

      {/* List Creation Sidebar Panel (Slide Over) */}
      <div
        className={`absolute inset-0 px-4 py-3 bg-surface z-20 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          showListSidebar
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-full opacity-0 pointer-events-none"
        }`}
      >
        <ListSidebar
          isOpen={showListSidebar}
          onClose={() => setShowListSidebar(false)}
          token={token}
          onCreated={(newListId) => {
            fetchLists();
            setActiveFilterId(newListId);
          }}
        />
      </div>
    </div>
  );
}
