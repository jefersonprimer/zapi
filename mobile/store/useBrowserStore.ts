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

export interface BrowserTab {
  id: string;
  url: string;
  navigationUrl: string;
  title: string;
  isIncognito: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  lastActive: number;
}

interface BrowserStore {
  tabs: BrowserTab[];
  activeTabId: string;
  history: HistoryItem[];
  favorites: FavoriteItem[];
  adblockEnabled: boolean;
  blockedCount: number;
  trackersBlockedCount: number;
  dataSavedMb: number;
  timeSavedSeconds: number;
  
  createTab: (url?: string, isIncognito?: boolean) => string;
  closeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
  updateTabState: (id: string, updates: Partial<BrowserTab>) => void;
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
  tabs: [
    {
      id: "default",
      url: "https://www.google.com",
      navigationUrl: "https://www.google.com",
      title: "Google",
      isIncognito: false,
      canGoBack: false,
      canGoForward: false,
      loading: false,
      lastActive: Date.now(),
    },
  ],
  activeTabId: "default",
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

  createTab: (url = "https://www.google.com", isIncognito = false) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newTab: BrowserTab = {
      id,
      url,
      navigationUrl: url,
      title: isIncognito ? "Guia Anônima" : "Nova Guia",
      isIncognito,
      canGoBack: false,
      canGoForward: false,
      loading: false,
      lastActive: Date.now(),
    };
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));
    return id;
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) {
      // If closing the last tab, create a fresh new one
      const newId = Math.random().toString(36).substring(2, 9);
      const newTab: BrowserTab = {
        id: newId,
        url: "https://www.google.com",
        navigationUrl: "https://www.google.com",
        title: "Google",
        isIncognito: false,
        canGoBack: false,
        canGoForward: false,
        loading: false,
        lastActive: Date.now(),
      };
      set({
        tabs: [newTab],
        activeTabId: newId,
      });
      return;
    }

    const filteredTabs = tabs.filter((t) => t.id !== id);
    let newActiveTabId = activeTabId;

    if (activeTabId === id) {
      // Find another tab to make active (prefer the one before it, or after)
      const closedIndex = tabs.findIndex((t) => t.id === id);
      const nextActiveIndex = closedIndex > 0 ? closedIndex - 1 : 0;
      newActiveTabId = filteredTabs[nextActiveIndex].id;
    }

    set({
      tabs: filteredTabs,
      activeTabId: newActiveTabId,
    });
  },

  setActiveTabId: (id) => {
    set((state) => ({
      activeTabId: id,
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, lastActive: Date.now() } : t
      ),
    }));
  },

  updateTabState: (id, updates) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  addToHistory: (url, title) => {
    // Do not log incognito tabs in history
    const activeTab = get().tabs.find((t) => t.id === get().activeTabId);
    if (activeTab?.isIncognito) return;

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
