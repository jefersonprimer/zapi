"use client";

import { useState, useSyncExternalStore, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Search, Loader2 } from "lucide-react";
import { useBrazilianCities } from "@/hooks/useBrazilianCities";
import { CityItem } from "@/lib/cities";

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
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
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
    () => false,
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
  const [cidade, setCidade] = useState(
    initialCity !== "all" ? initialCity : "",
  );
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

  // Brazilian Cities Hook with IBGE + Fuse.js
  const { search: searchBrCities, isLoading: isLoadingBrCities } =
    useBrazilianCities();
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<CityItem[]>([]);
  const cityInputRef = useRef<HTMLDivElement>(null);

  // Filter available cities for quick selection in Tab 2
  const [citySearch, setCitySearch] = useState("");

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
    setCidade(val);
    setErrorMessage(null);
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
    setCidade(item.nome);
    if (item.uf) {
      setEstado(item.uf.toUpperCase());
    }
    setShowCitySuggestions(false);
  };

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
          setErrorMessage(
            "CEP não encontrado. Por favor, preencha o endereço manualmente.",
          );
        } else {
          setRua(data.logradouro || "");
          setBairro(data.bairro || "");
          setCidade(data.localidade || "");
          setEstado(data.uf || "");
          setShowCitySuggestions(false);
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
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o endereço. Tente novamente.";
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !mounted) return null;

  // For Tab 2: Tab selection search using Fuse.js on all BR cities if typed, or availableCities
  const tab2SearchResults: {
    name: string;
    uf?: string;
    isAvailable?: boolean;
  }[] = (() => {
    if (!citySearch.trim()) {
      return availableCities.map((c) => ({ name: c, isAvailable: true }));
    }

    const brResults = searchBrCities(citySearch, 15);
    if (brResults.length > 0) {
      return brResults.map((item) => ({
        name: item.nome,
        uf: item.uf,
        isAvailable: availableCities.some(
          (ac) => ac.toLowerCase() === item.nome.toLowerCase(),
        ),
      }));
    }

    // Fallback simple search on availableCities
    return availableCities
      .filter((c) => c.toLowerCase().includes(citySearch.toLowerCase()))
      .map((c) => ({ name: c, isAvailable: true }));
  })();

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-lg w-full p-6 sm:p-7 shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 h-9 w-9 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer z-10"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Title */}
        <div className="relative mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
            Onde você quer seu pedido?
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Informe seu endereço para filtrar as lojas da sua região
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-xl mb-5 border border-neutral-200/80 dark:border-neutral-700/60">
          <button
            type="button"
            onClick={() => setActiveTab("address")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs transition-all cursor-pointer ${
              activeTab === "address"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm font-bold"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white font-semibold"
            }`}
          >
            Endereço Completo
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("city")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs transition-all cursor-pointer ${
              activeTab === "city"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm font-bold"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white font-semibold"
            }`}
          >
            Selecionar Cidade
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-red-600 dark:text-red-400">
            {errorMessage}
          </div>
        )}

        {/* Tab 1: Full Address Form */}
        {activeTab === "address" ? (
          <form onSubmit={handleSubmitAddress} className="space-y-3.5">
            {/* CEP Input */}
            <div>
              <label className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                CEP
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="00000-000"
                  maxLength={8}
                  value={cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 focus:border-neutral-900 dark:focus:border-white transition-all placeholder:text-neutral-400"
                />
                {loadingCep && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Buscando...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cidade & Estado (UF) */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2 relative" ref={cityInputRef}>
                <label className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  Cidade *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Frederico Westphalen"
                  value={cidade}
                  onChange={(e) => handleCidadeChange(e.target.value)}
                  onFocus={() => {
                    if (cidade.trim().length >= 1) {
                      const results = searchBrCities(cidade, 8);
                      setCitySuggestions(results);
                      setShowCitySuggestions(results.length > 0);
                    }
                  }}
                  required
                  autoComplete="off"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 focus:border-neutral-900 dark:focus:border-white transition-all placeholder:text-neutral-400"
                />

                {/* Autocomplete Dropdown suggestions */}
                {showCitySuggestions && citySuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl max-h-52 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 animate-in fade-in duration-150">
                    {citySuggestions.map((item) => (
                      <button
                        key={`${item.nome}-${item.uf}`}
                        type="button"
                        onClick={() => handleSelectCitySuggestion(item)}
                        className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          {item.nome}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                          {item.uf}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  UF *
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 focus:border-neutral-900 dark:focus:border-white transition-all cursor-pointer"
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
                <label className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  Rua / Avenida *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Av. Paulista"
                  value={rua}
                  onChange={(e) => setRua(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 focus:border-neutral-900 dark:focus:border-white transition-all placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  Nº *
                </label>
                <input
                  type="text"
                  placeholder="123"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 focus:border-neutral-900 dark:focus:border-white transition-all placeholder:text-neutral-400"
                />
              </div>
            </div>

            {/* Bairro & Complemento */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  Bairro *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Bela Vista"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 focus:border-neutral-900 dark:focus:border-white transition-all placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  Ponto de Ref. / Apto
                </label>
                <input
                  type="text"
                  placeholder="Apto 42 / Próx. ao mercado"
                  value={pontoReferencia}
                  onChange={(e) => setPontoReferencia(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 focus:border-neutral-900 dark:focus:border-white transition-all placeholder:text-neutral-400"
                />
              </div>
            </div>

            {/* Etiqueta / Tipo (Casa, Trabalho, Outro) */}
            <div>
              <label className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                Salvar como
              </label>
              <div className="flex gap-2">
                {[
                  { key: "casa", label: "Casa" },
                  { key: "trabalho", label: "Trabalho" },
                  { key: "outro", label: "Outro" },
                ].map((item) => {
                  const isSel = label === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setLabel(item.key as AddressData["label"])}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center cursor-pointer ${
                        isSel
                          ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white shadow-sm"
                          : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-600"
                      }`}
                    >
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
                className="w-full py-3 px-4 bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Salvando endereço...</span>
                  </>
                ) : (
                  <span>Salvar e Ver Lojas em {cidade || "sua Cidade"}</span>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Tab 2: Quick City Selection with Fuse.js & IBGE dataset */
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Pesquisar qualquer cidade do Brasil (ex: Frederico Westphalen)..."
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 focus:border-neutral-900 dark:focus:border-white transition-all placeholder:text-neutral-400"
              />
              {isLoadingBrCities && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                </div>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {tab2SearchResults.map((cityObj) => (
                <button
                  key={`${cityObj.name}-${cityObj.uf || ""}`}
                  type="button"
                  onClick={() => onSelectCity(cityObj.name)}
                  className="w-full text-left p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">
                        {cityObj.name}
                      </span>
                      {cityObj.uf && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                          {cityObj.uf}
                        </span>
                      )}
                      {cityObj.isAvailable && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200">
                          Entregas na região
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block mt-0.5">
                      Ver estabelecimentos em {cityObj.name}
                    </span>
                  </div>
                </button>
              ))}

              {tab2SearchResults.length === 0 && (
                <div className="py-8 text-center text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  Nenhuma cidade encontrada para &quot;{citySearch}&quot;.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
