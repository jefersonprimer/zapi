import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Store as StoreIcon,
  ChevronRight,
  Clock,
  Star,
  Tag,
  Motorbike,
} from "lucide-react";
import { type Store } from "@/lib/api";
import { slugify, getImageUrl } from "@/lib/utils";

interface StoreCardProps {
  item: Store;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

function formatEta(min: number): string {
  if (min <= 20) return "15–25 min";
  if (min <= 30) return "25–35 min";
  if (min <= 40) return "35–45 min";
  if (min <= 55) return "45–60 min";
  return `${min} min`;
}

function isStoreOpenNow(store: Store): boolean {
  if (!store.is_open) return false;
  if (!store.hours || store.hours.length === 0) {
    return store.is_open;
  }

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const todayKey = now.getDay();
  const todayH = store.hours.find((h) => h.day_of_week === todayKey);

  if (todayH && !todayH.is_closed) {
    try {
      const [oh, om] = todayH.open_time.split(":").map(Number);
      const [ch, cm] = todayH.close_time.split(":").map(Number);
      const openMins = oh * 60 + om;
      const closeMins = ch * 60 + cm;

      return currentMins >= openMins && currentMins < closeMins;
    } catch {
      return store.is_open;
    }
  }

  return false;
}

export default function StoreCard({ item }: StoreCardProps) {
  const isOpen = isStoreOpenNow(item);
  const citySlug = slugify(item.city);
  const storeSlug = slugify(item.name);

  return (
    <Link
      href={`/delivery/${citySlug}/${storeSlug}`}
      className="group flex flex-row items-center p-3 rounded-xl border border-card-border bg-card-bg mb-2.5 transition-all duration-300 hover:border-neutral-400 dark:hover:border-neutral-500 hover:shadow-md cursor-pointer w-full text-left"
    >
      {item.avatar ? (
        <Image
          src={getImageUrl(item.avatar)}
          alt={`${item.name} logo`}
          width={78}
          height={78}
          className="w-[78px] h-[78px] rounded-2xl object-cover flex-shrink-0"
          unoptimized
        />
      ) : (
        <div className="w-[78px] h-[78px] rounded-2xl bg-surface flex items-center justify-center flex-shrink-0 text-muted-text border border-card-border">
          <StoreIcon className="w-8 h-8 text-muted-text" />
        </div>
      )}

      <div className="flex-grow ml-3 min-w-0 flex flex-col justify-between py-0.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-base font-semibold text-foreground truncate group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors leading-snug">
            {item.name}
          </span>
          <div className="flex flex-row flex-wrap items-center gap-1.5">
            <div
              className={`flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                isOpen
                  ? "bg-emerald-100/70 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/40"
                  : "bg-rose-100/70 text-rose-800 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/40"
              }`}
            >
              {isOpen ? "Aberto" : "Fechado"}
            </div>

            <div className="flex flex-row items-center bg-neutral-100 dark:bg-neutral-800/80 px-1.5 py-0.5 rounded border border-card-border">
              <span className="text-[11px] font-bold text-foreground">
                {item.score && Number(item.ratings_count) > 0 ? (
                  <div className="flex items-center gap-0.5">
                    <Star className="w-[11px] h-[11px] text-amber-500 fill-amber-500" />
                    {Number(item.score).toFixed(1)}
                  </div>
                ) : (
                  "Novo"
                )}
              </span>
            </div>

            {item.has_coupons && (
              <div className="flex flex-row items-center bg-neutral-100 dark:bg-neutral-800/80 px-1.5 py-0.5 rounded border border-card-border gap-1">
                <Tag className="w-2.5 h-2.5 text-foreground" />
                <span className="text-[10px] font-bold text-foreground">
                  Cupom
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-row items-center flex-wrap gap-2.5 mt-1 text-[12px] text-muted-text">
          {item.eta_min != null && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-text" />
              <span>{formatEta(item.eta_min)}</span>
            </div>
          )}
          {item.distance_km != null && (
            <div className="flex items-center gap-1">
              <Motorbike className="w-3 h-3 text-muted-text" />
              <span>{formatDistance(item.distance_km)}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            {item.delivery_fee === 0 && (
              <Motorbike className="w-3 h-3 text-muted-text" />
            )}
            <span>
              {item.delivery_fee === 0
                ? "Entrega grátis"
                : `R$ ${item.delivery_fee.toFixed(2)}`}
            </span>
          </div>
        </div>
      </div>

      <ChevronRight className="w-5 h-5 text-muted-text group-hover:text-foreground group-hover:translate-x-0.5 transition-all ml-auto flex-shrink-0" />
    </Link>
  );
}

export function StoreCardSkeleton() {
  return (
    <div className="flex flex-row items-center p-3 rounded-xl border border-card-border bg-card-bg mb-2.5 animate-pulse w-full">
      <div className="w-[78px] h-[78px] rounded-2xl bg-surface border border-card-border flex-shrink-0" />
      <div className="flex-1 ml-3 min-w-0">
        <div className="flex flex-col gap-2">
          <div className="h-4 bg-surface rounded w-[65%]" />
          <div className="flex flex-row gap-1.5">
            <div className="h-4 bg-surface rounded w-[55px]" />
            <div className="h-4 bg-surface rounded w-[40px]" />
          </div>
          <div className="flex flex-row gap-2.5 mt-1">
            <div className="h-3.5 bg-surface rounded w-[55px]" />
            <div className="h-3.5 bg-surface rounded w-[45px]" />
            <div className="h-3.5 bg-surface rounded w-[65px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
