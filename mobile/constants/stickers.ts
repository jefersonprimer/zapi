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
      { id: "cat_hello", url: "https://media.giphy.com/media/l0ExdUrO6hOQYo21q/giphy.gif", name: "Cat Hello" },
      { id: "doge", url: "https://media.giphy.com/media/l3q2zVr6cu95nF6O4/giphy.gif", name: "Doge" },
      { id: "cute_panda", url: "https://media.giphy.com/media/13CoXDiaCcC2qc/giphy.gif", name: "Cute Panda" },
      { id: "happy_fox", url: "https://media.giphy.com/media/3o7qDQ4kc0JfyCg1a0/giphy.gif", name: "Happy Fox" },
      { id: "sleeping_koala", url: "https://media.giphy.com/media/12P3yf5CtsWyvC/giphy.gif", name: "Sleeping Koala" },
      { id: "jump_rabbit", url: "https://media.giphy.com/media/26xBs47yD6r2w4Z0I/giphy.gif", name: "Rabbit Jump" },
    ],
  },
  {
    id: "memes",
    name: "Memes",
    icon: "😂",
    stickers: [
      { id: "pepe_cool", url: "https://media.giphy.com/media/X8M4L3N4P1vF2jDQc6/giphy.gif", name: "Pepe Cool" },
      { id: "popcat", url: "https://media.giphy.com/media/3orif2uE4Zc1QPy7Qc/giphy.gif", name: "Pop Cat" },
      { id: "shrug", url: "https://media.giphy.com/media/l3q2Lz5yuEFUXXefC/giphy.gif", name: "Shrug" },
      { id: "facepalm", url: "https://media.giphy.com/media/3og0INyMDTk59TNW9i/giphy.gif", name: "Facepalm" },
      { id: "fine", url: "https://media.giphy.com/media/3o72F8t9TDi2xVnxOE/giphy.gif", name: "This is fine" },
      { id: "mindblown", url: "https://media.giphy.com/media/26ufdipGbF56nn9hm/giphy.gif", name: "Mindblown" },
    ],
  },
  {
    id: "zapi_reactions",
    name: "Reações",
    icon: "🔥",
    stickers: [
      { id: "thumbs_up", url: "https://media.giphy.com/media/l0HlHFRbmaJHdxOWc/giphy.gif", name: "Thumbs Up" },
      { id: "clap", url: "https://media.giphy.com/media/l3q2XHFQhFIv0EFHO/giphy.gif", name: "Clap" },
      { id: "fire", url: "https://media.giphy.com/media/3o72F3zN4M9eL63bDW/giphy.gif", name: "Fire" },
      { id: "love_eyes", url: "https://media.giphy.com/media/3o7TKoWXm3okO1kgdW/giphy.gif", name: "Love Eyes" },
      { id: "crying", url: "https://media.giphy.com/media/2WxWlkKW1cBlS/giphy.gif", name: "Crying" },
      { id: "cool_sunglasses", url: "https://media.giphy.com/media/3o7TKoKoM30iXw4qg0/giphy.gif", name: "Cool" },
    ],
  },
];
