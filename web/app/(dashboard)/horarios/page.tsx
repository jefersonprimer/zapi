"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { authFetch, API_URL, Store, StoreHours, WEEKDAYS } from "@/lib/api";
import {
  Clock,
  Save,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Check,
  Loader2,
  Coffee,
  X
} from "lucide-react";

interface HoursForm {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  existing_id?: string;
}

const DEFAULT_HOURS: HoursForm[] = WEEKDAYS.map((day) => ({
  day_of_week: day.key,
  open_time: "08:00",
  close_time: "18:00",
  is_closed: false,
  existing_id: undefined,
}));

export default function HorariosPage() {
  const { token } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [hours, setHours] = useState<HoursForm[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<number | null>(null);
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
        const hoursData = await authFetch(
          `${API_URL}/delivery/stores/${s.id}/hours`,
          token
        );
        const existing: StoreHours[] = hoursData.hours || [];
        const merged = DEFAULT_HOURS.map((def) => {
          const found = existing.find((h) => h.day_of_week === def.day_of_week);
          if (found) {
            return {
              day_of_week: found.day_of_week,
              open_time: found.open_time,
              close_time: found.close_time,
              is_closed: found.is_closed,
              existing_id: found.id,
            };
          }
          return { ...def };
        });
        setHours(merged);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar horários");
      showToast("Erro ao carregar horários", "error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  async function saveDay(dayIndex: number) {
    if (!token || !store) return;
    const day = hours[dayIndex];
    setSaving(dayIndex);
    setError(null);
    setSuccess(null);
    try {
      const body = {
        day_of_week: day.day_of_week,
        open_time: day.open_time,
        close_time: day.close_time,
        is_closed: day.is_closed,
      };
      const data = await authFetch(
        `${API_URL}/delivery/stores/${store.id}/hours`,
        token,
        { method: "POST", body: JSON.stringify(body) }
      );
      const updated: StoreHours = data.hours;
      setHours((prev) =>
        prev.map((h, i) =>
          i === dayIndex
            ? { ...h, existing_id: updated.id }
            : h
        )
      );
      setSuccess(dayIndex);
      showToast(`Horário de ${WEEKDAYS[dayIndex].label} salvo com sucesso!`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar horário";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(null);
    }
  }

  async function saveAll() {
    if (!token || !store) return;
    setSavingAll(true);
    setError(null);
    try {
      for (const day of hours) {
        await authFetch(
          `${API_URL}/delivery/stores/${store.id}/hours`,
          token,
          {
            method: "POST",
            body: JSON.stringify({
              day_of_week: day.day_of_week,
              open_time: day.open_time,
              close_time: day.close_time,
              is_closed: day.is_closed,
            }),
          }
        );
      }
      await loadData();
      setSuccess(99);
      showToast("Todos os horários de funcionamento foram salvos!");
      setTimeout(() => setSuccess(null), 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar horários";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSavingAll(false);
    }
  }

  function updateDay(field: keyof HoursForm, value: string | boolean, index: number) {
    setHours((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h))
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-100 dark:border-emerald-950/30" />
          <div className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
          Carregando seus horários...
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
          Você precisa configurar sua loja antes de gerenciar os horários de funcionamento.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Horários</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/25">
              Semanal
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Determine os turnos e os dias de funcionamento da sua loja para receber pedidos.
          </p>
        </div>
        <button
          onClick={saveAll}
          disabled={savingAll}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm shadow-emerald-600/10 cursor-pointer active:scale-98 disabled:opacity-50"
        >
          {savingAll ? (
            <Loader2 className="w-4 h-4 animate-spin animate-infinite" />
          ) : (
            <Save className="w-4.5 h-4.5" />
          )}
          <span>Salvar Tudo</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Schedules Stack */}
      <div className="space-y-3">
        {hours.map((day, i) => (
          <div
            key={day.day_of_week}
            className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 transition-all ${
              success === i
                ? "border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/15 shadow-sm"
                : "border-slate-200 dark:border-slate-850"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              
              {/* Day selection */}
              <div className="flex items-center gap-3 sm:w-44">
                <label className="flex items-center gap-3 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={!day.is_closed}
                    onChange={(e) =>
                      updateDay("is_closed", !e.target.checked, i)
                    }
                    className="w-4.5 h-4.5 rounded border-slate-350 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 focus:ring-2 cursor-pointer transition-colors"
                  />
                  <span className="text-sm font-bold text-slate-850 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    {WEEKDAYS[i].label}
                  </span>
                </label>
              </div>

              {/* Time Fields */}
              {!day.is_closed ? (
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="relative">
                    <input
                      type="time"
                      value={day.open_time}
                      onChange={(e) => updateDay("open_time", e.target.value, i)}
                      className="border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-semibold"
                    />
                  </div>
                  <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wider">até</span>
                  <div className="relative">
                    <input
                      type="time"
                      value={day.close_time}
                      onChange={(e) => updateDay("close_time", e.target.value, i)}
                      className="border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-semibold"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-650 italic text-sm flex-1">
                  <Coffee className="w-4 h-4 shrink-0 text-slate-355 dark:text-slate-700" />
                  <span>Fechado / Descanso</span>
                </div>
              )}

              {/* Individual save action */}
              <button
                onClick={() => saveDay(i)}
                disabled={saving === i}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-450 hover:bg-emerald-50 dark:hover:bg-emerald-950/25 transition-all disabled:opacity-50 cursor-pointer w-full sm:w-auto"
              >
                {saving === i ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : success === i ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{saving === i ? "Salvando..." : success === i ? "Salvo" : "Salvar"}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
