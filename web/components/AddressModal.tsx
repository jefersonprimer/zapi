"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  MapPin,
  X,
  Search,
  Building,
  Home,
  Briefcase,
  Loader2,
  Check,
  Navigation,
  Compass,
} from "lucide-react";

export interface AddressData {
  label: "casa" | "trabalho" | "outro";
  estado: string;
  cidade: string;
  bairro: string;
  cep: string;
  rua: string;
  numero: string;
  ponto_referencia?: string;
  is_default?: boolean;
}

export interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAddress: (data: AddressData) => Promise<void>;
  onSelectCity: (city: string) => void;
  availableCities: string[];
  initialCity?: string;
}

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const emptySubscribe = () => () => {};

export default function AddressModal({
  isOpen,
  onClose,
  onSaveAddress,
  onSelectCity,
  availableCities,
  initialCity = "",
}: AddressModalProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [activeTab, setActiveTab] = useState<"address" | "city">("address");
  const [loadingCep, setLoadingCep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form fields
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState(initialCity !== "all" ? initialCity : "");
  const [prevInitialCity, setPrevInitialCity] = useState(initialCity);

  if (initialCity !== prevInitialCity) {
    setPrevInitialCity(initialCity);
    if (initialCity && initialCity !== "all") {
      setCidade(initialCity);
    }
  }

  const [estado, setEstado] = useState("");
  const [pontoReferencia, setPontoReferencia] = useState("");
  const [label, setLabel] = useState<"casa" | "trabalho" | "outro">("casa");
  const [isDefault] = useState(true);

  // Filter available cities for quick selection
  const [citySearch, setCitySearch] = useState("");

  const handleCepChange = async (value: string) => {
    const formatted = value.replace(/\D/g, "").slice(0, 8);
    setCep(formatted);
    setErrorMessage(null);

    if (formatted.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${formatted}/json/`);
        const data = await res.json();
        if (data.erro) {
          setErrorMessage("CEP não encontrado. Por favor, preencha o endereço manualmente.");
        } else {
          setRua(data.logradouro || "");
          setBairro(data.bairro || "");
          setCidade(data.localidade || "");
          setEstado(data.uf || "");
        }
      } catch (err) {
        console.error("ViaCEP lookup error:", err);
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleSubmitAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!cidade.trim()) {
      setErrorMessage("Por favor, informe a cidade.");
      return;
    }
    if (!estado.trim()) {
      setErrorMessage("Por favor, selecione o estado (UF).");
      return;
    }
    if (!rua.trim()) {
      setErrorMessage("Por favor, informe a rua/logradouro.");
      return;
    }
    if (!numero.trim()) {
      setErrorMessage("Por favor, informe o número do endereço.");
      return;
    }
    if (!bairro.trim()) {
      setErrorMessage("Por favor, informe o bairro.");
      return;
    }

    try {
      setSaving(true);
      await onSaveAddress({
        label,
        estado: estado.toUpperCase(),
        cidade: cidade.trim(),
        bairro: bairro.trim(),
        cep: cep.trim(),
        rua: rua.trim(),
        numero: numero.trim(),
        ponto_referencia: pontoReferencia.trim() || undefined,
        is_default: isDefault,
      });
    } catch (err: unknown) {
      console.error("Save address error:", err);
      const msg = err instanceof Error ? err.message : "Não foi possível salvar o endereço. Tente novamente.";
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const filteredCities = availableCities.filter((c) =>
    c.toLowerCase().includes(citySearch.toLowerCase())
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative bg-surface dark:bg-card-bg border border-card-border/80 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
        {/* Header background accent */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 h-9 w-9 rounded-full bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-muted-text hover:text-foreground transition-colors cursor-pointer z-10"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Title */}
        <div className="relative mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-sm">
              <MapPin className="h-5.5 w-5.5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                Onde você quer seu pedido?
              </h2>
              <p className="text-xs text-muted-text">
                Informe seu endereço para filtrar as lojas da sua região
              </p>
            </div>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex p-1 bg-neutral-100 dark:bg-neutral-900/60 rounded-2xl mb-5 border border-card-border/40">
          <button
            type="button"
            onClick={() => setActiveTab("address")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "address"
                ? "bg-surface dark:bg-card-bg text-foreground shadow-sm"
                : "text-muted-text hover:text-foreground"
            }`}
          >
            <Navigation className="h-3.5 w-3.5 text-emerald-500" />
            <span>Endereço Completo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("city")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "city"
                ? "bg-surface dark:bg-card-bg text-foreground shadow-sm"
                : "text-muted-text hover:text-foreground"
            }`}
          >
            <Building className="h-3.5 w-3.5 text-emerald-500" />
            <span>Selecionar Cidade</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-500 flex items-center gap-2">
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab 1: Full Address Form */}
        {activeTab === "address" ? (
          <form onSubmit={handleSubmitAddress} className="space-y-3.5">
            {/* CEP Input */}
            <div>
              <label className="block text-[11px] font-bold text-muted-text uppercase tracking-wider mb-1">
                CEP <span className="text-muted-text/60 font-normal">(Busca automática)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="00000-000"
                  maxLength={8}
                  value={cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-card-border/70 bg-surface/70 dark:bg-neutral-900/40 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/80 transition-all placeholder:text-muted-text/40"
                />
                {loadingCep && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Buscando...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cidade & Estado (UF) */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-muted-text uppercase tracking-wider mb-1">
                  Cidade *
                </label>
                <input
                  type="text"
                  placeholder="Ex: São Paulo"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-card-border/70 bg-surface/70 dark:bg-neutral-900/40 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/80 transition-all placeholder:text-muted-text/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-text uppercase tracking-wider mb-1">
                  UF *
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-card-border/70 bg-surface/70 dark:bg-neutral-900/40 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/80 transition-all cursor-pointer"
                >
                  <option value="">UF</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rua & Número */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-muted-text uppercase tracking-wider mb-1">
                  Rua / Avenida *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Av. Paulista"
                  value={rua}
                  onChange={(e) => setRua(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-card-border/70 bg-surface/70 dark:bg-neutral-900/40 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/80 transition-all placeholder:text-muted-text/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-text uppercase tracking-wider mb-1">
                  Nº *
                </label>
                <input
                  type="text"
                  placeholder="123"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-card-border/70 bg-surface/70 dark:bg-neutral-900/40 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/80 transition-all placeholder:text-muted-text/40"
                />
              </div>
            </div>

            {/* Bairro & Complemento */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-muted-text uppercase tracking-wider mb-1">
                  Bairro *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Bela Vista"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-card-border/70 bg-surface/70 dark:bg-neutral-900/40 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/80 transition-all placeholder:text-muted-text/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-text uppercase tracking-wider mb-1">
                  Ponto de Ref. / Apto
                </label>
                <input
                  type="text"
                  placeholder="Apto 42 / Próx. ao mercado"
                  value={pontoReferencia}
                  onChange={(e) => setPontoReferencia(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-card-border/70 bg-surface/70 dark:bg-neutral-900/40 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/80 transition-all placeholder:text-muted-text/40"
                />
              </div>
            </div>

            {/* Etiqueta / Tipo (Casa, Trabalho, Outro) */}
            <div>
              <label className="block text-[11px] font-bold text-muted-text uppercase tracking-wider mb-1.5">
                Salvar como
              </label>
              <div className="flex gap-2">
                {[
                  { key: "casa", label: "Casa", icon: Home },
                  { key: "trabalho", label: "Trabalho", icon: Briefcase },
                  { key: "outro", label: "Outro", icon: MapPin },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSel = label === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setLabel(item.key as AddressData["label"])}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSel
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                          : "bg-surface dark:bg-neutral-900/40 border-card-border/60 text-muted-text hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Salvando endereço...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Salvar e Ver Lojas em {cidade || "sua Cidade"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Tab 2: Quick City Selection */
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-text/60" />
              <input
                type="text"
                placeholder="Buscar cidade disponível..."
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-card-border/70 bg-surface/70 dark:bg-neutral-900/40 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/80 transition-all placeholder:text-muted-text/40"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              <button
                type="button"
                onClick={() => onSelectCity("all")}
                className="w-full text-left p-3 rounded-xl border border-card-border/50 bg-neutral-50/50 dark:bg-neutral-900/30 hover:border-emerald-500/50 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">
                    🌐
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      Todas as Cidades
                    </span>
                    <span className="text-[10px] text-muted-text">
                      Exibir lojas e restaurantes de qualquer região
                    </span>
                  </div>
                </div>
                <Compass className="h-4 w-4 text-muted-text group-hover:text-emerald-500 transition-colors" />
              </button>

              {filteredCities.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => onSelectCity(city)}
                  className="w-full text-left p-3 rounded-xl border border-card-border/50 hover:border-emerald-500/50 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-surface dark:bg-card-bg border border-card-border/60 text-emerald-500 flex items-center justify-center font-bold text-xs">
                      <Building className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground block">
                        {city}
                      </span>
                      <span className="text-[10px] text-muted-text">
                        Ver estabelecimentos que entregam em {city}
                      </span>
                    </div>
                  </div>
                  <Check className="h-4 w-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}

              {filteredCities.length === 0 && (
                <div className="py-8 text-center text-xs text-muted-text font-medium">
                  Nenhuma cidade encontrada para &quot;{citySearch}&quot;.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
