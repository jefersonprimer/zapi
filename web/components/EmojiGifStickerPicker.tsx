"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Smile,
  Film,
  Sticker as StickerIcon,
  Search,
  X,
  Upload,
  Plus,
  Flame,
  Sparkles,
  Heart,
  SmilePlus,
  Loader2,
  Trash2,
} from "lucide-react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

interface EmojiGifStickerPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gifUrl: string) => void;
  onSelectSticker: (stickerUrl: string) => void;
  onClose: () => void;
}

// Built-in sticker packs definitions using local static SVGs
const BUILTIN_STICKER_PACKS = [
  {
    id: "Animals",
    name: "Animais",
    icon: "🐶",
    stickers: [
      { id: "dog", name: "Cãozinho", url: "/stickers/Animals/dog.svg" },
      { id: "cat", name: "Gatinho", url: "/stickers/Animals/cat.svg" },
      { id: "bear", name: "Ursinho", url: "/stickers/Animals/bear.svg" },
      { id: "panda", name: "Panda", url: "/stickers/Animals/panda.svg" },
    ],
  },
  {
    id: "Memes",
    name: "Memes",
    icon: "😂",
    stickers: [
      { id: "hahaha", name: "Hahaha", url: "/stickers/Memes/hahaha.svg" },
      { id: "crying", name: "Chorando", url: "/stickers/Memes/crying.svg" },
      { id: "fire", name: "Fogo", url: "/stickers/Memes/fire.svg" },
      { id: "mindblown", name: "Explodiu", url: "/stickers/Memes/mindblown.svg" },
    ],
  },
  {
    id: "Flork",
    name: "Flork",
    icon: "🤍",
    stickers: [
      { id: "flork_love", name: "Flork Amor", url: "/stickers/Flork/flork_love.svg" },
      { id: "flork_coffee", name: "Flork Café", url: "/stickers/Flork/flork_coffee.svg" },
      { id: "flork_angry", name: "Flork Bravo", url: "/stickers/Flork/flork_angry.svg" },
      { id: "flork_happy", name: "Flork Feliz", url: "/stickers/Flork/flork_happy.svg" },
    ],
  },
  {
    id: "Reactions",
    name: "Reações",
    icon: "⭐",
    stickers: [
      { id: "cool", name: "Óculos", url: "/stickers/Reactions/cool.svg" },
      { id: "love", name: "Corações", url: "/stickers/Reactions/love.svg" },
      { id: "party", name: "Festa", url: "/stickers/Reactions/party.svg" },
      { id: "star", name: "Estrela", url: "/stickers/Reactions/star.svg" },
    ],
  },
];

// Fallback curated GIFs from Giphy/Tenor CDNs
const CURATED_GIFS = [
  {
    id: "cat-jam",
    title: "Cat Jam",
    category: "Engraçados",
    url: "https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif",
    preview: "https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif",
  },
  {
    id: "popcorn-cat",
    title: "Eating Popcorn",
    category: "Reações",
    url: "https://media.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif",
    preview: "https://media.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif",
  },
  {
    id: "dance-party",
    title: "Dance Party",
    category: "Dança",
    url: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif",
    preview: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif",
  },
  {
    id: "mind-blown-gif",
    title: "Mind Blown",
    category: "Memes",
    url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
    preview: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
  },
  {
    id: "heart-love",
    title: "Heart Love",
    category: "Amor",
    url: "https://media.giphy.com/media/l41JWw65ocOTzpdfG/giphy.gif",
    preview: "https://media.giphy.com/media/l41JWw65ocOTzpdfG/giphy.gif",
  },
  {
    id: "anime-wow",
    title: "Anime Wow",
    category: "Anime",
    url: "https://media.giphy.com/media/11pQhaGQyC3S4U/giphy.gif",
    preview: "https://media.giphy.com/media/11pQhaGQyC3S4U/giphy.gif",
  },
  {
    id: "dog-smile",
    title: "Dog Nodding",
    category: "Engraçados",
    url: "https://media.giphy.com/media/uBuzWOCgURrCU/giphy.gif",
    preview: "https://media.giphy.com/media/uBuzWOCgURrCU/giphy.gif",
  },
  {
    id: "applause-gif",
    title: "Applause",
    category: "Reações",
    url: "https://media.giphy.com/media/g9582DNuQppxC/giphy.gif",
    preview: "https://media.giphy.com/media/g9582DNuQppxC/giphy.gif",
  },
];

const GIF_CATEGORIES = [
  "🔥 Trending",
  "😂 Engraçados",
  "❤️ Amor",
  "🎉 Festa",
  "🐱 Gatos",
  "⚡ Anime",
  "👋 Olá",
];

export function EmojiGifStickerPicker({
  onSelectEmoji,
  onSelectGif,
  onSelectSticker,
  onClose,
}: EmojiGifStickerPickerProps) {
  const [activeTab, setActiveTab] = useState<"emojis" | "gifs" | "stickers">("emojis");
  const [gifSearchQuery, setGifSearchQuery] = useState("");
  const [selectedGifCategory, setSelectedGifCategory] = useState("🔥 Trending");
  const [gifs, setGifs] = useState(CURATED_GIFS);
  const [loadingGifs, setLoadingGifs] = useState(false);

  // Sticker pack selection
  const [selectedStickerPackId, setSelectedStickerPackId] = useState("Animals");
  const [customStickers, setCustomStickers] = useState<string[]>([]);
  const customFileInputRef = useRef<HTMLInputElement>(null);

  // Load custom stickers from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("zapi_custom_stickers");
      if (saved) {
        setCustomStickers(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load custom stickers", e);
    }
  }, []);

  // Save custom stickers to localStorage
  const saveCustomStickers = (newStickers: string[]) => {
    setCustomStickers(newStickers);
    try {
      localStorage.setItem("zapi_custom_stickers", JSON.stringify(newStickers));
    } catch (e) {
      console.error("Failed to save custom stickers", e);
    }
  };

  // Handle uploading custom sticker (converts image to DataURL webp/png)
  const handleCustomStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const updated = [result, ...customStickers];
        saveCustomStickers(updated);
        setSelectedStickerPackId("custom");
      }
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = "";
  };

  const removeCustomSticker = (index: number) => {
    const updated = customStickers.filter((_, i) => i !== index);
    saveCustomStickers(updated);
  };

  // Fetch GIFs from Tenor API if key exists, else filter curated list
  useEffect(() => {
    if (activeTab !== "gifs") return;

    let isMounted = true;
    const query = gifSearchQuery.trim() || selectedGifCategory.replace(/[^a-zA-ZáàâãéèêíóôõúçÁÀÂÃÉÈÊÍÓÔÕÚÇ]/g, "");

    const fetchTenorGifs = async () => {
      const tenorApiKey = process.env.NEXT_PUBLIC_TENOR_API_KEY;
      if (!tenorApiKey) {
        // Fallback filtering on curated GIFs
        if (!query || selectedGifCategory.includes("Trending")) {
          setGifs(CURATED_GIFS);
        } else {
          const filtered = CURATED_GIFS.filter(
            (g) =>
              g.title.toLowerCase().includes(query.toLowerCase()) ||
              g.category.toLowerCase().includes(query.toLowerCase())
          );
          setGifs(filtered.length > 0 ? filtered : CURATED_GIFS);
        }
        return;
      }

      setLoadingGifs(true);
      try {
        const endpoint = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${tenorApiKey}&limit=20&media_filter=gif`;
        const res = await fetch(endpoint);
        const data = await res.json();

        if (isMounted && data?.results) {
          const fetchedGifs = data.results.map((item: any) => ({
            id: item.id,
            title: item.title || "GIF",
            category: "Tenor",
            url: item.media_formats?.gif?.url || item.media_formats?.tinygif?.url,
            preview: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url,
          }));
          setGifs(fetchedGifs);
        }
      } catch (err) {
        console.error("Failed to fetch Tenor GIFs:", err);
        if (isMounted) setGifs(CURATED_GIFS);
      } finally {
        if (isMounted) setLoadingGifs(false);
      }
    };

    const timer = setTimeout(fetchTenorGifs, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeTab, gifSearchQuery, selectedGifCategory]);

  const activeStickerPack = useMemo(() => {
    return BUILTIN_STICKER_PACKS.find((p) => p.id === selectedStickerPackId);
  }, [selectedStickerPackId]);

  return (
    <div className="flex flex-col w-[360px] sm:w-[420px] h-[460px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl transition-all duration-200 animate-fadeIn z-50">
      {/* Top Header & Tab Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
        <div className="flex items-center gap-1 bg-neutral-200/60 dark:bg-neutral-800 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab("emojis")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              activeTab === "emojis"
                ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <Smile className="h-4 w-4 text-amber-500" />
            <span>Emojis</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("gifs")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              activeTab === "gifs"
                ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <Film className="h-4 w-4 text-purple-500" />
            <span>GIFs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("stickers")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              activeTab === "stickers"
                ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <StickerIcon className="h-4 w-4 text-emerald-500" />
            <span>Figurinhas</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          title="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* EMOJIS TAB */}
        {activeTab === "emojis" && (
          <div className="h-full w-full flex justify-center items-center overflow-auto emoji-mart-container">
            <Picker
              data={data}
              onEmojiSelect={(emoji: any) => {
                if (emoji?.native) {
                  onSelectEmoji(emoji.native);
                }
              }}
              locale="pt"
              theme="auto"
              previewPosition="none"
              skinTonePosition="none"
              navPosition="bottom"
              perLine={8}
            />
          </div>
        )}

        {/* GIFS TAB */}
        {activeTab === "gifs" && (
          <div className="h-full flex flex-col p-3 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Pesquisar GIFs no Tenor..."
                value={gifSearchQuery}
                onChange={(e) => setGifSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-neutral-100 dark:bg-neutral-800/80 text-xs rounded-xl border border-transparent focus:border-purple-500 outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
              />
              {gifSearchQuery && (
                <button
                  type="button"
                  onClick={() => setGifSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Quick Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {GIF_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedGifCategory(cat);
                    setGifSearchQuery("");
                  }}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg whitespace-nowrap transition-all ${
                    selectedGifCategory === cat && !gifSearchQuery
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* GIF Grid */}
            <div className="flex-1 overflow-y-auto pr-1">
              {loadingGifs ? (
                <div className="flex flex-col items-center justify-center h-48 text-neutral-400 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                  <span className="text-xs">Buscando GIFs...</span>
                </div>
              ) : gifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-neutral-400 gap-2">
                  <Film className="h-8 w-8 text-neutral-300 dark:text-neutral-700" />
                  <span className="text-xs">Nenhum GIF encontrado</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {gifs.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      onClick={() => onSelectGif(gif.url)}
                      className="group relative h-28 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-800/80 hover:ring-2 hover:ring-purple-500 transition-all cursor-pointer"
                    >
                      <img
                        src={gif.preview || gif.url}
                        alt={gif.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <span className="text-[10px] text-white font-medium truncate">
                          {gif.title}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STICKERS TAB */}
        {activeTab === "stickers" && (
          <div className="h-full flex flex-col">
            {/* Sticker Pack Selector Sub-bar */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/30 overflow-x-auto">
              {BUILTIN_STICKER_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setSelectedStickerPackId(pack.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                    selectedStickerPackId === pack.id
                      ? "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  <span>{pack.icon}</span>
                  <span>{pack.name}</span>
                </button>
              ))}

              {/* Custom User Stickers Tab */}
              <button
                type="button"
                onClick={() => setSelectedStickerPackId("custom")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                  selectedStickerPackId === "custom"
                    ? "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <SmilePlus className="h-3.5 w-3.5 text-emerald-500" />
                <span>Meus ({customStickers.length})</span>
              </button>
            </div>

            {/* Custom Sticker Upload Action Bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-800">
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                {selectedStickerPackId === "custom"
                  ? "Suas figurinhas personalizadas (WEBP/PNG)"
                  : `Pack: ${activeStickerPack?.name || ""}`}
              </span>

              <input
                type="file"
                ref={customFileInputRef}
                accept="image/png, image/webp, image/jpeg, image/gif"
                onChange={handleCustomStickerUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => customFileInputRef.current?.click()}
                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900 transition-colors"
              >
                <Upload className="h-3 w-3" />
                <span>+ Criar Sticker</span>
              </button>
            </div>

            {/* Sticker Grid */}
            <div className="flex-1 p-3 overflow-y-auto">
              {selectedStickerPackId === "custom" ? (
                customStickers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-neutral-400 gap-2 text-center">
                    <StickerIcon className="h-10 w-10 text-neutral-300 dark:text-neutral-700" />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Você ainda não criou Nenhuma figurinha.
                    </p>
                    <button
                      type="button"
                      onClick={() => customFileInputRef.current?.click()}
                      className="mt-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl font-medium shadow-md transition-colors"
                    >
                      Enviar primeira figurinha (PNG/WEBP)
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {customStickers.map((st, idx) => (
                      <div key={idx} className="relative group">
                        <button
                          type="button"
                          onClick={() => onSelectSticker(st)}
                          className="w-full aspect-square p-1.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-neutral-200 dark:border-neutral-800 hover:border-emerald-400 transition-all flex items-center justify-center cursor-pointer group-hover:scale-105 transform"
                        >
                          <img
                            src={st}
                            alt={`Custom sticker ${idx}`}
                            className="w-full h-full object-contain"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCustomSticker(idx);
                          }}
                          className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          title="Remover sticker"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {activeStickerPack?.stickers.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => onSelectSticker(st.url)}
                      className="aspect-square p-2 rounded-2xl bg-neutral-100/70 dark:bg-neutral-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-neutral-200/60 dark:border-neutral-800 hover:border-emerald-400/60 transition-all flex items-center justify-center cursor-pointer hover:scale-110 transform duration-200"
                      title={st.name}
                    >
                      <img
                        src={st.url}
                        alt={st.name}
                        className="w-full h-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
