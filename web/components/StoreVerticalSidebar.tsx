"use client";

import React, { useState } from "react";
import Image from "next/image";
import { getImageUrl, formatPrice } from "@/lib/utils";
import { Store, StoreHours, StoreDeliverySlot, StoreCoupon } from "@/lib/api";
import {
  Store as StoreIcon,
  Loader2,
  Star,
  UserCheck,
  UserPlus,
} from "lucide-react";

const CATEGORY_MAP: Record<string, { label: string; emoji: string }> = {
  restaurante: { label: "Restaurantes", emoji: "🍔" },
  fast_food: { label: "Fast Food", emoji: "🍟" },
  lanchonete: { label: "Lanches", emoji: "🥪" },
  lanches: { label: "Lanches", emoji: "🥪" },
  pizza: { label: "Pizzas", emoji: "🍕" },
  marmita: { label: "Marmitas & PF", emoji: "🍱" },
  padaria: { label: "Padarias", emoji: "🍞" },
  salgados: { label: "Salgados", emoji: "🥐" },
  pastel: { label: "Pastéis", emoji: "🥟" },
  confeitaria: { label: "Confeitaria", emoji: "🍰" },
  acai: { label: "Açaí", emoji: "🍧" },
  sorvete: { label: "Sorvetes", emoji: "🍦" },
  cafe: { label: "Cafés", emoji: "☕" },
  comida_japonesa: { label: "Japonesa", emoji: "🍱" },
  comida_italiana: { label: "Italiana", emoji: "🍝" },
  comida_chinesa: { label: "Chinesa", emoji: "🥢" },
  comida_arabe: { label: "Árabe", emoji: "🥙" },
  comida_mexicana: { label: "Mexicana", emoji: "🌮" },
  frango_assado: { label: "Frango Assado", emoji: "🍗" },
  churrascaria: { label: "Churrascaria", emoji: "🍖" },
  saudavel: { label: "Saudável", emoji: "🥗" },
  vegetariana: { label: "Vegetariana & Vegana", emoji: "🌱" },
  mercado: { label: "Mercados", emoji: "🛒" },
  acougue: { label: "Açougue", emoji: "🥩" },
  hortifruti: { label: "Hortifruti", emoji: "🍇" },
  bebidas: { label: "Bebidas", emoji: "🍺" },
  conveniencia: { label: "Conveniência", emoji: "🏪" },
  queijos_frios: { label: "Queijos & Frios", emoji: "🧀" },
  peixaria: { label: "Peixaria", emoji: "🐟" },
  farmacia: { label: "Farmácias", emoji: "💊" },
  petshop: { label: "Pet Shop", emoji: "🐾" },
  flores: { label: "Flores", emoji: "🌸" },
  tabacaria: { label: "Tabacaria", emoji: "🚬" },
  shopping: { label: "Shopping", emoji: "🛍️" },
  outro: { label: "Outros", emoji: "✨" },
};

const DAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

interface StoreVerticalSidebarProps {
  store: Store;
  isOwner: boolean;
  isFollowing: boolean;
  followLoading: boolean;
  chatLoading: boolean;
  hours?: StoreHours[];
  coupons?: StoreCoupon[];
  slots?: StoreDeliverySlot[];
  onOpenChat: () => void;
  onToggleFollow: () => void;
  onOpenReviews: () => void;
  followersCount?: number | null;
  followingCount?: number | null;
}

export default function StoreVerticalSidebar({
  store,
  isOwner,
  isFollowing,
  followLoading,
  chatLoading,
  hours,
  coupons,
  slots,
  onOpenChat,
  onToggleFollow,
  onOpenReviews,
  followersCount,
  followingCount,
}: StoreVerticalSidebarProps) {
  const [showAllHours, setShowAllHours] = useState(false);

  const categoryInfo = CATEGORY_MAP[store.category] || {
    label: "Outros",
    emoji: "✨",
  };

  const formatDayOfWeek = (day: number) => {
    return DAY_NAMES[day] || `Dia ${day}`;
  };

  const currentDay = new Date().getDay();
  const todayHours = hours?.find((hr) => hr.day_of_week === currentDay);

  return (
    <aside className="lg:col-span-1 lg:sticky top-4 space-y-4">
      {/* Unified Premium Sidebar Panel */}
      <div className="bg-surface border border-card-border overflow-hidden shadow-sm rounded-2xl">
        {/* Store Banner */}
        <div className="relative h-32 w-full bg-gradient-to-r from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900">
          {store.image_banner ? (
            <Image
              src={getImageUrl(store.image_banner)}
              alt={`${store.name} banner`}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-300 dark:text-neutral-700">
              <StoreIcon className="h-10 w-10" />
            </div>
          )}
          {/* Status badge */}
          <div className="absolute top-3 right-3">
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-md ${
                store.is_open
                  ? "bg-emerald-500/90 text-white"
                  : "bg-red-500/90 text-white"
              }`}
            >
              {store.is_open ? "Aberto Agora" : "Fechado"}
            </span>
          </div>
        </div>

        {/* Store Core Details */}
        <div className="p-6 relative pt-8">
          {/* Avatar overlapping banner */}
          <div className="absolute top-0 left-6 -translate-y-1/2 h-16 w-16 rounded-full border-4 border-surface overflow-hidden bg-background shadow-sm flex items-center justify-center">
            {store.avatar ? (
              <Image
                src={getImageUrl(store.avatar)}
                alt={`${store.name} logo`}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="text-2xl">{categoryInfo.emoji}</span>
            )}
          </div>

          {/* Name & Subtitle */}
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {store.name}
            </h1>
            {store.description && (
              <p className="text-xs text-muted-text leading-relaxed">
                {store.description}
              </p>
            )}
          </div>

          {/* Followers / Following Counts */}
          {followersCount !== undefined && followersCount !== null && (
            <div className="flex items-center gap-4 mt-4 text-xs border-t border-card-border/30 pt-3">
              <div>
                <span className="font-bold text-foreground">
                  {followersCount}
                </span>{" "}
                <span className="text-muted-text">seguidores</span>
              </div>
              <div>
                <span className="font-bold text-foreground">
                  {followingCount ?? 0}
                </span>{" "}
                <span className="text-muted-text">seguindo</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!isOwner && (
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={onOpenChat}
                disabled={chatLoading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-neutral-950 hover:bg-neutral-800 dark:bg-neutral-50 dark:hover:bg-neutral-200 active:scale-[0.98] text-white dark:text-neutral-950 font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                {chatLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                <span>Mensagem</span>
              </button>

              <button
                onClick={onToggleFollow}
                disabled={followLoading}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 font-bold text-xs rounded-lg border transition-all cursor-pointer active:scale-[0.98] disabled:opacity-60 ${
                  isFollowing
                    ? "bg-neutral-200 hover:bg-neutral-300 text-neutral-800 border-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-100 dark:border-neutral-700"
                    : "bg-transparent border-card-border text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900"
                }`}
              >
                {followLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isFollowing ? (
                  <UserCheck className="h-3.5 w-3.5 text-neutral-700 dark:text-neutral-300" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5 text-muted-text" />
                )}
                <span>{isFollowing ? "Seguindo" : "Seguir"}</span>
              </button>
            </div>
          )}

          {/* Unified Location & CNPJ Section */}
          <div className="mt-4 pt-4 border-t border-card-border/50 text-[11px] text-muted-text space-y-2">
            {store.street && (
              <div>
                {store.street}, {store.number} - {store.neighborhood},{" "}
                {store.city} - {store.state}
              </div>
            )}
            {store.cnpj && (
              <div className="text-[10px] opacity-80">
                CNPJ:{" "}
                {store.cnpj.replace(/\D/g, "").length === 14
                  ? store.cnpj
                      .replace(/\D/g, "")
                      .replace(
                        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                        "$1.$2.$3/$4-$5",
                      )
                  : store.cnpj}
              </div>
            )}
          </div>
        </div>

        {/* Integrated Stats Section */}
        <div className="border-t border-card-border/50 bg-neutral-50/50 dark:bg-neutral-900/10 grid grid-cols-4 divide-x divide-card-border/40 text-center py-4">
          {/* Rating */}
          <button
            onClick={onOpenReviews}
            className="flex flex-col items-center justify-center px-1 cursor-pointer hover:opacity-85 transition-opacity"
          >
            <div className="flex items-center gap-0.5 text-amber-500 font-bold text-xs">
              <Star className="h-3 w-3 fill-amber-500" />
              <span>
                {store.score != null && Number(store.ratings_count) > 0
                  ? Number(store.score).toFixed(1)
                  : "—"}
              </span>
            </div>
            <span className="text-[9px] text-muted-text uppercase font-semibold tracking-wider mt-1">
              Avaliar
            </span>
          </button>

          {/* Prep Time */}
          <div className="flex flex-col items-center justify-center px-1">
            <span className="text-foreground font-bold text-xs">
              {store.prep_time_minutes || 35} min
            </span>
            <span className="text-[9px] text-muted-text uppercase font-semibold tracking-wider mt-1">
              Tempo
            </span>
          </div>

          {/* Delivery Fee */}
          <div className="flex flex-col items-center justify-center px-1">
            <span className="text-foreground font-bold text-xs">
              {store.delivery_fee === 0 ? "Grátis" : `R$ ${store.delivery_fee}`}
            </span>
            <span className="text-[9px] text-muted-text uppercase font-semibold tracking-wider mt-1">
              Taxa
            </span>
          </div>

          {/* Minimum Order */}
          <div className="flex flex-col items-center justify-center px-1">
            <span className="text-foreground font-bold text-xs">
              R$ {Number(store.minimum_order).toFixed(0)}
            </span>
            <span className="text-[9px] text-muted-text uppercase font-semibold tracking-wider mt-1">
              Mínimo
            </span>
          </div>
        </div>

        {/* Collapsible Operating Hours */}
        {hours && hours.length > 0 && (
          <div className="border-t border-card-border/50 p-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-foreground text-[10px] uppercase tracking-wider">
                Funcionamento
              </span>
              <button
                onClick={() => setShowAllHours(!showAllHours)}
                className="text-[10px] font-semibold text-muted-text hover:text-foreground transition-colors cursor-pointer"
              >
                {showAllHours ? "Ver menos" : "Ver todos"}
              </button>
            </div>

            {!showAllHours ? (
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-foreground/80">Hoje</span>
                {todayHours ? (
                  todayHours.is_closed ? (
                    <span className="text-red-500 font-medium">Fechado</span>
                  ) : (
                    <span className="text-muted-text font-sans">
                      {todayHours.open_time.slice(0, 5)} -{" "}
                      {todayHours.close_time.slice(0, 5)}
                    </span>
                  )
                ) : (
                  <span className="text-muted-text">Sem registro</span>
                )}
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                {hours
                  .sort((a, b) => a.day_of_week - b.day_of_week)
                  .map((hr) => (
                    <div
                      key={hr.id}
                      className="flex justify-between items-center text-xs pb-1 border-b border-card-border/20 last:border-b-0 last:pb-0"
                    >
                      <span
                        className={`font-medium ${
                          hr.day_of_week === currentDay
                            ? "text-foreground font-bold"
                            : "text-foreground/70"
                        }`}
                      >
                        {formatDayOfWeek(hr.day_of_week)}
                        {hr.day_of_week === currentDay && " (Hoje)"}
                      </span>
                      {hr.is_closed ? (
                        <span className="text-red-500 font-medium">
                          Fechado
                        </span>
                      ) : (
                        <span className="text-muted-text font-sans">
                          {hr.open_time.slice(0, 5)} -{" "}
                          {hr.close_time.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Active Coupons Section */}
        {coupons && coupons.length > 0 && (
          <div className="border-t border-card-border/50 p-6 space-y-3">
            <span className="block font-bold text-foreground text-[10px] uppercase tracking-wider">
              Cupons de Desconto
            </span>
            <div className="space-y-2.5">
              {coupons.map((coupon) => (
                <div
                  key={coupon.id}
                  className="bg-neutral-50 dark:bg-neutral-900/30 border border-card-border/60 rounded-xl p-3 flex justify-between items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-foreground text-xs tracking-wider truncate">
                      {coupon.code}
                    </div>
                    <div className="text-[10px] text-muted-text mt-0.5">
                      {coupon.discount_type === "percentage"
                        ? `${coupon.discount_value}% de desconto`
                        : `${formatPrice(coupon.discount_value)} de desconto`}
                    </div>
                    {coupon.min_order > 0 && (
                      <div className="text-[9px] text-muted-text/80 font-sans mt-0.5">
                        Mínimo: {formatPrice(coupon.min_order)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(coupon.code);
                      alert("Cupom copiado!");
                    }}
                    className="text-[10px] font-bold bg-neutral-950 hover:bg-neutral-850 dark:bg-neutral-50 dark:hover:bg-neutral-200 text-white dark:text-neutral-950 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors flex-shrink-0 ml-3"
                  >
                    Copiar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delivery & Agendamento Slots */}
        {slots && slots.length > 0 && (
          <div className="border-t border-card-border/50 p-6 space-y-3">
            <span className="block font-bold text-foreground text-[10px] uppercase tracking-wider">
              Horários de Entrega
            </span>
            <div className="space-y-2">
              {slots
                .filter((s) => s.is_active)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((slot) => (
                  <div
                    key={slot.id}
                    className="bg-neutral-50/40 dark:bg-neutral-900/10 border border-card-border/40 rounded-xl p-2.5 flex justify-between items-center text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground/80 font-sans">
                        {slot.start_time.slice(0, 5)} às{" "}
                        {slot.end_time.slice(0, 5)}
                      </div>
                      <div className="text-[9px] text-muted-text uppercase font-semibold mt-0.5">
                        {slot.fulfillment_type === "entrega"
                          ? "Apenas Entrega"
                          : slot.fulfillment_type === "retirada"
                            ? "Apenas Retirada"
                            : "Entrega e Retirada"}
                      </div>
                    </div>
                    <div className="text-right font-bold text-foreground font-sans">
                      {slot.fee === 0 ? "Grátis" : formatPrice(slot.fee)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
