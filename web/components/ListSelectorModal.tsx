"use client";

import { useState, useEffect } from "react";
import { X, Check, Plus, Loader2 } from "lucide-react";
import { getChatLists, updateChatLists, createChatList, type ChatListResponse } from "@/lib/api";

interface ListSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  token: string;
  onUpdate: () => void;
}

export function ListSelectorModal({
  isOpen,
  onClose,
  chatId,
  token,
  onUpdate,
}: ListSelectorModalProps) {
  const [lists, setLists] = useState<ChatListResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    Promise.resolve().then(async () => {
      if (!isMounted) return;
      setLoading(true);
      try {
        const res = await getChatLists(token);
        if (!isMounted) return;
        const allLists = res.lists || [];
        setLists(allLists);
        const selected = allLists
          .filter((l) => l.chat_ids.includes(chatId))
          .map((l) => l.id);
        setSelectedIds(selected);
      } catch {
        if (isMounted) {
          setLists([]);
          setSelectedIds([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [isOpen, token, chatId]);

  const toggleList = (listId: string) => {
    setSelectedIds((prev) =>
      prev.includes(listId)
        ? prev.filter((id) => id !== listId)
        : [...prev, listId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateChatLists(token, chatId, selectedIds);
      onUpdate();
      onClose();
    } catch (err) {
      console.error("Error saving lists:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setCreating(true);
    try {
      const res = await createChatList(token, newListName.trim());
      if (res?.list) {
        setLists((prev) => [...prev, { ...res.list, chat_ids: res.chat_ids || [] }]);
        setSelectedIds((prev) => [...prev, res.list.id]);
        setNewListName("");
        setShowCreateInput(false);
      }
    } catch (err) {
      console.error("Error creating list:", err);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative bg-surface dark:bg-card-bg border border-card-border/80 rounded-3xl max-w-sm w-full p-6 shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          disabled={saving}
          className="absolute top-5 right-5 h-9 w-9 rounded-full bg-neutral-100 dark:bg-neutral-800/80 flex items-center justify-center text-muted-text hover:text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="text-lg font-bold mb-1">Adicionar a lista</h3>
        <p className="text-xs text-muted-text mb-5">
          Selecione as listas que deseja adicionar esta conversa.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-text" />
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto mb-4 space-y-1">
            {lists.length === 0 ? (
              <p className="text-sm text-muted-text text-center py-4">
                Nenhuma lista criada. Crie uma nova lista abaixo.
              </p>
            ) : (
              lists.map((list) => {
                const isChecked = selectedIds.includes(list.id);
                return (
                  <button
                    key={list.id}
                    onClick={() => toggleList(list.id)}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {list.icon && <span>{list.icon}</span>}
                      {list.name}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        isChecked
                          ? "bg-emerald-500 border-emerald-500"
                          : "border-neutral-300 dark:border-neutral-600"
                      }`}
                    >
                      {isChecked && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {showCreateInput ? (
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
              placeholder="Nome da nova lista"
              autoFocus
              className="flex-1 px-3 py-2 text-sm border border-card-border rounded-xl bg-background text-foreground placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              onClick={handleCreateList}
              disabled={creating || !newListName.trim()}
              className="px-3 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              {creating && <Loader2 className="h-3 w-3 animate-spin" />}
              Criar
            </button>
            <button
              onClick={() => { setShowCreateInput(false); setNewListName(""); }}
              className="px-3 py-2 text-sm font-semibold rounded-xl border border-card-border hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreateInput(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-colors cursor-pointer mb-4"
          >
            <Plus className="h-4 w-4" />
            <span>Nova lista</span>
          </button>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-card-border hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
