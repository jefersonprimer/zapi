"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getOrder,
  simulatePayment,
  type Order,
  type OrderItem,
  type Store,
  getOrderStatusLabel,
  ORDER_STATUS_COLORS,
} from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { ArrowLeft, MapPin, Tag, Loader2, Copy } from "lucide-react";

const STEPS = ["PENDING_PAYMENT", "PAID", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"];

function getStepIndex(status: string): number {
  const normalized = status.toUpperCase();
  if (normalized === "PENDING_PAYMENT" || normalized === "PENDENTE") return 0;
  if (normalized === "PAID") return 1;
  if (normalized === "ACCEPTED" || normalized === "CONFIRMADO") return 2;
  if (normalized === "PREPARING" || normalized === "PREPARANDO") return 3;
  if (normalized === "READY" || normalized === "OUT_FOR_DELIVERY" || normalized === "SAIU_ENTREGA") return 4;
  if (normalized === "DELIVERED" || normalized === "ENTREGUE") return 5;
  return -1;
}

function formatOrderDate(dateStr: string): string {
  if (!dateStr) return "";
  const part = dateStr.slice(0, 10);
  const parts = part.split("-");
  if (parts.length !== 3) return dateStr;
  const [, m, d] = parts;
  return `${d}/${m}`;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulatingPay, setSimulatingPay] = useState(false);

  const loadData = useCallback(async () => {
    if (!token || !id) return;
    try {
      setLoading(true);
      const data = await getOrder(token, id);
      setOrder(data.order);
      setItems(data.items);
      setStore(data.store);
    } catch (err) {
      console.error("Failed to load order details:", err);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    if (!authLoading && !token) {
      router.push(`/login?redirect=/orders/${id}`);
      return;
    }
    if (token && id) {
      const timer = setTimeout(() => {
        loadData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [token, id, authLoading, loadData, router]);

  const handleSimulatePayment = async () => {
    if (!token || !order) return;
    setSimulatingPay(true);
    try {
      await simulatePayment(token, order.id);
      alert("Pagamento confirmado com sucesso!");
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao confirmar pagamento");
    } finally {
      setSimulatingPay(false);
    }
  };

  const handleCopyPix = () => {
    const copiaCola = (order?.payment_details as Record<string, string> | null)?.pix_copia_e_cola || "";
    if (copiaCola) {
      navigator.clipboard.writeText(copiaCola);
      alert("Código Pix Copia e Cola copiado com sucesso!");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
        <Loader2 className="w-10 h-10 animate-spin text-neutral-800 dark:text-neutral-200" />
        <span className="mt-4 text-sm font-medium text-muted-text">Carregando detalhes do pedido...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
        <span className="text-sm font-medium text-muted-text">Pedido não encontrado.</span>
        <button
          onClick={() => router.push("/delivery/orders")}
          className="mt-4 px-6 py-2 bg-foreground text-background font-bold text-xs uppercase rounded-full"
        >
          Voltar para meus pedidos
        </button>
      </div>
    );
  }

  const currentStep = getStepIndex(order.status);
  const isPendingPix = order.payment_status === "pending" && order.payment_method === "pix";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push("/delivery/orders")}
          className="p-2.5 rounded-full border border-card-border/60 hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Pedido #{order.id.substring(0, 8).toUpperCase()}</h1>
          <p className="text-xs text-muted-text mt-0.5">{store?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Status, Items and Details */}
        <div className="lg:col-span-8 space-y-6">
          {/* Status Progress */}
          <div className="bg-surface dark:bg-card-bg border border-card-border/60 rounded-3xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider">
              Status do Pedido
            </h2>
            <div className="relative pl-6 border-l-2 border-dashed border-card-border/60 space-y-6">
              {STEPS.map((step, idx) => {
                const isActive = idx <= currentStep;
                const isCurrent = idx === currentStep;
                const stepColor = ORDER_STATUS_COLORS[step] || "#6B7280";

                return (
                  <div key={step} className="relative">
                     {/* Circle Indicator on the dashed line */}
                    <div
                      className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-background transition-all ${
                        isCurrent
                          ? "scale-125 ring-4 ring-offset-0 ring-foreground/5"
                          : ""
                      }`}
                      style={{
                        backgroundColor: isActive ? stepColor : "var(--card-border)",
                      }}
                    />
                    <div className="pl-4">
                      <span
                        className={`text-xs block font-bold transition-colors ${
                          isActive ? "text-foreground" : "text-muted-text"
                        } ${isCurrent ? "text-sm font-black" : ""}`}
                      >
                        {getOrderStatusLabel(step, order.fulfillment_type)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Items card */}
          <div className="bg-surface dark:bg-card-bg border border-card-border/60 rounded-3xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">
              Itens do Pedido
            </h2>
            <div className="divide-y divide-card-border/40">
              {items.map((item) => {
                let parsedAddons: Array<{ name: string; price: number }> = [];
                if (item.addons && Array.isArray(item.addons)) {
                  parsedAddons = item.addons;
                } else if (typeof item.addons === "string") {
                  try {
                    parsedAddons = JSON.parse(item.addons);
                  } catch {}
                }

                return (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex justify-between items-start text-xs">
                    <div>
                      <span className="font-bold text-foreground block">
                        {item.sale_type === "weight"
                          ? `${item.quantity_decimal?.toFixed(3)}kg x ${item.product_name}`
                          : `${item.quantity}x ${item.product_name}`}
                      </span>
                      {parsedAddons.length > 0 && (
                        <div className="mt-1 space-y-0.5 pl-2 border-l border-card-border/80">
                          {parsedAddons.map((addon, index) => (
                            <span key={index} className="block text-[10px] text-muted-text">
                              + {addon.name} ({formatPrice(addon.price)})
                            </span>
                          ))}
                        </div>
                      )}
                      {item.observation && (
                        <span className="block text-[10px] italic text-muted-text mt-1">
                          Obs: {item.observation}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-foreground ml-4 shrink-0">
                      {formatPrice(item.subtotal)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Observation */}
          {order.observation && (
            <div className="bg-surface dark:bg-card-bg border border-card-border/60 rounded-3xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-foreground mb-2 uppercase tracking-wider">
                Observação
              </h2>
              <p className="text-xs text-muted-text italic leading-relaxed">
                &ldquo;{order.observation}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Right column: Delivery address & Totals */}
        <div className="lg:col-span-4 space-y-6">
          {/* Pix Sandbox Payment Simulation if pending */}
          {isPendingPix && (
            <div className="bg-surface dark:bg-card-bg border border-card-border/60 rounded-3xl p-6 shadow-md flex flex-col items-center">
              <h2 className="text-xs font-bold text-foreground mb-4 uppercase tracking-wider text-center">
                Pague via Pix (Sandbox)
              </h2>

              <div className="bg-white p-3 rounded-2xl border border-card-border/30 shadow-sm mb-4">
                <svg width="120" height="120" viewBox="0 0 160 160" fill="none" className="text-black">
                  <rect x="10" y="10" width="40" height="40" stroke="currentColor" strokeWidth="4" />
                  <rect x="20" y="20" width="20" height="20" fill="currentColor" />
                  <rect x="110" y="10" width="40" height="40" stroke="currentColor" strokeWidth="4" />
                  <rect x="120" y="20" width="20" height="20" fill="currentColor" />
                  <rect x="10" y="110" width="40" height="40" stroke="currentColor" strokeWidth="4" />
                  <rect x="20" y="120" width="20" height="20" fill="currentColor" />
                  <rect x="60" y="15" width="10" height="10" fill="currentColor" />
                  <rect x="85" y="20" width="10" height="10" fill="currentColor" />
                  <rect x="60" y="35" width="20" height="10" fill="currentColor" />
                  <rect x="120" y="60" width="10" height="10" fill="currentColor" />
                  <rect x="135" y="80" width="15" height="15" fill="currentColor" />
                  <rect x="110" y="125" width="20" height="20" fill="currentColor" />
                  <rect x="58" y="58" width="44" height="44" fill="white" />
                  <rect x="60" y="60" width="40" height="40" fill="black" rx="4" />
                  <text x="80" y="88" fill="white" className="font-extrabold text-xl font-sans" textAnchor="middle">
                    Z
                  </text>
                </svg>
              </div>

              <button
                onClick={handleCopyPix}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700/80 text-foreground text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all border border-card-border/60 mb-4"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Pix</span>
              </button>

              <button
                onClick={handleSimulatePayment}
                disabled={simulatingPay}
                className="w-full h-10 bg-black dark:bg-white hover:bg-neutral-900 dark:hover:bg-neutral-100 text-white dark:text-black font-bold uppercase tracking-widest text-[10px] rounded-full flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {simulatingPay ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Simular Pagamento</span>
                )}
              </button>
            </div>
          )}

          {/* Delivery Details */}
          <div className="bg-surface dark:bg-card-bg border border-card-border/60 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-muted-text" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                {order.fulfillment_type === "retirada" ? "Retirada" : "Entrega"}
              </h2>
            </div>
            {order.scheduled_date && order.slot_start && (
              <span className="block text-xs font-bold text-foreground mb-2">
                {order.fulfillment_type === "retirada"
                  ? `Retirar em ${formatOrderDate(order.scheduled_date)} a partir das ${order.slot_start}`
                  : `Receber em ${formatOrderDate(order.scheduled_date)} das ${order.slot_start} às ${order.slot_end}`}
              </span>
            )}
            <span className="block text-xs text-muted-text leading-relaxed">
              {order.address_snapshot?.rua}, {order.address_snapshot?.numero} - {order.address_snapshot?.bairro}
              <br />
              {order.address_snapshot?.cidade} / {order.address_snapshot?.estado}
            </span>
          </div>

          {/* Calculation details */}
          <div className="bg-surface dark:bg-card-bg border border-card-border/60 rounded-3xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">
              Resumo de Valores
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-text">Subtotal</span>
                <span className="font-semibold">{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-text">
                  {order.fulfillment_type === "retirada" ? "Taxa de Retirada" : "Taxa de Entrega"}
                </span>
                <span className="font-semibold text-foreground font-mono">
                  {order.delivery_fee > 0 ? formatPrice(order.delivery_fee) : "Grátis"}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between items-center text-xs text-green-600 dark:text-green-500">
                  <span className="inline-flex items-center gap-1 font-bold">
                    <Tag className="w-3.5 h-3.5" />
                    {order.coupon_code}
                  </span>
                  <span className="font-semibold font-mono">- {formatPrice(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm font-bold border-t border-card-border/20 pt-3 text-foreground">
                <span>Total</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
