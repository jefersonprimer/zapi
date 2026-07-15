import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { getChatLists, createChatList } from "@/services/api";
import { getLocalChatLists, saveLocalChatLists, type LocalChatList } from "@/services/database";
import { updateChatListSelections } from "@/services/chatActions";
import { useAuth } from "@/context/AuthContext";

/**
 * Custom hook to manage adding/removing a chat to/from user custom lists.
 * Shares states for list selections, listing, and list creation across screens.
 * 
 * @param chatId The ID of the chat. If not yet resolved (e.g. in details screen), 
 *               it can be resolved dynamically when saving.
 * @param onSaveSuccess Optional callback to execute after successful update.
 */
export function useChatLists(
  chatId: string | null | undefined,
  onSaveSuccess?: () => void
) {
  const { token } = useAuth();
  const [listSelectorVisible, setListSelectorVisible] = useState(false);
  const [createListModalVisible, setCreateListModalVisible] = useState(false);
  const [allLists, setAllLists] = useState<LocalChatList[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [isListActionLoading, setIsListActionLoading] = useState(false);

  const syncLists = useCallback(async () => {
    if (!token) return;
    try {
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
        setAllLists(mappedLists);
        if (chatId) {
          const selected = mappedLists
            .filter((l) => l.chat_ids.includes(chatId))
            .map((l) => l.id);
          setSelectedListIds(selected);
        }
      }
    } catch (err) {
      console.warn("Offline or sync error syncing lists:", err);
    }
  }, [token, chatId]);

  const loadListsAndSelection = useCallback(async () => {
    try {
      const lists = await getLocalChatLists();
      setAllLists(lists);
      if (chatId) {
        const selected = lists
          .filter((l) => l.chat_ids.includes(chatId))
          .map((l) => l.id);
        setSelectedListIds(selected);
      } else {
        setSelectedListIds([]);
      }
    } catch (err) {
      console.error("Error loading chat lists:", err);
    }
  }, [chatId]);

  useEffect(() => {
    loadListsAndSelection();
  }, [loadListsAndSelection]);

  const handleOpenListSelector = useCallback(async () => {
    setIsListActionLoading(true);
    try {
      await syncLists();
      setListSelectorVisible(true);
    } catch (err) {
      console.error("Error fetching lists:", err);
      setListSelectorVisible(true);
    } finally {
      setIsListActionLoading(false);
    }
  }, [syncLists]);

  const handleSaveLists = useCallback(async (selectedIds: string[], targetChatId?: string) => {
    const finalChatId = targetChatId || chatId;
    if (!token || !finalChatId) return;
    setIsListActionLoading(true);
    try {
      await updateChatListSelections(token, finalChatId, selectedIds);
      setSelectedListIds(selectedIds);
      setListSelectorVisible(false);
      Alert.alert("Sucesso", "Listas atualizadas com sucesso.");
      if (onSaveSuccess) onSaveSuccess();
    } catch (err: any) {
      console.error("Error saving lists:", err);
      Alert.alert(
        "Erro",
        err.message || "Não foi possível atualizar as listas.",
      );
    } finally {
      setIsListActionLoading(false);
    }
  }, [token, chatId, onSaveSuccess]);

  const handleCreateList = useCallback(async (
    name: string,
    color: string,
    icon: string,
  ) => {
    if (!token) return;
    setIsListActionLoading(true);
    try {
      const response = await createChatList(token, name, color, icon);
      if (response && response.list) {
        await syncLists();
        setSelectedListIds((prev) => [...prev, response.list.id]);
        setCreateListModalVisible(false);
        setListSelectorVisible(true);
      }
    } catch (err: any) {
      console.error("Error creating list:", err);
      Alert.alert("Erro", "Não foi possível criar a lista.");
    } finally {
      setIsListActionLoading(false);
    }
  }, [token, syncLists]);

  return {
    listSelectorVisible,
    setListSelectorVisible,
    createListModalVisible,
    setCreateListModalVisible,
    allLists,
    selectedListIds,
    setSelectedListIds,
    isListActionLoading,
    syncLists,
    loadListsAndSelection,
    handleOpenListSelector,
    handleSaveLists,
    handleCreateList,
  };
}
