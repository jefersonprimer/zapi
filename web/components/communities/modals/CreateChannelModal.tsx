"use client";

import React, { useState } from "react";
import { X, Hash, MessageSquare, Calendar } from "lucide-react";
import { CreateChannelPayload, ChannelType } from "@/lib/community-types";

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateChannelPayload) => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ChannelType>("text");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreate({
      name: name.trim().toLowerCase().replace(/\s+/g, "-"),
      type,
      description: description.trim() || undefined,
    });

    setName("");
    setDescription("");
    setType("text");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-6 relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-200 p-1 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-zinc-100">Criar Canal</h2>
          <p className="text-xs text-zinc-400">
            Adicione um novo canal ao servidor para bate-papo, fóruns ou eventos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Tipo de Canal
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType("text")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-bold cursor-pointer ${
                  type === "text"
                    ? "bg-zinc-100 text-black border-zinc-100 shadow-md"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <Hash className="w-4 h-4" />
                <span>Texto</span>
              </button>

              <button
                type="button"
                onClick={() => setType("forum")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-bold cursor-pointer ${
                  type === "forum"
                    ? "bg-zinc-100 text-black border-zinc-100 shadow-md"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Fórum</span>
              </button>

              <button
                type="button"
                onClick={() => setType("event")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-bold cursor-pointer ${
                  type === "event"
                    ? "bg-zinc-100 text-black border-zinc-100 shadow-md"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Eventos</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
              Nome do Canal *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-xs">
                #
              </span>
              <input
                type="text"
                required
                placeholder="novo-canal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-7 pr-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
              Descrição (Opcional)
            </label>
            <input
              type="text"
              placeholder="Sobre o que é este canal?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
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
              Criar Canal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
