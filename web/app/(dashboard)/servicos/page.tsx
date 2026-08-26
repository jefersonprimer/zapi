"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getVendorStore,
  listSchedulingServices,
  createSchedulingService,
  updateSchedulingService,
  deleteSchedulingService,
  uploadFile,
  SchedulingService,
} from "@/lib/api";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  UploadCloud,
  Camera,
  Scissors,
  Loader2,
} from "lucide-react";
import Image from "next/image";

interface ServiceFormData {
  name: string;
  description: string;
  price: string;
  duration_minutes: string;
  image_url: string;
}

const EMPTY_FORM: ServiceFormData = {
  name: "",
  description: "",
  price: "",
  duration_minutes: "30",
  image_url: "",
};

export default function ServicosPage() {
  const { token } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [services, setServices] = useState<SchedulingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<SchedulingService | null>(null);
  const [form, setForm] = useState<ServiceFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await getVendorStore(token);
      if (res && res.store) {
        setStoreId(res.store.id);
        const sList = await listSchedulingServices(res.store.id);
        setServices(sList);
      }
    } catch (err: any) {
      showToast(err.message || "Erro ao carregar dados", "error");
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setEditingService(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const handleOpenEdit = (service: SchedulingService) => {
    setEditingService(service);
    setForm({
      name: service.name,
      description: service.description || "",
      price: service.price.toString(),
      duration_minutes: service.duration_minutes.toString(),
      image_url: service.image_url || "",
    });
    setShowForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    try {
      setUploading(true);
      const data = await uploadFile(token, file);
      setForm((prev) => ({ ...prev, image_url: data.url }));
      showToast("Imagem enviada com sucesso!");
    } catch (err: any) {
      showToast(err.message || "Erro ao enviar imagem", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !storeId) return;

    if (!form.name.trim()) {
      showToast("Nome do serviço é obrigatório", "error");
      return;
    }

    const priceNum = parseFloat(form.price);
    if (isNaN(priceNum) || priceNum < 0) {
      showToast("Preço inválido", "error");
      return;
    }

    const durationNum = parseInt(form.duration_minutes, 10);
    if (isNaN(durationNum) || durationNum <= 0) {
      showToast("Duração inválida", "error");
      return;
    }

    try {
      setSaving(true);
      if (editingService) {
        await updateSchedulingService(token, editingService.id, {
          name: form.name,
          description: form.description || null,
          price: priceNum,
          duration_minutes: durationNum,
          image_url: form.image_url || null,
          is_available: editingService.is_available,
        });
        showToast("Serviço atualizado com sucesso!");
      } else {
        await createSchedulingService(token, {
          store_id: storeId,
          name: form.name,
          description: form.description || null,
          price: priceNum,
          duration_minutes: durationNum,
          image_url: form.image_url || null,
        });
        showToast("Serviço cadastrado com sucesso!");
      }
      setShowForm(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Erro ao salvar serviço", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailable = async (service: SchedulingService) => {
    if (!token) return;
    try {
      await updateSchedulingService(token, service.id, {
        name: service.name,
        description: service.description,
        price: service.price,
        duration_minutes: service.duration_minutes,
        image_url: service.image_url,
        is_available: !service.is_available,
      });
      showToast(`Serviço marcado como ${!service.is_available ? "disponível" : "indisponível"}`);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Erro ao atualizar status do serviço", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;

    try {
      await deleteSchedulingService(token, id);
      showToast("Serviço excluído com sucesso!");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Erro ao excluir serviço", "error");
    }
  };

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-white shadow-lg transition-all duration-300 ${
            toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Scissors className="h-6 w-6 text-emerald-500" />
            Serviços Ofertados
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Cadastre os serviços que seus clientes poderão agendar no seu estabelecimento.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 font-semibold transition-colors shadow-md shadow-emerald-500/10"
        >
          <Plus className="h-5 w-5" />
          Adicionar Serviço
        </button>
      </div>

      {/* Search and Filters */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar serviços pelo nome ou descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a2e] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Services List / Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#1a1a2e] rounded-lg border border-gray-100 dark:border-gray-850">
          <p className="text-gray-500 dark:text-gray-400">Nenhum serviço encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className={`relative flex flex-col justify-between bg-white dark:bg-[#1a1a2e] border rounded-xl overflow-hidden transition-all shadow-sm ${
                service.is_available
                  ? "border-gray-200 dark:border-gray-800 hover:shadow-md"
                  : "border-gray-150 dark:border-gray-900 opacity-60"
              }`}
            >
              <div>
                {/* Service Image banner or default icon */}
                <div className="relative h-44 w-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  {service.image_url ? (
                    <Image
                      src={service.image_url}
                      alt={service.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <Scissors className="h-12 w-12 text-gray-400 dark:text-gray-600" />
                  )}
                  <span className="absolute top-3 right-3 bg-emerald-500/90 text-white font-bold text-sm px-2.5 py-1 rounded-full backdrop-blur-sm">
                    R$ {service.price.toFixed(2)}
                  </span>
                </div>

                <div className="p-4 space-y-2">
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white leading-tight">
                    {service.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {service.description || "Sem descrição."}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
                    <Clock className="h-4 w-4 text-emerald-500" />
                    <span>{service.duration_minutes} min de duração</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-[#141427]/40">
                <button
                  onClick={() => handleToggleAvailable(service)}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-all ${
                    service.is_available
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                      : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10"
                  }`}
                >
                  {service.is_available ? "Disponível" : "Indisponível"}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEdit(service)}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-800"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/20 text-gray-600 dark:text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 transition-all border border-transparent hover:border-rose-100 dark:hover:border-rose-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-[#1a1a2e] rounded-xl border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-[#15152a]">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                {editingService ? "Editar Serviço" : "Novo Serviço"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Image upload box */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Foto do Serviço (Opcional)
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                    {form.image_url ? (
                      <Image
                        src={form.image_url}
                        alt="Service preview"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <Scissors className="h-7 w-7 text-gray-400" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 text-sm font-semibold px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-gray-700 dark:text-gray-300"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                    ) : (
                      <Camera className="h-4 w-4 text-emerald-500" />
                    )}
                    Alterar Foto
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Service Name */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Nome do Serviço *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Corte de Cabelo Degradê"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111124] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Descrição (Opcional)
                </label>
                <textarea
                  placeholder="Descreva detalhes ou diferenciais do serviço..."
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111124] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Price */}
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Preço (R$) *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4.5 w-4.5 text-gray-400" />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.price}
                      onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111124] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Duração (Minutos) *
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4.5 w-4.5 text-gray-400" />
                    <input
                      type="number"
                      placeholder="30"
                      value={form.duration_minutes}
                      onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111124] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-gray-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-gray-700 dark:text-gray-300 text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-450 text-white rounded-lg transition-all text-sm font-semibold shadow-md shadow-emerald-500/10"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar Serviço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
