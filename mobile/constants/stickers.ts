export interface Sticker {
  id: string;
  url: string;
  name: string;
}

export interface StickerPack {
  id: string;
  name: string;
  icon: string; // Emoji or path
  stickers: Sticker[];
}

export const STICKER_PACKS: StickerPack[] = [
  {
    id: "cute_animals",
    name: "Animais",
    icon: "🐱",
    stickers: [
      { id: "animal_1", url: "https://i.giphy.com/media/caaF3868Ck9yuWEmPK/giphy.webp", name: "Cute Animal 1" },
      { id: "animal_2", url: "https://i.giphy.com/media/9TuX30acPdjFvFffOK/giphy.webp", name: "Cute Animal 2" },
      { id: "animal_3", url: "https://i.giphy.com/media/MbAOev49To4mdUR68u/giphy.webp", name: "Cute Animal 3" },
      { id: "animal_4", url: "https://i.giphy.com/media/PNo3rrww1K4lTqHly1/giphy.webp", name: "Cute Animal 4" },
      { id: "animal_5", url: "https://i.giphy.com/media/lPxeVtiiEnL48eYYQF/giphy.webp", name: "Cute Animal 5" },
      { id: "animal_6", url: "https://i.giphy.com/media/zbULhntU3dQtTLavtl/giphy.webp", name: "Cute Animal 6" },
    ],
  },
  {
    id: "memes",
    name: "Memes",
    icon: "😂",
    stickers: [
      { id: "meme_1", url: "https://i.giphy.com/media/3oKIPp5NqhzH1R7TNe/giphy.webp", name: "Meme 1" },
      { id: "meme_2", url: "https://i.giphy.com/media/BuEtjXSH2RWUS9Oini/giphy.webp", name: "Meme 2" },
      { id: "meme_3", url: "https://i.giphy.com/media/iAIwyKeZlKBgIpH4TZ/giphy.webp", name: "Meme 3" },
      { id: "meme_4", url: "https://i.giphy.com/media/JXYpWj1qM7YTPesiVB/giphy.webp", name: "Meme 4" },
      { id: "meme_5", url: "https://i.giphy.com/media/X6hLfRgoJmWiF0i9Xr/giphy.webp", name: "Meme 5" },
      { id: "meme_6", url: "https://i.giphy.com/media/C1GAgvaNL7JgGA6NH4/giphy.webp", name: "Meme 6" },
    ],
  },
  {
    id: "zapi_reactions",
    name: "Reações",
    icon: "🔥",
    stickers: [
      { id: "react_1", url: "https://i.giphy.com/media/2Tx2smt0cqbCUhmKBQ/giphy.webp", name: "Reaction 1" },
      { id: "react_2", url: "https://i.giphy.com/media/tdCvhQsgx4IkvMDKob/giphy.webp", name: "Reaction 2" },
      { id: "react_3", url: "https://i.giphy.com/media/iyGqsXjNfCfx1p2ldm/giphy.webp", name: "Reaction 3" },
      { id: "react_4", url: "https://i.giphy.com/media/gYBCWGIzW4Dygi8sZK/giphy.webp", name: "Reaction 4" },
      { id: "react_5", url: "https://i.giphy.com/media/sTQOXYuDrDzmobUpIt/giphy.webp", name: "Reaction 5" },
      { id: "react_6", url: "https://i.giphy.com/media/YPszS6UJnKSXKxfCNE/giphy.webp", name: "Reaction 6" },
    ],
  },
];
