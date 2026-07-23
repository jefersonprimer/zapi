"use client";

import React, { useState } from "react";
import { X, Sparkles, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { CreateCommunityPayload, CommunityVisibility } from "@/lib/community-types";
import { useAuth } from "@/lib/auth-context";
import { uploadFile } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";

interface CreateCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateCommunityPayload) => void;
}

export const CreateCommunityModal: React.FC<CreateCommunityModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Tecnologia");
  const [visibility, setVisibility] = useState<CommunityVisibility>("public");
  const [iconUrl, setIconUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadError, setUploadError] = useState("");

  if (!isOpen) return null;

  const handleUploadIcon = async (file: File) => {
    if (!token) {
      setUploadError("Você precisa estar autenticado para enviar imagens.");
      return;
    }
    setUploadingIcon(true);
    setUploadError("");
    try {
      const res = await uploadFile(token, file);
      setIconUrl(res.url);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Erro ao enviar imagem do ícone.");
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleUploadBanner = async (file: File) => {
    if (!token) {
      setUploadError("Você precisa estar autenticado para enviar imagens.");
      return;
    }
    setUploadingBanner(true);
    setUploadError("");
    try {
      const res = await uploadFile(token, file);
      setBannerUrl(res.url);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Erro ao enviar imagem do banner.");
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      visibility,
      icon_url: iconUrl.trim() || undefined,
      banner_url: bannerUrl.trim() || undefined,
    });

    setName("");
    setDescription("");
    setIconUrl("");
    setBannerUrl("");
    setUploadError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-6 relative animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto no-scrollbar">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-200 p-1 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-zinc-300" />
            Criar sua Comunidade
          </h2>
          <p className="text-xs text-zinc-400">
            Dê vida ao seu novo servidor Discord-like com canais, fóruns e membros.
          </p>
        </div>

        {uploadError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-medium">
            {uploadError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
              Nome da Comunidade *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Devs & Soluções Zapi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
              Descrição
            </label>
            <textarea
              rows={3}
              placeholder="Descreva sobre o que é o seu servidor..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
              >
                <option value="Tecnologia">Tecnologia</option>
                <option value="Design">Design</option>
                <option value="Engenharia">Engenharia</option>
                <option value="Negócios">Negócios</option>
                <option value="Geral">Geral</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Visibilidade
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as CommunityVisibility)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
              >
                <option value="public">Pública</option>
                <option value="private">Privada</option>
              </select>
            </div>
          </div>

          {/* Ícone Component */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
              Ícone da Comunidade
            </label>
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0 group">
                {iconUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getImageUrl(iconUrl)}
                      alt="Ícone"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setIconUrl("")}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                      title="Remover ícone"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : uploadingIcon ? (
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-zinc-600" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingIcon ? "Enviando..." : "Fazer Upload do Ícone"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingIcon}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadIcon(file);
                    }}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  placeholder="Ou cole a URL da imagem (https://...)"
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
              </div>
            </div>
          </div>

          {/* Banner Component */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
              Banner da Comunidade
            </label>
            <div className="space-y-2">
              <div className="relative w-full h-24 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden group">
                {bannerUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getImageUrl(bannerUrl)}
                      alt="Banner"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setBannerUrl("")}
                      className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-rose-600 text-white rounded-lg transition-colors cursor-pointer"
                      title="Remover banner"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : uploadingBanner ? (
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                ) : (
                  <div className="text-center text-zinc-500 text-xs flex flex-col items-center gap-1">
                    <ImageIcon className="w-6 h-6 text-zinc-600" />
                    <span>Nenhum banner selecionado</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingBanner ? "Enviando..." : "Upload do Banner"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingBanner}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadBanner(file);
                    }}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  placeholder="Ou cole a URL do banner (https://...)"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
              </div>
            </div>
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
              disabled={uploadingIcon || uploadingBanner}
              className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-black rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Criar Comunidade
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

