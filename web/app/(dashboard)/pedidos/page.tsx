"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { authFetch, API_URL, Store, Order, OrderItem } from "@/lib/api";
import {
  ShoppingBag,
  Calendar,
  DollarSign,
  MapPin,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Clock,
  Truck,
  FileText,
  User,
  Undo
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  WAITING_STORE_CONFIRMATION: {
    label: "Aguardando",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/35",
  },
  ACCEPTED: {
    label: "Aceito",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/35",
  },
  PREPARING: {
    label: "Preparando",
    color: "text-purple-700 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/35",
  },
  READY: {
    label: "Pronto",
    color: "text-indigo-700 dark:text-indigo-400",
    bg: "bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/35",
  },
  OUT_FOR_DELIVERY: {
    label: "A caminho",
    color: "text-cyan-700 dark:text-cyan-400",
    bg: "bg-cyan-100 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/35",
  },
  DELIVERED: {
    label: "Entregue",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/35",
  },
  CANCELLED: {
    label: "Cancelado",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-900/35",
  },
  REJECTED: {
    label: "Rejeitado",
    color: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/35",
  },
  PENDING: {
    label: "Pendente",
    color: "text-slate-700 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850",
  },
  PAID: {
    label: "Pago",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/35",
  },
};

const STATUS_FLOW: Record<string, string> = {
  WAITING_STORE_CONFIRMATION: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
  READY: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

const STATUS_CANCEL: Record<string, string> = {
  WAITING_STORE_CONFIRMATION: "REJECTED",
  ACCEPTED: "REJECTED",
};

type FilterStatus = "all" | "WAITING_STORE_CONFIRMATION" | "ACCEPTED" | "PREPARING" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED";

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "WAITING_STORE_CONFIRMATION", label: "Aguardando" },
  { value: "ACCEPTED", label: "Aceitos" },
  { value: "PREPARING", label: "Preparando" },
  { value: "READY", label: "Prontos" },
  { value: "OUT_FOR_DELIVERY", label: "A caminho" },
  { value: "DELIVERED", label: "Entregues" },
];

export default function PedidosPage() {
  const { token } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [expandedItems, setExpandedItems] = useState<
    Record<string, OrderItem[]>
  >({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const storeData = await authFetch(
        `${API_URL}/delivery/vendor/stores`,
        token
      );
      const s: Store | null = storeData.store;
      setStore(s);
      if (s) {
        const orderData = await authFetch(
          `${API_URL}/delivery/vendor/orders`,
          token
        );
        setOrders(orderData.orders || []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar pedidos");
      showToast("Erro ao carregar pedidos", "error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  async function advanceStatus(order: Order) {
    const next = STATUS_FLOW[order.status];
    if (!next || !token) return;
    setUpdatingId(order.id);
    setError(null);
    try {
      await authFetch(
        `${API_URL}/delivery/orders/${order.id}/status`,
        token,
        {
          method: "PUT",
          body: JSON.stringify({ status: next }),
        }
      );
      showToast(`Pedido #${order.id.slice(0, 8).toUpperCase()} avançado!`);
      await loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao atualizar status";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setUpdatingId(null);
    }
  }

  async function cancelOrder() {
    if (!cancelTarget || !token) return;
    const next = STATUS_CANCEL[cancelTarget.status];
    if (!next) return;
    setUpdatingId(cancelTarget.id);
    setError(null);
    try {
      await authFetch(
        `${API_URL}/delivery/orders/${cancelTarget.id}/status`,
        token,
        {
          method: "PUT",
          body: JSON.stringify({ status: next }),
        }
      );
      showToast(`Pedido #${cancelTarget.id.slice(0, 8).toUpperCase()} rejeitado.`);
      setCancelTarget(null);
      await loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao rejeitar pedido";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setUpdatingId(null);
    }
  }

  async function loadOrderItems(orderId: string) {
    if (expandedItems[orderId]) return;
    if (!token) return;
    try {
      const data = await authFetch(
        `${API_URL}/delivery/orders/${orderId}`,
        token
      );
      setExpandedItems((prev) => ({
        ...prev,
        [orderId]: data.items || [],
      }));
    } catch (e: unknown) {
      showToast("Erro ao carregar itens do pedido", "error");
    }
  }

  function toggleExpand(order: Order) {
    if (expandedId === order.id) {
      setExpandedId(null);
    } else {
      setExpandedId(order.id);
      loadOrderItems(order.id);
    }
  }

  const filtered =
    filter === "all"
      ? orders
      : orders.filter((o) => o.status === filter);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-100 dark:border-emerald-950/30" />
          <div className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
          Carregando seus pedidos...
        </p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/20 rounded-full flex items-center justify-center mx-auto text-amber-500 border border-amber-100 dark:border-amber-900/30">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Loja Não Encontrada</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Você precisa configurar sua loja antes de gerenciar seus pedidos.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border animate-in slide-in-from-bottom duration-300 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-500" />
          )}
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {toast.message}
          </span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Pedidos</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/25">
              {orders.length} total
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitore a entrada de pedidos, mude o status de preparo e gerencie as entregas.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Horizontal Scroll Filter Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-250">
        {FILTER_OPTIONS.map((opt) => {
          const count =
            opt.value === "all"
              ? orders.length
              : orders.filter((o) => o.status === opt.value).length;
          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer border ${
                filter === opt.value
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/10"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-350 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              <span>{opt.label}</span>
              {count > 0 && (
                <span
                  className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                    filter === opt.value ? "bg-emerald-500 text-emerald-50" : "bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-450"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Orders List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-250 dark:border-slate-800 py-16 text-center text-sm text-slate-450 dark:text-slate-650 bg-white dark:bg-slate-900 shadow-xs">
          <ShoppingBag className="w-12 h-12 text-slate-300 dark:text-slate-800 mx-auto mb-3" />
          <p className="font-semibold text-slate-700 dark:text-slate-350">
            Nenhum pedido encontrado nesta seção.
          </p>
          <p className="text-xs text-slate-450 dark:text-slate-500 mt-1">
            Novos pedidos criados pelos clientes serão listados aqui instantaneamente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const nextStatus = STATUS_FLOW[order.status];
            const canCancel = STATUS_CANCEL[order.status];
            const isExpanded = expandedId === order.id;
            const items = expandedItems[order.id];
            const shortId = order.id.slice(0, 8).toUpperCase();

            let address = "";
            try {
              if (order.address_snapshot) {
                address = [order.address_snapshot.rua, order.address_snapshot.numero, order.address_snapshot.bairro, order.address_snapshot.cidade]
                  .filter(Boolean)
                  .join(", ");
              }
            } catch {
              // address parsing failed
            }

            return (
              <div
                key={order.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-850 overflow-hidden shadow-xs hover:border-slate-300 dark:hover:border-slate-800/80 transition-all"
              >
                {/* Header/Summary Line */}
                <button
                  onClick={() => toggleExpand(order)}
                  className="w-full text-left px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-colors cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-sm font-black text-slate-850 dark:text-slate-100">
                          #{shortId}
                        </span>
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${statusInfo.bg} ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                        {order.fulfillment_type && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-850">
                            {order.fulfillment_type === "entrega" ? (
                              <>
                                <Truck className="w-3 h-3" />
                                <span>Entrega</span>
                              </>
                            ) : (
                              <>
                                <ShoppingBag className="w-3 h-3" />
                                <span>Retirada</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDate(order.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 border-slate-100 dark:border-slate-850 pt-2 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <p className="text-base font-extrabold text-slate-900 dark:text-white">
                          R$ {order.total.toFixed(2)}
                        </p>
                        {address && (
                          <p className="text-xs text-slate-400 dark:text-slate-550 max-w-[240px] truncate mt-0.5 flex items-center gap-1 justify-start sm:justify-end">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{address}</span>
                          </p>
                        )}
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-255 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>
                </button>

                {/* Collapsible expanded section */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-850/80 bg-slate-50/20 dark:bg-slate-950/20 px-5 py-5 space-y-5">
                    {items ? (
                      <>
                        {/* Order Items */}
                        <div>
                          <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-850 pb-1.5 mb-2.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <h4 className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">
                              Itens do Pedido
                            </h4>
                          </div>
                          <div className="space-y-2">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-start justify-between text-sm"
                              >
                                <div className="flex-1 min-w-0">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {item.quantity}x {item.product_name}
                                  </span>
                                  {item.sale_type === "weight" &&
                                    item.quantity_decimal && (
                                      <span className="text-slate-500 dark:text-slate-450 text-xs ml-1">
                                        ({item.quantity_decimal.toFixed(3)}kg)
                                      </span>
                                    )}
                                  {item.observation && (
                                    <p className="text-xs text-rose-500 dark:text-rose-400 font-medium italic mt-0.5">
                                      Obs: {item.observation}
                                    </p>
                                  )}
                                </div>
                                <span className="font-bold text-slate-700 dark:text-slate-350 ml-4 whitespace-nowrap">
                                  R$ {item.subtotal.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Order Calculations */}
                        <div className="border-t border-slate-150 dark:border-slate-850 pt-3 space-y-1.5 text-sm">
                          <div className="flex justify-between text-slate-550 dark:text-slate-400 font-medium">
                            <span>Subtotal</span>
                            <span>R$ {order.subtotal.toFixed(2)}</span>
                          </div>
                          {order.delivery_fee > 0 && (
                            <div className="flex justify-between text-slate-550 dark:text-slate-400 font-medium">
                              <span>Taxa de entrega</span>
                              <span>R$ {order.delivery_fee.toFixed(2)}</span>
                            </div>
                          )}
                          {order.discount > 0 && (
                            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                              <span>Desconto</span>
                              <span>-R$ {order.discount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-black text-slate-900 dark:text-white text-base pt-1.5 border-t border-slate-100 dark:border-slate-850">
                            <span>Total</span>
                            <span>R$ {order.total.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Additional Info Cards (Address & Observation) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-150 dark:border-slate-850 pt-4">
                          {address && (
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-150 dark:border-slate-800 shadow-xs">
                              <h4 className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-1">
                                Endereço de Entrega
                              </h4>
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-350 leading-relaxed">{address}</p>
                            </div>
                          )}

                          {order.observation && (
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-150 dark:border-slate-800 shadow-xs">
                              <h4 className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-1">
                                Observações do Cliente
                              </h4>
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-350 leading-relaxed italic">{order.observation}</p>
                            </div>
                          )}
                        </div>

                        {/* Status Change Buttons */}
                        <div className="border-t border-slate-150 dark:border-slate-850 pt-4 flex flex-wrap gap-2.5">
                          {nextStatus && (
                            <button
                              onClick={() => advanceStatus(order)}
                              disabled={updatingId === order.id}
                              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-650 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-600/10 cursor-pointer active:scale-98 disabled:opacity-50"
                            >
                              {updatingId === order.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {updatingId === order.id
                                  ? "Atualizando..."
                                  : `Avançar para: ${
                                      STATUS_CONFIG[nextStatus]?.label || nextStatus
                                    }`}
                              </span>
                            </button>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => setCancelTarget(order)}
                              disabled={updatingId === order.id}
                              className="inline-flex items-center gap-1.5 border border-rose-100 dark:border-rose-950/20 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/10 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Rejeitar Pedido</span>
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 space-y-2">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Carregando itens...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* REJECT CONFIRMATION MODAL */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center text-rose-500 mb-4 border border-rose-100 dark:border-rose-900/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Rejeitar Pedido</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Tem certeza que deseja recusar o pedido <strong>#{cancelTarget.id.slice(0,8).toUpperCase()}</strong>? O cliente será notificado sobre o cancelamento.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                className="flex-1 rounded-xl border border-slate-250 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={cancelOrder}
                disabled={updatingId === cancelTarget.id}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer shadow-sm shadow-rose-600/10 active:scale-98 disabled:opacity-50"
              >
                {updatingId === cancelTarget.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4.5 w-4.5" />
                )}
                <span>{updatingId === cancelTarget.id ? "Cancelando..." : "Rejeitar"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
