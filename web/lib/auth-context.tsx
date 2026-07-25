"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { login as apiLogin, register as apiRegister, type AuthResponse } from "./api";

interface User {
  user_id: string;
  id: string;
  username: string;
  email: string;
  avatar_url?: string | null;
  name?: string | null;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function parseToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const uid = payload.user_id || payload.sub || "";
    return {
      user_id: uid,
      id: uid,
      username: payload.username || "",
      email: payload.email || "",
      avatar_url: payload.avatar_url || null,
      name: payload.name || null,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const init = async () => {
      const stored = localStorage.getItem("token");
      let parsedUser: User | null = null;
      if (stored) {
        parsedUser = parseToken(stored);
        if (!parsedUser) {
          localStorage.removeItem("token");
        }
      }
      await Promise.resolve();
      if (!active) return;
      if (stored && parsedUser) {
        setToken(stored);
        setUser(parsedUser);
      }
      setIsLoading(false);
    };
    init();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res: AuthResponse = await apiLogin(email, password);
    localStorage.setItem("token", res.token);
    setToken(res.token);
    setUser({
      user_id: res.user_id,
      id: res.user_id,
      username: res.username,
      email: res.email,
      avatar_url: res.avatar_url,
      name: res.name,
    });
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      const res: AuthResponse = await apiRegister(username, email, password);
      localStorage.setItem("token", res.token);
      setToken(res.token);
      setUser({
        user_id: res.user_id,
        id: res.user_id,
        username: res.username,
        email: res.email,
        avatar_url: res.avatar_url,
        name: res.name,
      });
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, user, login, register, logout, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
