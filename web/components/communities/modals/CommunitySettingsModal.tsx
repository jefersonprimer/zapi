"use client";

import React, { useState, useEffect } from "react";
import { X, Settings, Link as LinkIcon, Trash2, Copy, Check, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { Community, CommunityInvite, CreateCommunityPayload } from "@/lib/community-types";
import { communityApi } from "@/lib/community-api";
import { useAuth } from "@/lib/auth-context";
import { uploadFile } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";

interface CommunitySettingsModalProps {
  isOpen: boolean;
  community: Community;
  onClose: () => void;
  onUpdate: (id: string, payload: Partial<CreateCommunityPayload>) => void;
  onDelete: (id: string) => void;
}

export const CommunitySettingsModal: React.FC<CommunitySettingsModalProps> = ({
  isOpen,
  community,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "invites">("overview");
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description || "");
  const [category, setCategory] = useState(community.category || "Geral");
  const [visibility, setVisibility] = useState(community.visibility);
  const [iconUrl, setIconUrl] = useState(community.icon_url || "");
  const [bannerUrl, setBannerUrl] = useState(community.banner_url || "");

  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [invites, setInvites] = useState<CommunityInvite[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !community) return;
    let isMounted = true;
    Promise.resolve().then(async () => {
      if (!isMounted) return;
      setName(community.name);
      setDescription(community.description || "");
      setCategory(community.category || "Geral");
      setVisibility(community.visibility);
      setIconUrl(community.icon_url || "");
      setBannerUrl(community.banner_url || "");

      const invs = await communityApi.listInvites(community.id);
      if (isMounted) setInvites(invs);
    });
    return () => {
      isMounted = false;
    };
  }, [isOpen, community]);

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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(community.id, {
      name,
      description,
      category,
      visibility,
      icon_url: iconUrl,
      banner_url: bannerUrl,
    });
    onClose();
  };

  const handleGenerateInvite = async () => {
    const newInv = await communityApi.createInvite(community.id);
    setInvites([newInv, ...invites]);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[580px] relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-200 p-1 rounded-lg z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Left Sidebar */}
        <div className="w-full md:w-52 bg-zinc-900 border-r border-zinc-800 p-4 space-y-2 select-none">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-2 mb-3">
            Configurações
          </div>

          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "overview"
                ? "bg-zinc-100 text-black shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Geral & Perfil</span>
          </button>

          <button
            onClick={() => setActiveTab("invites")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "invites"
                ? "bg-zinc-100 text-black shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>Convites ({invites.length})</span>
          </button>

          <div className="h-[1px] bg-zinc-800 my-2" />

          <button
            onClick={() => {
              if (confirm("Tem certeza que deseja excluir esta comunidade? Esta ação não pode ser desfeita.")) {
                onDelete(community.id);
                onClose();
              }
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Excluir Comunidade</span>
          </button>
        </div>

        {/* Modal Right Main Form */}
        <div className="flex-1 p-6 overflow-y-auto no-scrollbar">
          {activeTab === "overview" && (
            <form onSubmit={handleSave} className="space-y-4">
              <h3 className="text-lg font-extrabold text-zinc-100 mb-4">
                Visão Geral do Servidor
              </h3>

              {uploadError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-medium">
                  {uploadError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                  Nome do Servidor
                </label>
                <input
                  type="text"
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
                    onChange={(e) => setVisibility(e.target.value as "public" | "private")}
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

              <div className="pt-4 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={uploadingIcon || uploadingBanner}
                  className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-black rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          )}

          {activeTab === "invites" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-zinc-100">
                    Códigos de Convite
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Compartilhe estes códigos com novos membros para que eles ingressem na comunidade.
                  </p>
                </div>

                <button
                  onClick={handleGenerateInvite}
                  className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-black rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                >
                  Gerar Código
                </button>
              </div>

              <div className="space-y-2 pt-2">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-zinc-100 tracking-wider">
                        {inv.code}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        Por {inv.inviter_username || "Organizador"}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyCode(inv.code)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {copiedCode === inv.code ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-zinc-100" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
