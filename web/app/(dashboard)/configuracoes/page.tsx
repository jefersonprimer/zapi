"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { authFetch, API_URL, Store, StoreDeliverySlot } from "@/lib/api";
import {
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Check,
  Loader2,
  Settings2
} from "lucide-react";

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

export default function SlotsPage() {
  const { token } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [slots, setSlots] = useState<StoreDeliverySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SlotForm>(EMPTY_SLOT);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreDeliverySlot | null>(null);
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
        const slotData = await authFetch(
          `${API_URL}/delivery/stores/${s.id}/slots`,
          token
        );
        setSlots(slotData.slots || []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar slots");
      showToast("Erro ao carregar slots", "error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  function openCreate() {
    setForm({ ...EMPTY_SLOT, sort_order: String(slots.length) });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(slot: StoreDeliverySlot) {
    setForm({
      start_time: slot.start_time,
      end_time: slot.end_time,
      fee: String(slot.fee),
      fulfillment_type: slot.fulfillment_type,
      is_active: slot.is_active,
      sort_order: String(slot.sort_order),
    });
    setEditingId(slot.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !store) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        start_time: form.start_time,
        end_time: form.end_time,
        fee: parseFloat(form.fee) || 0,
        fulfillment_type: form.fulfillment_type,
        is_active: form.is_active,
        sort_order: parseInt(form.sort_order) || 0,
      };

      if (editingId) {
        await authFetch(
          `${API_URL}/delivery/stores/${store.id}/slots/${editingId}`,
          token,
          { method: "PUT", body: JSON.stringify(body) }
        );
        showToast("Slot de entrega atualizado com sucesso!");
      } else {
        await authFetch(
          `${API_URL}/delivery/stores/${store.id}/slots`,
          token,
          { method: "POST", body: JSON.stringify(body) }
        );
        showToast("Novo slot de entrega criado!");
      }
      setShowForm(false);
      setEditingId(null);
      await loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar slot";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !store || !deleteTarget) return;
    setDeleting(deleteTarget.id);
    setError(null);
    try {
      await authFetch(
        `${API_URL}/delivery/stores/${store.id}/slots/${deleteTarget.id}`,
        token,
        { method: "DELETE" }
      );
      showToast("Slot de entrega excluído.");
      setDeleteTarget(null);
      await loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao excluir slot";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleActive(slot: StoreDeliverySlot) {
    if (!token || !store) return;
    try {
      await authFetch(
        `${API_URL}/delivery/stores/${store.id}/slots/${slot.id}`,
        token,
        {
          method: "PUT",
          body: JSON.stringify({ is_active: !slot.is_active }),
        }
      );
      showToast(
        !slot.is_active
          ? "Slot ativado com sucesso!"
          : "Slot desativado temporariamente."
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
          Carregando slots de entrega...
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
          Você precisa configurar sua loja antes de gerenciar os slots de entrega.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
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
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Configurações</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/25">
              {slots.length} slot{slots.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure e gerencie os slots de horários e as taxas de entrega para seus clientes.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/10 cursor-pointer active:scale-98"
        >
          <Plus className="h-4.5 w-4.5" />
          Novo Slot
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Form Area */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-850 p-6 shadow-xs animate-in slide-in-from-top-3 duration-250">
          <div className="flex items-center justify-between pb-3 mb-5 border-b border-slate-100 dark:border-slate-850">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {editingId ? "Editar Slot de Horário" : "Novo Slot de Horário"}
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="p-1 rounded-lg text-slate-450 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800/40 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Horário Início *
                </label>
                <input
                  type="time"
                  required
                  value={form.start_time}
                  onChange={(e) =>
                    setForm({ ...form, start_time: e.target.value })
                  }
                  className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Horário Fim *
                </label>
                <input
                  type="time"
                  required
                  value={form.end_time}
                  onChange={(e) =>
                    setForm({ ...form, end_time: e.target.value })
                  }
                  className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-semibold"
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
                  value={form.fee}
                  onChange={(e) =>
                    setForm({ ...form, fee: e.target.value })
                  }
                  className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Modalidade
                </label>
                <select
                  value={form.fulfillment_type}
                  onChange={(e) =>
                    setForm({ ...form, fulfillment_type: e.target.value })
                  }
                  className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none cursor-pointer transition-all"
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
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm({ ...form, sort_order: e.target.value })
                  }
                  className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="pt-1.5 pb-2">
              <label className="flex items-center gap-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                  className="w-4.5 h-4.5 rounded border-slate-350 dark:border-slate-750 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 focus:ring-2 cursor-pointer transition-colors"
                />
                <span>Slot Ativo</span>
              </label>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-850">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-650 text-white px-5 py-2.5 text-sm font-bold transition-all shadow-sm shadow-emerald-600/10 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{saving ? "Salvando..." : editingId ? "Salvar Slot" : "Criar Slot"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="px-5 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850/40 cursor-pointer transition-colors"
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
            Defina faixas de horários de funcionamento específicos e configure taxas extras para turnos diferentes.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-850 overflow-hidden shadow-xs">
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
                  <span className="sm:hidden text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mr-2">Início:</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {slot.start_time}
                  </span>
                </div>
                <div>
                  <span className="sm:hidden text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mr-2">Fim:</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {slot.end_time}
                  </span>
                </div>
                <div>
                  <span className="sm:hidden text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mr-2">Taxa:</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-350">
                    R$ {slot.fee.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="sm:hidden text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mr-2">Tipo:</span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                      slot.fulfillment_type === "entrega"
                        ? "bg-blue-50 dark:bg-blue-950/25 text-blue-700 dark:text-blue-450 border border-blue-105"
                        : slot.fulfillment_type === "retirada"
                        ? "bg-amber-50 dark:bg-amber-950/25 text-amber-700 dark:text-amber-450 border border-amber-105"
                        : "bg-purple-50 dark:bg-purple-950/25 text-purple-700 dark:text-purple-450 border border-purple-105"
                    }`}
                  >
                    {FULFILLMENT_LABELS[slot.fulfillment_type] || slot.fulfillment_type}
                  </span>
                </div>
                <div>
                  <span className="sm:hidden text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mr-2">Ordem:</span>
                  <span className="text-sm font-mono text-slate-400 dark:text-slate-500">{slot.sort_order}</span>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1.5 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-50 dark:border-slate-850">
                  <button
                    onClick={() => handleToggleActive(slot)}
                    className={`text-xs px-2.5 py-1.5 font-bold rounded-lg transition-colors cursor-pointer border ${
                      slot.is_active
                        ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 border-transparent"
                        : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border-transparent"
                    }`}
                  >
                    {slot.is_active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => openEdit(slot)}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 font-bold rounded-lg text-slate-650 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border border-transparent cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(slot)}
                    disabled={deleting === slot.id}
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
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center text-rose-500 mb-4 border border-rose-100 dark:border-rose-900/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Excluir Slot</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Tem certeza que deseja excluir o slot de <strong>{deleteTarget.start_time} às {deleteTarget.end_time}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-slate-250 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting === deleteTarget.id}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer shadow-sm shadow-rose-600/10 active:scale-98 disabled:opacity-50"
              >
                {deleting === deleteTarget.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4.5 w-4.5" />
                )}
                <span>{deleting === deleteTarget.id ? "Excluindo..." : "Excluir"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
