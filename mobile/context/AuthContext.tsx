import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { clearAllLocalData } from "@/services/database";

interface User {
  user_id: string;
  username: string;
  email: string;
  avatar_url?: string | null;
  about?: string | null;
  name?: string | null;
  privacy_messages?: string;
  privacy_calls?: string;
}

export interface SavedProfile {
  user_id: string;
  username: string;
  email: string;
  avatar_url?: string | null;
  name?: string | null;
  token: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updatedFields: Partial<User>) => Promise<void>;
  savedProfiles: SavedProfile[];
  removeProfile: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Platform-aware storage helpers to ensure web support
export const getStorageItem = async (key: string): Promise<string | null> => {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

export const setStorageItem = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {}
};

export const deleteStorageItem = async (key: string): Promise<void> => {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const updateSavedProfiles = useCallback(async (u: User, t: string) => {
    try {
      const savedStr = await getStorageItem("zapi_saved_profiles");
      let profiles: SavedProfile[] = savedStr ? JSON.parse(savedStr) : [];
      // Remove any existing one with same user_id or email
      profiles = profiles.filter((p) => p.user_id !== u.user_id && p.email !== u.email);
      // Insert at head
      profiles.unshift({
        user_id: u.user_id,
        username: u.username,
        email: u.email,
        avatar_url: u.avatar_url,
        name: u.name,
        token: t,
      });
      await setStorageItem("zapi_saved_profiles", JSON.stringify(profiles));
      setSavedProfiles(profiles);
    } catch (e) {
      console.error("Failed to update saved profiles:", e);
    }
  }, []);

  const removeProfile = useCallback(async (userId: string) => {
    try {
      const savedStr = await getStorageItem("zapi_saved_profiles");
      if (!savedStr) return;
      let profiles: SavedProfile[] = JSON.parse(savedStr);
      profiles = profiles.filter((p) => p.user_id !== userId);
      await setStorageItem("zapi_saved_profiles", JSON.stringify(profiles));
      setSavedProfiles(profiles);
    } catch (e) {
      console.error("Failed to remove saved profile:", e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await getStorageItem("token");
        const storedUser = await getStorageItem("user");
        
        // Load saved profiles
        const savedStr = await getStorageItem("zapi_saved_profiles");
        let loadedProfiles: SavedProfile[] = savedStr ? JSON.parse(savedStr) : [];
        
        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);
          
          // Sync saved profiles list with the currently active user
          const filtered = loadedProfiles.filter((p) => p.user_id !== parsedUser.user_id && p.email !== parsedUser.email);
          const updated = [{
            user_id: parsedUser.user_id,
            username: parsedUser.username,
            email: parsedUser.email,
            avatar_url: parsedUser.avatar_url,
            name: parsedUser.name,
            token: storedToken,
          }, ...filtered];
          await setStorageItem("zapi_saved_profiles", JSON.stringify(updated));
          setSavedProfiles(updated);
        } else {
          setSavedProfiles(loadedProfiles);
        }
      } catch (e) {
        console.warn("Error restoring session:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (newToken: string, newUser: User) => {
    try {
      await setStorageItem("token", newToken);
      await setStorageItem("user", JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      await updateSavedProfiles(newUser, newToken);
    } catch (e) {
      console.error("Sign in storage failed:", e);
    }
  }, [updateSavedProfiles]);

  const signOut = useCallback(async () => {
    try {
      await deleteStorageItem("token");
      await deleteStorageItem("user");
      await clearAllLocalData();
      setToken(null);
      setUser(null);
    } catch (e) {
      console.error("Sign out storage failed:", e);
    }
  }, []);

  const updateUser = useCallback(async (updatedFields: Partial<User>) => {
    try {
      const storedUser = await getStorageItem("user");
      let updated: User;
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        updated = { ...parsed, ...updatedFields };
      } else if (user) {
        updated = { ...user, ...updatedFields };
      } else {
        return;
      }
      await setStorageItem("user", JSON.stringify(updated));
      setUser(updated);

      // Also update in saved profiles if there is an active session
      const activeToken = await getStorageItem("token");
      if (activeToken) {
        await updateSavedProfiles(updated, activeToken);
      }
    } catch (e) {
      console.error("Update user storage failed:", e);
    }
  }, [user, updateSavedProfiles]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      signIn,
      signOut,
      updateUser,
      savedProfiles,
      removeProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
