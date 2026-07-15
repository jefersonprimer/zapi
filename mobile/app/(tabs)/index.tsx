import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import {
  getChats,
  type ChatListItem,
  deleteChat,
  archiveChat,
  getChatLists,
  createChatList,
  deleteChatList,
  updateChatLists,
  updateChatList as updateChatListApi,
} from "@/services/api";
import {
  toggleBlockContact,
  toggleFavoriteChat,
  toggleMuteChat,
  clearChatHistory,
} from "@/services/chatActions";
import {
  getChatsFromLocal,
  saveChats,
  deleteChatLocal,
  setChatPinnedLocal,
  setChatArchivedLocal,
  getLocalChatLists,
  saveLocalChatLists,
  type LocalChatList,
  getDatabase,
  getListPositionsLocal,
  saveListPositionLocal,
} from "@/services/database";
import {
  Camera,
  MoreVertical,
  MessageSquarePlus,
  Lock,
  Trash2,
  ArrowLeft,
  Pin,
  PinOff,
  Bell,
  BellOff,
  Archive,
  PanelTopOpen,
  PanelTopClose,
  Search,
  Heart,
  Star,
  Briefcase,
  Home,
  Gamepad2,
  BookOpen,
  Folder,
  ChevronRight,
} from "lucide-react-native";
import { wsClient } from "@/services/ws";
import { useAppTheme } from "@/context/ThemeContext";
import MuteModal from "@/components/MuteModal";
import MainMenuModal from "@/components/MainMenuModal";
import CreateListModal from "@/components/CreateListModal";
import EditListModal from "@/components/EditListModal";
import ChatListItemComponent from "@/components/ChatListItem";
import ChatSelectorModal from "@/components/ChatSelectorModal";
import ListSelectorModal from "@/components/ListSelectorModal";
import ListMenuModal from "@/components/ListMenuModal";
import ReorderListsModal from "@/components/ReorderListsModal";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const isChatMuted = (chat: ChatListItem) => {
  if (chat.notification_muted_forever) return true;
  if (chat.notification_muted_until) {
    return new Date(chat.notification_muted_until) > new Date();
  }
  return false;
};

const renderListIcon = (
  iconName: string | null,
  colorColor: string | null,
  tintColor: string,
  size: number = 20,
) => {
  let hexColor = tintColor;
  if (colorColor === "🔴") hexColor = "#ef4444";
  else if (colorColor === "🟠") hexColor = "#f97316";
  else if (colorColor === "🟡") hexColor = "#eab308";
  else if (colorColor === "🟢") hexColor = "#22c55e";
  else if (colorColor === "🔵") hexColor = "#3b82f6";
  else if (colorColor === "🟣") hexColor = "#a855f7";

  switch (iconName) {
    case "❤️":
      return <Heart size={size} color={hexColor} fill={hexColor + "22"} />;
    case "⭐":
      return <Star size={size} color={hexColor} fill={hexColor + "22"} />;
    case "💼":
      return <Briefcase size={size} color={hexColor} fill={hexColor + "22"} />;
    case "🏠":
      return <Home size={size} color={hexColor} fill={hexColor + "22"} />;
    case "🎮":
      return <Gamepad2 size={size} color={hexColor} fill={hexColor + "22"} />;
    case "📚":
      return <BookOpen size={size} color={hexColor} fill={hexColor + "22"} />;
    default:
      return <Folder size={size} color={hexColor} fill={hexColor + "22"} />;
  }
};

export default function ChatListScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();

  const [chats, setChatsOriginal] = useState<ChatListItem[]>([]);
  const setChats = useCallback((newChats: ChatListItem[]) => {
    LayoutAnimation.configureNext({
      duration: 200,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
    setChatsOriginal(newChats);
  }, []);

  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [muteModalVisible, setMuteModalVisible] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);

  // Custom states for Lists and Search
  const [searchQuery, setSearchQuery] = useState("");
  const [userLists, setUserLists] = useState<LocalChatList[]>([]);
  const [activeFilterId, setActiveFilterId] = useState<string>("all");

  const selectFilter = (filterId: string) => {
    LayoutAnimation.configureNext({
      duration: 180,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
    setActiveFilterId(filterId);
  };

  const [isFabVisible, setIsFabVisible] = useState(true);
  const lastScrollY = useRef(0);

  const handleScroll = useCallback(
    (event: any) => {
      const currentOffset = event.nativeEvent.contentOffset.y;
      const direction = currentOffset > lastScrollY.current ? "down" : "up";

      if (currentOffset > 60) {
        if (direction === "down" && isFabVisible) {
          LayoutAnimation.configureNext({
            duration: 180,
            create: {
              type: LayoutAnimation.Types.easeInEaseOut,
              property: LayoutAnimation.Properties.opacity,
            },
            update: {
              type: LayoutAnimation.Types.easeInEaseOut,
            },
          });
          setIsFabVisible(false);
        } else if (direction === "up" && !isFabVisible) {
          LayoutAnimation.configureNext({
            duration: 180,
            create: {
              type: LayoutAnimation.Types.easeInEaseOut,
              property: LayoutAnimation.Properties.opacity,
            },
            update: {
              type: LayoutAnimation.Types.easeInEaseOut,
            },
          });
          setIsFabVisible(true);
        }
      } else if (currentOffset <= 60 && !isFabVisible) {
        LayoutAnimation.configureNext({
          duration: 180,
          create: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
          },
          update: {
            type: LayoutAnimation.Types.easeInEaseOut,
          },
        });
        setIsFabVisible(true);
      }

      lastScrollY.current = currentOffset;
    },
    [isFabVisible],
  );

  const [createListModalVisible, setCreateListModalVisible] = useState(false);
  const [listSelectorVisible, setListSelectorVisible] = useState(false);
  const [chatSelectorVisible, setChatSelectorVisible] = useState(false);
  const [selectorListId, setSelectorListId] = useState<string | null>(null);
  const [selectorChatIds, setSelectorChatIds] = useState<string[]>([]);

  // List menu and reordering states
  const [activeMenuList, setActiveMenuList] = useState<any | null>(null);
  const [editListModalVisible, setEditListModalVisible] = useState(false);
  const [listToEdit, setListToEdit] = useState<any | null>(null);
  const [muteSelectorList, setMuteSelectorList] =
    useState<LocalChatList | null>(null);

  // Drag-and-drop sortable lists states
  const [reorderModalVisible, setReorderModalVisible] = useState(false);
  const [orderedFilters, setOrderedFilters] = useState<any[]>([]);

  const activeChats = chats.filter((c) => !c.is_archived);

  const filteredChats = activeChats.filter((c) => {
    // 1. Filter by Search Query
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      const chatName = (
        c.name ??
        c.participant_name ??
        c.participant_username ??
        ""
      ).toLowerCase();
      if (!chatName.includes(query)) return false;
    }

    // 2. Filter by Active List Chip
    if (activeFilterId === "all") {
      return true;
    } else if (activeFilterId === "unread") {
      return c.unread_count > 0;
    } else if (activeFilterId === "favorites") {
      return !!c.is_favorite;
    } else if (activeFilterId === "groups") {
      return c.is_group;
    } else {
      // Custom user list ID
      const customList = userLists.find((l) => l.id === activeFilterId);
      if (customList) {
        return customList.chat_ids.includes(c.id);
      }
      return true;
    }
  });

  const archivedChatsCount = chats.filter((c) => c.is_archived).length;

  const handleLongPress = (chatId: string) => {
    setSelectedChatIds((prev) => {
      if (prev.includes(chatId)) {
        return prev.filter((id) => id !== chatId);
      } else {
        return [...prev, chatId];
      }
    });
  };

  const handlePress = (item: ChatListItem) => {
    if (selectedChatIds.length > 0) {
      handleLongPress(item.id);
    } else {
      router.push({
        pathname: "/chat",
        params: {
          chatId: item.id,
          participantId: item.participant_id || "",
          participantUsername:
            item.name ??
            item.participant_name ??
            item.participant_username ??
            "Unknown",
          participantAvatarUrl:
            (item.is_group ? item.avatar_url : item.participant_avatar_url) ||
            "",
        },
      });
    }
  };

  const handleDeleteSelectedChats = () => {
    if (selectedChatIds.length === 0) return;

    const message =
      selectedChatIds.length === 1
        ? "Deseja apagar esta conversa?"
        : `Deseja apagar as ${selectedChatIds.length} conversas selecionadas?`;

    Alert.alert("Apagar conversa", message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          try {
            for (const chatId of selectedChatIds) {
              await deleteChat(token, chatId);
              await deleteChatLocal(chatId);
            }
            setSelectedChatIds([]);
            const updatedChats = await getChatsFromLocal();
            setChats(updatedChats);
          } catch (err: any) {
            console.error("Error deleting chat(s):", err);
            Alert.alert("Erro", "Não foi possível apagar a conversa.");
          }
        },
      },
    ]);
  };

  const handlePinSelectedChats = async () => {
    if (selectedChatIds.length === 0) return;

    const selectedChats = chats.filter((c) => selectedChatIds.includes(c.id));
    const isAllPinned = selectedChats.every((c) => c.is_pinned);
    const newPinState = !isAllPinned;

    try {
      for (const chatId of selectedChatIds) {
        await setChatPinnedLocal(chatId, newPinState);
      }
      setSelectedChatIds([]);
      const updatedChats = await getChatsFromLocal();
      setChats(updatedChats);
    } catch (err) {
      console.error("Error toggling pin status:", err);
      Alert.alert("Erro", "Não foi possível alterar o status de fixação.");
    }
  };

  const handleMutePress = async () => {
    if (selectedChatIds.length === 0) return;

    const selectedChats = chats.filter((c) => selectedChatIds.includes(c.id));
    const allSelectedAreMuted = selectedChats.every(isChatMuted);

    if (allSelectedAreMuted) {
      // Unmute all selected chats immediately
      try {
        for (const chatId of selectedChatIds) {
          if (token) {
            await toggleMuteChat(token, chatId, "unmute");
          }
        }
        setSelectedChatIds([]);
        const updatedChats = await getChatsFromLocal();
        setChats(updatedChats);
      } catch (err) {
        console.error("Error unmuting chat(s):", err);
        Alert.alert("Erro", "Não foi possível desativar o silenciamento.");
      }
    } else {
      // Show modal to choose mute duration
      setMuteModalVisible(true);
    }
  };

  const handleMuteChats = async (durationHours: number | "always") => {
    let chatIdsToMute: string[] = [];
    if (muteSelectorList) {
      chatIdsToMute = muteSelectorList.chat_ids;
    } else {
      chatIdsToMute = selectedChatIds;
    }

    if (chatIdsToMute.length === 0) return;

    try {
      for (const chatId of chatIdsToMute) {
        if (token) {
          await toggleMuteChat(token, chatId, durationHours);
        }
      }
      setMuteModalVisible(false);
      setMuteSelectorList(null);
      setSelectedChatIds([]);
      const updatedChats = await getChatsFromLocal();
      setChats(updatedChats);
    } catch (err) {
      console.error("Error muting chat(s):", err);
      Alert.alert("Erro", "Não foi possível silenciar as conversas.");
    }
  };

  const handleArchiveSelectedChats = async () => {
    if (!token || selectedChatIds.length === 0) return;
    try {
      const selectedChats = chats.filter((c) => selectedChatIds.includes(c.id));
      const shouldArchive = !selectedChats.every((c) => c.is_archived);

      for (const chatId of selectedChatIds) {
        await archiveChat(token, chatId, shouldArchive);
        await setChatArchivedLocal(chatId, shouldArchive);
      }

      setSelectedChatIds([]);
      const updatedChats = await getChatsFromLocal();
      setChats(updatedChats);
    } catch (err) {
      console.error("Error archiving chat(s):", err);
      Alert.alert("Erro", "Não foi possível arquivar as conversas.");
    }
  };

  const handleViewContact = () => {
    if (selectedChatIds.length !== 1) return;
    const chatItem = chats.find((c) => c.id === selectedChatIds[0]);
    if (!chatItem) return;

    if (chatItem.is_group) {
      Alert.alert("Grupo", "Não é possível ver o contato de um grupo.");
      return;
    }

    setMoreMenuVisible(false);
    setSelectedChatIds([]);

    router.push({
      pathname: "/contact-detail",
      params: {
        participantId: chatItem.participant_id || "",
        participantUsername:
          chatItem.participant_name ||
          chatItem.participant_username ||
          chatItem.name ||
          "Unknown",
        chatId: chatItem.id,
        avatarUrl: chatItem.participant_avatar_url || undefined,
      },
    });
  };

  const handleSelectAll = () => {
    setSelectedChatIds(activeChats.map((c) => c.id));
    setMoreMenuVisible(false);
  };

  const handleClearSelectedChats = () => {
    if (selectedChatIds.length === 0) return;

    const message =
      selectedChatIds.length === 1
        ? "Deseja realmente limpar todo o histórico de mensagens desta conversa? Esta ação não pode ser desfeita."
        : `Deseja realmente limpar todo o histórico de mensagens das ${selectedChatIds.length} conversas selecionadas? Esta ação não pode ser desfeita.`;

    Alert.alert("Limpar conversa", message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          try {
            for (const chatId of selectedChatIds) {
              await clearChatHistory(token, chatId);
            }
            setSelectedChatIds([]);
            setMoreMenuVisible(false);
            const updatedChats = await getChatsFromLocal();
            setChats(updatedChats);
          } catch (err: any) {
            console.error("Error clearing chat(s):", err);
            Alert.alert("Erro", "Não foi possível limpar as conversas.");
          }
        },
      },
    ]);
  };

  const handleBlockSelectedChats = () => {
    if (selectedChatIds.length === 0) return;

    const selectedChats = chats.filter((c) => selectedChatIds.includes(c.id));
    const nonGroupChats = selectedChats.filter((c) => !c.is_group);

    if (nonGroupChats.length === 0) {
      Alert.alert(
        "Erro",
        "Selecione pelo menos uma conversa individual para bloquear.",
      );
      return;
    }

    const allBlocked = nonGroupChats.every((c) => c.is_blocked_by_me);
    const newBlockState = !allBlocked;

    const title = newBlockState ? "Bloquear contato" : "Desbloquear contato";
    const message =
      nonGroupChats.length === 1
        ? `Deseja realmente ${newBlockState ? "bloquear" : "desbloquear"} este contato?`
        : `Deseja realmente ${newBlockState ? "bloquear" : "desbloquear"} os ${nonGroupChats.length} contatos selecionados?`;

    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: newBlockState ? "Bloquear" : "Desbloquear",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          try {
            for (const chat of nonGroupChats) {
              if (chat.participant_id) {
                await toggleBlockContact(
                  token,
                  chat.participant_id,
                  chat.id,
                  newBlockState,
                );
              }
            }
            setSelectedChatIds([]);
            setMoreMenuVisible(false);
            const updatedChats = await getChatsFromLocal();
            setChats(updatedChats);
          } catch (err: any) {
            console.error("Error blocking/unblocking chat(s):", err);
            Alert.alert(
              "Erro",
              "Não foi possível alterar o status de bloqueio.",
            );
          }
        },
      },
    ]);
  };

  const loadLists = useCallback(async () => {
    const buildOrderedFilters = async (localLists: LocalChatList[]) => {
      try {
        const positions = await getListPositionsLocal();
        const systemFilters = [
          { id: "all", name: "Todas", color: null, icon: null, isSystem: true },
          {
            id: "unread",
            name: "Não lidas",
            color: null,
            icon: null,
            isSystem: true,
          },
          {
            id: "favorites",
            name: "Favoritos",
            color: null,
            icon: null,
            isSystem: true,
          },
          {
            id: "groups",
            name: "Grupos",
            color: null,
            icon: null,
            isSystem: true,
          },
        ];
        const customFilters = localLists.map((l) => ({
          id: l.id,
          name: l.name,
          color: l.color,
          icon: l.icon,
          chat_ids: l.chat_ids,
          isSystem: false,
        }));
        const combined = [...systemFilters, ...customFilters];
        combined.sort((a, b) => {
          const posA = positions[a.id] !== undefined ? positions[a.id] : 999;
          const posB = positions[b.id] !== undefined ? positions[b.id] : 999;
          return posA - posB;
        });
        setOrderedFilters(combined);
      } catch (err) {
        console.error("Error building ordered filters:", err);
      }
    };

    try {
      const localLists = await getLocalChatLists();
      setUserLists(localLists);
      await buildOrderedFilters(localLists);

      if (token) {
        const response = await getChatLists(token);
        if (response && response.lists) {
          const mappedLists: LocalChatList[] = response.lists.map((l) => ({
            id: l.id,
            user_id: l.user_id,
            name: l.name,
            color: l.color,
            icon: l.icon,
            position: l.position,
            created_at: l.created_at,
            updated_at: l.updated_at,
            chat_ids: l.chat_ids,
          }));
          await saveLocalChatLists(mappedLists);
          setUserLists(mappedLists);
          await buildOrderedFilters(mappedLists);
        }
      }
    } catch (err) {
      console.warn("Offline or sync error loading lists:", err);
    }
  }, [token]);

  const loadChats = useCallback(async () => {
    if (!token) return;
    try {
      // Load lists in background
      loadLists();

      // 1. Get from local SQLite database immediately
      const localChats = await getChatsFromLocal();
      setChats(localChats);

      if (localChats.length > 0) {
        setLoading(false);
      }

      // 2. Sincroniza em background com a API
      const data = await getChats(token);

      // 3. Salva no SQLite local
      await saveChats(data.chats);

      // 4. Recarrega as informações atualizadas do SQLite
      const updatedChats = await getChatsFromLocal();
      setChats(updatedChats);
    } catch (err: any) {
      console.warn("Offline or sync error loading chats:", err);
    } finally {
      setLoading(false);
    }
  }, [token, loadLists, setChats]);

  const handleToggleFavoriteSelectedChats = async () => {
    if (selectedChatIds.length === 0) return;

    setMoreMenuVisible(false);
    const selectedChats = chats.filter((c) => selectedChatIds.includes(c.id));
    const allFavorited = selectedChats.every((c) => c.is_favorite);
    const nextFavorite = !allFavorited;

    try {
      for (const chatId of selectedChatIds) {
        if (token) {
          await toggleFavoriteChat(token, chatId, nextFavorite);
        }
      }
      setSelectedChatIds([]);
      const updatedChats = await getChatsFromLocal();
      setChats(updatedChats);
    } catch (err) {
      console.error("Error toggling favorite on selected chats:", err);
      Alert.alert("Erro", "Não foi possível alterar o status de favorito.");
      const updatedChats = await getChatsFromLocal();
      setChats(updatedChats);
    }
  };

  const handleCreateList = async (
    name: string,
    color: string,
    icon: string,
  ) => {
    try {
      if (token) {
        const response = await createChatList(token, name, color, icon);
        if (response && response.list) {
          setCreateListModalVisible(false);
          await loadLists();

          // Open selector to add chats to this new list
          setSelectorListId(response.list.id);
          setSelectorChatIds([]);
          setChatSelectorVisible(true);
        }
      }
    } catch (err) {
      console.error("Error creating list:", err);
      Alert.alert("Erro", "Não foi possível criar a lista.");
    }
  };

  const handleDeleteList = async (listId: string) => {
    Alert.alert("Apagar lista", "Deseja realmente apagar esta lista?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            if (token) {
              await deleteChatList(token, listId);
              if (activeFilterId === listId) {
                setActiveFilterId("all");
              }
              await loadLists();
            }
          } catch (err) {
            console.error("Error deleting list:", err);
            Alert.alert("Erro", "Não foi possível apagar a lista.");
          }
        },
      },
    ]);
  };

  const handleUpdateChatLists = async (
    chatId: string,
    selectedListIds: string[],
  ) => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        "DELETE FROM chat_list_items WHERE chat_id = ? AND list_id IN (SELECT id FROM chat_lists)",
        [chatId],
      );
      for (const lid of selectedListIds) {
        await db.runAsync(
          "INSERT INTO chat_list_items (list_id, chat_id, created_at) VALUES (?, ?, ?)",
          [lid, chatId, new Date().toISOString()],
        );
      }

      if (token) {
        await updateChatLists(token, chatId, selectedListIds);
      }

      await loadLists();
    } catch (err) {
      console.error("Error updating chat lists:", err);
      Alert.alert("Erro", "Não foi possível atualizar as listas da conversa.");
    }
  };

  const handleSaveChatLists = async (selectedListIds: string[]) => {
    if (selectedChatIds.length > 0) {
      try {
        for (const cid of selectedChatIds) {
          await handleUpdateChatLists(cid, selectedListIds);
        }
        setSelectedChatIds([]);
      } catch (err) {
        console.error("Error bulk updating lists:", err);
      }
    }
    setListSelectorVisible(false);
  };

  const handleSaveListChats = async (selectedChatIds: string[]) => {
    if (!selectorListId) return;
    try {
      const db = await getDatabase();
      await db.runAsync("DELETE FROM chat_list_items WHERE list_id = ?", [
        selectorListId,
      ]);
      for (const cid of selectedChatIds) {
        await db.runAsync(
          "INSERT INTO chat_list_items (list_id, chat_id, created_at) VALUES (?, ?, ?)",
          [selectorListId, cid, new Date().toISOString()],
        );
      }

      if (token) {
        for (const cid of activeChats.map((c) => c.id)) {
          const customListsForChat = userLists
            .map((l) => {
              if (l.id === selectorListId) {
                return selectedChatIds.includes(cid) ? l.id : null;
              }
              return l.chat_ids.includes(cid) ? l.id : null;
            })
            .filter(Boolean) as string[];

          await updateChatLists(token, cid, customListsForChat);
        }
      }

      setChatSelectorVisible(false);
      setSelectorListId(null);
      setSelectorChatIds([]);
      await loadLists();
    } catch (err) {
      console.error("Error saving chats to list:", err);
      Alert.alert("Erro", "Não foi possível salvar as conversas na lista.");
    }
  };

  const handleEditList = async (name: string, color: string, icon: string) => {
    if (!listToEdit) return;

    try {
      const db = await getDatabase();
      await db.runAsync(
        "UPDATE chat_lists SET name = ?, color = ?, icon = ?, updated_at = ? WHERE id = ?",
        [name, color, icon, new Date().toISOString(), listToEdit.id],
      );

      if (token) {
        await updateChatListApi(token, listToEdit.id, {
          name: name,
          color: color,
          icon: icon,
        });
      }

      setEditListModalVisible(false);
      setListToEdit(null);
      await loadLists();
    } catch (err) {
      console.error("Error editing list:", err);
      Alert.alert("Erro", "Não foi possível editar a lista.");
    }
  };

  // Touch-drag sorting callback
  const handleReorderEnd = async (updated: any[]) => {
    try {
      const db = await getDatabase();

      for (let i = 0; i < updated.length; i++) {
        await saveListPositionLocal(updated[i].id, i);

        if (!updated[i].isSystem) {
          await db.runAsync("UPDATE chat_lists SET position = ? WHERE id = ?", [
            i,
            updated[i].id,
          ]);
          if (token) {
            await updateChatListApi(token, updated[i].id, { position: i });
          }
        }
      }

      await loadLists();
    } catch (err) {
      console.error("Error saving reordered lists:", err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadChats();
      setSelectedChatIds([]);
    }, [loadChats]),
  );

  useEffect(() => {
    if (!token) return;
    const unsub = wsClient.on("chat_list_update", () => {
      loadChats();
    });
    return unsub;
  }, [token, loadChats]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {selectedChatIds.length > 0 ? (
        <View
          style={[styles.header, { backgroundColor: colors.headerBackground }]}
        >
          <View style={styles.headerLeftSelected}>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => setSelectedChatIds([])}
            >
              <ArrowLeft color={colors.headerText} size={22} />
            </TouchableOpacity>
            <Text
              style={[styles.selectedCountText, { color: colors.headerText }]}
            >
              {selectedChatIds.length}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={handlePinSelectedChats}
            >
              {(() => {
                const selectedChats = chats.filter((c) =>
                  selectedChatIds.includes(c.id),
                );
                const isAllPinned = selectedChats.every((c) => c.is_pinned);
                return isAllPinned ? (
                  <PinOff color={colors.headerText} size={22} />
                ) : (
                  <Pin color={colors.headerText} size={22} />
                );
              })()}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={handleMutePress}
            >
              {(() => {
                const selectedChats = chats.filter((c) =>
                  selectedChatIds.includes(c.id),
                );
                const allSelectedAreMuted = selectedChats.every(isChatMuted);
                return allSelectedAreMuted ? (
                  <Bell color={colors.headerText} size={22} />
                ) : (
                  <BellOff color={colors.headerText} size={22} />
                );
              })()}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={handleArchiveSelectedChats}
            >
              {(() => {
                const selectedChats = chats.filter((c) =>
                  selectedChatIds.includes(c.id),
                );
                const shouldArchive = !selectedChats.every(
                  (c) => c.is_archived,
                );
                return shouldArchive ? (
                  <PanelTopOpen color={colors.headerText} size={22} />
                ) : (
                  <PanelTopClose color={colors.headerText} size={22} />
                );
              })()}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={handleDeleteSelectedChats}
            >
              <Trash2 color={colors.headerText} size={22} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => setMoreMenuVisible(true)}
            >
              <MoreVertical color={colors.headerText} size={22} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View
          style={[styles.header, { backgroundColor: colors.headerBackground }]}
        >
          <Text
            style={[
              styles.title,
              { color: isDark ? colors.headerText : colors.tint },
            ]}
          >
            Zapi
          </Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() =>
                Alert.alert("Câmera", "Câmera em desenvolvimento.")
              }
            >
              <Camera color={colors.headerText} size={22} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => setMenuVisible(true)}
            >
              <MoreVertical color={colors.headerText} size={22} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Selected Chats Options Menu Dropdown */}
      <Modal
        visible={moreMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMoreMenuVisible(false)}
        >
          <View
            style={[
              styles.menuContainer,
              {
                backgroundColor: colors.menuBackground,
                borderColor: colors.border,
              },
            ]}
          >
            {selectedChatIds.length === 1 && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleViewContact}
                >
                  <Text style={[styles.menuItemText, { color: colors.text }]}>
                    Ver contato
                  </Text>
                </TouchableOpacity>
                <View
                  style={[
                    styles.menuDivider,
                    { backgroundColor: colors.border },
                  ]}
                />
              </>
            )}

            <TouchableOpacity style={styles.menuItem} onPress={handleSelectAll}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Selecionar tudo
              </Text>
            </TouchableOpacity>

            <View
              style={[styles.menuDivider, { backgroundColor: colors.border }]}
            />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleToggleFavoriteSelectedChats}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                {(() => {
                  const selectedChats = chats.filter((c) =>
                    selectedChatIds.includes(c.id),
                  );
                  const allFavorited = selectedChats.every(
                    (c) => c.is_favorite,
                  );
                  return allFavorited ? "Remover dos favoritos" : "Favoritar";
                })()}
              </Text>
            </TouchableOpacity>

            <View
              style={[styles.menuDivider, { backgroundColor: colors.border }]}
            />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMoreMenuVisible(false);
                setSelectorChatIds([]);
                setListSelectorVisible(true);
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Adicionar à lista
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleClearSelectedChats}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Limpar conversa
              </Text>
            </TouchableOpacity>

            <View
              style={[styles.menuDivider, { backgroundColor: colors.border }]}
            />

            {(() => {
              const selectedChats = chats.filter((c) =>
                selectedChatIds.includes(c.id),
              );
              const nonGroupChats = selectedChats.filter((c) => !c.is_group);
              if (nonGroupChats.length > 0) {
                const allBlocked = nonGroupChats.every(
                  (c) => c.is_blocked_by_me,
                );
                return (
                  <>
                    <View
                      style={[
                        styles.menuDivider,
                        { backgroundColor: colors.border },
                      ]}
                    />
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={handleBlockSelectedChats}
                    >
                      <Text
                        style={[styles.menuItemText, { color: colors.danger }]}
                      >
                        {allBlocked ? "Desbloquear" : "Bloquear"}
                      </Text>
                    </TouchableOpacity>
                  </>
                );
              }
              return null;
            })()}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Main Options Menu Dropdown */}
      <MainMenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
      />

      {/* Mute Chat Dialog Modal */}
      <MuteModal
        visible={muteModalVisible}
        onClose={() => {
          setMuteModalVisible(false);
          setMuteSelectorList(null);
        }}
        onMute={handleMuteChats}
      />

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.tint}
          style={{ marginTop: 40 }}
        />
      ) : (
        <>
          {/* SEARCH BAR & FILTER CHIPS CONTAINER */}
          {selectedChatIds.length === 0 && (
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 6,
              }}
            >
              <View
                style={{
                  backgroundColor: isDark ? "#1C1C1E" : "#F1F5F9",
                  borderRadius: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  height: 40,
                  marginBottom: 10,
                }}
              >
                <Search
                  size={18}
                  color={colors.textSecondary}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  placeholder="Buscar conversas..."
                  placeholderTextColor={colors.textSecondary}
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontSize: 15,
                    padding: 0,
                  }}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {orderedFilters.map((item) => {
                  const isActive = activeFilterId === item.id;
                  const isCustom = !item.isSystem;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isDark ? "#1C1C1E" : "#F1F5F9",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        },
                        isActive && {
                          backgroundColor: colors.tint,
                          elevation: 2,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.15,
                          shadowRadius: 2,
                        },
                      ]}
                      onPress={() => selectFilter(item.id)}
                      onLongPress={() => {
                        if (isCustom) {
                          const list = userLists.find((l) => l.id === item.id);
                          if (list) {
                            setActiveMenuList(list);
                          }
                        } else {
                          const virtualList: any = {
                            id: item.id,
                            name: item.name,
                            isSystem: true,
                            chat_ids:
                              item.id === "all"
                                ? chats.map((c) => c.id)
                                : item.id === "unread"
                                  ? chats
                                      .filter((c) => c.unread_count > 0)
                                      .map((c) => c.id)
                                  : item.id === "favorites"
                                    ? chats
                                        .filter((c) => c.is_favorite)
                                        .map((c) => c.id)
                                    : item.id === "groups"
                                      ? chats
                                          .filter((c) => c.is_group)
                                          .map((c) => c.id)
                                      : [],
                          };
                          setActiveMenuList(virtualList);
                        }
                      }}
                      delayLongPress={600}
                    >
                      {item.icon &&
                        renderListIcon(
                          item.icon,
                          item.color,
                          isActive ? "#fff" : colors.tint,
                          14,
                        )}
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: colors.textSecondary, fontSize: 14 },
                          isActive && { color: "#fff", fontWeight: "600" },
                        ]}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isDark ? "#1C1C1E" : "#F1F5F9",
                    },
                  ]}
                  onPress={() => setCreateListModalVisible(true)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: colors.textSecondary, fontWeight: "bold" },
                    ]}
                  >
                    ＋
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {activeChats.length === 0 && archivedChatsCount === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyContent}>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  Nenhuma conversa ainda
                </Text>
                <Text
                  style={[styles.emptySubtext, { color: colors.textSecondary }]}
                >
                  Toque no botão abaixo para iniciar
                </Text>
              </View>
              <View style={[styles.footerContainer, { marginBottom: 60 }]}>
                <Lock color={colors.textSecondary} size={13} />
                <Text
                  style={[styles.footerText, { color: colors.textSecondary }]}
                >
                  Suas mensagens estão protegidas por criptografia.
                </Text>
              </View>
            </View>
          ) : (
            <FlatList
              data={filteredChats}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 100 }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              ListHeaderComponent={
                archivedChatsCount > 0 &&
                searchQuery.trim().length === 0 &&
                activeFilterId === "all" ? (
                  <TouchableOpacity
                    style={[
                      styles.archivedRow,
                      {
                        borderBottomColor: colors.border,
                      },
                    ]}
                    onPress={() => router.push("/archived" as any)}
                  >
                    <View style={styles.archivedLeft}>
                      <View
                        style={[
                          styles.archivedIconContainer,
                          { backgroundColor: isDark ? "#222222" : "#F1F5F9" },
                        ]}
                      >
                        <Archive color={colors.textSecondary} size={20} />
                      </View>
                      <Text
                        style={[
                          styles.archivedText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Conversas arquivadas
                      </Text>
                    </View>
                    <View style={styles.archivedRight}>
                      <View
                        style={[
                          styles.archivedBadge,
                          { backgroundColor: isDark ? "#2C2C2E" : "#E5E7EB" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.archivedCountText,
                            { color: colors.textSecondary, fontWeight: "600" },
                          ]}
                        >
                          {archivedChatsCount}
                        </Text>
                      </View>
                      <ChevronRight
                        color={colors.textSecondary}
                        size={16}
                        style={{ opacity: 0.5 }}
                      />
                    </View>
                  </TouchableOpacity>
                ) : null
              }
              ListFooterComponent={
                <View>
                  <View style={styles.footerContainer}>
                    <Lock color={colors.textSecondary} size={13} />
                    <Text
                      style={[
                        styles.footerText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Suas mensagens estão protegidas por criptografia.
                    </Text>
                  </View>
                </View>
              }
              renderItem={({ item }) => (
                <ChatListItemComponent
                  item={item}
                  isSelected={selectedChatIds.includes(item.id)}
                  onPress={handlePress}
                  onLongPress={handleLongPress}
                />
              )}
            />
          )}
        </>
      )}

      {isFabVisible && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.fab }]}
          onPress={() => router.push("/contacts")}
        >
          <MessageSquarePlus color={isDark ? "#121212" : "#FFFFFF"} size={24} />
        </TouchableOpacity>
      )}

      {/* Create List Modal */}
      <CreateListModal
        visible={createListModalVisible}
        onClose={() => setCreateListModalVisible(false)}
        onCreate={handleCreateList}
      />

      {/* Choose Chats Selector Modal */}
      <ChatSelectorModal
        visible={chatSelectorVisible}
        onClose={() => {
          setChatSelectorVisible(false);
          setSelectorListId(null);
          setSelectorChatIds([]);
        }}
        activeChats={activeChats}
        initialSelectedChatIds={selectorChatIds}
        onSave={handleSaveListChats}
      />

      {/* Add/Remove Chat lists Membership Modal */}
      <ListSelectorModal
        visible={listSelectorVisible}
        onClose={() => setListSelectorVisible(false)}
        userLists={userLists}
        initialSelectedListIds={selectorChatIds}
        onSave={handleSaveChatLists}
        onCreateNewList={() => {
          setListSelectorVisible(false);
          setCreateListModalVisible(true);
        }}
      />

      {/* Custom List Options Menu Modal */}
      <ListMenuModal
        visible={!!activeMenuList}
        onClose={() => setActiveMenuList(null)}
        list={activeMenuList}
        onMuteChats={() => {
          if (activeMenuList) {
            setMuteSelectorList(activeMenuList);
            setMuteModalVisible(true);
            setActiveMenuList(null);
          }
        }}
        onEditList={() => {
          if (activeMenuList) {
            setListToEdit(activeMenuList);
            setEditListModalVisible(true);
            setActiveMenuList(null);
          }
        }}
        onReorderLists={() => {
          setActiveMenuList(null);
          setReorderModalVisible(true);
        }}
        onDeleteList={() => {
          if (activeMenuList) {
            handleDeleteList(activeMenuList.id);
            setActiveMenuList(null);
          }
        }}
      />

      {/* Edit List Modal */}
      <EditListModal
        visible={editListModalVisible}
        initialName={listToEdit?.name ?? ""}
        initialColor={listToEdit?.color ?? "🔴"}
        initialIcon={listToEdit?.icon ?? "❤️"}
        onClose={() => {
          setEditListModalVisible(false);
          setListToEdit(null);
        }}
        onSave={handleEditList}
      />

      {/* Bottom Sheet Reorganizar Listas Modal */}
      <ReorderListsModal
        visible={reorderModalVisible}
        onClose={() => setReorderModalVisible(false)}
        orderedFilters={orderedFilters}
        onReorderEnd={handleReorderEnd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  title: { fontSize: 22, fontWeight: "bold" },
  headerLeftSelected: { flexDirection: "row", alignItems: "center", gap: 12 },
  selectedCountText: { fontSize: 20, fontWeight: "bold", marginLeft: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerIcon: {
    padding: 4,
  },
  groupAvatar: { backgroundColor: "#34C759" },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  chatInfo: { flex: 1 },
  chatName: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  lastMessage: { fontSize: 14 },
  lastMessageAudioContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  lastMessageUnread: { fontWeight: "700" },
  time: { fontSize: 12 },
  timeUnread: { fontWeight: "700" },
  rightContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 8,
  },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  rightIconsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  pinIcon: {
    marginRight: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  empty: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  emptySubtext: { fontSize: 14, textAlign: "center" },
  footerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 40,
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
    flexShrink: 1,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  dialogOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  menuContainer: {
    position: "absolute",
    top: 60,
    right: 6,
    borderRadius: 12,
    paddingVertical: 6,
    width: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
  },
  menuItem: {
    padding: 14,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "500",
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
  themeDialog: {
    width: "80%",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  dialogOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  dialogOptionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dialogOptionText: {
    fontSize: 16,
  },
  dialogCloseButton: {
    alignItems: "flex-end",
    paddingTop: 8,
    paddingRight: 4,
  },
  dialogCloseText: {
    fontSize: 16,
    fontWeight: "600",
  },
  reorderListLeading: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 8,
  },
  reorderListIconSlot: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  reorderListName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 20,
    includeFontPadding: false,
  },
  archivedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  archivedLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  archivedIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  archivedText: {
    fontSize: 16,
    fontWeight: "500",
  },
  archivedRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  archivedBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  archivedCountText: {
    fontSize: 12,
  },
  filterChip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  filterChipText: {
    fontSize: 14,
  },
});
