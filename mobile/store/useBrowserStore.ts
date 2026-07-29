import { create } from "zustand";

export interface HistoryItem {
  url: string;
  title: string;
  timestamp: number;
}

export interface FavoriteItem {
  url: string;
  title: string;
}

interface BrowserStore {
  currentUrl: string;
  history: HistoryItem[];
  favorites: FavoriteItem[];
  adblockEnabled: boolean;
  blockedCount: number;
  trackersBlockedCount: number;
  dataSavedMb: number;
  timeSavedSeconds: number;
  
  setCurrentUrl: (url: string) => void;
  addToHistory: (url: string, title: string) => void;
  clearHistory: () => void;
  addFavorite: (url: string, title: string) => void;
  removeFavorite: (url: string) => void;
  isFavorite: (url: string) => boolean;
  setAdblockEnabled: (enabled: boolean) => void;
  incrementBlockedCount: (count: number) => void;
  resetStats: () => void;
}

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  currentUrl: "https://www.google.com",
  history: [],
  favorites: [
    { url: "https://www.google.com", title: "Google" },
    { url: "https://www.wikipedia.org", title: "Wikipedia" },
    { url: "https://github.com", title: "GitHub" },
  ],
  adblockEnabled: true,
  blockedCount: 0,
  trackersBlockedCount: 0,
  dataSavedMb: 0,
  timeSavedSeconds: 0,

  setCurrentUrl: (url) => set({ currentUrl: url }),

  addToHistory: (url, title) => {
    const currentHistory = get().history;
    if (currentHistory[0]?.url === url) return;

    const newItem: HistoryItem = {
      url,
      title: title || url,
      timestamp: Date.now(),
    };
    set({ history: [newItem, ...currentHistory].slice(0, 100) });
  },

  clearHistory: () => set({ history: [] }),

  addFavorite: (url, title) => {
    const favorites = get().favorites;
    if (favorites.some((f) => f.url === url)) return;
    set({ favorites: [...favorites, { url, title: title || url }] });
  },

  removeFavorite: (url) => {
    set({ favorites: get().favorites.filter((f) => f.url !== url) });
  },

  isFavorite: (url) => {
    return get().favorites.some((f) => f.url === url);
  },

  setAdblockEnabled: (enabled) => set({ adblockEnabled: enabled }),

  incrementBlockedCount: (count) => {
    if (!get().adblockEnabled) return;
    set((state) => {
      const newBlocked = state.blockedCount + count;
      const newTrackers = Math.round(newBlocked * 0.6);
      const newDataSaved = Number((newBlocked * 0.18).toFixed(1));
      const newTimeSaved = Number((newBlocked * 0.05).toFixed(1));

      return {
        blockedCount: newBlocked,
        trackersBlockedCount: newTrackers,
        dataSavedMb: newDataSaved,
        timeSavedSeconds: newTimeSaved,
      };
    });
  },

  resetStats: () => set({
    blockedCount: 0,
    trackersBlockedCount: 0,
    dataSavedMb: 0,
    timeSavedSeconds: 0
  }),
}));
