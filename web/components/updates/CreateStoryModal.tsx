"use client";

import { useState } from "react";
import { X, Type, Image as ImageIcon, Loader2, Send } from "lucide-react";
import { uploadFile } from "@/lib/api";
import { createStory } from "@/lib/updates-api";
import { useAuth } from "@/lib/auth-context";

const BG_COLORS = [
  "#111827",
  "#007AFF",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
];

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateStoryModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateStoryModalProps) {
  const { token } = useAuth();
  const [mode, setMode] = useState<"choose" | "media" | "text">("choose");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    const previewUrl = URL.createObjectURL(selected);
    setFilePreview(previewUrl);
    setMode("media");
  };

  const handlePublish = async () => {
    if (!token || isSubmitting) return;
    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const attachments = [];

      if (file) {
        const uploaded = await uploadFile(token, file);
        const isVideo = file.type.startsWith("video/");
        attachments.push({
          url: uploaded.url,
          type: isVideo ? "video" : "image",
          mime_type: file.type,
          size: file.size,
        });
      }

      await createStory(token, {
        content: text.trim() || null,
        background_color: mode === "text" ? bgColor : null,
        font_color: mode === "text" ? "#FFFFFF" : null,
        attachments,
      });

      onSuccess();
      handleClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao publicar status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setMode("choose");
    setFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    setText("");
    setBgColor(BG_COLORS[0]);
    setErrorMsg("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#11111e] rounded-2xl border border-card-border/60 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border/60">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Criar Novo Status
          </h3>
          <button
            onClick={handleClose}
            className="text-muted-text hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {mode === "choose" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-text">
                Escolha como deseja publicar seu status (expira em 24h):
              </p>

              <label className="flex items-center gap-4 p-4 rounded-xl border border-card-border/60 hover:border-black dark:hover:border-white bg-neutral-50 dark:bg-white/5 cursor-pointer transition-all hover:scale-[1.01]">
                <div className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-xl">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                    Foto ou Vídeo
                  </h4>
                  <p className="text-xs text-muted-text">
                    Selecione uma imagem ou vídeo da sua galeria
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => setMode("text")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-card-border/60 hover:border-black dark:hover:border-white bg-neutral-50 dark:bg-white/5 cursor-pointer transition-all hover:scale-[1.01] text-left"
              >
                <div className="p-3 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-black rounded-xl">
                  <Type className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                    Texto Colorido
                  </h4>
                  <p className="text-xs text-muted-text">
                    Escreva uma frase com cores de fundo personalizadas
                  </p>
                </div>
              </button>
            </div>
          )}

          {mode === "media" && filePreview && (
            <div className="space-y-4">
              <div className="relative w-full h-64 bg-black rounded-xl overflow-hidden flex items-center justify-center">
                {file?.type.startsWith("video/") ? (
                  <video
                    src={filePreview}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                )}
                <button
                  onClick={() => {
                    setFile(null);
                    setFilePreview(null);
                    setMode("choose");
                  }}
                  className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-full hover:bg-black"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input
                type="text"
                placeholder="Adicionar legenda (opcional)..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full bg-neutral-100 dark:bg-white/5 border border-card-border/60 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
            </div>
          )}

          {mode === "text" && (
            <div className="space-y-4">
              <div
                className="w-full h-64 rounded-xl p-6 flex items-center justify-center text-center transition-colors shadow-inner"
                style={{ backgroundColor: bgColor }}
              >
                <textarea
                  placeholder="Digite seu status..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={300}
                  className="w-full bg-transparent text-white font-extrabold text-2xl text-center outline-none resize-none placeholder-white/50"
                  rows={4}
                  autoFocus
                />
              </div>

              {/* Color picker */}
              <div className="flex items-center justify-center gap-2 pt-2">
                {BG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBgColor(color)}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                      bgColor === color
                        ? "ring-2 ring-black dark:ring-white ring-offset-2 scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {mode !== "choose" && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-card-border/60 bg-neutral-50 dark:bg-white/5">
            <button
              onClick={() => {
                setMode("choose");
                setFile(null);
                setFilePreview(null);
              }}
              className="text-xs font-bold text-muted-text hover:text-foreground cursor-pointer"
            >
              Voltar
            </button>

            <button
              onClick={handlePublish}
              disabled={
                isSubmitting ||
                (mode === "text" && !text.trim()) ||
                (mode === "media" && !file)
              }
              className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Publicar
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
