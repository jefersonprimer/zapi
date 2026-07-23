"use client";

import { useState } from "react";
import { X, Image as ImageIcon, BarChart3, Trash2, Loader2, Send, Globe, Users, Lock } from "lucide-react";
import { uploadFile } from "@/lib/api";
import { createPost, CreatePostPayload } from "@/lib/updates-api";
import { useAuth } from "@/lib/auth-context";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreatePostModal({
  isOpen,
  onClose,
  onSuccess,
}: CreatePostModalProps) {
  const { token } = useAuth();
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"contacts" | "followers" | "public">("contacts");
  const [isPoll, setIsPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; type: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    const currentTotal = files.length + selected.length;
    if (currentTotal > 4) {
      setErrorMsg("Você pode anexar no máximo 4 arquivos por post.");
      return;
    }

    setErrorMsg("");
    const newFiles = [...files, ...selected];
    setFiles(newFiles);

    const newPreviews = selected.map((f) => ({
      url: URL.createObjectURL(f),
      type: f.type,
    }));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveFile = (index: number) => {
    URL.revokeObjectURL(previews[index].url);
    setFiles(files.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleAddPollOption = () => {
    if (pollOptions.length < 5) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  const handleRemovePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const handlePublish = async () => {
    if (!token || isSubmitting) return;
    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const validPollOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
      const attachments = [];

      for (const file of files) {
        const uploaded = await uploadFile(token, file);
        const isVideo = file.type.startsWith("video/");
        attachments.push({
          url: uploaded.url,
          type: isVideo ? "video" : "image",
          mime_type: file.type,
          size: file.size,
        });
      }

      let type = "text";
      if (isPoll && validPollOptions.length >= 2) {
        type = "poll";
      } else if (attachments.length > 0) {
        const allVideo = attachments.every((a) => a.type === "video");
        type = allVideo ? "video" : "image";
      }

      const postData: CreatePostPayload = {
        type,
        content: content.trim() || null,
        visibility,
        attachments,
      };

      if (type === "poll") {
        postData.poll_options = validPollOptions;
        postData.poll_duration_hours = 24;
      }

      await createPost(token, postData);
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Falha ao criar publicação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setContent("");
    setVisibility("contacts");
    setIsPoll(false);
    setPollOptions(["", ""]);
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setFiles([]);
    setPreviews([]);
    setErrorMsg("");
    onClose();
  };

  const canSubmit =
    content.trim().length > 0 ||
    files.length > 0 ||
    (isPoll && pollOptions.filter((o) => o.trim()).length >= 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#11111e] rounded-2xl border border-card-border/60 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border/60">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Criar Publicação
          </h3>
          <button
            onClick={handleClose}
            className="text-muted-text hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Textarea */}
          <textarea
            placeholder="O que está acontecendo no seu dia?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full bg-neutral-50 dark:bg-white/5 border border-card-border/60 rounded-xl p-4 text-sm text-gray-900 dark:text-gray-100 placeholder-muted-text outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none transition-all"
          />

          {/* Attachments preview grid */}
          {previews.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {previews.map((item, idx) => (
                <div
                  key={idx}
                  className="relative h-36 bg-black rounded-xl overflow-hidden group border border-card-border/60"
                >
                  {item.type.startsWith("video/") ? (
                    <video src={item.url} className="w-full h-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="Preview" className="w-full h-full object-cover" />
                  )}
                  <button
                    onClick={() => handleRemoveFile(idx)}
                    className="absolute top-2 right-2 p-1 bg-black/70 text-white rounded-full hover:bg-rose-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Media Attach button */}
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 border border-card-border/60 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer transition-all active:scale-95">
              <ImageIcon className="w-4 h-4 text-black dark:text-white" />
              Fotos / Vídeos ({files.length}/4)
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleAddFiles}
                disabled={files.length >= 4}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => setIsPoll(!isPoll)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                isPoll
                  ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                  : "bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 border-card-border/60 text-gray-700 dark:text-gray-300"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              {isPoll ? "Remover Enquete" : "Criar Enquete"}
            </button>
          </div>

          {/* Poll Builder Section */}
          {isPoll && (
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-white/5 border border-card-border/60 space-y-3 animate-in fade-in">
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Opções da Enquete (mínimo 2)
              </h4>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Opção ${i + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[i] = e.target.value;
                      setPollOptions(next);
                    }}
                    className="flex-1 bg-white dark:bg-[#151528] border border-card-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => handleRemovePollOption(i)}
                      className="p-2 text-muted-text hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {pollOptions.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddPollOption}
                  className="text-xs font-bold text-black dark:text-white hover:underline pt-1 cursor-pointer"
                >
                  + Adicionar opção
                </button>
              )}
            </div>
          )}

          {/* Visibility selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-text uppercase tracking-wider">
              Quem pode ver
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibility("contacts")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  visibility === "contacts"
                    ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow"
                    : "bg-neutral-100 dark:bg-white/5 border-card-border/60 text-muted-text hover:text-foreground"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Contatos
              </button>
              <button
                type="button"
                onClick={() => setVisibility("followers")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  visibility === "followers"
                    ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow"
                    : "bg-neutral-100 dark:bg-white/5 border-card-border/60 text-muted-text hover:text-foreground"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Seguidores
              </button>
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  visibility === "public"
                    ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow"
                    : "bg-neutral-100 dark:bg-white/5 border-card-border/60 text-muted-text hover:text-foreground"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Público
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-card-border/60 bg-neutral-50 dark:bg-white/5">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 text-xs font-bold text-muted-text hover:text-foreground cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handlePublish}
            disabled={!canSubmit || isSubmitting}
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
                Publicar Post
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
