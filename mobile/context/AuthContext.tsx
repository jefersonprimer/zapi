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
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updatedFields: Partial<User>) => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await getStorageItem("token");
        const storedUser = await getStorageItem("user");
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
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
    } catch (e) {
      console.error("Sign in storage failed:", e);
    }
  }, []);

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
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        const updated = { ...parsed, ...updatedFields };
        await setStorageItem("user", JSON.stringify(updated));
        setUser(updated);
      } else if (user) {
        const updated = { ...user, ...updatedFields };
        await setStorageItem("user", JSON.stringify(updated));
        setUser(updated);
      }
    } catch (e) {
      console.error("Update user storage failed:", e);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
