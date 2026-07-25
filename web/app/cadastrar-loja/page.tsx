"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { authFetch, API_URL, STORE_CATEGORIES } from "@/lib/api";
import { useBrazilianCities } from "@/hooks/useBrazilianCities";
import { CityItem } from "@/lib/cities";
import {
  Store as StoreIcon,
  MapPin,
  CreditCard,
  Truck,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Check,
  ShieldCheck,
  Loader2,
} from "lucide-react";

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

export default function CadastrarLojaPage() {
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Brazilian Cities Hook with IBGE + Fuse.js
  const { search: searchBrCities } =
    useBrazilianCities();
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<CityItem[]>([]);
  const cityInputRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        cityInputRef.current &&
        !cityInputRef.current.contains(event.target as Node)
      ) {
        setShowCitySuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCidadeChange = (val: string) => {
    updateField("city", val);
    if (val.trim().length >= 1) {
      const results = searchBrCities(val, 8);
      setCitySuggestions(results);
      setShowCitySuggestions(results.length > 0);
    } else {
      setShowCitySuggestions(false);
      setCitySuggestions([]);
    }
  };

  const handleSelectCitySuggestion = (item: CityItem) => {
    updateField("city", item.nome);
    if (item.uf) {
      updateField("state", item.uf.toUpperCase());
    }
    setShowCitySuggestions(false);
  };

  // Check if user already has a store
  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.replace("/login");
      return;
    }

    let active = true;
    authFetch(`${API_URL}/delivery/vendor/stores`, token)
      .then((data) => {
        if (!active) return;
        if (data?.store) {
          router.replace("/dashboard");
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, authLoading, router]);

  function updateField<K extends keyof typeof EMPTY_FORM>(
    field: K,
    value: (typeof EMPTY_FORM)[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (!form.name.trim()) {
      setError("Por favor, informe o nome da sua loja.");
      return;
    }
    if (!form.pix_key.trim()) {
      setError("Por favor, informe uma chave Pix para receber os pagamentos.");
      return;
    }
    if (!form.city.trim() || !form.state.trim()) {
      setError("Por favor, informe a cidade e o estado da sua loja.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        phone: form.phone.trim() || undefined,
        cnpj: form.cnpj.trim() || undefined,
        pix_key: form.pix_key.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase().slice(0, 2),
        delivery_fee: parseFloat(form.delivery_fee) || 0,
        minimum_order: parseFloat(form.minimum_order) || 0,
        prep_time_minutes: parseInt(form.prep_time_minutes) || 20,
        accepts_delivery: form.accepts_delivery,
        accepts_pickup: form.accepts_pickup,
      };

      await authFetch(`${API_URL}/delivery/stores`, token, {
        method: "POST",
        body: JSON.stringify(body),
      });

      // Once form is completed, redirect directly to dashboard
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível criar a loja. Verifique os dados e tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0a0e17]">
        <div className="relative w-12 h-12 mb-3">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-100 dark:border-emerald-950/30" />
          <div className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">
          Carregando...
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-50 dark:bg-[#0a0e17] text-gray-900 dark:text-gray-100 flex flex-col overflow-y-auto">
      {/* Main Content: ONLY the Registration Form */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24">
        <div className="bg-white dark:bg-[#121824] rounded-xl border border-gray-200 dark:border-gray-800 p-6 sm:p-8 shadow-xl dark:shadow-emerald-950/5">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-400 px-4 py-3.5 rounded-xl text-sm flex items-center gap-3 mb-6">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* SECTION 1: IDENTIFICATION */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800/80 pb-2.5">
                <StoreIcon className="w-4 h-4 text-emerald-500" />
                <h2 className="text-xs font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                  Identificação & Categoria
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    Nome do Estabelecimento *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Ex: Burger House, Cantina do Nono"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700/80 bg-gray-50/50 dark:bg-[#0a0e17] px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0d1320] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    Categoria *
                  </label>
                  <select
                    required
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700/80 bg-gray-50/50 dark:bg-[#0a0e17] px-3 py-3 text-sm text-gray-900 dark:text-gray-100 focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0d1320] focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer transition-all"
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
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Descrição Curta
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Fale brevemente sobre o cardápio, pratos principais e horários..."
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700/80 bg-gray-50/50 dark:bg-[#0a0e17] px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0d1320] focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none transition-all"
                />
              </div>
            </div>

            {/* SECTION 2: CONTACT & PAYMENT */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800/80 pb-2.5">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                <h2 className="text-xs font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                  Contato & Pagamento Pix
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    Telefone de Contato
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="Ex: (11) 99999-9999"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700/80 bg-gray-50/50 dark:bg-[#0a0e17] px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0d1320] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    CNPJ
                  </label>
                  <input
                    type="text"
                    value={form.cnpj}
                    onChange={(e) => updateField("cnpj", e.target.value)}
                    placeholder="Ex: 00.000.000/0000-00"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700/80 bg-gray-50/50 dark:bg-[#0a0e17] px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0d1320] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    Chave Pix para Receber *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.pix_key}
                    onChange={(e) => updateField("pix_key", e.target.value)}
                    placeholder="E-mail, CPF/CNPJ, Telefone ou Aleatória"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700/80 bg-gray-50/50 dark:bg-[#0a0e17] px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0d1320] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: LOCATION */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800/80 pb-2.5">
                <MapPin className="w-4 h-4 text-emerald-500" />
                <h2 className="text-xs font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                  Localização
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 relative" ref={cityInputRef}>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.city}
                    onChange={(e) => handleCidadeChange(e.target.value)}
                    onFocus={() => {
                      if (form.city.trim().length >= 1) {
                        const results = searchBrCities(form.city, 8);
                        setCitySuggestions(results);
                        setShowCitySuggestions(results.length > 0);
                      }
                    }}
                    autoComplete="off"
                    placeholder="Ex: São Paulo"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700/80 bg-gray-50/50 dark:bg-[#0a0e17] px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0d1320] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />

                  {/* Autocomplete Dropdown suggestions */}
                  {showCitySuggestions && citySuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 bg-white dark:bg-[#121824] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/80 animate-in fade-in duration-150">
                      {citySuggestions.map((item) => (
                        <button
                          key={`${item.nome}-${item.uf}`}
                          type="button"
                          onClick={() => handleSelectCitySuggestion(item)}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {item.nome}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                            {item.uf}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    UF *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={form.state}
                    onChange={(e) =>
                      updateField(
                        "state",
                        e.target.value.toUpperCase().slice(0, 2),
                      )
                    }
                    placeholder="SP"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700/80 bg-gray-50/50 dark:bg-[#0a0e17] px-4 py-3 text-sm text-gray-900 dark:text-gray-100 uppercase placeholder-gray-400 focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0d1320] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 4: DELIVERY & LOGISTICS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800/80 pb-2.5">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <h2 className="text-xs font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                  Logística & Valores
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    Taxa de Entrega (R$)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={form.delivery_fee}
                    onChange={(e) =>
                      updateField("delivery_fee", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700/80 bg-gray-50/50 dark:bg-[#0a0e17] px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0d1320] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    Pedido Mínimo (R$)
                  </label>
                  <input
                    type="number"
                    step="1.00"
                    min="0"
                    value={form.minimum_order}
                    onChange={(e) =>
                      updateField("minimum_order", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700/80 bg-gray-50/50 dark:bg-[#0a0e17] px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0d1320] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    Preparo Estimado (min)
                  </label>
                  <input
                    type="number"
                    min="5"
                    value={form.prep_time_minutes}
                    onChange={(e) =>
                      updateField("prep_time_minutes", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700/80 bg-gray-50/50 dark:bg-[#0a0e17] px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0d1320] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 5: MODES */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800/80 pb-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h2 className="text-xs font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                  Modo de Operação
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() =>
                    updateField("accepts_delivery", !form.accepts_delivery)
                  }
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    form.accepts_delivery
                      ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-950/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl transition-colors ${
                        form.accepts_delivery
                          ? "bg-emerald-500 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                      }`}
                    >
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-gray-100">
                        Aceito fazer Entregas
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Entregar no endereço do cliente
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      form.accepts_delivery
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {form.accepts_delivery && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>

                <div
                  onClick={() =>
                    updateField("accepts_pickup", !form.accepts_pickup)
                  }
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    form.accepts_pickup
                      ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-950/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl transition-colors ${
                        form.accepts_pickup
                          ? "bg-emerald-500 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                      }`}
                    >
                      <StoreIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-gray-100">
                        Aceito Retiradas
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Cliente retira no local
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      form.accepts_pickup
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {form.accepts_pickup && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800/80">
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Criando seu restaurante...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Concluir Cadastro e Ir ao Painel
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
