"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listOrders, type Order, getOrderStatusLabel, ORDER_STATUS_COLORS } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { Package, Tag, ChevronRight, Loader2, ShoppingBag, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function MyOrdersPage() {
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await listOrders(token);
      // Sort orders by newest first
      const sorted = (data.orders || []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setOrders(sorted);
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && !token) {
      router.push("/login?redirect=/orders");
      return;
    }
    if (token) {
      const timer = setTimeout(() => {
        loadOrders();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [token, authLoading, loadOrders, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
        <Loader2 className="w-10 h-10 animate-spin text-neutral-800 dark:text-neutral-200" />
        <span className="mt-4 text-sm font-medium text-muted-text">Carregando seus pedidos...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push("/delivery")}
          className="p-2.5 rounded-full border border-card-border/60 hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Meus Pedidos</h1>
          <p className="text-xs text-muted-text mt-0.5">Acompanhe suas compras no Zapi Food</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-center bg-surface dark:bg-card-bg border border-card-border/60 rounded-3xl p-8">
          <ShoppingBag className="w-12 h-12 text-muted-text mb-4" />
          <h2 className="text-lg font-bold">Nenhum pedido encontrado</h2>
          <p className="text-xs text-muted-text mt-1 mb-6">
            Você ainda não fez nenhum pedido pelo Zapi Food.
          </p>
          <Link
            href="/delivery"
            className="px-6 py-2.5 bg-foreground text-background font-bold text-xs uppercase tracking-wider rounded-full hover:opacity-90 transition-opacity"
          >
            Ir para Delivery
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const shortId = order.id.substring(0, 8).toUpperCase();
            const statusColor = ORDER_STATUS_COLORS[order.status] || "#6B7280";
            const date = new Date(order.created_at);
            const dateStr = date.toLocaleDateString("pt-BR") + " " + date.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <button
                key={order.id}
                onClick={() => router.push(`/orders/${order.id}`)}
                className="w-full text-left bg-surface dark:bg-card-bg border border-card-border/60 hover:border-card-border hover:shadow-md transition-all rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl shrink-0">
                    <Package className="w-6 h-6 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">
                        Pedido #{shortId}
                      </span>
                      <span
                        className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md"
                        style={{
                          backgroundColor: `${statusColor}15`,
                          color: statusColor,
                        }}
                      >
                        {getOrderStatusLabel(order.status, order.fulfillment_type)}
                      </span>
                    </div>
                    <span className="block text-[11px] text-muted-text mt-1">
                      {dateStr}
                    </span>
                    <span className="block text-xs text-muted-text mt-2 truncate max-w-md">
                      {order.fulfillment_type === "retirada"
                        ? "Retirada na loja"
                        : `${order.address_snapshot?.rua}, ${order.address_snapshot?.numero} - ${order.address_snapshot?.bairro}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-card-border/40">
                  <div className="text-left sm:text-right">
                    <span className="block text-xs text-muted-text uppercase tracking-wider font-bold">
                      Total
                    </span>
                    <span className="block text-lg font-black text-foreground">
                      {formatPrice(order.total)}
                    </span>
                    {order.discount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-green-600 dark:text-green-500 font-bold mt-0.5">
                        <Tag className="w-3 h-3" />
                        Desconto: -{formatPrice(order.discount)}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-text shrink-0 hidden sm:block" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
