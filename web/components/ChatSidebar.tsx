"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  MessageSquare,
  Loader2,
  AlertCircle,
  MessageSquarePlus,
  EllipsisVertical,
  ArrowLeft,
  UserPlus,
  Users,
  Plus,
  X,
  Trash2,
  Folder,
  Archive,
  Phone,
} from "lucide-react";
import ContactCard from "@/components/ContactCard";
import CallSidebar from "@/components/CallSidebar";
import { ListSelectorModal } from "@/components/ListSelectorModal";
import {
  getContacts,
  searchUsers,
  getChatLists,
  createChatList,
  deleteChatList,
  type ChatListItem,
  type UserSearchResult,
  type ChatListResponse,
} from "@/lib/api";

const PRESET_ICONS = ["📁", "❤️", "⭐", "💼", "🏠", "🎮", "📚"];
const PRESET_COLORS = ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣"];

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
      setShowCallSidebar(true);
    }
  }, [searchParams]);

  // List management state
  const [userLists, setUserLists] = useState<ChatListResponse[]>([]);
  const [activeFilterId, setActiveFilterId] = useState<string>("all");

  const [listSelectorChatId, setListSelectorChatId] = useState<string | null>(
    null,
  );
  const [showListSelector, setShowListSelector] = useState(false);

  // Create List Modal state
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListIcon, setNewListIcon] = useState("📁");
  const [newListColor, setNewListColor] = useState("");
  const [creatingList, setCreatingList] = useState(false);

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
    fetchLists();
  }, [fetchLists]);

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

  const handleCreateList = async () => {
    if (!newListName.trim() || !token) return;
    setCreatingList(true);
    try {
      const res = await createChatList(
        token,
        newListName.trim(),
        newListColor || undefined,
        newListIcon || undefined,
      );
      await fetchLists();
      if (res?.list?.id) {
        setActiveFilterId(res.list.id);
      }
      setNewListName("");
      setNewListIcon("📁");
      setNewListColor("");
      setShowCreateListModal(false);
    } catch (err) {
      console.error("Error creating list:", err);
    } finally {
      setCreatingList(false);
    }
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
    <div className="w-100 px-3 flex flex-col border-r border-card-border bg-surface flex-shrink-0 relative overflow-hidden">
      {showCallSidebar ? (
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
      ) : showNewChatSidebar ? (
        /* New Chat Sub-sidebar Panel */
        <div className="flex flex-col h-full w-full bg-surface animate-in slide-in-from-left duration-200">
          {/* Header Row */}
          <div className="p-4 border-b border-card-border flex items-center gap-3">
            <button
              onClick={() => {
                setShowNewChatSidebar(false);
                setUserSearchQuery("");
                setSearchResults([]);
              }}
              className="p-2 text-muted-text hover:text-foreground rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold">Nova conversa</h2>
          </div>

          {/* Search bar inside Nova Conversa */}
          <div className="p-4 border-b border-card-border">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-muted-text" />
              </span>
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Pesquisar nome de usuário..."
                autoFocus
                className="w-full pl-9 pr-4 py-3 text-sm border border-card-border rounded-full bg-background text-foreground placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600 focus:border-neutral-400 dark:focus:border-neutral-600"
              />
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-card-border/30">
            {/* Options: Novo grupo & Novo contato */}
            <div className="p-2 space-y-1">
              <button
                onClick={() => {
                  /* Group creation handler placeholder */
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 text-left transition-all cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 flex items-center justify-center font-bold flex-shrink-0">
                  <Users className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
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
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 text-left transition-all cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 flex items-center justify-center font-bold flex-shrink-0">
                  <UserPlus className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
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
            <div className="p-3">
              <h3 className="px-2 pb-2 text-xs font-semibold text-muted-text uppercase tracking-wider">
                Contatos no Zapi
              </h3>

              <div className="space-y-1 mt-1">
                {searchingUsers ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-text space-y-2">
                    <Loader2 className="h-6 w-6 animate-spin text-neutral-500 dark:text-neutral-400" />
                    <span className="text-xs">Buscando contatos...</span>
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
      ) : showArchivedSidebar ? (
        /* Archived Sub-sidebar Panel */
        <div className="flex flex-col h-full w-full bg-surface animate-in slide-in-from-left duration-200">
          {/* Header Row */}
          <div className="p-4 border-b border-card-border flex items-center gap-3">
            <button
              onClick={() => {
                setShowArchivedSidebar(false);
                setArchivedSearchQuery("");
              }}
              className="p-2 text-muted-text hover:text-foreground rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold">Arquivadas</h2>
          </div>

          {/* Search bar inside Archived */}
          <div className="p-4 border-b border-card-border">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-muted-text" />
              </span>
              <input
                type="text"
                value={archivedSearchQuery}
                onChange={(e) => setArchivedSearchQuery(e.target.value)}
                placeholder="Pesquisar conversas arquivadas..."
                autoFocus
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-card-border rounded-full bg-background text-foreground placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600 focus:border-neutral-400 dark:focus:border-neutral-600"
              />
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-card-border/30 p-2 space-y-1">
            {filteredArchivedChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Archive className="h-10 w-10 text-muted-text/60 mb-2" />
                <p className="text-sm font-medium">Nenhuma conversa arquivada</p>
                <p className="text-xs text-muted-text mt-1">
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
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Header Row of Sidebar */}
          <div className="py-4 px-2 border-card-border flex items-center justify-between">
            <h2 className="text-xl font-bold">Conversas</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowCallSidebar(true);
                  setShowNewChatSidebar(false);
                  setShowArchivedSidebar(false);
                }}
                className="p-2 text-muted-text hover:text-foreground rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title="Histórico de Ligações"
              >
                <Phone className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowNewChatSidebar(true)}
                className="p-2 text-muted-text hover:text-foreground rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title="Nova Conversa"
              >
                <MessageSquarePlus className="h-5 w-5" />
              </button>
              <button className="p-2 text-muted-text hover:text-foreground rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer">
                <EllipsisVertical className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Search bar inside Sidebar */}
          <div className="border-card-border">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-muted-text" />
              </span>
              <input
                type="text"
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                placeholder="Buscar conversa..."
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-card-border rounded-full bg-background text-foreground placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600 focus:border-neutral-400 dark:focus:border-neutral-600"
              />
            </div>
          </div>

          {/* List Filters System Bar (Right below Search Input) */}
          <div className="py-2.5 border-b border-card-border/40 overflow-hidden">
            <div
              className="flex items-center gap-1.5 overflow-x-auto px-0.5"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {/* All / Tudo */}
              <button
                onClick={() => setActiveFilterId("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeFilterId === "all"
                    ? "bg-emerald-600 text-white dark:bg-emerald-500 shadow-sm"
                    : "bg-neutral-100 dark:bg-neutral-800/80 text-muted-text hover:text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700/80"
                }`}
              >
                Tudo
              </button>

              {/* Unread / Não lidas */}
              <button
                onClick={() => setActiveFilterId("unread")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeFilterId === "unread"
                    ? "bg-emerald-600 text-white dark:bg-emerald-500 shadow-sm"
                    : "bg-neutral-100 dark:bg-neutral-800/80 text-muted-text hover:text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700/80"
                }`}
              >
                Não lidas
              </button>

              {/* Favorites / Favoritas */}
              <button
                onClick={() => setActiveFilterId("favorites")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeFilterId === "favorites"
                    ? "bg-emerald-600 text-white dark:bg-emerald-500 shadow-sm"
                    : "bg-neutral-100 dark:bg-neutral-800/80 text-muted-text hover:text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700/80"
                }`}
              >
                Favoritas
              </button>

              {/* Groups / Grupos */}
              <button
                onClick={() => setActiveFilterId("groups")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeFilterId === "groups"
                    ? "bg-emerald-600 text-white dark:bg-emerald-500 shadow-sm"
                    : "bg-neutral-100 dark:bg-neutral-800/80 text-muted-text hover:text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700/80"
                }`}
              >
                Grupos
              </button>

              {/* Custom User Lists */}
              {userLists.map((list) => {
                const isActive = activeFilterId === list.id;
                return (
                  <div
                    key={list.id}
                    className="relative group/chip flex-shrink-0"
                  >
                    <button
                      onClick={() => setActiveFilterId(list.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? "bg-emerald-600 text-white dark:bg-emerald-500 shadow-sm"
                          : "bg-neutral-100 dark:bg-neutral-800/80 text-muted-text hover:text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700/80"
                      }`}
                    >
                      {list.icon && (
                        <span className="text-xs">{list.icon}</span>
                      )}
                      <span>{list.name}</span>
                      {isActive && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteList(list.id);
                          }}
                          title="Excluir lista"
                          className="ml-1 hover:text-red-200 p-0.5 rounded-full"
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
                onClick={() => setShowCreateListModal(true)}
                title="Criar nova lista"
                className="h-7 px-2 rounded-full bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-muted-text hover:text-foreground flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer text-xs gap-1 font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable Chats List */}
          <div className="flex-1 overflow-y-auto divide-y divide-card-border/30 py-2 space-y-2">
            {/* Archived Chats Card Button */}
            {archivedChats.length > 0 &&
              !chatSearchQuery &&
              activeFilterId === "all" && (
                <button
                  onClick={() => setShowArchivedSidebar(true)}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-all cursor-pointer group text-left border-b border-card-border/30 mb-1"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800/80 border border-card-border text-emerald-600 dark:text-emerald-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
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
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-600 text-white dark:bg-emerald-500">
                        {unreadArchivedCount}
                      </span>
                    )}
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-neutral-200 dark:bg-neutral-800 text-muted-text group-hover:text-foreground transition-colors">
                      {archivedChats.length}
                    </span>
                  </div>
                </button>
              )}
            {loadingChats ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-2 text-muted-text">
                <Loader2 className="h-8 w-8 animate-spin text-neutral-500 dark:text-neutral-400" />
                <span className="text-sm">Carregando conversas...</span>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <MessageSquare className="h-10 w-10 text-muted-text/60 mb-2" />
                <p className="text-sm font-medium">
                  Nenhuma conversa encontrada
                </p>
                <p className="text-xs text-muted-text mt-1">
                  {activeFilterId !== "all"
                    ? "Nenhuma conversa nesta lista."
                    : 'Comece clicando no ícone "+" acima.'}
                </p>
              </div>
            ) : (
              filteredChats.map((chat) => (
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
                />
              ))
            )}
          </div>
        </>
      )}

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

      {/* Create New List Modal */}
      {showCreateListModal && (
        <div className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative bg-surface dark:bg-card-bg border border-card-border/80 rounded-3xl max-w-sm w-full p-6 shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowCreateListModal(false)}
              disabled={creatingList}
              className="absolute top-5 right-5 h-9 w-9 rounded-full bg-neutral-100 dark:bg-neutral-800/80 flex items-center justify-center text-muted-text hover:text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-bold mb-1">Nova lista</h3>
            <p className="text-xs text-muted-text mb-4">
              Crie uma lista personalizada para organizar suas conversas.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-text mb-1">
                  Nome da lista
                </label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
                  placeholder="Ex: Trabalho, Família..."
                  autoFocus
                  className="w-full px-3 py-2.5 text-sm border border-card-border rounded-xl bg-background text-foreground placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-text mb-1">
                  Ícone
                </label>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {PRESET_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewListIcon(icon)}
                      className={`h-9 w-9 rounded-xl border flex items-center justify-center text-base transition-all cursor-pointer ${
                        newListIcon === icon
                          ? "border-emerald-500 bg-emerald-500/10 scale-105"
                          : "border-card-border hover:bg-neutral-100 dark:hover:bg-white/5"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-text mb-1">
                  Cor
                </label>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() =>
                        setNewListColor(newListColor === color ? "" : color)
                      }
                      className={`h-9 w-9 rounded-xl border flex items-center justify-center text-base transition-all cursor-pointer ${
                        newListColor === color
                          ? "border-emerald-500 bg-emerald-500/10 scale-105"
                          : "border-card-border hover:bg-neutral-100 dark:hover:bg-white/5"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateListModal(false)}
                  disabled={creatingList}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-card-border hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateList}
                  disabled={creatingList || !newListName.trim()}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {creatingList && <Loader2 className="h-4 w-4 animate-spin" />}
                  Criar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

