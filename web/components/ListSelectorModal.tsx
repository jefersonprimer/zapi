"use client";

import { useState, useEffect, useRef } from "react";
import { X, Check, Plus, Loader2 } from "lucide-react";
import { getChatLists, updateChatLists, createChatList, type ChatListResponse } from "@/lib/api";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

interface ListSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  token: string;
  onUpdate: () => void;
}

const PREMIUM_COLORS = [
  { name: "Preto", value: "#171717" },
  { name: "Cinza", value: "#64748b" },
  { name: "Esmeralda", value: "#10b981" },
  { name: "Azul", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violeta", value: "#8b5cf6" },
  { name: "Rosa", value: "#f43f5e" },
  { name: "Ambar", value: "#f59e0b" },
  { name: "Teal", value: "#0d9488" }
];

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
  const [newListIcon, setNewListIcon] = useState("📁");
  const [newListColor, setNewListColor] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [creating, setCreating] = useState(false);

  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      const res = await createChatList(token, newListName.trim(), newListColor || undefined, newListIcon);
      if (res?.list) {
        setLists((prev) => [...prev, { ...res.list, chat_ids: res.chat_ids || [] }]);
        setSelectedIds((prev) => [...prev, res.list.id]);
        setNewListName("");
        setNewListIcon("📁");
        setNewListColor("");
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
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-900 rounded-[28px] max-w-sm w-full p-6 shadow-2xl overflow-visible my-8 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          disabled={saving}
          className="absolute top-5 right-5 h-8 w-8 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="text-lg font-bold mb-1 text-neutral-950 dark:text-white">Adicionar a lista</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-5">
          Selecione as listas que deseja adicionar esta conversa.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400 dark:text-neutral-600" />
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto mb-4 space-y-1 pr-1">
            {lists.length === 0 ? (
              <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-6">
                Nenhuma lista criada. Crie uma nova lista abaixo.
              </p>
            ) : (
              lists.map((list) => {
                const isChecked = selectedIds.includes(list.id);
                return (
                  <button
                    key={list.id}
                    onClick={() => toggleList(list.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all duration-200 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 text-sm font-medium text-neutral-800 dark:text-neutral-250">
                      {list.color && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: list.color }}
                        />
                      )}
                      {list.icon && <span className="text-sm">{list.icon}</span>}
                      {list.name}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-[6px] border-2 flex items-center justify-center transition-all duration-200 ${
                        isChecked
                          ? "bg-neutral-950 border-neutral-950 dark:bg-white dark:border-white scale-105"
                          : "border-neutral-300 dark:border-neutral-750"
                      }`}
                    >
                      {isChecked && <Check className="h-3 w-3 text-white dark:text-neutral-950 stroke-[3]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {showCreateInput ? (
          <div className="flex flex-col gap-3.5 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-200/60 dark:border-neutral-900/60 mb-5 animate-in slide-in-from-top-2 duration-200 relative">
            <div className="flex items-center gap-3">
              {/* Emoji Trigger */}
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="h-11 w-11 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 flex items-center justify-center text-xl hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm"
                  title="Escolher Emoji"
                >
                  {newListIcon}
                </button>

                {showEmojiPicker && (
                  <div className="absolute left-0 bottom-full mb-2 z-[10001] shadow-2xl rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
                    <Picker
                      data={data}
                      onEmojiSelect={(emoji: { native: string }) => {
                        setNewListIcon(emoji.native);
                        setShowEmojiPicker(false);
                      }}
                      locale="pt"
                      theme="auto"
                      previewPosition="none"
                      skinTonePosition="none"
                    />
                  </div>
                )}
              </div>

              {/* Name Input */}
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
                placeholder="Nome da lista"
                autoFocus
                className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-neutral-250 dark:border-neutral-750 rounded-xl bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white transition-all"
              />
            </div>

            {/* Premium Colors Selector */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Cor de Destaque
              </label>
              <div className="flex flex-wrap items-center gap-1.5 py-1">
                {PREMIUM_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setNewListColor(newListColor === color.value ? "" : color.value)}
                    className={`h-6 w-6 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-90 ${
                      newListColor === color.value
                        ? "ring-2 ring-offset-2 ring-neutral-950 dark:ring-white dark:ring-offset-neutral-900 scale-110"
                        : "opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-neutral-200/50 dark:border-neutral-800/40">
              <button
                type="button"
                onClick={() => {
                  setShowCreateInput(false);
                  setNewListName("");
                  setNewListIcon("📁");
                  setNewListColor("");
                }}
                className="flex-1 py-2 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-850 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateList}
                disabled={creating || !newListName.trim()}
                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {creating && <Loader2 className="h-3 w-3 animate-spin" />}
                Criar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreateInput(true)}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-neutral-950 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-neutral-250 dark:border-neutral-800 rounded-xl transition-all duration-200 cursor-pointer mb-5 shadow-sm active:scale-98"
          >
            <Plus className="h-4 w-4" />
            <span>Nova lista</span>
          </button>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 text-sm font-semibold rounded-xl border border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer text-neutral-700 dark:text-neutral-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 py-3 text-sm font-semibold rounded-xl bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

