import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
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
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { wsClient } from "@/services/ws";
import { useAppTheme } from "@/context/ThemeContext";
import MuteModal from "@/components/MuteModal";
import MainMenuModal from "@/components/MainMenuModal";
import CreateListModal from "@/components/CreateListModal";
import ChatListItemComponent from "@/components/ChatListItem";
import ChatSelectorModal from "@/components/ChatSelectorModal";
import ListSelectorModal from "@/components/ListSelectorModal";
import ListMenuModal from "@/components/ListMenuModal";
import ReorderListsModal from "@/components/ReorderListsModal";
import ListFilterCarousel from "@/components/ListFilterCarousel";
import { SelectedChatsMenuModal } from "@/components/SelectedChatsMenuModal";

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

  // Custom states for Lists
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

  const handleLongPressFilter = (item: any) => {
    const isCustom = !item.isSystem;
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
              ? chats.filter((c) => c.unread_count > 0).map((c) => c.id)
              : item.id === "favorites"
                ? chats.filter((c) => c.is_favorite).map((c) => c.id)
                : item.id === "groups"
                  ? chats.filter((c) => c.is_group).map((c) => c.id)
                  : [],
      };
      setActiveMenuList(virtualList);
    }
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

  // Lazy mount trackers for modals to optimize start-up/render performance without breaking exit animations
  const [hasOpenedMenu, setHasOpenedMenu] = useState(false);
  const [hasOpenedMoreMenu, setHasOpenedMoreMenu] = useState(false);
  const [hasOpenedMute, setHasOpenedMute] = useState(false);
  const [hasOpenedCreateList, setHasOpenedCreateList] = useState(false);
  const [hasOpenedChatSelector, setHasOpenedChatSelector] = useState(false);
  const [hasOpenedListSelector, setHasOpenedListSelector] = useState(false);
  const [hasOpenedListMenu, setHasOpenedListMenu] = useState(false);
  const [hasOpenedEditList, setHasOpenedEditList] = useState(false);
  const [hasOpenedReorder, setHasOpenedReorder] = useState(false);

  useEffect(() => {
    if (menuVisible) setHasOpenedMenu(true);
  }, [menuVisible]);

  useEffect(() => {
    if (moreMenuVisible) setHasOpenedMoreMenu(true);
  }, [moreMenuVisible]);

  useEffect(() => {
    if (muteModalVisible) setHasOpenedMute(true);
  }, [muteModalVisible]);

  useEffect(() => {
    if (createListModalVisible) setHasOpenedCreateList(true);
  }, [createListModalVisible]);

  useEffect(() => {
    if (chatSelectorVisible) setHasOpenedChatSelector(true);
  }, [chatSelectorVisible]);

  useEffect(() => {
    if (listSelectorVisible) setHasOpenedListSelector(true);
  }, [listSelectorVisible]);

  useEffect(() => {
    if (activeMenuList) setHasOpenedListMenu(true);
  }, [activeMenuList]);

  useEffect(() => {
    if (editListModalVisible) setHasOpenedEditList(true);
  }, [editListModalVisible]);

  useEffect(() => {
    if (reorderModalVisible) setHasOpenedReorder(true);
  }, [reorderModalVisible]);

  const activeChats = chats.filter((c) => !c.is_archived);

  const filteredChats = activeChats.filter((c) => {
    // Filter by Active List Chip
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
              <MaterialCommunityIcons
                name="arrow-left"
                color={colors.headerText}
                size={22}
              />
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
                  <MaterialCommunityIcons
                    name="pin-off"
                    color={colors.headerText}
                    size={24}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="pin"
                    color={colors.headerText}
                    size={24}
                  />
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
                  <MaterialCommunityIcons
                    name="bell"
                    color={colors.headerText}
                    size={24}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="bell-off"
                    color={colors.headerText}
                    size={24}
                  />
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
                  <MaterialCommunityIcons
                    name="archive-arrow-down-outline"
                    color={colors.headerText}
                    size={24}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="archive-arrow-up-outline"
                    color={colors.headerText}
                    size={24}
                  />
                );
              })()}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={handleDeleteSelectedChats}
            >
              <MaterialCommunityIcons
                name="delete-outline"
                color={colors.headerText}
                size={24}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => setMoreMenuVisible(true)}
            >
              <MaterialCommunityIcons
                name="dots-vertical"
                color={colors.headerText}
                size={24}
              />
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
              onPress={() => router.push("/search")}
            >
              <MaterialCommunityIcons
                name="magnify"
                color={colors.headerText}
                size={24}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => router.push("/link-device")}
            >
              <MaterialCommunityIcons
                name="camera-outline"
                color={colors.headerText}
                size={24}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => setMenuVisible(true)}
            >
              <MaterialCommunityIcons
                name="dots-vertical"
                color={colors.headerText}
                size={24}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Selected Chats Options Menu Dropdown */}
      {(moreMenuVisible || hasOpenedMoreMenu) && (
        <SelectedChatsMenuModal
          visible={moreMenuVisible}
          onClose={() => setMoreMenuVisible(false)}
          selectedChatIds={selectedChatIds}
          chats={chats}
          onViewContact={handleViewContact}
          onSelectAll={handleSelectAll}
          onToggleFavorite={handleToggleFavoriteSelectedChats}
          onAddToList={() => {
            setSelectorChatIds([]);
            setListSelectorVisible(true);
          }}
          onClearChats={handleClearSelectedChats}
          onBlockChats={handleBlockSelectedChats}
        />
      )}

      {/* Main Options Menu Dropdown */}
      {(menuVisible || hasOpenedMenu) && (
        <MainMenuModal
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
        />
      )}

      {/* Mute Chat Dialog Modal */}
      {(muteModalVisible || hasOpenedMute) && (
        <MuteModal
          visible={muteModalVisible}
          onClose={() => {
            setMuteModalVisible(false);
            setMuteSelectorList(null);
          }}
          onMute={handleMuteChats}
        />
      )}

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.tint}
          style={{ marginTop: 40 }}
        />
      ) : (
        <>
          {/* FILTER CHIPS CONTAINER */}
          {selectedChatIds.length === 0 && (
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 8,
              }}
            >
              <ListFilterCarousel
                orderedFilters={orderedFilters}
                activeFilterId={activeFilterId}
                onSelectFilter={selectFilter}
                onLongPressFilter={handleLongPressFilter}
                onCreateListPress={() => setCreateListModalVisible(true)}
                colors={colors}
              />
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
            </View>
          ) : (
            <FlatList
              data={filteredChats}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 100 }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              ListHeaderComponent={
                archivedChatsCount > 0 && activeFilterId === "all" ? (
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
                      <View style={[styles.archivedIconContainer]}>
                        <MaterialCommunityIcons
                          name="archive-arrow-down-outline"
                          color={colors.textSecondary}
                          size={24}
                        />
                      </View>
                      <Text
                        style={[
                          styles.archivedText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Conversas Arquivadas
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : null
              }
              ListFooterComponent={
                <View>
                  <View style={styles.footerContainer}>
                    <MaterialCommunityIcons
                      name="lock"
                      color={colors.textSecondary}
                      size={13}
                    />
                    <Text
                      style={[
                        styles.footerText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Seus dados estão protegidas por criptografia.
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
          <MaterialCommunityIcons
            name="message-plus"
            color="#FFFFFF"
            size={24}
          />
        </TouchableOpacity>
      )}

      {/* Create List Modal */}
      {(createListModalVisible || hasOpenedCreateList) && (
        <CreateListModal
          visible={createListModalVisible}
          onClose={() => setCreateListModalVisible(false)}
          onSubmit={handleCreateList}
        />
      )}

      {/* Choose Chats Selector Modal */}
      {(chatSelectorVisible || hasOpenedChatSelector) && (
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
      )}

      {/* Add/Remove Chat lists Membership Modal */}
      {(listSelectorVisible || hasOpenedListSelector) && (
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
      )}

      {/* Custom List Options Menu Modal */}
      {(!!activeMenuList || hasOpenedListMenu) && (
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
      )}

      {(editListModalVisible || hasOpenedEditList) && (
        <CreateListModal
          visible={editListModalVisible}
          mode="edit"
          initialName={listToEdit?.name ?? ""}
          initialColor={listToEdit?.color ?? "🔴"}
          initialIcon={listToEdit?.icon ?? ""}
          onClose={() => {
            setEditListModalVisible(false);
            setListToEdit(null);
          }}
          onSubmit={handleEditList}
        />
      )}

      {/* Bottom Sheet Reorganizar Listas Modal */}
      {(reorderModalVisible || hasOpenedReorder) && (
        <ReorderListsModal
          visible={reorderModalVisible}
          onClose={() => setReorderModalVisible(false)}
          orderedFilters={orderedFilters}
          onReorderEnd={handleReorderEnd}
          onDeleteList={handleDeleteList}
        />
      )}
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
    paddingTop: 50,
    paddingBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "500",
  },
  headerLeftSelected: { flexDirection: "row", alignItems: "center", gap: 12 },
  selectedCountText: { fontSize: 20, fontWeight: "bold", marginLeft: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerIcon: {
    padding: 4,
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
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  archivedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  archivedLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  archivedIconContainer: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  archivedText: {
    fontSize: 16,
  },
});
