"use client";

import React, { useState } from "react";
import { X, Hash, LogIn } from "lucide-react";

interface JoinCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinByCode: (code: string) => void;
}

export const JoinCommunityModal: React.FC<JoinCommunityModalProps> = ({
  isOpen,
  onClose,
  onJoinByCode,
}) => {
  const [code, setCode] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    onJoinByCode(code.trim());
    setCode("");
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
          <h2 className="text-xl font-extrabold text-zinc-100 flex items-center gap-2">
            <Hash className="w-5 h-5 text-zinc-300" />
            Entrar em um Servidor
          </h2>
          <p className="text-xs text-zinc-400">
            Insira o código de convite recebido para entrar na comunidade instantaneamente.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
              Código de Convite *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: ZAPI-DEV-2026"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-zinc-600 uppercase"
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
              className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-black rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>Entrar no Servidor</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
