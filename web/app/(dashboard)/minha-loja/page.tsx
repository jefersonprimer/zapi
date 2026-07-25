"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Sparkles,
  Copy,
  Check,
  ArrowLeft,
  Pencil,
  FileText,
  Activity,
  Star,
  Eye,
  Settings,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getImageUrl } from "@/lib/utils";

const EMPTY_FORM = {
  name: "",
  description: "",
  category: "restaurante",
  phone: "",
  cnpj: "",
  pix_key: "",
  city: "",
  state: "",
  delivery_fee: "0",
  minimum_order: "0",
  prep_time_minutes: "20",
  accepts_delivery: true,
  accepts_pickup: true,
};

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

export default function LojaPage() {
  const { token } = useAuth();
  const router = useRouter();
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
  const [activeTab, setActiveTab] = useState<"painel" | "previa">("painel");

  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStore = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
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
          cnpj: s.cnpj || "",
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
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        fetchStore();
      }
    });
    return () => {
      active = false;
    };
  }, [fetchStore]);

  useEffect(() => {
    if (!loading && !store) {
      router.replace("/cadastrar-loja");
    }
  }, [loading, store, router]);

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
        cnpj: form.cnpj || null,
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
      showToast("Configurações atualizadas!");
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
      setForm(prev => ({
        ...prev,
        [field]: data.store[field] ?? true
      }));
      showToast(
        field === "accepts_delivery"
          ? (data.store.accepts_delivery ? "Entrega ativada!" : "Entrega desativada.")
          : (data.store.accepts_pickup ? "Retirada ativada!" : "Retirada desativada.")
      );
    } catch {
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
        field === "avatar" ? "Logo atualizada!" : "Banner atualizado!"
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
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-emerald-100 dark:border-emerald-950/20" />
          <div className="absolute inset-0 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
        </div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Carregando loja...
        </p>
      </div>
    );
  }

  if (!store) return null;

  // Real-time Preview values mapping
  const previewName = editing ? form.name : store.name;
  const previewDescription = editing ? form.description : store.description;
  const previewCategory = editing ? form.category : store.category;
  const previewDeliveryFee = editing ? parseFloat(form.delivery_fee) : store.delivery_fee;
  const previewMinimumOrder = editing ? parseFloat(form.minimum_order) : store.minimum_order;
  const previewPrepTime = editing ? parseInt(form.prep_time_minutes) : store.prep_time_minutes;
  const previewAcceptsDelivery = editing ? form.accepts_delivery : store.accepts_delivery;
  const previewAcceptsPickup = editing ? form.accepts_pickup : store.accepts_pickup;

  const categoryInfo = CATEGORY_MAP[previewCategory] || { label: "Outros", emoji: "✨" };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 px-4 sm:px-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border animate-in slide-in-from-bottom duration-300 bg-white dark:bg-[#111] border-neutral-200 dark:border-neutral-800">
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-500" />
          )}
          <span className="text-xs font-bold text-neutral-850 dark:text-neutral-100">
            {toast.message}
          </span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
            <Link href="/dashboard" className="hover:underline">Dashboard</Link>
            <span>/</span>
            <span className="text-neutral-600 dark:text-neutral-350">Minha Loja</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mt-1">
            Configurações da Loja
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              store.is_open
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30"
                : "bg-neutral-100 text-neutral-600 border border-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:border-neutral-800"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${store.is_open ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"}`} />
            {store.is_open ? "Aberta para Clientes" : "Fechada temporariamente"}
          </button>

          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111] hover:bg-neutral-50 dark:hover:bg-white/5 text-neutral-850 dark:text-neutral-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar Loja
            </button>
          )}
        </div>
      </div>

      {/* MOBILE TABS (Only visible on small screens to toggle between Dashboard & Preview) */}
      <div className="flex lg:hidden border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab("painel")}
          className={`flex-1 py-3 text-center text-xs font-bold border-b-2 transition-all ${
            activeTab === "painel"
              ? "border-emerald-500 text-neutral-900 dark:text-white"
              : "border-transparent text-neutral-400 dark:text-neutral-500"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Settings className="w-3.5 h-3.5" />
            {editing ? "Formulário" : "Painel"}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("previa")}
          className={`flex-1 py-3 text-center text-xs font-bold border-b-2 transition-all ${
            activeTab === "previa"
              ? "border-emerald-500 text-neutral-900 dark:text-white"
              : "border-transparent text-neutral-400 dark:text-neutral-500"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            Espelho da Loja (Live)
          </span>
        </button>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* LEFT COLUMN: DASHBOARD OR EDIT FORM */}
        <div className={`lg:col-span-3 space-y-6 ${activeTab === "painel" ? "block" : "hidden lg:block"}`}>
          
          {editing ? (
            /* EDIT FORM PANEL */
            <form onSubmit={handleUpdate} className="bg-white dark:bg-[#111] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900 pb-4">
                <div>
                  <h2 className="text-base font-bold text-neutral-905 dark:text-neutral-100">Atualizar Dados</h2>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500">As alterações serão exibidas na prévia ao lado.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-550 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-205 text-[10px] font-bold transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Voltar
                </button>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-400 px-3 py-2.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="font-semibold">{error}</span>
                </div>
              )}

              {/* Identity Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Sobre a Loja</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                      Nome da loja *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Ex: Pizzaria da Nonna"
                      className="w-full border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                      Categoria *
                    </label>
                    <select
                      required
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-550 outline-none cursor-pointer transition-all"
                    >
                      {Object.entries(STORE_CATEGORIES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                    Descrição
                  </label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descreva seu estabelecimento, diferenciais, etc."
                    className="w-full border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-550 outline-none resize-none transition-all placeholder:text-neutral-400"
                  />
                </div>
              </div>

              {/* Contact & Finances */}
              <div className="space-y-4 border-t border-neutral-100 dark:border-neutral-900 pt-4">
                <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Contato & Financeiro</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                      Telefone
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="w-full border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-550 outline-none transition-all placeholder:text-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                      CNPJ
                    </label>
                    <input
                      type="text"
                      value={form.cnpj}
                      onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00"
                      className="w-full border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-550 outline-none transition-all placeholder:text-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                      Chave Pix *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.pix_key}
                      onChange={(e) => setForm({ ...form, pix_key: e.target.value })}
                      placeholder="E-mail, Celular ou CNPJ"
                      className="w-full border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-550 outline-none transition-all placeholder:text-neutral-400"
                    />
                  </div>
                </div>
              </div>

              {/* Localisation */}
              <div className="space-y-4 border-t border-neutral-100 dark:border-neutral-900 pt-4">
                <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Localização</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                      Cidade *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Ex: Porto Alegre"
                      className="w-full border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-550 outline-none transition-all placeholder:text-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                      Estado (UF) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })}
                      placeholder="RS"
                      className="w-full border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-550 outline-none transition-all uppercase placeholder:text-neutral-400"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Configs */}
              <div className="space-y-4 border-t border-neutral-100 dark:border-neutral-900 pt-4">
                <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Valores & Logística</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                      Taxa de entrega (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.delivery_fee}
                      onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })}
                      className="w-full border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-550 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                      Pedido mínimo (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.minimum_order}
                      onChange={(e) => setForm({ ...form, minimum_order: e.target.value })}
                      className="w-full border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-550 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                      Preparo padrão (min)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.prep_time_minutes}
                      onChange={(e) => setForm({ ...form, prep_time_minutes: e.target.value })}
                      className="w-full border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-550 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Mode of operation */}
              <div className="space-y-3 border-t border-neutral-100 dark:border-neutral-900 pt-4">
                <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Modos de Entrega</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, accepts_delivery: !form.accepts_delivery })}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      form.accepts_delivery
                        ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 text-neutral-850 dark:text-neutral-100"
                        : "border-neutral-200 dark:border-neutral-800 text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Truck className={`w-4 h-4 ${form.accepts_delivery ? "text-emerald-500" : "text-neutral-400"}`} />
                      <div>
                        <span className="text-xs font-bold block">Entrega</span>
                        <span className="text-[10px] opacity-75 font-normal">Entregar no endereço do cliente</span>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${form.accepts_delivery ? "border-emerald-500 bg-emerald-500 text-white" : "border-neutral-300 dark:border-neutral-700"}`}>
                      {form.accepts_delivery && <Check className="w-2.5 h-2.5" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, accepts_pickup: !form.accepts_pickup })}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      form.accepts_pickup
                        ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 text-neutral-850 dark:text-neutral-100"
                        : "border-neutral-200 dark:border-neutral-800 text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <StoreIcon className={`w-4 h-4 ${form.accepts_pickup ? "text-emerald-500" : "text-neutral-400"}`} />
                      <div>
                        <span className="text-xs font-bold block">Retirada</span>
                        <span className="text-[10px] opacity-75 font-normal">Cliente busca no estabelecimento</span>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${form.accepts_pickup ? "border-emerald-500 bg-emerald-500 text-white" : "border-neutral-300 dark:border-neutral-700"}`}>
                      {form.accepts_pickup && <Check className="w-2.5 h-2.5" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 border-t border-neutral-100 dark:border-neutral-900 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{saving ? "Salvando..." : "Salvar Alterações"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer text-center"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            /* VIEW MODE: LUXURIOUS MINIMALIST DASHBOARD */
            <div className="space-y-6">
              
              {/* STATS OVERVIEW CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: "Frete",
                    value: store.delivery_fee === 0 ? "Grátis" : `R$ ${store.delivery_fee.toFixed(2)}`,
                    icon: Truck,
                    color: "text-emerald-600 dark:text-emerald-450",
                    bg: "bg-emerald-500/5 dark:bg-emerald-950/10",
                  },
                  {
                    label: "Pedido Mínimo",
                    value: `R$ ${(store.minimum_order ?? 0).toFixed(2)}`,
                    icon: DollarSign,
                    color: "text-neutral-700 dark:text-neutral-300",
                    bg: "bg-neutral-550/5 dark:bg-neutral-950/10",
                  },
                  {
                    label: "Tempo Preparo",
                    value: `${store.prep_time_minutes ?? 20} min`,
                    icon: Clock,
                    color: "text-neutral-700 dark:text-neutral-300",
                    bg: "bg-neutral-550/5 dark:bg-neutral-950/10",
                  },
                  {
                    label: "Modo Retirada",
                    value: store.accepts_pickup ? "Ativo" : "Desativo",
                    icon: StoreIcon,
                    color: store.accepts_pickup ? "text-emerald-600 dark:text-emerald-450" : "text-neutral-400",
                    bg: store.accepts_pickup ? "bg-emerald-500/5 dark:bg-emerald-950/10" : "bg-neutral-100/50 dark:bg-neutral-900/30",
                  },
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={i}
                      className="bg-white dark:bg-[#111] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 shadow-sm space-y-3"
                    >
                      <div className={`p-2 w-fit rounded-lg ${stat.bg} ${stat.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">
                          {stat.label}
                        </span>
                        <span className="text-sm font-bold text-neutral-800 dark:text-neutral-100 mt-0.5 block">
                          {stat.value}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ABOUT CARD */}
              <div className="bg-white dark:bg-[#111] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider">Apresentação</h3>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-semibold"
                  >
                    Editar
                  </button>
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-bold text-neutral-800 dark:text-neutral-150">{store.name}</h4>
                  <p className="text-xs text-neutral-450 dark:text-neutral-500">
                    Categoria: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{categoryInfo.label}</span>
                  </p>
                </div>

                {store.description ? (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-line bg-neutral-50/50 dark:bg-neutral-900/10 p-3 rounded-xl border border-neutral-100 dark:border-neutral-900">
                    {store.description}
                  </p>
                ) : (
                  <p className="text-xs text-neutral-400 italic">Nenhuma descrição adicionada.</p>
                )}
              </div>

              {/* CONTACTS & KEY DETAILS */}
              <div className="bg-white dark:bg-[#111] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm space-y-5">
                <h3 className="text-xs font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider">Contato & Recebimentos</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div className="flex items-center gap-3 bg-neutral-50/50 dark:bg-neutral-900/10 p-3 rounded-xl border border-neutral-100 dark:border-neutral-900">
                    <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">Telefone</span>
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block truncate">
                        {store.phone || "Não informado"}
                      </span>
                    </div>
                  </div>

                  {/* CNPJ */}
                  <div className="flex items-center gap-3 bg-neutral-50/50 dark:bg-neutral-900/10 p-3 rounded-xl border border-neutral-100 dark:border-neutral-900">
                    <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">CNPJ</span>
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block truncate">
                        {store.cnpj || "Não informado"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pix copy card */}
                <div className="flex items-center justify-between gap-3 bg-neutral-50/50 dark:bg-neutral-900/10 p-3.5 rounded-xl border border-neutral-100 dark:border-neutral-900">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">Recebimento Pix</span>
                      <span className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-100 block truncate">
                        {store.pix_key}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyPix}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111] hover:bg-neutral-50 text-neutral-750 dark:text-neutral-300 text-[10px] font-bold transition-all cursor-pointer shrink-0 border-neutral-200 dark:border-neutral-800"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copiar Chave
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* OPERATIONAL MODES SWITCH PANEL */}
              <div className="bg-white dark:bg-[#111] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider">Modos de Atendimento</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Delivery */}
                  <div className="flex items-center justify-between p-3.5 bg-neutral-50/50 dark:bg-neutral-900/10 rounded-xl border border-neutral-100 dark:border-neutral-900">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-450">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold block text-neutral-800 dark:text-neutral-200">Fazer Entregas</span>
                        <span className="text-[9px] text-neutral-450 block">Entregar no endereço</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleMode("accepts_delivery")}
                      disabled={togglingModes === "accepts_delivery"}
                      className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors cursor-pointer ${
                        store.accepts_delivery ? "bg-emerald-500 justify-end" : "bg-neutral-300 dark:bg-neutral-700 justify-start"
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                    </button>
                  </div>

                  {/* Pickup */}
                  <div className="flex items-center justify-between p-3.5 bg-neutral-50/50 dark:bg-neutral-900/10 rounded-xl border border-neutral-100 dark:border-neutral-900">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-450">
                        <StoreIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold block text-neutral-800 dark:text-neutral-200">Aceitar Retiradas</span>
                        <span className="text-[9px] text-neutral-450 block">Cliente retira no local</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleMode("accepts_pickup")}
                      disabled={togglingModes === "accepts_pickup"}
                      className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors cursor-pointer ${
                        store.accepts_pickup ? "bg-emerald-500 justify-end" : "bg-neutral-300 dark:bg-neutral-700 justify-start"
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                    </button>
                  </div>
                </div>
              </div>

              {/* QUICK LINKS */}
              <div className="bg-white dark:bg-[#111] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider">Gerenciamento</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/produtos"
                    className="flex items-center justify-center gap-2 p-3 border border-neutral-200 dark:border-neutral-805 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-all text-center"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    Cardápio
                  </Link>
                  <Link
                    href="/pedidos"
                    className="flex items-center justify-center gap-2 p-3 border border-neutral-200 dark:border-neutral-805 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-all text-center"
                  >
                    <Activity className="w-4 h-4 text-blue-500" />
                    Pedidos
                  </Link>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* RIGHT COLUMN: LIVE STORE MIRROR PREVIEW */}
        <div className={`lg:col-span-2 space-y-4 ${activeTab === "previa" ? "block" : "hidden lg:block"}`}>
          
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Espelho do Cliente (Live Preview)
            </span>
            <span className="text-[9px] text-neutral-400 dark:text-neutral-500">
              Modo: {editing ? "Editando" : "Salvo"}
            </span>
          </div>

          {/* SIMULATED CLIENT SIDEBAR */}
          <div className="bg-white dark:bg-[#161616] border border-neutral-200 dark:border-neutral-800/80 overflow-hidden shadow-md rounded-2xl sticky top-24 transition-all duration-300">
            
            {/* Store Banner */}
            <div className="relative h-28 sm:h-32 w-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden group/banner">
              {store.image_banner ? (
                <Image
                  src={getImageUrl(store.image_banner)}
                  alt="Banner da Loja"
                  fill
                  className="object-cover transition-transform duration-500 group-hover/banner:scale-105"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-300 dark:text-neutral-750 bg-gradient-to-r from-neutral-200 to-neutral-250 dark:from-neutral-800 dark:to-neutral-900">
                  <StoreIcon className="h-8 w-8" />
                </div>
              )}
              
              {/* Capa Edit Button */}
              <button
                onClick={() => bannerInput.current?.click()}
                disabled={uploadingBanner}
                className="absolute top-2.5 right-2.5 bg-black/60 hover:bg-black/80 text-white px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer backdrop-blur-sm border border-white/10"
              >
                {uploadingBanner ? (
                  <div className="animate-spin rounded-full h-2.5 w-2.5 border-2 border-white border-t-transparent" />
                ) : (
                  <Camera className="w-2.5 h-2.5" />
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

              {/* Status badge */}
              <div className="absolute top-2.5 left-2.5">
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm backdrop-blur-md text-white ${
                    store.is_open ? "bg-emerald-500/90" : "bg-neutral-600/90"
                  }`}
                >
                  {store.is_open ? "Aberto Agora" : "Fechado"}
                </span>
              </div>
            </div>

            {/* Store Details Box */}
            <div className="p-5 relative pt-7">
              {/* Avatar Overlap */}
              <div className="absolute top-0 left-5 -translate-y-1/2 h-14 w-14 rounded-xl border-3 border-white dark:border-[#161616] overflow-hidden bg-neutral-50 dark:bg-neutral-800 shadow-sm flex items-center justify-center group/avatar">
                {store.avatar ? (
                  <Image
                    src={getImageUrl(store.avatar)}
                    alt={previewName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-xl">{categoryInfo.emoji}</span>
                )}

                <button
                  onClick={() => avatarInput.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center text-white transition-all cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
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

              {/* Identity & Desc */}
              <div className="space-y-1 mt-1.5">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-bold tracking-tight text-neutral-905 dark:text-white truncate">
                    {previewName || "Sem nome"}
                  </h1>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">
                    ({categoryInfo.label})
                  </span>
                </div>
                {previewDescription ? (
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-3">
                    {previewDescription}
                  </p>
                ) : (
                  <p className="text-[10px] text-neutral-400 italic">
                    Sem descrição inserida.
                  </p>
                )}
              </div>

              {/* Badges Retirada/Entrega */}
              <div className="flex flex-wrap gap-1 mt-3">
                {previewAcceptsDelivery && (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/10">
                    Faz Entrega
                  </span>
                )}
                {previewAcceptsPickup && (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800">
                    Aceita Retirada
                  </span>
                )}
              </div>

              {/* Location & CNPJ preview */}
              <div className="mt-4 pt-3.5 border-t border-neutral-100 dark:border-neutral-900/50 text-[10px] text-neutral-450 dark:text-neutral-500 space-y-1">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-neutral-400" />
                  <span className="truncate">{store.city || form.city || "—"}, {store.state || form.state || "—"}</span>
                </div>
                {store.cnpj && (
                  <div className="text-[9px] opacity-75 font-mono">
                    CNPJ: {store.cnpj}
                  </div>
                )}
              </div>
            </div>

            {/* Simulated Live Stats Grid */}
            <div className="border-t border-neutral-100 dark:border-neutral-900/60 bg-neutral-50/50 dark:bg-neutral-900/10 grid grid-cols-4 divide-x divide-neutral-200/50 dark:divide-neutral-900/50 text-center py-3">
              
              {/* Rating Mock */}
              <div className="flex flex-col items-center justify-center px-1">
                <div className="flex items-center gap-0.5 text-amber-500 font-bold text-[10px]">
                  <Star className="h-3 w-3 fill-amber-550 text-amber-500" />
                  <span>
                    {store.score && store.score > 0 ? store.score.toFixed(1) : "—"}
                  </span>
                </div>
                <span className="text-[8px] text-neutral-400 dark:text-neutral-500 uppercase font-bold tracking-wider mt-0.5">
                  Nota
                </span>
              </div>

              {/* Prep Time */}
              <div className="flex flex-col items-center justify-center px-1">
                <span className="text-neutral-800 dark:text-neutral-200 font-bold text-[10px]">
                  {previewPrepTime || 20} min
                </span>
                <span className="text-[8px] text-neutral-400 dark:text-neutral-500 uppercase font-bold tracking-wider mt-0.5">
                  Preparo
                </span>
              </div>

              {/* Delivery Fee */}
              <div className="flex flex-col items-center justify-center px-1">
                <span className="text-neutral-800 dark:text-neutral-200 font-bold text-[10px]">
                  {previewDeliveryFee === 0 ? "Grátis" : `R$ ${previewDeliveryFee.toFixed(1)}`}
                </span>
                <span className="text-[8px] text-neutral-400 dark:text-neutral-500 uppercase font-bold tracking-wider mt-0.5">
                  Taxa
                </span>
              </div>

              {/* Minimum Order */}
              <div className="flex flex-col items-center justify-center px-1">
                <span className="text-neutral-800 dark:text-neutral-200 font-bold text-[10px]">
                  R$ {(previewMinimumOrder || 0).toFixed(0)}
                </span>
                <span className="text-[8px] text-neutral-400 dark:text-neutral-500 uppercase font-bold tracking-wider mt-0.5">
                  Mínimo
                </span>
              </div>
            </div>

            {/* Operating Hours Preview */}
            {store.hours && store.hours.length > 0 && (
              <div className="border-t border-neutral-100 dark:border-neutral-900/60 p-4 space-y-2.5">
                <div className="flex justify-between items-center text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                  <span>Funcionamento</span>
                  <Link href="/horarios" className="text-emerald-500 hover:underline">Gerenciar</Link>
                </div>
                <div className="space-y-1.5 pt-0.5">
                  {store.hours.slice(0, 3).map((hr) => (
                    <div
                      key={hr.id}
                      className="flex justify-between items-center text-[10px]"
                    >
                      <span className="text-neutral-600 dark:text-neutral-400 font-medium">
                        {["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"][hr.day_of_week]}
                      </span>
                      {hr.is_closed ? (
                        <span className="text-rose-500 text-[9px] font-bold">Fechado</span>
                      ) : (
                        <span className="text-neutral-400 font-mono text-[9px]">
                          {hr.open_time.slice(0, 5)} - {hr.close_time.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  ))}
                  {store.hours.length > 3 && (
                    <div className="text-center pt-1">
                      <span className="text-[8px] text-neutral-400 italic">Mais horários cadastrados</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
