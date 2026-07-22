"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import {
  LayoutDashboard,
  MessageSquareText,
  ShoppingBag,
  LogOut,
  CircleDotDashed,
  Users,
  Phone,
  X,
  User,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { getVendorStore } from "@/lib/api";

export default function GlobalSidebar() {
  const pathname = usePathname();
  const { user, token, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [hasStore, setHasStore] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    getVendorStore(token)
      .then((res) => {
        if (res && res.store) {
          setHasStore(true);
        }
      })
      .catch(() => {});
  }, [token]);

  // If on login or auth page, do not render sidebar
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return null;
  }

  const navItems = [];

  if (hasStore) {
    navItems.push({
      href: "/dashboard",
      label: "Painel",
      tooltip: "Painel / Dashboard",
      icon: LayoutDashboard,
      active:
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/minha-loja") ||
        pathname.startsWith("/produtos") ||
        pathname.startsWith("/categorias") ||
        pathname.startsWith("/cupons") ||
        pathname.startsWith("/horarios") ||
        pathname.startsWith("/pedidos") ||
        pathname.startsWith("/configuracoes"),
    });
  }

  navItems.push(
    {
      href: "/conversas",
      label: "Conversas",
      tooltip: "Mensagens & Chat",
      icon: MessageSquareText,
      active:
        pathname.startsWith("/conversas") || pathname.startsWith("/conversa"),
    },
    {
      href: "/atualizacoes",
      label: "Status",
      tooltip: "Atualizações / Status",
      icon: CircleDotDashed,
      active: pathname.startsWith("/atualizacoes"),
    },
    {
      href: "/comunidades",
      label: "Grupos",
      tooltip: "Comunidades / Grupos",
      icon: Users,
      active: pathname.startsWith("/comunidades"),
    },
    {
      href: "/ligacoes",
      label: "Ligações",
      tooltip: "Ligações / Chamadas",
      icon: Phone,
      active: pathname.startsWith("/ligacoes"),
    },
    {
      href: "/delivery",
      label: "Delivery",
      tooltip: "Cardápio & Delivery",
      icon: ShoppingBag,
      active: pathname.startsWith("/delivery"),
    },
  );

  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() ||
    user?.username?.charAt(0)?.toUpperCase() ||
    "U";

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <>
      {/* Desktop Sidebar (Left side, slim) */}
      <aside className="hidden md:flex flex-col items-center justify-between w-16 h-screen py-6 bg-white dark:bg-[#1E1F1F] border-r border-card-border/60 z-50 flex-shrink-0">
        <div className="flex flex-col items-center gap-8 w-full">
          {/* Navigation Items */}
          <nav className="flex flex-col gap-4 w-full px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center justify-center h-11 w-11 rounded-xl transition-all duration-200 cursor-pointer ${
                    item.active
                      ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md shadow-black/10 dark:shadow-white/10"
                      : "text-muted-text hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />

                  {/* Tooltip */}
                  <span className="absolute left-14 scale-0 group-hover:scale-100 rounded-md bg-neutral-900 dark:bg-neutral-800 border border-neutral-700/30 px-2.5 py-1.5 text-xs text-white transition-all duration-200 z-50 whitespace-nowrap font-medium shadow-md pointer-events-none origin-left translate-x-[-10px] group-hover:translate-x-0 opacity-0 group-hover:opacity-100">
                    {item.tooltip}
                  </span>

                  {/* Active indicator bar */}
                  {item.active && (
                    <span className="absolute left-0 w-1 h-5 rounded-r bg-neutral-900 dark:bg-white" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & actions */}
        <div className="flex flex-col items-center w-full px-2">
          {/* User profile avatar (clickable button) */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="group relative flex items-center justify-center h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 font-bold text-sm cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:scale-105 active:scale-95 transition-all outline-none"
            title="Meu Perfil"
          >
            {userInitial}

            {/* Tooltip with user info */}
            <span className="absolute left-14 scale-0 group-hover:scale-100 rounded-md bg-neutral-900 dark:bg-neutral-800 border border-neutral-700/30 px-3 py-2 text-xs text-white transition-all duration-200 z-50 whitespace-nowrap shadow-md pointer-events-none origin-left translate-x-[-10px] group-hover:translate-x-0 opacity-0 group-hover:opacity-100 flex flex-col gap-0.5 text-left">
              <span className="font-semibold">
                {user?.name || user?.username || "Usuário"}
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">
                {user?.email}
              </span>
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <div className="flex md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-[#1E1F1F]/95 backdrop-blur-md border-t border-card-border/60 z-50 justify-around items-center px-2 shadow-lg shadow-black/5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center h-full py-1 text-[9px] font-medium transition-all min-w-0 ${
                item.active
                  ? "text-neutral-900 dark:text-white font-bold"
                  : "text-muted-text hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5 mb-0.5 flex-shrink-0" />
              <span className="truncate max-w-full px-0.5">{item.label}</span>
            </Link>
          );
        })}
        {/* Mobile profile button */}
        <button
          onClick={() => setIsProfileOpen(true)}
          className="flex-1 flex flex-col items-center justify-center h-full py-1 text-[9px] font-medium text-muted-text hover:text-foreground min-w-0 cursor-pointer"
        >
          <div className="h-5 w-5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 font-bold text-[10px] flex items-center justify-center mb-0.5 flex-shrink-0">
            {userInitial}
          </div>
          <span className="truncate max-w-full px-0.5">Perfil</span>
        </button>
      </div>

      {/* Unified Profile Modal (Centered for Desktop & Mobile) */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsProfileOpen(false)}
          />
          {/* Modal container */}
          <div className="relative w-full max-w-sm bg-white dark:bg-[#1E1F1F] rounded-2xl border border-card-border/60 p-6 z-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            {/* Close Button */}
            <button
              onClick={() => setIsProfileOpen(false)}
              className="absolute top-4 right-4 text-muted-text hover:text-foreground transition-colors cursor-pointer p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5"
            >
              <X className="h-5 w-5" />
            </button>

            {/* User Avatar */}
            <div className="h-20 w-20 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 font-bold text-3xl flex items-center justify-center shadow-inner mb-4 mt-2">
              {userInitial}
            </div>

            {/* User Info */}
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-full">
              {user?.name || user?.username || "Usuário"}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate max-w-full mb-3">
              {user?.email}
            </p>

            {/* Dynamic Status Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-5 shadow-sm border ${
                hasStore
                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700"
                  : "bg-neutral-50 dark:bg-white/5 text-muted-text border-card-border/30"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              {hasStore ? "Lojista / Parceiro" : "Cliente / Usuário"}
            </span>

            {/* Theme Selector */}
            <div className="w-full mb-6">
              <label className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 block text-center">
                Tema de Apresentação
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-xl border border-neutral-200 dark:border-neutral-700/60">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    theme === "light"
                      ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm font-semibold"
                      : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  Claro
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    theme === "dark"
                      ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm font-semibold"
                      : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                  Escuro
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("system")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    theme === "system"
                      ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm font-semibold"
                      : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Auto
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="w-full space-y-3">
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-900 dark:bg-white hover:bg-black dark:hover:bg-neutral-200 text-white dark:text-neutral-900 py-3 px-4 text-sm font-semibold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Sair da Conta
              </button>

              <button
                onClick={() => setIsProfileOpen(false)}
                className="w-full flex items-center justify-center rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 py-3 px-4 text-sm font-semibold transition-all border border-neutral-200/60 dark:border-neutral-700/60 active:scale-[0.98] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

