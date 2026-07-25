"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createChatList } from "@/lib/api";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

interface ListSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  onCreated: (newListId: string) => void;
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

export default function ListSidebar({
  onClose,
  token,
  onCreated,
}: ListSidebarProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");
  const [color, setColor] = useState("");
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

  const handleCreate = async () => {
    if (!name.trim() || !token) return;
    setCreating(true);
    try {
      const res = await createChatList(token, name.trim(), color || undefined, icon);
      if (res?.list?.id) {
        onCreated(res.list.id);
      }
      setName("");
      setIcon("📁");
      setColor("");
      onClose();
    } catch (err) {
      console.error("Error creating list:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header Row */}
      <div className="py-2 px-1 border-b border-card-border/50 flex items-center gap-3 shrink-0">
        <button
          onClick={() => {
            setName("");
            setIcon("📁");
            setColor("");
            onClose();
          }}
          disabled={creating}
          className="p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 active:scale-95 transition-all cursor-pointer"
          title="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-bold text-foreground">Nova lista</h2>
      </div>

      {/* Main Form Fields */}
      <div className="flex-1 overflow-y-auto py-5 space-y-6">
        {/* Profile-like Icon Picker */}
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="relative" ref={emojiPickerRef}>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="h-20 w-20 rounded-3xl border-2 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center text-4xl hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md hover:shadow-lg"
              title="Escolher Emoji"
            >
              {icon}
            </button>

            {showEmojiPicker && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-3 z-[10001] shadow-2xl rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 animate-in slide-in-from-top-2 duration-200">
                <Picker
                  data={data}
                  onEmojiSelect={(emoji: { native: string }) => {
                    setIcon(emoji.native);
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
          <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
            Toque para escolher o emoji
          </span>
        </div>

        {/* List Name Input */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-450 uppercase tracking-wider pl-1">
            Nome da lista
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Ex: Trabalho, Faculdade, Família..."
            className="w-full px-4 py-3 text-sm border border-neutral-250 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-450 focus:outline-none focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white transition-all shadow-sm"
          />
        </div>

        {/* Accent Colors Selection */}
        <div className="space-y-2.5">
          <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-450 uppercase tracking-wider pl-1">
            Cor de destaque
          </label>
          <div className="grid grid-cols-5 gap-3 p-3.5 bg-neutral-50 dark:bg-neutral-900/30 border border-neutral-200/50 dark:border-neutral-900/60 rounded-2xl">
            {PREMIUM_COLORS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setColor(color === item.value ? "" : item.value)}
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-90 mx-auto ${
                  color === item.value
                    ? "ring-2 ring-offset-2 ring-neutral-950 dark:ring-white dark:ring-offset-neutral-950 scale-110"
                    : "opacity-80 hover:opacity-100"
                }`}
                style={{ backgroundColor: item.value }}
                title={item.name}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Action Button at the bottom */}
      <div className="py-4 border-t border-card-border/50 bg-surface shrink-0">
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="w-full py-3.5 text-sm font-semibold rounded-xl bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:pointer-events-none"
        >
          {creating && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar Lista
        </button>
      </div>
    </div>
  );
}
