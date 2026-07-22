"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import ContactCard from "@/components/ContactCard";
import { ListSelectorModal } from "@/components/ListSelectorModal";
import {
  getContacts,
  searchUsers,
  type ChatListItem,
  type UserSearchResult,
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
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const [listSelectorChatId, setListSelectorChatId] = useState<string | null>(
    null,
  );
  const [showListSelector, setShowListSelector] = useState(false);

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

  // Filtered list of chats
  const filteredChats = chats.filter((c) => {
    const name = c.participant_name || c.participant_username || c.name || "";
    return name.toLowerCase().includes(chatSearchQuery.toLowerCase());
  });

  const handleOpenListSelector = (chatId: string) => {
    setListSelectorChatId(chatId);
    setShowListSelector(true);
  };

  return (
    <div className="w-100 px-3 flex flex-col border-r border-card-border bg-surface flex-shrink-0 relative overflow-hidden">
      {showNewChatSidebar ? (
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
      ) : (
        <>
          {/* Header Row of Sidebar */}
          <div className="p-4 border-card-border flex items-center justify-between">
            <h2 className="text-xl font-bold">Conversas</h2>
            <div className="flex items-center gap-2">
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
          <div className="p-4 border-card-border">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-muted-text" />
              </span>
              <input
                type="text"
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                placeholder="Buscar conversa..."
                className="w-full pl-9 pr-4 py-3 text-sm border border-card-border rounded-full bg-background text-foreground placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600 focus:border-neutral-400 dark:focus:border-neutral-600"
              />
            </div>
          </div>

          {/* Scrollable Chats List */}
          <div className="flex-1 overflow-y-auto divide-y divide-card-border/30">
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
                  Comece clicando no ícone &quot;+&quot; acima.
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

      {/* List Selector Modal */}
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
          }}
        />
      )}
    </div>
  );
}
