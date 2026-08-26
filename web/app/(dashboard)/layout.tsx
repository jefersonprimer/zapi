"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getVendorStore } from "@/lib/api";
import {
  LayoutDashboard,
  Store,
  Package,
  Tag,
  Clock,
  ShoppingCart,
  Menu,
  Loader2,
  Calendar,
  Users,
} from "lucide-react";

const SERVICE_CATEGORIES = [
  "barbeiro",
  "salao",
  "estetica",
  "tatuagem",
  "clinica",
  "dentista",
  "oficina",
  "personal",
  "fotografo",
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { token, isLoading } = useAuth();
  const [storeLoading, setStoreLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!token) {
      router.replace("/login");
      return;
    }

    let active = true;
    getVendorStore(token)
      .then((res) => {
        if (!active) return;
        if (res && res.store) {
          setCategory(res.store.category);
          setStoreLoading(false);
        } else {
          router.replace("/cadastrar-loja");
        }
      })
      .catch(() => {
        if (active) {
          router.replace("/cadastrar-loja");
        }
      });

    return () => {
      active = false;
    };
  }, [isLoading, token, router]);

  if (isLoading || storeLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-[#0a0e17]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <div className="flex h-full">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white dark:bg-[#1a1a2e] border-r border-gray-200 dark:border-gray-800 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {(() => {
            const isService = category && SERVICE_CATEGORIES.includes(category);
            const items = isService
              ? [
                  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
                  { href: "/minha-loja", label: "Minha Loja", icon: Store },
                  { href: "/servicos", label: "Serviços", icon: Package },
                  { href: "/profissionais", label: "Profissionais", icon: Users },
                  { href: "/agenda", label: "Agenda", icon: Calendar },
                  { href: "/horarios", label: "Horários", icon: Clock },
                ]
              : [
                  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
                  { href: "/minha-loja", label: "Minha Loja", icon: Store },
                  { href: "/produtos", label: "Produtos", icon: Package },
                  { href: "/cupons", label: "Cupons", icon: Tag },
                  { href: "/horarios", label: "Horários e Entrega", icon: Clock },
                  { href: "/pedidos", label: "Pedidos", icon: ShoppingCart },
                ];

            return items.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-emerald-50 dark:bg-[rgba(16,185,129,0.15)] text-emerald-700 dark:text-emerald-400 font-semibold border-l-[3px] border-emerald-500 shadow-sm shadow-emerald-500/5"
                      : "font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            });
          })()}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0a0a0a] px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            Zapi
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
