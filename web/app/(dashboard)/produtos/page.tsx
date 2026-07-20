"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  API_URL,
  StoreProduct,
  StoreProductCategory,
  ProductAddon,
  formatProductPrice,
  SaleType,
  SUGGESTED_PRODUCT_CATEGORIES,
  getVendorStore,
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  listProductAddons,
  createProductAddon,
  updateProductAddon,
  deleteProductAddon,
  uploadFile,
} from "@/lib/api";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Layers,
  Image as ImageIcon,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  DollarSign,
  Tag,
  Eye,
  EyeOff,
  Package,
  ShoppingBag,
  ListPlus,
  Loader2,
  Trash
} from "lucide-react";

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  category_id: string;
  sale_type: SaleType;
  image: string;
}

const EMPTY_FORM: ProductFormData = {
  name: "",
  description: "",
  price: "",
  category_id: "",
  sale_type: "unit",
  image: "",
};

export default function ProdutosPage() {
  const { token } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<StoreProduct | null>(null);

  const [addonsProductId, setAddonsProductId] = useState<string | null>(null);
  const [addons, setAddons] = useState<ProductAddon[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("");
  const [addonSaving, setAddonSaving] = useState(false);
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
      const { products: prods, categories: cats } = await listProducts(token, store.id);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error(err);
      showToast("Erro ao carregar dados", "error");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCreateForm = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (p: StoreProduct) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      category_id: p.category_id || "",
      sale_type: (p.sale_type as SaleType) || "unit",
      image: p.image || "",
    });
    setShowForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    try {
      const blobUrl = URL.createObjectURL(file);
      const { url } = await uploadFile(token, blobUrl, file.name, file.type);
      URL.revokeObjectURL(blobUrl);
      setForm((prev) => ({ ...prev, image: url }));
      showToast("Imagem enviada com sucesso!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro no upload", "error");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveProduct = async () => {
    if (!token || !storeId) return;
    if (!form.name.trim()) {
      showToast("O nome do produto é obrigatório", "error");
      return;
    }
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) {
      showToast("O preço deve ser maior que zero", "error");
      return;
    }
    setSaving(true);
    try {
      // Determine if category_id is a UUID or a fallback custom category string
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(form.category_id);
      const categoryIdParam = isUuid ? form.category_id : undefined;
      const categoryNameParam = !isUuid && form.category_id ? form.category_id : undefined;

      if (editingProduct) {
        const { product } = await updateProduct(token, editingProduct.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          price,
          image: form.image || null,
          category_id: categoryIdParam || null,
          category: categoryNameParam,
          sale_type: form.sale_type,
        });
        setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)));
        showToast("Produto atualizado com sucesso!");
      } else {
        const { product } = await createProduct(token, storeId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          price,
          image: form.image || undefined,
          category_id: categoryIdParam || undefined,
          category: categoryNameParam,
          sale_type: form.sale_type,
        });
        setProducts((prev) => [product, ...prev]);
        showToast("Produto criado com sucesso!");
      }
      setShowForm(false);
      // Reload categories to fetch the newly created ones
      if (categoryNameParam) {
        const { categories: cats } = await listProducts(token, storeId);
        setCategories(cats);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao salvar produto", "error");
    }
    setSaving(false);
  };

  const handleToggleAvailability = async (p: StoreProduct) => {
    if (!token) return;
    try {
      const { product } = await updateProduct(token, p.id, { is_available: !p.is_available });
      setProducts((prev) => prev.map((x) => (x.id === p.id ? product : x)));
      showToast(
        product.is_available
          ? `${product.name} está disponível para venda.`
          : `${product.name} foi pausado temporariamente.`
      );
    } catch (err) {
      console.error(err);
      showToast("Erro ao atualizar disponibilidade", "error");
    }
  };

  const handleDeleteProduct = async () => {
    if (!token || !deleteTarget) return;
    setSaving(true);
    try {
      await deleteProduct(token, deleteTarget.id);
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      showToast(`${deleteTarget.name} foi excluído.`);
      setDeleteTarget(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao excluir", "error");
    }
    setSaving(false);
  };

  const openAddons = async (productId: string) => {
    setAddonsProductId(productId);
    setAddons([]);
    setNewAddonName("");
    setNewAddonPrice("");
    if (!token) return;
    setAddonsLoading(true);
    try {
      const { addons: list } = await listProductAddons(token, productId);
      setAddons(list);
    } catch (err) {
      console.error(err);
      showToast("Erro ao carregar adicionais", "error");
    }
    setAddonsLoading(false);
  };

  const handleCreateAddon = async () => {
    if (!token || !addonsProductId || !newAddonName.trim() || !newAddonPrice) return;
    const price = parseFloat(newAddonPrice);
    if (isNaN(price) || price < 0) {
      showToast("O preço do adicional deve ser válido", "error");
      return;
    }
    setAddonSaving(true);
    try {
      const { addon } = await createProductAddon(token, addonsProductId, {
        name: newAddonName.trim(),
        price,
      });
      setAddons((prev) => [...prev, addon]);
      setNewAddonName("");
      setNewAddonPrice("");
      showToast("Adicional inserido com sucesso!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao criar adicional", "error");
    }
    setAddonSaving(false);
  };

  const handleToggleAddon = async (addon: ProductAddon) => {
    if (!token) return;
    try {
      const { addon: updated } = await updateProductAddon(token, addon.id, {
        is_available: !addon.is_available,
      });
      setAddons((prev) => prev.map((a) => (a.id === addon.id ? updated : a)));
      showToast(
        updated.is_available
          ? `${updated.name} está disponível.`
          : `${updated.name} está pausado.`
      );
    } catch (err) {
      console.error(err);
      showToast("Erro ao atualizar adicional", "error");
    }
  };

  const handleDeleteAddon = async (addonId: string) => {
    if (!token) return;
    try {
      await deleteProductAddon(token, addonId);
      setAddons((prev) => prev.filter((a) => a.id !== addonId));
      showToast("Adicional removido.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao excluir adicional", "error");
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
          Carregando seus produtos...
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
          Você precisa criar e configurar sua loja na aba <strong>Minha Loja</strong> antes de gerenciar seus produtos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
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
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Produtos</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/25">
              {products.length} cadastrado{products.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Gerencie seu cardápio, adicione novos itens e configure adicionais.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/10 cursor-pointer active:scale-98"
        >
          <Plus className="h-4.5 w-4.5" />
          Novo Produto
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto por nome..."
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-all placeholder:text-slate-400"
        />
      </div>

      {/* Main List Area */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-250 dark:border-slate-800 py-16 text-center text-sm text-slate-400 dark:text-slate-650 bg-white dark:bg-slate-900">
          <ShoppingBag className="w-12 h-12 text-slate-300 dark:text-slate-800 mx-auto mb-3" />
          <p className="font-semibold text-slate-700 dark:text-slate-350">
            {search ? "Nenhum produto correspondente." : "Nenhum produto cadastrado."}
          </p>
          <p className="text-xs text-slate-450 dark:text-slate-500 mt-1 max-w-xs mx-auto">
            {search ? "Tente alterar o termo buscado na barra de pesquisa." : "Comece inserindo seu primeiro produto no cardápio."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 shadow-xs">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/50">
                    <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Produto</th>
                    <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Preço</th>
                    <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Categoria</th>
                    <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Venda</th>
                    <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Status</th>
                    <th className="px-6 py-4 text-right font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {filtered.map((p) => (
                    <tr key={p.id} className="group hover:bg-slate-50/45 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {p.image ? (
                            <img
                              src={`${API_URL}${p.image}`}
                              alt={p.name}
                              className="h-11 w-11 rounded-xl object-cover shadow-xs border border-slate-100 dark:border-slate-800 transition-transform group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-600 border border-slate-100 dark:border-slate-850">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{p.name}</p>
                            {p.description && (
                              <p className="max-w-[220px] truncate text-xs text-slate-400 mt-0.5">{p.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-850 dark:text-slate-100">
                        {formatProductPrice(p.price)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-850">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">
                        {p.sale_type === "weight" ? "Peso (kg)" : "Unidade"}
                      </td>
                      <td className="px-6 py-4">
                        {/* Switch Switch */}
                        <button
                          onClick={() => handleToggleAvailability(p)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            p.is_available ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                              p.is_available ? "translate-x-4.5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={() => openAddons(p.id)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                          >
                            <ListPlus className="w-3.5 h-3.5" />
                            <span>Addons</span>
                          </button>
                          <button
                            onClick={() => openEditForm(p)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filtered.map((p) => (
              <div key={p.id} className="rounded-2xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 p-4 shadow-xs">
                <div className="flex gap-3">
                  {p.image ? (
                    <img src={`${API_URL}${p.image}`} alt={p.name} className="h-14 w-14 rounded-xl object-cover border border-slate-100 dark:border-slate-850" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-600 border border-slate-100 dark:border-slate-850">
                      <Package className="h-6 w-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-900 dark:text-white truncate text-sm">{p.name}</p>
                      {/* Availability toggle switch */}
                      <button
                        onClick={() => handleToggleAvailability(p)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                          p.is_available ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                            p.is_available ? "translate-x-4.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                    <p className="mt-0.5 text-sm font-bold text-slate-850 dark:text-slate-100">{formatProductPrice(p.price)}</p>
                    <p className="text-xs text-slate-450 dark:text-slate-550 mt-1 flex items-center gap-1">
                      <span className="px-1.5 py-0.2 bg-slate-50 dark:bg-slate-950 rounded-md border border-slate-100 dark:border-slate-850">{p.category}</span>
                      <span>·</span>
                      <span>{p.sale_type === "weight" ? "Peso" : "Unidade"}</span>
                    </p>
                  </div>
                </div>

                {/* Mobile Button Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-850 flex gap-2">
                  <button
                    onClick={() => openAddons(p.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <ListPlus className="w-3.5 h-3.5 text-slate-450" />
                    <span>Addons</span>
                  </button>
                  <button
                    onClick={() => openEditForm(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5 text-slate-450" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-rose-100 dark:border-rose-950/20 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/10 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* PRODUCT FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 pt-[5vh]">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {editingProduct ? "Editar Produto" : "Novo Produto"}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {editingProduct ? "Altere as configurações do item cadastrado." : "Preencha as informações do novo item do seu cardápio."}
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Nome do produto *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                  placeholder="Ex: Hambúrguer Duplo com Bacon"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Descrição
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none transition-all placeholder:text-slate-400"
                  placeholder="Ingredientes, porção, tamanho, alergênicos..."
                />
              </div>

              {/* Price and Sale Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Preço (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="w-full rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Cobrança / Venda
                  </label>
                  <select
                    value={form.sale_type}
                    onChange={(e) => setForm((f) => ({ ...f, sale_type: e.target.value as SaleType }))}
                    className="w-full rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-3 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none cursor-pointer transition-all"
                  >
                    <option value="unit">Por Unidade</option>
                    <option value="weight">Por Peso (kg)</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Categoria
                </label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                  className="w-full rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-3 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none cursor-pointer transition-all"
                >
                  <option value="">Selecionar categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {categories.length === 0 &&
                    SUGGESTED_PRODUCT_CATEGORIES.map((name) => (
                      <option key={name} value={name}>
                        {name} (criar ao salvar)
                      </option>
                    ))}
                </select>
              </div>

              {/* Image Uploader */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Imagem do Produto
                </label>
                <div className="flex items-center gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  
                  {form.image ? (
                    <div className="relative group/img-preview">
                      <img
                        src={`${API_URL}${form.image}`}
                        alt="Preview"
                        className="h-16 w-16 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, image: "" }))}
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-md hover:bg-rose-650 transition-colors cursor-pointer"
                        title="Remover Imagem"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="h-16 w-full max-w-sm rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-900 bg-slate-50/50 dark:bg-slate-950 flex flex-col items-center justify-center cursor-pointer transition-colors text-slate-400 hover:text-emerald-500 dark:text-slate-600 disabled:opacity-50"
                    >
                      {uploading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <ImageIcon className="h-5 w-5 mb-1" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">Carregar Imagem</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-slate-250 dark:border-slate-800 px-4 py-3 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveProduct}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-650 text-white px-4 py-3 text-sm font-semibold transition-all cursor-pointer shadow-sm shadow-emerald-600/10 active:scale-98 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <Check className="h-4.5 w-4.5" />
                )}
                <span>{saving ? "Salvando..." : editingProduct ? "Salvar" : "Criar Produto"}</span>
              </button>
            </div>
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
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Excluir Produto</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Tem certeza que deseja remover <strong>{deleteTarget.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-slate-250 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteProduct}
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

      {/* ADDONS MODAL */}
      {addonsProductId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 pt-[5vh]">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Adicionais / Complementos</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Configure as opções de personalização deste produto.
                </p>
              </div>
              <button
                onClick={() => setAddonsProductId(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Create Addon Form */}
            <div className="mt-6 flex gap-2">
              <input
                type="text"
                value={newAddonName}
                onChange={(e) => setNewAddonName(e.target.value)}
                placeholder="Ex: Queijo Extra, Molho Especial"
                className="flex-1 rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={newAddonPrice}
                onChange={(e) => setNewAddonPrice(e.target.value)}
                placeholder="R$ 0.00"
                className="w-24 rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400"
              />
              <button
                onClick={handleCreateAddon}
                disabled={addonSaving || !newAddonName.trim() || !newAddonPrice}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-650 text-white px-4 py-2.5 text-sm font-bold transition-all shadow-sm shadow-emerald-600/10 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {addonSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4.5 h-4.5" />
                )}
              </button>
            </div>

            {/* List of Addons */}
            <div className="mt-6 max-h-[45vh] divide-y divide-slate-100 dark:divide-slate-850 overflow-y-auto pr-1">
              {addonsLoading ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  <p className="text-xs text-slate-450 dark:text-slate-550 font-medium">Carregando adicionais...</p>
                </div>
              ) : addons.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-600">
                  Nenhum adicional cadastrado para este produto.
                </div>
              ) : (
                addons.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-3.5">
                    <div className="flex items-center gap-3">
                      {/* Toggle Switch */}
                      <button
                        onClick={() => handleToggleAddon(a)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                          a.is_available ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-850"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                            a.is_available ? "translate-x-4.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                      <div>
                        <p className={`text-sm font-bold transition-colors ${a.is_available ? "text-slate-800 dark:text-slate-200" : "text-slate-405 dark:text-slate-550 line-through"}`}>
                          {a.name}
                        </p>
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">{formatProductPrice(a.price)}</p>
                      </div>
                    </div>
                    
                    {/* Delete addon */}
                    <button
                      onClick={() => handleDeleteAddon(a.id)}
                      className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 dark:hover:text-rose-450 transition-colors cursor-pointer"
                      title="Excluir Adicional"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
