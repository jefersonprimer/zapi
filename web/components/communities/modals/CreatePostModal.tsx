"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, MessageSquare, Smile } from "lucide-react";
import { CreatePostPayload } from "@/lib/community-types";
import { EmojiGifStickerPicker } from "@/components/EmojiGifStickerPicker";
import { useAuth } from "@/lib/auth-context";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreatePostPayload) => void;
  channelId?: string;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  channelId,
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [activeInput, setActiveInput] = useState<"title" | "content">("content");
  const pickerRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentTextAreaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize content textarea as user writes
  useEffect(() => {
    const textarea = contentTextAreaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [content]);

  // Close picker on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    }
    if (showPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPicker]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    onCreate({
      title: title.trim(),
      content: content.trim(),
      channel_id: channelId,
    });

    setTitle("");
    setContent("");
    setShowPicker(false);
    onClose();
  };

  const insertTextAtCursor = (textToInsert: string) => {
    const inputElement = activeInput === "title" ? titleInputRef.current : contentTextAreaRef.current;
    
    if (!inputElement) {
      if (activeInput === "title") {
        setTitle((prev) => prev + textToInsert);
      } else {
        setContent((prev) => prev + textToInsert);
      }
      return;
    }

    const start = inputElement.selectionStart || 0;
    const end = inputElement.selectionEnd || 0;
    const text = inputElement.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    if (activeInput === "title") {
      setTitle(before + textToInsert + after);
    } else {
      setContent(before + textToInsert + after);
    }

    setTimeout(() => {
      inputElement.focus();
      inputElement.selectionStart = inputElement.selectionEnd = start + textToInsert.length;
    }, 0);
  };

  const handleSelectEmoji = (emoji: string) => {
    insertTextAtCursor(emoji);
  };

  const handleSelectGif = (gifUrl: string) => {
    setActiveInput("content");
    insertTextAtCursor(`\n![gif](${gifUrl})\n`);
    setShowPicker(false);
  };

  const handleSelectSticker = (stickerUrl: string) => {
    setActiveInput("content");
    insertTextAtCursor(`\n![sticker](${stickerUrl})\n`);
    setShowPicker(false);
  };

  const characterLimit = 2000;
  const isOverLimit = content.length > characterLimit;

  // Generate fallback initials
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : user?.username ? user.username.charAt(0).toUpperCase() : "?";

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] relative animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100 font-bold overflow-hidden shadow-inner">
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt={user?.name || "User"} className="h-full w-full object-cover" />
              ) : (
                <span>{userInitial}</span>
              )}
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-zinc-100 flex items-center gap-1.5 leading-tight">
                <MessageSquare className="w-4 h-4 text-zinc-400" />
                Novo Tópico de Discussão
              </h2>
              <p className="text-xs text-zinc-500">
                Publique na comunidade
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-full hover:bg-zinc-900 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <div className="border-b border-zinc-900 pb-3">
            <input
              ref={titleInputRef}
              id="post-title-input"
              type="text"
              required
              onFocus={() => setActiveInput("title")}
              placeholder="Título do Tópico..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent border-0 p-0 text-base font-bold text-zinc-100 placeholder-zinc-550 focus:ring-0 outline-none transition-all"
            />
          </div>

          <div className="relative">
            <textarea
              ref={contentTextAreaRef}
              id="post-content-input"
              required
              onFocus={() => setActiveInput("content")}
              rows={4}
              placeholder="Explique os detalhes do seu tópico ou dúvida..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-transparent border-0 p-0 text-sm text-zinc-150 placeholder-zinc-650 focus:ring-0 outline-none resize-none leading-relaxed transition-all min-h-[120px]"
            />
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
            <div>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold transition-all active:scale-95 shadow-sm cursor-pointer"
              >
                <Smile className="w-4 h-4 text-zinc-400" />
                <span>Emoji / GIF</span>
              </button>

              {showPicker && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
                  <div
                    ref={pickerRef}
                    className="relative shadow-2xl animate-in zoom-in-95 duration-150"
                  >
                    <EmojiGifStickerPicker
                      onSelectEmoji={handleSelectEmoji}
                      onSelectGif={handleSelectGif}
                      onSelectSticker={handleSelectSticker}
                      onClose={() => setShowPicker(false)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3.5">
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                isOverLimit 
                  ? "bg-red-950/40 border-red-900/50 text-red-400" 
                  : content.length > characterLimit - 100 
                    ? "bg-amber-950/40 border-amber-900/50 text-amber-400" 
                    : "bg-zinc-900/85 border-zinc-800/80 text-zinc-400"
              }`}>
                {content.length}/{characterLimit}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-semibold text-zinc-450 hover:text-zinc-250 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!title.trim() || !content.trim() || isOverLimit}
                className="px-5 py-2.5 bg-zinc-100 hover:bg-white disabled:opacity-40 text-black rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Publicar Tópico
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
