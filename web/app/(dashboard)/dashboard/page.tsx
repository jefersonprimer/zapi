"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getVendorStore, listVendorOrders, type Store, type Order, getOrderStatusLabel, ORDER_STATUS_COLORS } from "@/lib/api";
import { ShoppingBag, TrendingUp, Package, Store as StoreIcon, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const { token, user } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({
    todayOrders: 0,
    revenue: 0,
    products: 0,
  });

  useEffect(() => {
    if (!token) return;
    const t: string = token;
    async function load() {
      try {
        const [storeRes, ordersRes] = await Promise.all([
          getVendorStore(t),
          listVendorOrders(t),
        ]);
        setStore(storeRes.store);
        setOrders(ordersRes.orders);

        const today = new Date().toISOString().slice(0, 10);
        const todayOrders = ordersRes.orders.filter(
          (o) => o.created_at.slice(0, 10) === today
        );
        const revenue = todayOrders.reduce(
          (sum, o) =>
            o.status !== "CANCELLED" && o.status !== "REJECTED"
              ? sum + o.total
              : sum,
          0
        );

        setStats({
          todayOrders: todayOrders.length,
          revenue,
          products: 0,
        });
      } catch {
        // not critical
      }
    }
    load();
  }, [token]);

  const recentOrders = orders.slice(0, 5);

  const statCards = [
    {
      label: "Pedidos Hoje",
      value: stats.todayOrders,
      icon: ShoppingBag,
      color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
    },
    {
      label: "Faturamento",
      value: `R$ ${stats.revenue.toFixed(2)}`,
      icon: TrendingUp,
      color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      label: "Produtos",
      value: stats.products,
      icon: Package,
      color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
    },
    {
      label: "Status da Loja",
      value: store?.is_open ? "Aberta" : "Fechada",
      icon: StoreIcon,
      color: store?.is_open
        ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30"
        : "text-red-600 bg-red-100 dark:bg-red-900/30",
      highlight: store?.is_open ? "text-emerald-600" : "text-red-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Olá, {user?.name || user?.username || "usuário"}!
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {store?.name
            ? `Bem-vindo de volta à ${store.name}`
            : "Bem-vindo ao painel da sua loja"}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a2e] p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className={`rounded-lg p-2.5 ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className={`mt-4 text-2xl font-bold ${card.highlight || "text-gray-900 dark:text-gray-100"}`}>
                {card.value}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {card.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Recent orders + Quick actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent orders */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a2e] shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-5 py-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              Pedidos Recentes
            </h2>
            <Link
              href="/pedidos"
              className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1"
            >
              Ver todos
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentOrders.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">
                Nenhum pedido ainda
              </p>
            ) : (
              recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between px-5 py-3.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      #{order.id.slice(0, 8)}
                    </span>
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${ORDER_STATUS_COLORS[order.status]}20`,
                        color: ORDER_STATUS_COLORS[order.status],
                      }}
                    >
                      {getOrderStatusLabel(order.status, order.fulfillment_type)}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    R$ {order.total.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a2e] shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Ações Rápidas
          </h2>
          <div className="space-y-3">
            <Link
              href="/minha-loja"
              className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <StoreIcon className="h-5 w-5 text-emerald-600" />
              Abrir Loja no App
            </Link>
            <Link
              href="/produtos"
              className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <Package className="h-5 w-5 text-emerald-600" />
              Gerenciar Produtos
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
