"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  authFetch,
  API_URL,
  Store,
  StoreHours,
  StoreDeliverySlot,
  WEEKDAYS,
} from "@/lib/api";
import {
  Save,
  AlertCircle,
  CheckCircle2,
  Check,
  Loader2,
  Coffee,
  Plus,
  Edit,
  Trash2,
  X,
  Settings2,
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

const FULFILLMENT_LABELS: Record<string, string> = {
  entrega: "Entrega",
  retirada: "Retirada",
  ambos: "Ambos",
};

interface SlotForm {
  start_time: string;
  end_time: string;
  fee: string;
  fulfillment_type: string;
  is_active: boolean;
  sort_order: string;
}

const EMPTY_SLOT: SlotForm = {
  start_time: "09:00",
  end_time: "10:00",
  fee: "0",
  fulfillment_type: "ambos",
  is_active: true,
  sort_order: "0",
};

function HorariosContent() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "slots" ? "slots" : "funcionamento";

  const setActiveTab = (tab: "funcionamento" | "slots") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Tab 1: Funcionamento State
  const [hours, setHours] = useState<HoursForm[]>(DEFAULT_HOURS);
  const [savingHour, setSavingHour] = useState<number | null>(null);
  const [savingAllHours, setSavingAllHours] = useState(false);
  const [successHour, setSuccessHour] = useState<number | null>(null);

  // Tab 2: Slots State
  const [slots, setSlots] = useState<StoreDeliverySlot[]>([]);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState<SlotForm>(EMPTY_SLOT);
  const [savingSlot, setSavingSlot] = useState(false);
  const [deletingSlot, setDeletingSlot] = useState<string | null>(null);
  const [deleteSlotTarget, setDeleteSlotTarget] =
    useState<StoreDeliverySlot | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
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
        token,
      );
      const s: Store | null = storeData.store;
      setStore(s);

      if (s) {
        // Load Hours
        const hoursData = await authFetch(
          `${API_URL}/delivery/stores/${s.id}/hours`,
          token,
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

        // Load Slots
        const slotData = await authFetch(
          `${API_URL}/delivery/stores/${s.id}/slots`,
          token,
        );
        setSlots(slotData.slots || []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar informações");
      showToast("Erro ao carregar dados", "error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // --- Funcionamento (Tab 1) Handlers ---
  async function saveDay(dayIndex: number) {
    if (!token || !store) return;
    const day = hours[dayIndex];
    setSavingHour(dayIndex);
    setError(null);
    setSuccessHour(null);
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
        { method: "POST", body: JSON.stringify(body) },
      );
      const updated: StoreHours = data.hours;
      setHours((prev) =>
        prev.map((h, i) =>
          i === dayIndex ? { ...h, existing_id: updated.id } : h,
        ),
      );
      setSuccessHour(dayIndex);
      showToast(`Horário de ${WEEKDAYS[dayIndex].label} salvo com sucesso!`);
      setTimeout(() => setSuccessHour(null), 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar horário";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSavingHour(null);
    }
  }

  async function saveAllHours() {
    if (!token || !store) return;
    setSavingAllHours(true);
    setError(null);
    try {
      for (const day of hours) {
        await authFetch(`${API_URL}/delivery/stores/${store.id}/hours`, token, {
          method: "POST",
          body: JSON.stringify({
            day_of_week: day.day_of_week,
            open_time: day.open_time,
            close_time: day.close_time,
            is_closed: day.is_closed,
          }),
        });
      }
      await loadData();
      setSuccessHour(99);
      showToast("Todos os horários de funcionamento foram salvos!");
      setTimeout(() => setSuccessHour(null), 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar horários";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSavingAllHours(false);
    }
  }

  function updateDay(
    field: keyof HoursForm,
    value: string | boolean,
    index: number,
  ) {
    setHours((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)),
    );
  }

  // --- Slots (Tab 2) Handlers ---
  function openCreateSlot() {
    setSlotForm({ ...EMPTY_SLOT, sort_order: String(slots.length) });
    setEditingSlotId(null);
    setShowSlotForm(true);
  }

  function openEditSlot(slot: StoreDeliverySlot) {
    setSlotForm({
      start_time: slot.start_time,
      end_time: slot.end_time,
      fee: String(slot.fee),
      fulfillment_type: slot.fulfillment_type,
      is_active: slot.is_active,
      sort_order: String(slot.sort_order),
    });
    setEditingSlotId(slot.id);
    setShowSlotForm(true);
  }

  async function handleSlotSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !store) return;
    setSavingSlot(true);
    setError(null);
    try {
      const body = {
        start_time: slotForm.start_time,
        end_time: slotForm.end_time,
        fee: parseFloat(slotForm.fee) || 0,
        fulfillment_type: slotForm.fulfillment_type,
        is_active: slotForm.is_active,
        sort_order: parseInt(slotForm.sort_order) || 0,
      };

      if (editingSlotId) {
        await authFetch(
          `${API_URL}/delivery/stores/${store.id}/slots/${editingSlotId}`,
          token,
          { method: "PUT", body: JSON.stringify(body) },
        );
        showToast("Slot de entrega atualizado com sucesso!");
      } else {
        await authFetch(`${API_URL}/delivery/stores/${store.id}/slots`, token, {
          method: "POST",
          body: JSON.stringify(body),
        });
        showToast("Novo slot de entrega criado!");
      }
      setShowSlotForm(false);
      setEditingSlotId(null);
      await loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar slot";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSavingSlot(false);
    }
  }

  async function handleSlotDelete() {
    if (!token || !store || !deleteSlotTarget) return;
    setDeletingSlot(deleteSlotTarget.id);
    setError(null);
    try {
      await authFetch(
        `${API_URL}/delivery/stores/${store.id}/slots/${deleteSlotTarget.id}`,
        token,
        { method: "DELETE" },
      );
      showToast("Slot de entrega excluído.");
      setDeleteSlotTarget(null);
      await loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao excluir slot";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setDeletingSlot(null);
    }
  }

  async function handleToggleSlotActive(slot: StoreDeliverySlot) {
    if (!token || !store) return;
    try {
      await authFetch(
        `${API_URL}/delivery/stores/${store.id}/slots/${slot.id}`,
        token,
        {
          method: "PUT",
          body: JSON.stringify({ is_active: !slot.is_active }),
        },
      );
      showToast(
        !slot.is_active
          ? "Slot ativado com sucesso!"
          : "Slot desativado temporariamente.",
      );
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao alternar status");
      showToast("Erro ao alternar status do slot", "error");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-100 dark:border-emerald-950/30" />
          <div className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
          Carregando informações...
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
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Loja Não Encontrada
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Você precisa configurar sua loja antes de gerenciar seus horários.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto px-1 md:px-0">
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {activeTab === "funcionamento"
                ? "Horários de Funcionamento"
                : "Slots e Taxas de Entrega"}
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {activeTab === "funcionamento"
              ? "Determine os turnos e os dias de funcionamento da sua loja para receber pedidos."
              : "Configure e gerencie as janelas de horários disponíveis e taxas de entrega para seus clientes."}
          </p>
        </div>

        {activeTab === "funcionamento" ? (
          <button
            onClick={saveAllHours}
            disabled={savingAllHours}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm shadow-emerald-600/10 cursor-pointer active:scale-98 disabled:opacity-50"
          >
            <span>Salvar Horários</span>
          </button>
        ) : (
          <button
            onClick={openCreateSlot}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/10 cursor-pointer active:scale-98"
          >
            <Plus className="h-4.5 w-4.5" />
            Novo Slot
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("funcionamento")}
          className={`flex-1 sm:flex-none px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${
            activeTab === "funcionamento"
              ? "border-emerald-500 text-slate-900 dark:text-white"
              : "border-transparent text-slate-400 hover:text-slate-650 dark:text-slate-500 dark:hover:text-slate-400"
          }`}
        >
          <span>Funcionamento</span>
        </button>
        <button
          onClick={() => setActiveTab("slots")}
          className={`flex-1 sm:flex-none px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${
            activeTab === "slots"
              ? "border-emerald-500 text-slate-900 dark:text-white"
              : "border-transparent text-slate-400 hover:text-slate-650 dark:text-slate-500 dark:hover:text-slate-400"
          }`}
        >
          <span>Entrega</span>
        </button>
      </div>

      {/* Tab Content 1: Funcionamento */}
      {activeTab === "funcionamento" && (
        <div className="space-y-2">
          {hours.map((day, i) => (
            <div
              key={day.day_of_week}
              className={`bg-white dark:bg-slate-900 rounded-xl border p-4 transition-all ${
                successHour === i
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
                        onChange={(e) =>
                          updateDay("open_time", e.target.value, i)
                        }
                        className="border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-semibold"
                      />
                    </div>
                    <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      até
                    </span>
                    <div className="relative">
                      <input
                        type="time"
                        value={day.close_time}
                        onChange={(e) =>
                          updateDay("close_time", e.target.value, i)
                        }
                        className="border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-semibold"
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
                  disabled={savingHour === i}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-450 hover:bg-emerald-50 dark:hover:bg-emerald-950/25 transition-all disabled:opacity-50 cursor-pointer w-full sm:w-auto"
                >
                  {savingHour === i ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : successHour === i ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {savingHour === i
                      ? "Salvando..."
                      : successHour === i
                        ? "Salvo"
                        : "Salvar"}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content 2: Slots de Entrega */}
      {activeTab === "slots" && (
        <div className="space-y-6">
          {/* Form Area */}
          {showSlotForm && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 p-6 shadow-xs animate-in slide-in-from-top-3 duration-250">
              <div className="flex items-center justify-between pb-3 mb-5 border-b border-slate-100 dark:border-slate-850">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingSlotId
                    ? "Editar Slot de Horário"
                    : "Novo Slot de Horário"}
                </h3>
                <button
                  onClick={() => {
                    setShowSlotForm(false);
                    setEditingSlotId(null);
                  }}
                  className="p-1 rounded-lg text-slate-450 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800/40 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSlotSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Horário Início *
                    </label>
                    <input
                      type="time"
                      required
                      value={slotForm.start_time}
                      onChange={(e) =>
                        setSlotForm({ ...slotForm, start_time: e.target.value })
                      }
                      className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Horário Fim *
                    </label>
                    <input
                      type="time"
                      required
                      value={slotForm.end_time}
                      onChange={(e) =>
                        setSlotForm({ ...slotForm, end_time: e.target.value })
                      }
                      className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Taxa do Slot (R$)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={slotForm.fee}
                      onChange={(e) =>
                        setSlotForm({ ...slotForm, fee: e.target.value })
                      }
                      className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Modalidade
                    </label>
                    <select
                      value={slotForm.fulfillment_type}
                      onChange={(e) =>
                        setSlotForm({
                          ...slotForm,
                          fulfillment_type: e.target.value,
                        })
                      }
                      className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none cursor-pointer transition-all"
                    >
                      <option value="ambos">Ambos (Entrega & Retirada)</option>
                      <option value="entrega">Apenas Entrega</option>
                      <option value="retirada">Apenas Retirada</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Ordem de Exibição
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={slotForm.sort_order}
                      onChange={(e) =>
                        setSlotForm({ ...slotForm, sort_order: e.target.value })
                      }
                      className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="pt-1.5 pb-2">
                  <label className="flex items-center gap-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={slotForm.is_active}
                      onChange={(e) =>
                        setSlotForm({
                          ...slotForm,
                          is_active: e.target.checked,
                        })
                      }
                      className="w-4.5 h-4.5 rounded border-slate-350 dark:border-slate-750 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 focus:ring-2 cursor-pointer transition-colors"
                    />
                    <span>Slot Ativo</span>
                  </label>
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-850">
                  <button
                    type="submit"
                    disabled={savingSlot}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-650 text-white px-4 py-2.5 text-sm font-bold transition-all shadow-sm shadow-emerald-600/10 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    <span>
                      {savingSlot
                        ? "Salvando..."
                        : editingSlotId
                          ? "Salvar Slot"
                          : "Criar Slot"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSlotForm(false);
                      setEditingSlotId(null);
                    }}
                    className="px-4 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-850/40 cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Slots List */}
          {slots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-250 dark:border-slate-800 py-16 text-center text-sm text-slate-450 dark:text-slate-650 bg-white dark:bg-slate-900 shadow-xs animate-in">
              <Settings2 className="w-12 h-12 text-slate-300 dark:text-slate-800 mx-auto mb-3" />
              <p className="font-semibold text-slate-700 dark:text-slate-350">
                Nenhum slot de horário cadastrado.
              </p>
              <p className="text-xs text-slate-450 dark:text-slate-500 mt-1 max-w-xs mx-auto">
                Defina faixas de horários de funcionamento específicos e
                configure taxas extras para turnos diferentes.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 overflow-hidden shadow-xs">
              {/* Table Header */}
              <div className="hidden sm:grid grid-cols-[1fr_1fr_80px_130px_80px_160px] gap-4 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-850">
                <span>Início</span>
                <span>Fim</span>
                <span>Taxa Extra</span>
                <span>Modalidade</span>
                <span>Ordem</span>
                <span className="text-right">Ações</span>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-slate-100 dark:divide-slate-850">
                {slots.map((slot) => (
                  <div
                    key={slot.id}
                    className={`grid grid-cols-1 sm:grid-cols-[1fr_1fr_80px_130px_80px_160px] gap-3 sm:gap-4 px-6 py-4 items-center transition-colors hover:bg-slate-50/45 dark:hover:bg-slate-800/10 ${
                      !slot.is_active ? "opacity-55" : ""
                    }`}
                  >
                    <div>
                      <span className="sm:hidden text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mr-2">
                        Início:
                      </span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {slot.start_time}
                      </span>
                    </div>
                    <div>
                      <span className="sm:hidden text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mr-2">
                        Fim:
                      </span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {slot.end_time}
                      </span>
                    </div>
                    <div>
                      <span className="sm:hidden text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mr-2">
                        Taxa:
                      </span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-350">
                        R$ {slot.fee.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="sm:hidden text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mr-2">
                        Tipo:
                      </span>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                          slot.fulfillment_type === "entrega"
                            ? "bg-blue-50 dark:bg-blue-950/25 text-blue-700 dark:text-blue-450 border border-blue-105"
                            : slot.fulfillment_type === "retirada"
                              ? "bg-amber-50 dark:bg-amber-950/25 text-amber-700 dark:text-amber-450 border border-amber-105"
                              : "bg-purple-50 dark:bg-purple-950/25 text-purple-700 dark:text-purple-450 border border-purple-105"
                        }`}
                      >
                        {FULFILLMENT_LABELS[slot.fulfillment_type] ||
                          slot.fulfillment_type}
                      </span>
                    </div>
                    <div>
                      <span className="sm:hidden text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mr-2">
                        Ordem:
                      </span>
                      <span className="text-sm font-mono text-slate-400 dark:text-slate-500">
                        {slot.sort_order}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-50 dark:border-slate-850">
                      <button
                        onClick={() => handleToggleSlotActive(slot)}
                        className={`text-xs px-2.5 py-1.5 font-bold rounded-lg transition-colors cursor-pointer border ${
                          slot.is_active
                            ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 border-transparent"
                            : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border-transparent"
                        }`}
                      >
                        {slot.is_active ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        onClick={() => openEditSlot(slot)}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 font-bold rounded-lg text-slate-650 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border border-transparent cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                      <button
                        onClick={() => setDeleteSlotTarget(slot)}
                        disabled={deletingSlot === slot.id}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 font-bold rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 transition-colors border border-transparent cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Excluir</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DELETE CONFIRMATION MODAL */}
          {deleteSlotTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
              <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center text-rose-500 mb-4 border border-rose-100 dark:border-rose-900/30">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Excluir Slot
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Tem certeza que deseja excluir o slot de{" "}
                  <strong>
                    {deleteSlotTarget.start_time} às {deleteSlotTarget.end_time}
                  </strong>
                  ? Esta ação não pode ser desfeita.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setDeleteSlotTarget(null)}
                    className="flex-1 rounded-lg border border-slate-250 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSlotDelete}
                    disabled={deletingSlot === deleteSlotTarget.id}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer shadow-sm shadow-rose-600/10 active:scale-98 disabled:opacity-50"
                  >
                    {deletingSlot === deleteSlotTarget.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4.5 w-4.5" />
                    )}
                    <span>
                      {deletingSlot === deleteSlotTarget.id
                        ? "Excluindo..."
                        : "Excluir"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HorariosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-100 dark:border-emerald-950/30" />
            <div className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
            Carregando informações...
          </p>
        </div>
      }
    >
      <HorariosContent />
    </Suspense>
  );
}
