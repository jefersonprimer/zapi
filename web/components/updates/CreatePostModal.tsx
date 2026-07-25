"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Image as ImageIcon,
  BarChart3,
  Trash2,
  Loader2,
  Send,
  Globe,
  Users,
  Lock,
  Smile,
} from "lucide-react";
import { uploadFile } from "@/lib/api";
import { createPost, CreatePostPayload } from "@/lib/updates-api";
import { useAuth } from "@/lib/auth-context";
import { EmojiGifStickerPicker } from "@/components/EmojiGifStickerPicker";

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
  const { token, user } = useAuth();
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<
    "contacts" | "followers" | "public"
  >("contacts");
  const [isPoll, setIsPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  // Local file attachments
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; type: string }[]>([]);

  // Remote attachments (GIFs/Stickers from the picker)
  const [remoteAttachments, setRemoteAttachments] = useState<
    {
      url: string;
      type: string;
      mime_type?: string;
    }[]
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [content]);

  // Close picker on clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
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

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    const currentTotal =
      files.length + remoteAttachments.length + selected.length;
    if (currentTotal > 4) {
      setErrorMsg("Você pode anexar no máximo 4 mídias por publicação.");
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

  const handleRemoveRemoteAttachment = (index: number) => {
    setRemoteAttachments(remoteAttachments.filter((_, i) => i !== index));
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

  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + textToInsert);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    setContent(before + textToInsert + after);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd =
        start + textToInsert.length;
    }, 0);
  };

  const handleSelectGif = (gifUrl: string) => {
    const currentTotal = files.length + remoteAttachments.length;
    if (currentTotal >= 4) {
      setErrorMsg("Você pode anexar no máximo 4 mídias por publicação.");
      return;
    }
    setRemoteAttachments((prev) => [
      ...prev,
      { url: gifUrl, type: "image", mime_type: "image/gif" },
    ]);
    setShowPicker(false);
  };

  const handleSelectSticker = (stickerUrl: string) => {
    const currentTotal = files.length + remoteAttachments.length;
    if (currentTotal >= 4) {
      setErrorMsg("Você pode anexar no máximo 4 mídias por publicação.");
      return;
    }
    setRemoteAttachments((prev) => [
      ...prev,
      { url: stickerUrl, type: "image", mime_type: "image/svg+xml" },
    ]);
    setShowPicker(false);
  };

  const handlePublish = async () => {
    if (!token || isSubmitting) return;
    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const validPollOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
      const attachments = [];

      // Upload local files
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

      // Add remote attachments (GIFs, Stickers)
      for (const remote of remoteAttachments) {
        attachments.push({
          url: remote.url,
          type: remote.type,
          mime_type: remote.mime_type,
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
      setErrorMsg(
        err instanceof Error ? err.message : "Falha ao criar publicação.",
      );
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
    setRemoteAttachments([]);
    setErrorMsg("");
    setShowPicker(false);
    onClose();
  };

  const totalAttachmentsCount = files.length + remoteAttachments.length;
  const canSubmit =
    content.trim().length > 0 ||
    totalAttachmentsCount > 0 ||
    (isPoll && pollOptions.filter((o) => o.trim()).length >= 2);

  const characterLimit = 500;
  const isOverLimit = content.length > characterLimit;

  // Generate fallback avatar letter
  const userInitial = user?.name
    ? user.name.charAt(0).toUpperCase()
    : user?.username
      ? user.username.charAt(0).toUpperCase()
      : "?";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-zinc-950 rounded-xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100 font-bold overflow-hidden shadow-inner">
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt={user?.name || "User"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{userInitial}</span>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100 leading-tight">
                {user?.name || user?.username || "Novo Post"}
              </h3>
              <p className="text-xs text-zinc-500">
                Criando uma nova publicação
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-full hover:bg-zinc-900 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {errorMsg && (
            <div className="p-3.5 bg-red-950/40 border border-red-900/50 text-red-400 rounded-2xl text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Textarea Wrapper (x.com style) */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              id="post-textarea"
              placeholder="O que está acontecendo?!"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full bg-transparent border-0 p-0 text-base text-zinc-150 placeholder-zinc-650 outline-none focus:ring-0 resize-none transition-all leading-relaxed min-h-[120px]"
            />
          </div>

          {/* Attachments preview grid */}
          {(previews.length > 0 || remoteAttachments.length > 0) && (
            <div className="grid grid-cols-2 gap-3.5">
              {/* Local Previews */}
              {previews.map((item, idx) => (
                <div
                  key={`local-${idx}`}
                  className="relative h-40 bg-zinc-900 rounded-2xl overflow-hidden group border border-zinc-800/80 shadow-inner"
                >
                  {item.type.startsWith("video/") ? (
                    <video
                      src={item.url}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <button
                    onClick={() => handleRemoveFile(idx)}
                    className="absolute top-2.5 right-2.5 p-1.5 bg-black/85 text-zinc-300 rounded-full hover:bg-red-650 hover:text-white transition-all shadow-md active:scale-90"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute left-2.5 bottom-2.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-zinc-800 text-[10px] text-zinc-300 font-bold uppercase tracking-wider">
                    Local
                  </div>
                </div>
              ))}

              {/* Remote Previews (GIFs / Stickers) */}
              {remoteAttachments.map((item, idx) => (
                <div
                  key={`remote-${idx}`}
                  className="relative h-40 bg-zinc-900 rounded-2xl overflow-hidden group border border-zinc-800/80 shadow-inner flex items-center justify-center p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt="GIF/Sticker Preview"
                    className="w-full h-full object-contain"
                  />
                  <button
                    onClick={() => handleRemoveRemoteAttachment(idx)}
                    className="absolute top-2.5 right-2.5 p-1.5 bg-black/85 text-zinc-300 rounded-full hover:bg-red-600 hover:text-white transition-all shadow-md active:scale-90"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute left-2.5 bottom-2.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-zinc-800 text-[10px] text-zinc-300 font-bold uppercase tracking-wider">
                    {item.mime_type?.includes("gif") ? "GIF" : "Sticker"}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-900 pt-4">
            <div className="flex flex-wrap gap-2.5">
              <label className="flex items-center gap-2 px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-850 hover:border-zinc-700/80 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-300 cursor-pointer transition-all active:scale-95 shadow-sm">
                <ImageIcon className="w-4 h-4 text-zinc-400" />
                Mídias ({totalAttachmentsCount}/4)
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleAddFiles}
                  disabled={totalAttachmentsCount >= 4}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setIsPoll(!isPoll)}
                className={`flex items-center gap-2 px-3.5 py-2.5 border rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer ${
                  isPoll
                    ? "bg-zinc-100 text-black border-zinc-150 hover:bg-zinc-200"
                    : "bg-zinc-900 hover:bg-zinc-850 hover:border-zinc-700/80 border-zinc-800 text-zinc-300"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                {isPoll ? "Remover Enquete" : "Criar Enquete"}
              </button>

              {/* Emoji & GIF Trigger Button */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-850 hover:border-zinc-700/80 border border-zinc-800 text-zinc-300 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
                >
                  <Smile className="w-4 h-4" />
                  <span>Emoji / GIF</span>
                </button>

                {/* Screen-level Fixed Picker Overlay */}
                {showPicker && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div
                      ref={pickerRef}
                      className="relative shadow-2xl animate-in zoom-in-95 duration-150"
                    >
                      <EmojiGifStickerPicker
                        onSelectEmoji={(emoji) => insertTextAtCursor(emoji)}
                        onSelectGif={handleSelectGif}
                        onSelectSticker={handleSelectSticker}
                        onClose={() => setShowPicker(false)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Poll Builder Section */}
          {isPoll && (
            <div className="p-4.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Opções da Enquete (Mínimo 2)
              </h4>
              <div className="space-y-2.5">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-zinc-500 w-5">
                      {i + 1}.
                    </span>
                    <input
                      type="text"
                      placeholder={`Opção ${i + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const next = [...pollOptions];
                        next[i] = e.target.value;
                        setPollOptions(next);
                      }}
                      className="flex-1 bg-zinc-950/80 border border-zinc-850 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-700 transition-all"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        onClick={() => handleRemovePollOption(i)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {pollOptions.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddPollOption}
                  className="text-xs font-bold text-zinc-200 hover:text-white flex items-center gap-1.5 pt-1.5 cursor-pointer hover:underline"
                >
                  + Adicionar opção
                </button>
              )}
            </div>
          )}

          {/* Visibility selector */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Quem pode visualizar
            </label>
            <div className="flex gap-2 p-1 bg-zinc-900/80 rounded-2xl border border-zinc-850">
              <button
                type="button"
                onClick={() => setVisibility("contacts")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  visibility === "contacts"
                    ? "bg-zinc-100 text-black shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Contatos
              </button>
              <button
                type="button"
                onClick={() => setVisibility("followers")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  visibility === "followers"
                    ? "bg-zinc-100 text-black shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Seguidores
              </button>
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  visibility === "public"
                    ? "bg-zinc-100 text-black shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Público
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4.5 border-t border-zinc-800/80 bg-zinc-950">
          <div className="flex items-center">
            <span
              className={`text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg border ${
                isOverLimit
                  ? "bg-red-950/40 border-red-900/50 text-red-400"
                  : content.length > characterLimit - 50
                    ? "bg-amber-950/40 border-amber-900/50 text-amber-400"
                    : "bg-zinc-900/80 border-zinc-800/80 text-zinc-400"
              }`}
            >
              {content.length} / {characterLimit}
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <button
              onClick={handleClose}
              className="px-4.5 py-2.5 text-xs font-bold text-zinc-400 hover:text-zinc-250 hover:bg-zinc-900 rounded-lg transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handlePublish}
              disabled={!canSubmit || isSubmitting || isOverLimit}
              className="flex items-center gap-2 bg-zinc-100 text-black hover:bg-white disabled:opacity-40 disabled:hover:bg-zinc-100 px-6 py-2.5 rounded-lg font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Publicar Post
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
