"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Check,
  Tag,
  X,
  Bike,
  ShoppingBag,
  CreditCard,
  QrCode,
  Loader2,
  AlertCircle,
  Copy,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import {
  listAddresses,
  getStore,
  validateCoupon,
  createOrder,
  simulatePayment,
  type UserAddress,
  type Store,
  type StoreDeliverySlot,
  type StoreHours,
  type FulfillmentType,
  type Order,
} from "@/lib/api";
import { formatPrice } from "@/lib/utils";

type ScheduleDay = {
  date: string;
  dayNum: number;
  label: string;
  isToday: boolean;
};

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nowTimeStr(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function buildScheduleDays(count: number, hours: StoreHours[]): ScheduleDay[] {
  const short = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const days: ScheduleDay[] = [];
  const now = new Date();
  const hasHoursConfig = hours && hours.length > 0;
  let added = 0;

  for (let i = 0; i < 30 && added < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dayOfWeek = d.getDay();

    if (!hasHoursConfig) {
      continue;
    }

    const hourSetting = hours.find((h) => h.day_of_week === dayOfWeek);
    if (!hourSetting || hourSetting.is_closed) {
      continue;
    }

    days.push({
      date: toDateStr(d),
      dayNum: d.getDate(),
      label: i === 0 ? "Hoje" : short[dayOfWeek],
      isToday: i === 0,
    });
    added++;
  }
  return days;
}

function slotApplies(slot: StoreDeliverySlot, type: FulfillmentType): boolean {
  return slot.fulfillment_type === "ambos" || slot.fulfillment_type === type;
}

function formatSlotSummary(
  type: FulfillmentType,
  day: ScheduleDay | null,
  slot: StoreDeliverySlot | null,
): string {
  if (!day || !slot) return "Escolha um horário";
  const dayWord = day.isToday ? "hoje" : day.label.toLowerCase();
  if (type === "entrega") {
    return `Receba ${dayWord} das ${slot.start_time} às ${slot.end_time}`;
  }
  return `Retire ${dayWord} a partir das ${slot.start_time.replace(/^0/, "")}`;
}

export default function CheckoutPage() {
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { cart, cartStore, cartTotal, clearCart } = useCart();

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [slots, setSlots] = useState<StoreDeliverySlot[]>([]);
  const [storeHours, setStoreHours] = useState<StoreHours[]>([]);
  const [observation, setObservation] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("entrega");
  const [selectedDay, setSelectedDay] = useState<ScheduleDay | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<StoreDeliverySlot | null>(null);
  const [showMoreSlots, setShowMoreSlots] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card" | "debit_card">("pix");
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [simulatingPay, setSimulatingPay] = useState(false);

  const scheduleDays = useMemo(
    () => buildScheduleDays(store?.schedule_days ?? 5, storeHours),
    [store?.schedule_days, storeHours],
  );

  const activeDay = selectedDay || scheduleDays[0] || null;

  const availableSlots = useMemo(() => {
    const now = nowTimeStr();
    return slots
      .filter((s) => s.is_active && slotApplies(s, fulfillmentType))
      .filter((s) => {
        if (!activeDay?.isToday) return true;
        return s.end_time > now;
      })
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          a.start_time.localeCompare(b.start_time),
      );
  }, [slots, fulfillmentType, activeDay]);

  const primarySlots = availableSlots.slice(0, 4);
  const visibleSlots = showMoreSlots ? availableSlots : primarySlots;

  const activeSlot =
    (selectedSlot && availableSlots.find((s) => s.id === selectedSlot.id)) ||
    availableSlots[0] ||
    null;

  const loadData = useCallback(async () => {
    if (!token || !cartStore?.id) return;
    try {
      setLoading(true);
      const [addrData, storeData] = await Promise.all([
        listAddresses(token),
        getStore(token, cartStore.id),
      ]);
      setAddresses(addrData.addresses);
      setStore(storeData.store);
      setSlots(storeData.slots || []);
      setStoreHours(storeData.hours || []);
      
      const defaultAddr = addrData.addresses.find((a) => a.is_default);
      if (defaultAddr) setSelectedAddress(defaultAddr);
      else if (addrData.addresses.length > 0) setSelectedAddress(addrData.addresses[0]);

      if (storeData.store.accepts_delivery === false && storeData.store.accepts_pickup !== false) {
        setFulfillmentType("retirada");
      }
    } catch (err) {
      console.error("Failed to load checkout data:", err);
    } finally {
      setLoading(false);
    }
  }, [token, cartStore]);

  useEffect(() => {
    if (!authLoading && !token) {
      router.push("/login?redirect=/checkout");
      return;
    }
    if (token && cartStore?.id) {
      const timer = setTimeout(() => {
        loadData();
      }, 0);
      return () => clearTimeout(timer);
    } else if (!authLoading) {
      const timer = setTimeout(() => {
        setLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [token, authLoading, cartStore, loadData, router]);

  const handleApplyCoupon = async () => {
    if (!token || !couponInput.trim()) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const result = await validateCoupon(token, couponInput.trim(), cartTotal);
      setCouponCode(couponInput.trim().toUpperCase());
      setDiscount(result.discount);
      setCouponApplied(true);
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Não foi possível aplicar o cupom");
      setCouponCode(null);
      setDiscount(0);
      setCouponApplied(false);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode(null);
    setDiscount(0);
    setCouponInput("");
    setCouponApplied(false);
    setCouponError(null);
  };

  const deliveryFee =
    fulfillmentType === "entrega" ? (activeSlot?.fee ?? store?.delivery_fee ?? 0) : 0;

  const total = Math.max(0, cartTotal + deliveryFee - discount);

  const canSubmit =
    !!activeSlot &&
    !!activeDay &&
    (fulfillmentType === "retirada" || !!selectedAddress) &&
    !submitting;

  const handleOrder = async () => {
    if (!token || !cartStore?.id || !activeSlot || !activeDay) return;

    if (fulfillmentType === "entrega" && !selectedAddress) {
      alert("Selecione um endereço de entrega.");
      return;
    }

    if (store && !store.is_open) {
      alert("Esta loja está fechada no momento.");
      return;
    }

    if (store && store.minimum_order > cartTotal) {
      alert(`O pedido mínimo é R$ ${store.minimum_order.toFixed(2)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await createOrder(token, {
        store_id: cartStore.id,
        address_id: fulfillmentType === "entrega" ? selectedAddress?.id : undefined,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          observation: undefined,
          addon_ids: [],
        })),
        observation: observation || undefined,
        coupon_code: couponCode || undefined,
        fulfillment_type: fulfillmentType,
        scheduled_date: activeDay.date,
        slot_id: activeSlot.id,
        payment_method: paymentMethod,
      });

      clearCart();

      if (res.order.payment_status === "paid") {
        alert("Pedido criado e pago com sucesso!");
        router.replace("/delivery/orders");
      } else {
        setPendingOrder(res.order);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao criar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!token || !pendingOrder) return;
    setSimulatingPay(true);
    try {
      await simulatePayment(token, pendingOrder.id);
      alert("Pagamento confirmado com sucesso!");
      setPendingOrder(null);
      router.replace("/delivery/orders");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao confirmar pagamento");
    } finally {
      setSimulatingPay(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="w-10 h-10 animate-spin text-neutral-800 dark:text-neutral-200" />
        <span className="mt-4 text-sm font-medium text-muted-text">Carregando checkout...</span>
      </div>
    );
  }

  if (!cartStore || cart.length === 0) {
    if (pendingOrder) {
      // Don't show "empty cart" if we have a pending order we are paying for!
    } else {
      return (
        <div className="min-h-[70vh] max-w-2xl mx-auto px-4 flex flex-col items-center justify-center text-center">
          <ShoppingBag className="w-16 h-16 text-muted-text mb-4" />
          <h1 className="text-xl font-bold">Seu carrinho está vazio</h1>
          <p className="text-sm text-muted-text mt-2 mb-6">
            Adicione itens de uma loja antes de finalizar o pedido.
          </p>
          <button
            onClick={() => router.push("/delivery")}
            className="px-6 py-2.5 bg-foreground text-background font-bold text-xs uppercase tracking-wider rounded-full hover:opacity-90 transition-opacity"
          >
            Ir para Delivery
          </button>
        </div>
      );
    }
  }

  // Pending payment screen (PIX QR Code Sandbox)
  if (pendingOrder) {
    const copiaCola = (pendingOrder.payment_details as Record<string, string> | null)?.pix_copia_e_cola || "";
    const orderShortId = pendingOrder.id.substring(0, 8).toUpperCase();

    const handleCopyPix = () => {
      navigator.clipboard.writeText(copiaCola);
      alert("Código Pix Copia e Cola copiado!");
    };

    return (
      <div className="min-h-screen max-w-xl mx-auto px-4 py-12 flex flex-col justify-center">
        <div className="text-center mb-8 flex flex-col items-center">
          <QrCode className="w-16 h-16 mb-4 text-neutral-800 dark:text-neutral-200" />
          <h1 className="text-2xl font-bold tracking-tight">Pagamento do Pedido</h1>
          <p className="text-sm text-muted-text mt-1">
            Pedido #{orderShortId} • Total: {formatPrice(total)}
          </p>
        </div>

        <div className="bg-surface dark:bg-card-bg border border-card-border/60 rounded-3xl p-6 sm:p-8 flex flex-col items-center shadow-xl mb-6">
          <h2 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider text-center">
            Pague via Pix (Sandbox de Teste)
          </h2>

          {/* SVG QR Code Simulation */}
          <div className="bg-white p-4 rounded-2xl border border-card-border/30 shadow-md mb-6 flex flex-col items-center">
            <svg width="160" height="160" viewBox="0 0 160 160" fill="none" className="text-black">
              {/* Top Left */}
              <rect x="10" y="10" width="40" height="40" stroke="currentColor" strokeWidth="4" />
              <rect x="20" y="20" width="20" height="20" fill="currentColor" />
              {/* Top Right */}
              <rect x="110" y="10" width="40" height="40" stroke="currentColor" strokeWidth="4" />
              <rect x="120" y="20" width="20" height="20" fill="currentColor" />
              {/* Bottom Left */}
              <rect x="10" y="110" width="40" height="40" stroke="currentColor" strokeWidth="4" />
              <rect x="20" y="120" width="20" height="20" fill="currentColor" />
              {/* Sandbox Pix style code */}
              <rect x="60" y="15" width="10" height="10" fill="currentColor" />
              <rect x="85" y="20" width="10" height="10" fill="currentColor" />
              <rect x="60" y="35" width="20" height="10" fill="currentColor" />
              <rect x="15" y="60" width="10" height="10" fill="currentColor" />
              <rect x="35" y="70" width="15" height="10" fill="currentColor" />
              <rect x="120" y="60" width="10" height="10" fill="currentColor" />
              <rect x="135" y="80" width="15" height="15" fill="currentColor" />
              <rect x="110" y="125" width="20" height="20" fill="currentColor" />
              {/* Center Overlay */}
              <rect x="58" y="58" width="44" height="44" fill="white" />
              <rect x="60" y="60" width="40" height="40" fill="black" rx="4" />
              <text x="80" y="88" fill="white" className="font-extrabold text-xl font-sans" textAnchor="middle">
                Z
              </text>
            </svg>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-text mt-3">
              Zapi Pay Sandbox
            </span>
          </div>

          <button
            onClick={handleCopyPix}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-250 dark:hover:bg-neutral-700/80 text-foreground text-xs font-bold uppercase tracking-wider rounded-2xl transition-all border border-card-border/60 mb-6"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copiar Código Pix</span>
          </button>

          <p className="text-[11px] text-muted-text text-center leading-relaxed max-w-sm">
            Como estamos no ambiente de testes (Sandbox), você pode simular a confirmação do pagamento clicando no botão abaixo.
          </p>
        </div>

        <button
          onClick={handleSimulatePayment}
          disabled={simulatingPay}
          className="w-full h-12 bg-black dark:bg-white hover:bg-neutral-900 dark:hover:bg-neutral-100 text-white dark:text-black font-bold uppercase tracking-widest text-xs rounded-full flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {simulatingPay ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <span>Simular Pagamento Aprovado</span>
          )}
        </button>

        <button
          onClick={() => router.replace("/delivery/orders")}
          className="w-full py-3 text-center text-xs font-semibold text-muted-text hover:text-foreground mt-4 transition-colors"
        >
          Pagar mais tarde (Meus Pedidos)
        </button>
      </div>
    );
  }

  const acceptsDelivery = store?.accepts_delivery !== false;
  const acceptsPickup = store?.accepts_pickup !== false;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.back()}
          className="p-2.5 rounded-full border border-card-border/60 hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Finalizar Pedido</h1>
          <p className="text-xs text-muted-text mt-0.5">{cartStore?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Delivery settings */}
        <div className="lg:col-span-7 space-y-6">
          {/* Fulfillment Selection */}
          <div className="bg-surface dark:bg-card-bg border border-card-border/60 rounded-3xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">
              Forma de Entrega
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {acceptsDelivery && (
                <button
                  onClick={() => {
                    setFulfillmentType("entrega");
                    setShowMoreSlots(false);
                  }}
                  className={`flex flex-col text-left p-4 rounded-2xl border transition-all ${
                    fulfillmentType === "entrega"
                      ? "border-foreground bg-neutral-50 dark:bg-neutral-900/50"
                      : "border-card-border/40 bg-transparent hover:border-card-border/80"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Bike className="w-5 h-5" />
                    <span className="text-xs font-bold">Entrega</span>
                  </div>
                  <span className="text-[10px] text-muted-text mt-2 leading-relaxed">
                    {fulfillmentType === "entrega"
                      ? formatSlotSummary("entrega", activeDay, activeSlot)
                      : "Receba no seu endereço cadastrado"}
                  </span>
                </button>
              )}
              {acceptsPickup && (
                <button
                  onClick={() => {
                    setFulfillmentType("retirada");
                    setShowMoreSlots(false);
                  }}
                  className={`flex flex-col text-left p-4 rounded-2xl border transition-all ${
                    fulfillmentType === "retirada"
                      ? "border-foreground bg-neutral-50 dark:bg-neutral-900/50"
                      : "border-card-border/40 bg-transparent hover:border-card-border/80"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    <span className="text-xs font-bold">Retirada</span>
                  </div>
                  <span className="text-[10px] text-muted-text mt-2 leading-relaxed">
                    {fulfillmentType === "retirada"
                      ? formatSlotSummary("retirada", activeDay, activeSlot)
                      : "Retire o pedido diretamente na loja"}
                  </span>
                </button>
              )}
            </div>

            {/* Address Selection for delivery */}
            {fulfillmentType === "entrega" && (
              <div className="mt-6 pt-6 border-t border-card-border/40">
                <span className="block text-xs font-semibold mb-3">Endereço de Entrega</span>
                {addresses.length === 0 ? (
                  <div className="p-4 border border-dashed border-card-border/60 rounded-2xl flex flex-col items-center justify-center text-center">
                    <MapPin className="w-8 h-8 text-muted-text mb-2 animate-bounce" />
                    <span className="text-xs font-bold text-foreground">Nenhum endereço cadastrado</span>
                    <span className="text-[10px] text-muted-text mt-1 mb-3">
                      Adicione um endereço no topo ou nas configurações.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((addr) => {
                      const isSel = selectedAddress?.id === addr.id;
                      return (
                        <button
                          key={addr.id}
                          onClick={() => setSelectedAddress(addr)}
                          className={`w-full text-left p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                            isSel
                              ? "border-foreground bg-neutral-50 dark:bg-neutral-900/40"
                              : "border-card-border/30 hover:border-card-border/60 bg-transparent"
                          }`}
                        >
                          <div className="mt-0.5">
                            {isSel ? (
                              <div className="w-4 h-4 rounded-full bg-foreground flex items-center justify-center text-background">
                                <Check className="w-2.5 h-2.5" />
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-card-border/60" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="block text-xs font-bold capitalize">
                              {addr.label} · {addr.cidade}/{addr.estado}
                            </span>
                            <span className="block text-[10px] text-muted-text mt-0.5 truncate">
                              {addr.rua}, {addr.numero} — {addr.bairro}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Schedule/Time Selection */}
          <div className="bg-surface dark:bg-card-bg border border-card-border/60 rounded-3xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">
              Agendamento
            </h2>

            {/* Days picker */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {scheduleDays.map((day) => {
                const isSel = activeDay?.date === day.date;
                return (
                  <button
                    key={day.date}
                    onClick={() => {
                      setSelectedDay(day);
                      setShowMoreSlots(false);
                    }}
                    className={`flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-2xl border transition-all ${
                      isSel
                        ? "bg-foreground border-foreground text-background font-bold shadow-sm"
                        : "border-card-border/40 hover:border-card-border/80 text-foreground bg-transparent"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold opacity-80">{day.label}</span>
                    <span className="text-lg font-black tracking-tight mt-0.5">{day.dayNum}</span>
                  </button>
                );
              })}
            </div>

            {/* Hour Slots picker */}
            <div className="mt-6">
              <span className="block text-xs font-semibold mb-3">Horários Disponíveis</span>
              {availableSlots.length === 0 ? (
                <div className="p-4 border border-dashed border-card-border/60 rounded-2xl flex items-center justify-center gap-2 text-muted-text">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs">Nenhum horário disponível para este dia.</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {visibleSlots.map((slot) => {
                    const isSel = activeSlot?.id === slot.id;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2.5 px-3 rounded-2xl border text-center transition-all ${
                          isSel
                            ? "bg-foreground border-foreground text-background font-bold"
                            : "border-card-border/30 hover:border-card-border/85 bg-transparent"
                        }`}
                      >
                        <span className="block text-[11px] font-bold">
                          {slot.start_time} - {slot.end_time}
                        </span>
                        {slot.fee > 0 && (
                          <span
                            className={`block text-[9px] font-semibold mt-0.5 ${
                              isSel ? "text-background/80" : "text-muted-text"
                            }`}
                          >
                            + {formatPrice(slot.fee)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {availableSlots.length > 4 && (
                <button
                  onClick={() => setShowMoreSlots(!showMoreSlots)}
                  className="w-full text-center text-xs font-bold text-muted-text hover:text-foreground mt-4 transition-colors"
                >
                  {showMoreSlots ? "Ver menos horários" : `Ver mais +${availableSlots.length - 4} horários`}
                </button>
              )}
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-surface dark:bg-card-bg border border-card-border/60 rounded-3xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">
              Forma de Pagamento
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setPaymentMethod("pix")}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                  paymentMethod === "pix"
                    ? "border-foreground bg-neutral-50 dark:bg-neutral-900/50"
                    : "border-card-border/40 bg-transparent hover:border-card-border/80"
                }`}
              >
                <QrCode className="w-5 h-5" />
                <span className="text-xs font-bold">Pix</span>
              </button>
              <button
                onClick={() => setPaymentMethod("credit_card")}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                  paymentMethod === "credit_card"
                    ? "border-foreground bg-neutral-50 dark:bg-neutral-900/50"
                    : "border-card-border/40 bg-transparent hover:border-card-border/80"
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-xs font-bold">Crédito</span>
              </button>
              <button
                onClick={() => setPaymentMethod("debit_card")}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                  paymentMethod === "debit_card"
                    ? "border-foreground bg-neutral-50 dark:bg-neutral-900/50"
                    : "border-card-border/40 bg-transparent hover:border-card-border/80"
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-xs font-bold">Débito</span>
              </button>
            </div>
          </div>

          {/* Observation */}
          <div className="bg-surface dark:bg-card-bg border border-card-border/60 rounded-3xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">
              Observação para a Loja
            </h2>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Alguma restrição alimentar? Avisar ao motorista? Escreva aqui..."
              rows={3}
              className="w-full text-xs p-3 rounded-2xl border border-card-border/50 bg-neutral-50/50 dark:bg-neutral-900/20 focus:outline-none focus:ring-1 focus:ring-foreground focus:border-foreground resize-none transition-all placeholder:text-muted-text/50"
            />
          </div>
        </div>

        {/* Right Side: Order summary */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-surface dark:bg-card-bg border border-card-border/60 rounded-3xl p-6 shadow-xl sticky top-24">
            <h2 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">
              Resumo do Pedido
            </h2>

            {/* Cart Items list */}
            <div className="max-h-60 overflow-y-auto space-y-3 pr-2 scrollbar-thin mb-6">
              {cart.map((item) => (
                <div key={item.product.id} className="flex justify-between items-center text-xs">
                  <div className="min-w-0 flex-grow">
                    <span className="font-bold text-foreground block truncate">
                      {item.product.name}
                    </span>
                    <span className="text-[10px] text-muted-text">
                      Qtd: {item.quantity} · {formatPrice(item.product.promotional_price || item.product.price)}
                    </span>
                  </div>
                  <span className="font-bold text-foreground ml-3 shrink-0">
                    {formatPrice((item.product.promotional_price || item.product.price) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Coupons Section */}
            <div className="border-t border-card-border/30 pt-4 mb-4">
              <span className="block text-[11px] font-bold text-muted-text uppercase tracking-wider mb-2">
                Cupom de Desconto
              </span>
              {couponApplied ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-card-border/40 text-xs">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-green-600 dark:text-green-500" />
                    <span className="font-bold uppercase tracking-wider">{couponCode}</span>
                    <span className="text-[10px] text-green-600 dark:text-green-500">
                      (-{formatPrice(discount)})
                    </span>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Digite o cupom"
                    className="flex-grow text-xs uppercase p-2.5 rounded-xl border border-card-border/50 bg-neutral-50/50 dark:bg-neutral-900/20 focus:outline-none focus:ring-1 focus:ring-foreground focus:border-foreground transition-all"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={validatingCoupon || !couponInput.trim()}
                    className="py-2.5 px-4 bg-foreground text-background font-bold text-xs uppercase tracking-wider rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {validatingCoupon ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Aplicar"
                    )}
                  </button>
                </div>
              )}
              {couponError && (
                <span className="block text-[10px] font-semibold text-red-600 dark:text-red-500 mt-1.5 ml-1">
                  {couponError}
                </span>
              )}
            </div>

            {/* Calculations */}
            <div className="border-t border-card-border/30 pt-4 space-y-2 mb-6">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-text">Subtotal</span>
                <span className="font-semibold">{formatPrice(cartTotal)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-text">Taxa de Entrega</span>
                <span className="font-semibold text-foreground">
                  {deliveryFee > 0 ? formatPrice(deliveryFee) : "Grátis"}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between items-center text-xs text-green-600 dark:text-green-500">
                  <span>Desconto</span>
                  <span className="font-semibold">- {formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm font-bold border-t border-card-border/20 pt-3 text-foreground">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            {/* Place Order Button */}
            <button
              onClick={handleOrder}
              disabled={!canSubmit}
              className="w-full h-12 bg-black dark:bg-white hover:bg-neutral-900 dark:hover:bg-neutral-100 text-white dark:text-black font-bold uppercase tracking-widest text-xs rounded-full flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando Pedido...</span>
                </>
              ) : (
                <span>Confirmar Pedido</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
