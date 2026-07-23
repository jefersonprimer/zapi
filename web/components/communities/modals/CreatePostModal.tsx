"use client";

import React, { useState } from "react";
import { X, MessageSquare } from "lucide-react";
import { CreatePostPayload } from "@/lib/community-types";

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
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-6 relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-200 p-1 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-zinc-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-zinc-300" />
            Novo Tópico de Discussão
          </h2>
          <p className="text-xs text-zinc-400">
            Publique uma pergunta, tutorial ou debate técnico para os membros da comunidade.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
              Título do Tópico *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Como configurar pooling de conexões no SQLx?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
              Conteúdo Detalhado *
            </label>
            <textarea
              required
              rows={6}
              placeholder="Explique os detalhes do seu tópico ou dúvida..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 resize-none leading-relaxed"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-black rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Publicar Tópico
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
