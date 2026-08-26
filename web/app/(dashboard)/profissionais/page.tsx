"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getVendorStore,
  listProfessionals,
  createProfessional,
  updateProfessional,
  deleteProfessional,
  listSchedulingServices,
  uploadFile,
  Professional,
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
  Users,
  Camera,
  UploadCloud,
  Loader2,
  Info,
} from "lucide-react";
import Image from "next/image";

interface ProfFormData {
  name: string;
  bio: string;
  avatar_url: string;
  service_ids: string[];
}

const EMPTY_FORM: ProfFormData = {
  name: "",
  bio: "",
  avatar_url: "",
  service_ids: [],
};

export default function ProfissionaisPage() {
  const { token } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<SchedulingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingProf, setEditingProf] = useState<Professional | null>(null);
  const [form, setForm] = useState<ProfFormData>(EMPTY_FORM);
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
        const [pList, sList] = await Promise.all([
          listProfessionals(res.store.id),
          listSchedulingServices(res.store.id),
        ]);
        setProfessionals(pList);
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
    setEditingProf(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const handleOpenEdit = (prof: Professional) => {
    setEditingProf(prof);
    setForm({
      name: prof.name,
      bio: prof.bio || "",
      avatar_url: prof.avatar_url || "",
      service_ids: prof.service_ids || [],
    });
    setShowForm(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    try {
      setUploading(true);
      const data = await uploadFile(token, file);
      setForm((prev) => ({ ...prev, avatar_url: data.url }));
      showToast("Avatar enviado com sucesso!");
    } catch (err: any) {
      showToast(err.message || "Erro ao enviar avatar", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleService = (serviceId: string) => {
    setForm((prev) => {
      const selected = prev.service_ids.includes(serviceId)
        ? prev.service_ids.filter((id) => id !== serviceId)
        : [...prev.service_ids, serviceId];
      return { ...prev, service_ids: selected };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !storeId) return;

    if (!form.name.trim()) {
      showToast("Nome é obrigatório", "error");
      return;
    }

    try {
      setSaving(true);
      if (editingProf) {
        await updateProfessional(token, editingProf.id, {
          name: form.name,
          bio: form.bio || null,
          avatar_url: form.avatar_url || null,
          is_active: editingProf.is_active,
          service_ids: form.service_ids,
        });
        showToast("Profissional atualizado!");
      } else {
        await createProfessional(token, {
          store_id: storeId,
          name: form.name,
          bio: form.bio || null,
          avatar_url: form.avatar_url || null,
          service_ids: form.service_ids,
        });
        showToast("Profissional cadastrado!");
      }
      setShowForm(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Erro ao salvar profissional", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (prof: Professional) => {
    if (!token) return;
    try {
      await updateProfessional(token, prof.id, {
        name: prof.name,
        bio: prof.bio,
        avatar_url: prof.avatar_url,
        is_active: !prof.is_active,
        service_ids: prof.service_ids,
      });
      showToast(`Profissional marcado como ${!prof.is_active ? "ativo" : "inativo"}`);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Erro ao atualizar profissional", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!confirm("Tem certeza que deseja remover este profissional?")) return;

    try {
      await deleteProfessional(token, id);
      showToast("Profissional excluído com sucesso!");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Erro ao excluir profissional", "error");
    }
  };

  const filteredProfs = professionals.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.bio && p.bio.toLowerCase().includes(search.toLowerCase()))
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
            <Users className="h-6 w-6 text-emerald-500" />
            Profissionais / Equipe
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gerencie as pessoas que realizam os serviços no seu comércio e defina quais serviços cada um realiza.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 font-semibold transition-colors shadow-md shadow-emerald-500/10"
        >
          <Plus className="h-5 w-5" />
          Adicionar Profissional
        </button>
      </div>

      {/* Search and Filters */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar profissionais..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a2e] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Professionals List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
        </div>
      ) : filteredProfs.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#1a1a2e] rounded-lg border border-gray-100 dark:border-gray-850">
          <p className="text-gray-500 dark:text-gray-400">Nenhum profissional cadastrado.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProfs.map((prof) => (
            <div
              key={prof.id}
              className={`flex flex-col justify-between bg-white dark:bg-[#1a1a2e] border rounded-xl overflow-hidden shadow-sm transition-all ${
                prof.is_active
                  ? "border-gray-200 dark:border-gray-800 hover:shadow-md"
                  : "border-gray-150 dark:border-gray-900 opacity-60"
              }`}
            >
              <div className="p-5 space-y-4">
                {/* Profile Header */}
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 rounded-full overflow-hidden bg-gray-150 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-shrink-0">
                    {prof.avatar_url ? (
                      <Image
                        src={prof.avatar_url}
                        alt={prof.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-bold text-xl">
                        {prof.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white leading-tight">
                      {prof.name}
                    </h3>
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      prof.is_active
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                        : "bg-gray-100 text-gray-600 border border-gray-250 dark:bg-white/5 dark:text-gray-400"
                    }`}>
                      {prof.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>

                {/* Bio */}
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3">
                  {prof.bio || "Nenhuma biografia informada."}
                </p>

                {/* Executed Services count */}
                <div className="flex flex-wrap gap-1">
                  {prof.service_ids && prof.service_ids.length > 0 ? (
                    services
                      .filter((s) => prof.service_ids.includes(s.id))
                      .map((s) => (
                        <span
                          key={s.id}
                          className="text-[10px] bg-gray-50 border border-gray-150 text-gray-600 dark:bg-[#15152a] dark:border-gray-800 dark:text-gray-400 px-2 py-0.5 rounded-md"
                        >
                          {s.name}
                        </span>
                      ))
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <Info className="h-3.5 w-3.5" /> Nenhum serviço associado
                    </span>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-[#141427]/40">
                <button
                  onClick={() => handleToggleActive(prof)}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-all ${
                    prof.is_active
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400"
                      : "bg-gray-100 text-gray-600 border-gray-250 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400"
                  }`}
                >
                  {prof.is_active ? "Desativar" : "Ativar"}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEdit(prof)}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(prof.id)}
                    className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/20 text-gray-600 dark:text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 transition-all"
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
                {editingProf ? "Editar Profissional" : "Novo Profissional"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Profile image upload */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Foto de Perfil (Opcional)
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                    {form.avatar_url ? (
                      <Image
                        src={form.avatar_url}
                        alt="Avatar preview"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <Users className="h-6 w-6 text-gray-400" />
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
                    Carregar Foto
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Nome do Profissional *
                </label>
                <input
                  type="text"
                  placeholder="Ex: João da Silva"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111124] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Bio */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Breve Biografia / Especialidade
                </label>
                <textarea
                  placeholder="Ex: Especialista em cortes degradê e barboterapia..."
                  value={form.bio}
                  onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111124] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              {/* Services List selection (checkboxes) */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Serviços que Realiza
                </label>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2 bg-[#111124]">
                  {services.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Cadastre serviços primeiro para vinculá-los aos profissionais.
                    </p>
                  ) : (
                    services.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={form.service_ids.includes(s.id)}
                          onChange={() => handleToggleService(s.id)}
                          className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                        />
                        <span>{s.name} ({s.duration_minutes} min)</span>
                      </label>
                    ))
                  )}
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
                  Salvar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
