"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  formatProductPrice,
  StoreCoupon,
  getVendorStore,
  listStoreCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from "@/lib/api";
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Check,
  Loader2,
  Calendar,
  Layers,
  Copy,
  Clock,
  Sparkles,
} from "lucide-react";

interface CouponFormData {
  code: string;
  discount_type: string;
  discount_value: string;
  min_order: string;
  max_uses: string;
  applies_to: string;
  category: string;
  expires_at: string;
}

const EMPTY_FORM: CouponFormData = {
  code: "",
  discount_type: "percentage",
  discount_value: "",
  min_order: "",
  max_uses: "",
  applies_to: "all",
  category: "",
  expires_at: "",
};

export default function CuponsPage() {
  const { token } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<StoreCoupon | null>(null);
  const [form, setForm] = useState<CouponFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<StoreCoupon | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { store } = await getVendorStore(token);
      if (!store) {
        setLoading(false);
        return;
      }
      setStoreId(store.id);
      const { coupons: list } = await listStoreCoupons(token, store.id);
      setCoupons(list);
    } catch (err) {
      console.error(err);
      showToast("Erro ao carregar cupons", "error");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      await Promise.resolve();
      if (active) {
        load();
      }
    };
    init();
    return () => {
      active = false;
    };
  }, [load]);

  const openCreateForm = () => {
    setEditingCoupon(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (c: StoreCoupon) => {
    setEditingCoupon(c);
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      min_order: c.min_order ? String(c.min_order) : "",
      max_uses: c.max_uses != null ? String(c.max_uses) : "",
      applies_to: c.applies_to,
      category: c.category || "",
      expires_at: c.expires_at
        ? new Date(c.expires_at).toISOString().slice(0, 16)
        : "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!token || !storeId) return;
    if (!form.code.trim()) {
      showToast("Código do cupom é obrigatório", "error");
      return;
    }
    const discountValue = parseFloat(form.discount_value);
    if (isNaN(discountValue) || discountValue <= 0) {
      showToast("O valor do desconto deve ser maior que zero", "error");
      return;
    }
    setSaving(true);
    try {
      const data = {
        code: form.code.trim().toUpperCase(),
        discount_type: form.discount_type,
        discount_value: discountValue,
        min_order: form.min_order ? parseFloat(form.min_order) : 0,
        max_uses: form.max_uses ? parseInt(form.max_uses) : undefined,
        applies_to: form.applies_to,
        category:
          form.applies_to === "category"
            ? form.category || undefined
            : undefined,
        expires_at: form.expires_at
          ? new Date(form.expires_at)
              .toISOString()
              .replace("T", " ")
              .slice(0, 19)
          : undefined,
      };

      if (editingCoupon) {
        const { coupon } = await updateCoupon(token, editingCoupon.id, data);
        setCoupons((prev) =>
          prev.map((c) => (c.id === coupon.id ? coupon : c)),
        );
        showToast("Cupom atualizado com sucesso!");
      } else {
        const { coupon } = await createCoupon(token, storeId, data);
        setCoupons((prev) => [coupon, ...prev]);
        showToast("Cupom criado com sucesso!");
      }
      setShowForm(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao salvar cupom",
        "error",
      );
    }
    setSaving(false);
  };

  const handleToggleActive = async (c: StoreCoupon) => {
    if (!token) return;
    try {
      const { coupon } = await updateCoupon(token, c.id, {
        is_active: !c.is_active,
      });
      setCoupons((prev) => prev.map((x) => (x.id === c.id ? coupon : x)));
      showToast(
        coupon.is_active
          ? `Cupom ${coupon.code} ativado!`
          : `Cupom ${coupon.code} desativado.`,
      );
    } catch (err) {
      console.error(err);
      showToast("Erro ao alternar status do cupom", "error");
    }
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget) return;
    setSaving(true);
    try {
      await deleteCoupon(token, deleteTarget.id);
      setCoupons((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      showToast(`Cupom ${deleteTarget.code} excluído.`);
      setDeleteTarget(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao excluir",
        "error",
      );
    }
    setSaving(false);
  };

  const isExpired = (expires_at: string | null) => {
    if (!expires_at) return false;
    return new Date(expires_at) < new Date();
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast(`Código "${code}" copiado!`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-100 dark:border-emerald-950/30" />
          <div className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
          Carregando cupons...
        </p>
      </div>
    );
  }

  if (!storeId) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/20 rounded-full flex items-center justify-center mx-auto text-amber-500 border border-amber-100 dark:border-amber-900/30">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Loja Não Encontrada
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Você precisa configurar sua loja para gerenciar cupons.
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
              Cupons
            </h1>
            <span>
              ({coupons.length} cadastrado{coupons.length !== 1 ? "s" : ""})
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Atraia clientes oferecendo descontos fixos ou percentuais nas
            compras.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-all shadow-md hover:shadow-lg shadow-emerald-600/10 cursor-pointer active:scale-95 whitespace-nowrap self-start sm:self-center"
        >
          <Plus className="h-5 w-5" />
          Novo Cupom
        </button>
      </div>

      {coupons.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 py-20 text-center bg-white dark:bg-slate-900 shadow-sm flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 mb-4 border border-slate-100 dark:border-slate-850">
            <Tag className="w-8 h-8" />
          </div>
          <p className="font-semibold text-slate-700 dark:text-slate-350 text-base">
            Nenhum cupom cadastrado
          </p>
          <p className="text-xs text-slate-450 dark:text-slate-500 mt-1 max-w-xs leading-relaxed">
            Seus cupons ativos aparecerão aqui. Clique no botão acima para criar
            o seu primeiro cupom promocional!
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111622] rounded-lg border border-slate-200 dark:border-slate-850 shadow-sm overflow-hidden">
          {/* Scrollable container to prevent squeezing/overflowing */}
          <div className="w-full overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm min-w-[950px] table-fixed">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/20 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4.5 w-[20%]">Código</th>
                  <th className="px-6 py-4.5 w-[15%]">Desconto</th>
                  <th className="px-6 py-4.5 w-[15%]">Regras / Mínimo</th>
                  <th className="px-6 py-4.5 w-[15%]">Uso / Limite</th>
                  <th className="px-6 py-4.5 w-[15%]">Expiração</th>
                  <th className="px-6 py-4.5 w-[10%]">Status</th>
                  <th className="px-6 py-4.5 w-[10%] text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {coupons.map((c) => {
                  const expired = isExpired(c.expires_at);
                  const discountLabel =
                    c.discount_type === "percentage"
                      ? `${c.discount_value}%`
                      : formatProductPrice(c.discount_value);

                  return (
                    <tr
                      key={c.id}
                      className={`group hover:bg-slate-50/40 dark:hover:bg-slate-900/10 transition-colors ${
                        !c.is_active || expired ? "opacity-70" : ""
                      }`}
                    >
                      {/* Code Badge */}
                      <td className="px-6 py-5 align-middle">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(c.code)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 p-2 font-mono text-xs font-extrabold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition-all cursor-pointer select-all group-hover:border-slate-350 dark:group-hover:border-slate-700"
                            title="Clique para copiar"
                          >
                            <span>{c.code}</span>
                            <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                          </button>
                        </div>
                      </td>

                      {/* Discount Value */}
                      <td className="px-6 py-5 align-middle">
                        <div className="flex flex-col">
                          <span className="text-base font-extrabold text-slate-900 dark:text-white">
                            {discountLabel}
                          </span>
                          <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mt-0.5">
                            {c.discount_type === "percentage"
                              ? "Percentual"
                              : "Valor Fixo"}
                          </span>
                        </div>
                      </td>

                      {/* Minimum order & applicability */}
                      <td className="px-6 py-5 align-middle">
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {c.min_order > 0 ? (
                              <span>
                                Mín. {formatProductPrice(c.min_order)}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">
                                Sem mínimo
                              </span>
                            )}
                          </div>
                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {c.applies_to === "all" ? (
                              <span className="flex items-center gap-1 bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-lg border border-amber-100 dark:border-amber-900/20">
                                Toda loja
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                                Categoria: {c.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Usage counter & limits */}
                      <td className="px-6 py-5 align-middle">
                        <div className="space-y-1.5 max-w-[140px]">
                          <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <span>{c.current_uses}</span>
                            <span className="text-slate-400">
                              / {c.max_uses ?? "∞"}
                            </span>
                          </div>
                          {c.max_uses && (
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(100, (c.current_uses / c.max_uses) * 100)}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Expiration date */}
                      <td className="px-6 py-5 align-middle">
                        <div className="flex items-center gap-2 text-slate-650 dark:text-slate-300 font-semibold">
                          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-xs">
                              {c.expires_at
                                ? new Date(c.expires_at).toLocaleDateString(
                                    "pt-BR",
                                  )
                                : "Nunca expira"}
                            </span>
                            {expired && (
                              <span className="inline-flex self-start px-1.5 py-0.5 text-[9px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-md uppercase tracking-wider mt-0.5 border border-rose-100 dark:border-rose-900/20">
                                Expirado
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Toggle status switch */}
                      <td className="px-6 py-5 align-middle">
                        <button
                          onClick={() => handleToggleActive(c)}
                          className={`relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            c.is_active && !expired
                              ? "bg-emerald-500"
                              : "bg-slate-200 dark:bg-slate-800"
                          }`}
                          disabled={expired}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                              c.is_active && !expired
                                ? "translate-x-5"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-5 align-middle text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditForm(c)}
                            className="inline-flex items-center justify-center p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                            title="Editar cupom"
                          >
                            <Edit2 className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="inline-flex items-center justify-center p-2 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
                            title="Excluir cupom"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 pt-[5vh]">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#111622] p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {editingCoupon ? "Editar Cupom" : "Novo Cupom"}
                </h3>
                <p className="text-xs text-slate-450 dark:text-slate-500 mt-1">
                  Configure as regras, descontos e vigência para a promoção.
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-4.5">
              {/* Code */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Código do Cupom *
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-4 py-3 font-mono text-sm uppercase tracking-wider focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 bg-white"
                  placeholder="EX: VERÃO15"
                />
              </div>

              {/* Discount Type and Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Tipo de desconto *
                  </label>
                  <select
                    value={form.discount_type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, discount_type: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-3 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none cursor-pointer transition-all bg-white"
                  >
                    <option value="percentage">Porcentagem (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Valor do desconto *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.discount_value}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, discount_value: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
                    placeholder={
                      form.discount_type === "percentage" ? "15" : "20.00"
                    }
                  />
                </div>
              </div>

              {/* Min Order and Max Uses */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Pedido Mínimo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={form.min_order}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, min_order: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Limite de usos
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.max_uses}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, max_uses: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
                    placeholder="Ilimitado"
                  />
                </div>
              </div>

              {/* Scope/Applies To */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Aplica-se a
                  </label>
                  <select
                    value={form.applies_to}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, applies_to: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-3 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none cursor-pointer transition-all bg-white"
                  >
                    <option value="all">Todos os produtos</option>
                    <option value="category">Categoria específica</option>
                  </select>
                </div>
                {form.applies_to === "category" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Nome da Categoria
                    </label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, category: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-450 bg-white"
                      placeholder="Ex: Bebidas"
                    />
                  </div>
                )}
              </div>

              {/* Date Expire */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Data de expiração
                </label>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expires_at: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all cursor-pointer bg-white"
                />
              </div>
            </div>

            {/* Actions modal */}
            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-slate-250 dark:border-slate-800 px-4 py-3 text-sm font-semibold text-slate-500 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-650 text-white px-4 py-3 text-sm font-semibold transition-all cursor-pointer shadow-sm shadow-emerald-600/10 active:scale-98 disabled:opacity-50"
              >
                <span>
                  {saving
                    ? "Salvando..."
                    : editingCoupon
                      ? "Salvar"
                      : "Criar Cupom"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#111622] p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center text-rose-500 mb-4 border border-rose-100 dark:border-rose-900/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Excluir Cupom
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Tem certeza que deseja excluir o cupom{" "}
              <strong>{deleteTarget.code}</strong>? Os clientes não poderão mais
              usá-lo em compras.
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
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer shadow-sm shadow-rose-600/10 active:scale-98 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4.5 w-4.5" />
                )}
                <span>{saving ? "Excluindo..." : "Excluir"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
