"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getVendorStore,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  StoreProductCategory,
} from "@/lib/api";
import {
  Folder,
  ArrowUp,
  ArrowDown,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar
} from "lucide-react";

export default function CategoriasPage() {
  const { token } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [categories, setCategories] = useState<StoreProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StoreProductCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
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
      const { categories: cats } = await listCategories(token, store.id);
      setCategories(cats);
    } catch (err) {
      console.error(err);
      showToast("Erro ao carregar categorias", "error");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!token || !storeId || !newName.trim()) return;
    setSaving(true);
    try {
      const { category } = await createCategory(token, storeId, { name: newName.trim() });
      setCategories((prev) => [...prev, category]);
      setNewName("");
      showToast("Categoria adicionada com sucesso!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao criar categoria", "error");
    }
    setSaving(false);
  };

  const handleUpdate = async (id: string) => {
    if (!token || !editingName.trim()) return;
    setSaving(true);
    try {
      const { category } = await updateCategory(token, id, { name: editingName.trim() });
      setCategories((prev) => prev.map((c) => (c.id === id ? category : c)));
      setEditingId(null);
      setEditingName("");
      showToast("Categoria atualizada com sucesso!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao atualizar", "error");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget) return;
    setSaving(true);
    try {
      await deleteCategory(token, deleteTarget.id);
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      showToast("Categoria excluída!");
      setDeleteTarget(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao excluir", "error");
    }
    setSaving(false);
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (!token || !storeId) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= categories.length) return;

    const reordered = [...categories];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    const items = reordered.map((c, i) => ({ id: c.id, sort_order: i }));

    setCategories(
      reordered.map((c, i) => ({ ...c, sort_order: i }))
    );

    try {
      const { categories: updated } = await reorderCategories(token, storeId, items);
      setCategories(updated);
      showToast("Ordem das categorias atualizada!");
    } catch (err) {
      console.error(err);
      load();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-100 dark:border-emerald-950/30" />
          <div className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
          Carregando categorias...
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
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Loja Não Encontrada</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Você precisa configurar sua loja para gerenciar categorias.
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Categorias</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/25">
              {categories.length} ativa{categories.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Organize os produtos da sua loja por categorias para facilitar a navegação do cliente.
          </p>
        </div>
      </div>

      {/* Create New Category Card */}
      <div className="rounded-2xl border border-slate-250 dark:border-slate-850 bg-white dark:bg-slate-900 p-6 shadow-xs">
        <h2 className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-3">Nova Categoria</h2>
        <div className="flex gap-2.5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Ex: Bebidas, Sobremesas, Pratos Principais"
            className="flex-1 rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400"
          />
          <button
            onClick={handleCreate}
            disabled={saving || !newName.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/10 cursor-pointer active:scale-98 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4.5 h-4.5" />
            )}
            <span className="hidden sm:inline">Adicionar</span>
          </button>
        </div>
      </div>

      {/* Table/List Area */}
      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-250 dark:border-slate-800 py-16 text-center text-sm text-slate-450 dark:text-slate-650 bg-white dark:bg-slate-900 shadow-xs">
          <Folder className="w-12 h-12 text-slate-350 dark:text-slate-800 mx-auto mb-3" />
          <p className="font-semibold text-slate-700 dark:text-slate-350">
            Nenhuma categoria cadastrada.
          </p>
          <p className="text-xs text-slate-450 dark:text-slate-500 mt-1">
            Crie categorias acima para começar a classificar seu cardápio.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden sm:block">
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 shadow-xs">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/50">
                    <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs w-16">Ordem</th>
                    <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Nome</th>
                    <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs w-44">Criada em</th>
                    <th className="px-6 py-4 text-right font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs w-64">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {categories.map((cat, i) => (
                    <tr key={cat.id} className="group hover:bg-slate-50/45 dark:hover:bg-slate-800/10 transition-colors">
                      <td className="px-6 py-4 text-slate-400 dark:text-slate-600 font-mono text-xs">{cat.sort_order + 1}</td>
                      <td className="px-6 py-4">
                        {editingId === cat.id ? (
                          <input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdate(cat.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="w-full rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                          />
                        ) : (
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{cat.name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(cat.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                          {/* Reordering */}
                          <button
                            onClick={() => handleMove(i, -1)}
                            disabled={i === 0}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850/30 rounded-lg disabled:opacity-20 cursor-pointer"
                            title="Mover para cima"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleMove(i, 1)}
                            disabled={i === categories.length - 1}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850/30 rounded-lg disabled:opacity-20 cursor-pointer"
                            title="Mover para baixo"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>

                          <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />

                          {editingId === cat.id ? (
                            <>
                              <button
                                onClick={() => handleUpdate(cat.id)}
                                disabled={saving}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-450 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Salvar</span>
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-550 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/30 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Cancelar</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingId(cat.id);
                                  setEditingName(cat.name);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850/40 cursor-pointer transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-slate-450" />
                                <span>Editar</span>
                              </button>
                              <button
                                onClick={() => setDeleteTarget(cat)}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Excluir</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 gap-4 sm:hidden">
            {categories.map((cat, i) => (
              <div key={cat.id} className="rounded-2xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 p-4 shadow-xs">
                {editingId === cat.id ? (
                  <div className="space-y-3">
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(cat.id)}
                        disabled={saving}
                        className="flex-1 rounded-xl bg-emerald-600 text-white py-2 text-xs font-bold shadow-sm cursor-pointer"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 rounded-xl border border-slate-250 dark:border-slate-800 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{cat.name}</p>
                        <p className="text-xs text-slate-450 dark:text-slate-500 mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Ordem: {cat.sort_order + 1} · {new Date(cat.created_at).toLocaleDateString("pt-BR")}</span>
                        </p>
                      </div>
                      <div className="flex gap-1 bg-slate-50 dark:bg-slate-950 rounded-xl p-1 border border-slate-100 dark:border-slate-850">
                        <button
                          onClick={() => handleMove(i, -1)}
                          disabled={i === 0}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:bg-white dark:hover:bg-slate-900 rounded-lg disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleMove(i, 1)}
                          disabled={i === categories.length - 1}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:bg-white dark:hover:bg-slate-900 rounded-lg disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-850 flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(cat.id);
                          setEditingName(cat.name);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 py-2 text-xs font-semibold text-slate-600 dark:text-slate-350 hover:bg-slate-50 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-450" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cat)}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-rose-100 dark:border-rose-950/20 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center text-rose-500 mb-4 border border-rose-100 dark:border-rose-900/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Excluir Categoria</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Tem certeza que deseja excluir a categoria <strong>{deleteTarget.name}</strong>? Os produtos associados continuarão existindo, mas sem categoria.
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
