"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  authFetch,
  API_URL,
  Store,
  STORE_CATEGORIES,
} from "@/lib/api";
import {
  Store as StoreIcon,
  MapPin,
  Phone,
  CreditCard,
  Clock,
  Truck,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Camera,
  Upload,
  Sparkles,
  Copy,
  Check,
  ArrowLeft,
  Settings,
  ChevronRight,
  ShieldCheck,
  Map,
  DollarSign as MoneyIcon,
  Activity
} from "lucide-react";

const EMPTY_FORM = {
  name: "",
  description: "",
  category: "restaurante",
  phone: "",
  pix_key: "",
  city: "",
  state: "",
  delivery_fee: "0",
  minimum_order: "0",
  prep_time_minutes: "20",
  accepts_delivery: true,
  accepts_pickup: true,
};

export default function LojaPage() {
  const { token } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [togglingModes, setTogglingModes] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [copied, setCopied] = useState(false);
  
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStore = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await authFetch(`${API_URL}/delivery/vendor/stores`, token);
      const s: Store | null = data.store;
      setStore(s);
      if (s) {
        setForm({
          name: s.name || "",
          description: s.description || "",
          category: s.category || "restaurante",
          phone: s.phone || "",
          pix_key: s.pix_key || "",
          city: s.city || "",
          state: s.state || "",
          delivery_fee: String(s.delivery_fee ?? 0),
          minimum_order: String(s.minimum_order ?? 0),
          prep_time_minutes: String(s.prep_time_minutes ?? 20),
          accepts_delivery: s.accepts_delivery ?? true,
          accepts_pickup: s.accepts_pickup ?? true,
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar loja");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStore();
  }, [fetchStore]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        description: form.description || undefined,
        category: form.category,
        phone: form.phone || undefined,
        pix_key: form.pix_key,
        city: form.city,
        state: form.state,
        delivery_fee: parseFloat(form.delivery_fee) || 0,
        minimum_order: parseFloat(form.minimum_order) || 0,
        prep_time_minutes: parseInt(form.prep_time_minutes) || 20,
        accepts_delivery: form.accepts_delivery,
        accepts_pickup: form.accepts_pickup,
      };
      const data = await authFetch(`${API_URL}/delivery/stores`, token, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setStore(data.store);
      setEditing(false);
      showToast("Loja criada com sucesso!");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao criar loja");
      showToast("Erro ao criar loja", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !store) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description || null,
        category: form.category,
        phone: form.phone || null,
        pix_key: form.pix_key,
        city: form.city,
        state: form.state,
        delivery_fee: parseFloat(form.delivery_fee) || 0,
        minimum_order: parseFloat(form.minimum_order) || 0,
        prep_time_minutes: parseInt(form.prep_time_minutes) || 20,
        accepts_delivery: form.accepts_delivery,
        accepts_pickup: form.accepts_pickup,
      };
      const data = await authFetch(
        `${API_URL}/delivery/stores/${store.id}`,
        token,
        { method: "PUT", body: JSON.stringify(body) }
      );
      setStore(data.store);
      setEditing(false);
      showToast("Configurações atualizadas com sucesso!");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar loja");
      showToast("Erro ao salvar configurações", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!token || !store) return;
    setToggling(true);
    try {
      const data = await authFetch(
        `${API_URL}/delivery/stores/${store.id}/toggle`,
        token,
        { method: "PATCH" }
      );
      setStore(data.store);
      showToast(
        data.store.is_open
          ? "Sua loja está aberta para receber pedidos!"
          : "Sua loja agora está fechada."
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao alternar status");
      showToast("Erro ao alternar status da loja", "error");
    } finally {
      setToggling(false);
    }
  }

  async function handleToggleMode(field: "accepts_delivery" | "accepts_pickup") {
    if (!token || !store) return;
    setTogglingModes(field);
    try {
      const currentValue = store[field] ?? false;
      const body = {
        [field]: !currentValue,
      };
      const data = await authFetch(
        `${API_URL}/delivery/stores/${store.id}`,
        token,
        {
          method: "PUT",
          body: JSON.stringify(body),
        }
      );
      setStore(data.store);
      // Synchronize form
      setForm(prev => ({
        ...prev,
        [field]: data.store[field] ?? true
      }));
      showToast(
        field === "accepts_delivery"
          ? (data.store.accepts_delivery ? "Opção de entrega ativada!" : "Opção de entrega desativada.")
          : (data.store.accepts_pickup ? "Opção de retirada ativada!" : "Opção de retirada desativada.")
      );
    } catch (e: unknown) {
      showToast("Erro ao atualizar modo de operação", "error");
    } finally {
      setTogglingModes(null);
    }
  }

  async function uploadImage(file: File, field: "avatar" | "image_banner") {
    if (!token || !store) return;
    const setUpload =
      field === "avatar" ? setUploadingAvatar : setUploadingBanner;
    setUpload(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error("Upload falhou");
      const data = await res.json();
      const url: string = data.url || data.path;
      const updateBody: Record<string, string> = {};
      updateBody[field] = url;
      const updateData = await authFetch(
        `${API_URL}/delivery/stores/${store.id}`,
        token,
        { method: "PUT", body: JSON.stringify(updateBody) }
      );
      setStore(updateData.store);
      showToast(
        field === "avatar" ? "Logo/Avatar atualizado!" : "Banner da loja atualizado!"
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar imagem";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setUpload(false);
    }
  }

  function handleCopyPix() {
    if (!store?.pix_key) return;
    navigator.clipboard.writeText(store.pix_key);
    setCopied(true);
    showToast("Chave Pix copiada!");
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-100 dark:border-emerald-950/30" />
          <div className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
          Carregando informações da loja...
        </p>
      </div>
    );
  }

  if (!store && !editing) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="mx-auto w-20 h-20 bg-emerald-50 dark:bg-emerald-950/30 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-emerald-100/50 dark:border-emerald-900/20">
            <StoreIcon className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
            Crie sua loja no Zapi
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            Monte o perfil do seu estabelecimento para expor produtos, gerenciar entregas e receber pagamentos online.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-sm transition-all hover:shadow-md">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1.5">
              Logística Inteligente
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Defina taxas de entrega dinâmicas e decida se deseja aceitar entregas ou retirada no local.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-sm transition-all hover:shadow-md">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1.5">
              Tempo sob Controle
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Determine o tempo médio de preparo dos pedidos para manter seus clientes informados e satisfeitos.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-sm transition-all hover:shadow-md">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1.5">
              Recebimento Rápido
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Configure sua chave Pix e receba diretamente dos seus clientes de forma simples e integrada.
            </p>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-98 cursor-pointer"
          >
            <Sparkles className="w-5 h-5" />
            Configurar Minha Loja
          </button>
        </div>
      </div>
    );
  }

  const statCards = store ? [
    {
      label: "Taxa de Entrega",
      value: store.delivery_fee === 0 ? "Grátis" : `R$ ${store.delivery_fee.toFixed(2)}`,
      icon: Truck,
      color: "text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      label: "Pedido Mínimo",
      value: `R$ ${(store.minimum_order ?? 0).toFixed(2)}`,
      icon: DollarSign,
      color: "text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
    },
    {
      label: "Tempo de Preparo",
      value: `${store.prep_time_minutes ?? 20} min`,
      icon: Clock,
      color: "text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "Canais de Retirada",
      value: store.accepts_delivery && store.accepts_pickup
        ? "Entrega e Retirada"
        : store.accepts_delivery
        ? "Apenas Entrega"
        : store.accepts_pickup
        ? "Apenas Retirada"
        : "Nenhum Ativo",
      icon: StoreIcon,
      color: "text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30",
    },
  ] : [];

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

      {/* Main Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="font-medium">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-xs font-semibold underline hover:no-underline">
            Fechar
          </button>
        </div>
      )}

      {editing ? (
        <div className="max-w-4xl mx-auto">
          <StoreForm
            form={form}
            setForm={setForm}
            onSubmit={store ? handleUpdate : handleCreate}
            saving={saving}
            error={error}
            onCancel={() => {
              setEditing(false);
              setError(null);
            }}
            isNew={!store}
          />
        </div>
      ) : (
        store && (
          <>
            {/* Banner & Avatar Wrapper */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-850 overflow-hidden shadow-sm">
              {/* Banner Area */}
              <div className="relative h-48 sm:h-64 bg-slate-100 dark:bg-slate-950 group/banner overflow-hidden">
                {store.image_banner ? (
                  <img
                    src={store.image_banner}
                    alt="Banner da Loja"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/banner:scale-103"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-800 flex items-center justify-center text-white/20">
                    <Sparkles className="w-16 h-16 animate-pulse" />
                  </div>
                )}
                {/* Banner Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />

                {/* Edit Banner Trigger */}
                <button
                  onClick={() => bannerInput.current?.click()}
                  disabled={uploadingBanner}
                  className="absolute top-4 right-4 bg-slate-900/60 hover:bg-slate-900/90 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-md border border-white/10 active:scale-95"
                >
                  {uploadingBanner ? (
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  <span>Alterar Capa</span>
                </button>
                <input
                  ref={bannerInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f, "image_banner");
                  }}
                />
              </div>

              {/* Profile Details (Avatar and Name overlay) */}
              <div className="px-6 pb-6 -mt-16 sm:-mt-20 relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-6 text-center sm:text-left">
                {/* Avatar */}
                <div className="relative group/avatar">
                  <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-white dark:bg-slate-900 p-1 shadow-md border-4 border-white dark:border-slate-900 overflow-hidden">
                    {store.avatar ? (
                      <img
                        src={store.avatar}
                        alt={store.name}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <div className="w-full h-full rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-4xl font-extrabold text-white">
                        {store.name[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  {/* Upload Avatar Trigger */}
                  <button
                    onClick={() => avatarInput.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-1 rounded-2xl bg-slate-900/50 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center text-white transition-opacity duration-200 cursor-pointer"
                  >
                    {uploadingAvatar ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <Camera className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-semibold">Alterar Foto</span>
                      </>
                    )}
                  </button>
                  <input
                    ref={avatarInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(f, "avatar");
                    }}
                  />
                </div>

                {/* Name / Category / Actions */}
                <div className="flex-1 pb-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                          {store.name}
                        </h1>
                        <span className="px-3 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20">
                          {STORE_CATEGORIES[store.category] || store.category}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-center sm:justify-start gap-1">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        {store.city}, {store.state}
                      </p>
                    </div>

                    {/* Actions Panel */}
                    <div className="flex items-center justify-center sm:justify-start gap-3">
                      {/* Interactive Open/Close Toggle Button */}
                      <button
                        onClick={handleToggle}
                        disabled={toggling}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm cursor-pointer ${
                          store.is_open
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10 active:scale-95"
                            : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/10 active:scale-95"
                        } disabled:opacity-50`}
                      >
                        <span className="relative flex h-2 w-2">
                          {store.is_open && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          )}
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                        <span>
                          {toggling
                            ? "Salvando..."
                            : store.is_open
                            ? "Loja Aberta"
                            : "Loja Fechada"}
                        </span>
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => setEditing(true)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors cursor-pointer shadow-xs"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        <span>Configurar</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statCards.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={i}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-850 p-4 shadow-xs flex items-center gap-4 transition-all hover:-translate-y-0.5"
                  >
                    <div className={`p-3 rounded-xl ${stat.color} shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        {stat.label}
                      </p>
                      <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5 leading-tight">
                        {stat.value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Content Two-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Side (About & Operation Settings) */}
              <div className="lg:col-span-2 space-y-6">
                {/* About & Description */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-850 p-6 shadow-xs">
                  <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                    Sobre o Estabelecimento
                  </h3>
                  {store.description ? (
                    <p className="text-slate-700 dark:text-slate-350 text-sm leading-relaxed whitespace-pre-line">
                      {store.description}
                    </p>
                  ) : (
                    <div className="text-center py-6 text-slate-400 dark:text-slate-600 text-sm">
                      Nenhuma descrição cadastrada para esta loja.
                    </div>
                  )}
                </div>

                {/* Interactive Operating Mode Panel */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-850 p-6 shadow-xs">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Modos de Operação
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Delivery Toggle Card */}
                    <div
                      onClick={() => handleToggleMode("accepts_delivery")}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group ${
                        store.accepts_delivery
                          ? "border-emerald-500/80 bg-emerald-50/20 dark:bg-emerald-950/10"
                          : "border-slate-200 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-800"
                      } ${togglingModes === "accepts_delivery" ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${store.accepts_delivery ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-550"}`}>
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">Aceitar Entrega</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Leve o produto até o cliente</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${store.accepts_delivery ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 dark:border-slate-700"}`}>
                        {store.accepts_delivery && <Check className="w-3 h-3" />}
                      </div>
                    </div>

                    {/* Pickup Toggle Card */}
                    <div
                      onClick={() => handleToggleMode("accepts_pickup")}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group ${
                        store.accepts_pickup
                          ? "border-emerald-500/80 bg-emerald-50/20 dark:bg-emerald-950/10"
                          : "border-slate-200 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-800"
                      } ${togglingModes === "accepts_pickup" ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${store.accepts_pickup ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-550"}`}>
                          <StoreIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">Aceitar Retirada</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Clientes retiram no balcão</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${store.accepts_pickup ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 dark:border-slate-700"}`}>
                        {store.accepts_pickup && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side (Contact, Pix & Rating Summary) */}
              <div className="space-y-6">
                {/* Contact & Pix Panel */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-850 p-6 shadow-xs space-y-4">
                  <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Contato & Recebimentos
                  </h3>

                  {/* Phone */}
                  {store.phone && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 mt-0.5">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-550 font-medium">Telefone de Contato</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{store.phone}</p>
                      </div>
                    </div>
                  )}

                  {/* Pix Key */}
                  <div className="flex items-start gap-3 pt-2">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 mt-0.5">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400 dark:text-slate-550 font-medium">Chave Pix de Recebimento</p>
                      <div className="flex items-center gap-2 mt-1 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-850">
                        <span className="text-xs font-mono text-slate-650 dark:text-slate-400 truncate flex-1 select-all">
                          {store.pix_key}
                        </span>
                        <button
                          onClick={handleCopyPix}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 cursor-pointer p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                          title="Copiar Chave Pix"
                        >
                          {copied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score & Reviews Panel */}
                {(store.score !== undefined && store.score > 0) && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-850 p-6 shadow-xs">
                    <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
                      Avaliação dos Clientes
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                        {store.score.toFixed(1)}
                      </div>
                      <div>
                        <div className="flex text-amber-400 gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-5 h-5 ${
                                i < Math.round(store.score || 0)
                                  ? "fill-current"
                                  : "text-slate-200 dark:text-slate-800"
                              }`}
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1 font-medium">
                          Média de {store.ratings_count ?? 0} avaliações
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}

interface StoreFormProps {
  form: typeof EMPTY_FORM;
  setForm: (f: typeof EMPTY_FORM) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  isNew: boolean;
}

function StoreForm({
  form,
  setForm,
  onSubmit,
  saving,
  error,
  onCancel,
  isNew,
}: StoreFormProps) {
  function update(field: string, value: any) {
    setForm({ ...form, [field]: value });
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-850 p-6 md:p-8 shadow-sm max-w-3xl mx-auto">
      {/* Header Form */}
      <div className="flex items-center gap-4 mb-8">
        <button
          type="button"
          onClick={onCancel}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isNew ? "Criar Minha Loja" : "Configurações do Estabelecimento"}
          </h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
            Insira os dados essenciais da sua loja para receber pedidos.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-8">
        {/* SECTION: BASIC INFO */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">
            <StoreIcon className="w-4.5 h-4.5 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Identificação & Categoria
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Nome da loja *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Ex: Cantina do Nono, Farmácia Central"
                className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Categoria *
              </label>
              <select
                required
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none cursor-pointer transition-all"
              >
                {Object.entries(STORE_CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Descrição
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Fale um pouco sobre a sua loja, especialidades, política de atendimento..."
              className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* SECTION: CONTACT & FINANCES */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">
            <CreditCard className="w-4.5 h-4.5 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Contato & Pagamento
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Telefone de Contato
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="Ex: (51) 99999-9999"
                className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Chave Pix de Recebimento *
              </label>
              <input
                type="text"
                required
                value={form.pix_key}
                onChange={(e) => update("pix_key", e.target.value)}
                placeholder="Celular, CNPJ, E-mail ou Chave Aleatória"
                className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* SECTION: ADDRESS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">
            <Map className="w-4.5 h-4.5 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Localização
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Cidade *
              </label>
              <input
                type="text"
                required
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                placeholder="Ex: Porto Alegre"
                className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Estado (UF) *
              </label>
              <input
                type="text"
                required
                maxLength={2}
                value={form.state}
                onChange={(e) =>
                  update("state", e.target.value.toUpperCase().slice(0, 2))
                }
                placeholder="RS"
                className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none uppercase transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* SECTION: DELIVERY CONFIGS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">
            <MoneyIcon className="w-4.5 h-4.5 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Logística & Valores
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Taxa de entrega (R$)
              </label>
              <input
                type="number"
                step="0.10"
                min="0"
                value={form.delivery_fee}
                onChange={(e) => update("delivery_fee", e.target.value)}
                className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Pedido mínimo (R$)
              </label>
              <input
                type="number"
                step="0.50"
                min="0"
                value={form.minimum_order}
                onChange={(e) => update("minimum_order", e.target.value)}
                className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Preparo padrão (min)
              </label>
              <input
                type="number"
                min="1"
                value={form.prep_time_minutes}
                onChange={(e) => update("prep_time_minutes", e.target.value)}
                className="w-full border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* SECTION: OPERATING MODES */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">
            <ShieldCheck className="w-4.5 h-4.5 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Modo de Operação
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Delivery Toggle Checkbox Card */}
            <div
              onClick={() => update("accepts_delivery", !form.accepts_delivery)}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group ${
                form.accepts_delivery
                  ? "border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/10"
                  : "border-slate-250 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-colors ${form.accepts_delivery ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"}`}>
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">Aceito fazer Entregas</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Levar o pedido até a residência</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${form.accepts_delivery ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-350 dark:border-slate-700"}`}>
                {form.accepts_delivery && <Check className="w-3.5 h-3.5" />}
              </div>
            </div>

            {/* Pickup Toggle Checkbox Card */}
            <div
              onClick={() => update("accepts_pickup", !form.accepts_pickup)}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group ${
                form.accepts_pickup
                  ? "border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/10"
                  : "border-slate-250 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-colors ${form.accepts_pickup ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"}`}>
                  <StoreIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">Aceito Retiradas</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Cliente retira no estabelecimento</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${form.accepts_pickup ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-350 dark:border-slate-700"}`}>
                {form.accepts_pickup && <Check className="w-3.5 h-3.5" />}
              </div>
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTONS */}
        <div className="flex items-center gap-4 pt-4 border-t border-slate-150 dark:border-slate-800">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-650 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all shadow-md shadow-emerald-600/10 active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <CheckCircle2 className="w-4.5 h-4.5" />
            )}
            <span>{saving ? "Salvando..." : isNew ? "Criar Minha Loja" : "Salvar Configurações"}</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-3 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
