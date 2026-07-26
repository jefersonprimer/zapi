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
  batchDiscountProducts,
  listProductAddons,
  createProductAddon,
  updateProductAddon,
  deleteProductAddon,
  uploadFile,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from "@/lib/api";
import {
  Search,
  Plus,
  Edit,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Package,
  ShoppingBag,
  ListPlus,
  Loader2,
  Trash,
  Percent,
  Layers,
  CheckSquare,
  Square,
  Folder,
  ArrowUp,
  ArrowDown,
  DollarSign,
  ChevronDown,
  UploadCloud,
  Camera,
} from "lucide-react";
import Image from "next/image";

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  discount_percent: string;
  promotional_price: string;
  category_id: string;
  sale_type: SaleType;
  image: string;
}

const EMPTY_FORM: ProductFormData = {
  name: "",
  description: "",
  price: "",
  discount_percent: "",
  promotional_price: "",
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
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [showForm, setShowForm] = useState(false);
  const [showPromoInputs, setShowPromoInputs] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(
    null,
  );
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

  // Bulk Selection & Batch Promotion State
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTargetScope, setBulkTargetScope] = useState<
    "selected" | "category" | "all"
  >("selected");
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const [bulkDiscountPercent, setBulkDiscountPercent] = useState<string>("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Category management modal state
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [deleteCategoryTarget, setDeleteCategoryTarget] =
    useState<StoreProductCategory | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);

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
      const { products: prods, categories: cats } = await listProducts(
        token,
        store.id,
      );
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error(err);
      showToast("Erro ao carregar dados", "error");
    }
    setLoading(false);
  }, [token]);

  const handleCreateCategory = async () => {
    if (!token || !storeId || !newCategoryName.trim()) return;
    setCategorySaving(true);
    try {
      const { category } = await createCategory(token, storeId, {
        name: newCategoryName.trim(),
      });
      setCategories((prev) => [...prev, category]);
      setNewCategoryName("");
      showToast("Categoria adicionada com sucesso!");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao criar categoria",
        "error",
      );
    }
    setCategorySaving(false);
  };

  const handleUpdateCategory = async (id: string) => {
    if (!token || !editingCategoryName.trim()) return;
    setCategorySaving(true);
    try {
      const { category } = await updateCategory(token, id, {
        name: editingCategoryName.trim(),
      });
      setCategories((prev) => prev.map((c) => (c.id === id ? category : c)));
      setProducts((prev) =>
        prev.map((p) =>
          p.category_id === id ? { ...p, category: category.name } : p,
        ),
      );
      setEditingCategoryId(null);
      setEditingCategoryName("");
      showToast("Categoria atualizada com sucesso!");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao atualizar",
        "error",
      );
    }
    setCategorySaving(false);
  };

  const handleDeleteCategory = async () => {
    if (!token || !deleteCategoryTarget) return;
    setCategorySaving(true);
    try {
      await deleteCategory(token, deleteCategoryTarget.id);
      setCategories((prev) =>
        prev.filter((c) => c.id !== deleteCategoryTarget.id),
      );
      setProducts((prev) =>
        prev.map((p) =>
          p.category_id === deleteCategoryTarget.id
            ? { ...p, category_id: null, category: "" }
            : p,
        ),
      );
      showToast("Categoria excluída!");
      setDeleteCategoryTarget(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao excluir",
        "error",
      );
    }
    setCategorySaving(false);
  };

  const handleMoveCategory = async (index: number, direction: -1 | 1) => {
    if (!token || !storeId) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= categories.length) return;

    const reordered = [...categories];
    [reordered[index], reordered[newIndex]] = [
      reordered[newIndex],
      reordered[index],
    ];
    const items = reordered.map((c, i) => ({ id: c.id, sort_order: i }));

    setCategories(reordered.map((c, i) => ({ ...c, sort_order: i })));

    try {
      const { categories: updated } = await reorderCategories(
        token,
        storeId,
        items,
      );
      setCategories(updated);
      showToast("Ordem das categorias atualizada!");
    } catch (err) {
      console.error(err);
      // fallback and load
      const { categories: cats } = await listProducts(
        token,
        storeId,
      );
      setCategories(cats);
    }
  };

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

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description &&
        p.description.toLowerCase().includes(search.toLowerCase()));

    if (selectedCategory === "all") return matchesSearch;
    return (
      matchesSearch &&
      (p.category_id === selectedCategory || p.category === selectedCategory)
    );
  });

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const updateFormPricing = (fields: {
    price?: string;
    discount_percent?: string;
    promotional_price?: string;
    source: "price" | "discount" | "promo" | "clear";
  }) => {
    setForm((prev) => {
      const nextPrice = fields.price !== undefined ? fields.price : prev.price;
      let nextDiscount =
        fields.discount_percent !== undefined
          ? fields.discount_percent
          : prev.discount_percent;
      let nextPromo =
        fields.promotional_price !== undefined
          ? fields.promotional_price
          : prev.promotional_price;

      if (fields.source === "clear") {
        return {
          ...prev,
          price: nextPrice,
          discount_percent: "",
          promotional_price: "",
        };
      }

      const numPrice = parseFloat(nextPrice);
      if (!isNaN(numPrice) && numPrice > 0) {
        if (fields.source === "discount") {
          const numDiscount = parseFloat(nextDiscount);
          if (!isNaN(numDiscount) && numDiscount > 0 && numDiscount < 100) {
            const calculatedPromo = numPrice * (1 - numDiscount / 100);
            nextPromo = calculatedPromo.toFixed(2);
          } else if (nextDiscount === "") {
            nextPromo = "";
          }
        } else if (fields.source === "promo") {
          const numPromo = parseFloat(nextPromo);
          if (!isNaN(numPromo) && numPromo > 0 && numPromo < numPrice) {
            const calculatedDiscount = Math.round(
              ((numPrice - numPromo) / numPrice) * 100,
            );
            nextDiscount = String(calculatedDiscount);
          } else if (nextPromo === "") {
            nextDiscount = "";
          }
        } else if (fields.source === "price") {
          const numDiscount = parseFloat(nextDiscount);
          if (!isNaN(numDiscount) && numDiscount > 0 && numDiscount < 100) {
            const calculatedPromo = numPrice * (1 - numDiscount / 100);
            nextPromo = calculatedPromo.toFixed(2);
          } else {
            const numPromo = parseFloat(nextPromo);
            if (!isNaN(numPromo) && numPromo > 0 && numPromo < numPrice) {
              const calculatedDiscount = Math.round(
                ((numPrice - numPromo) / numPrice) * 100,
              );
              nextDiscount = String(calculatedDiscount);
            }
          }
        }
      }

      return {
        ...prev,
        price: nextPrice,
        discount_percent: nextDiscount,
        promotional_price: nextPromo,
      };
    });
  };

  const openCreateForm = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setShowPromoInputs(false);
    setShowForm(true);
  };

  const openEditForm = (p: StoreProduct) => {
    setEditingProduct(p);
    let discountPct = "";
    const hasPromo = !!(
      p.promotional_price &&
      p.promotional_price > 0 &&
      p.promotional_price < p.price
    );
    if (hasPromo) {
      discountPct = String(
        Math.round(((p.price - p.promotional_price!) / p.price) * 100),
      );
    }
    setForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      discount_percent: discountPct,
      promotional_price: p.promotional_price ? String(p.promotional_price) : "",
      category_id: p.category_id || "",
      sale_type: (p.sale_type as SaleType) || "unit",
      image: p.image || "",
    });
    setShowPromoInputs(hasPromo);
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
    const promotionalPriceNum = form.promotional_price
      ? parseFloat(form.promotional_price)
      : null;
    if (
      promotionalPriceNum !== null &&
      (isNaN(promotionalPriceNum) ||
        promotionalPriceNum >= price ||
        promotionalPriceNum <= 0)
    ) {
      showToast(
        "O preço promocional deve ser maior que zero e menor que o preço normal",
        "error",
      );
      return;
    }
    setSaving(true);
    try {
      const isUuid =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
          form.category_id,
        );
      const categoryIdParam = isUuid ? form.category_id : undefined;
      const categoryNameParam =
        !isUuid && form.category_id ? form.category_id : undefined;

      if (editingProduct) {
        const { product } = await updateProduct(token, editingProduct.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          price,
          promotional_price: promotionalPriceNum,
          image: form.image || null,
          category_id: categoryIdParam || null,
          category: categoryNameParam,
          sale_type: form.sale_type,
        });
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? product : p)),
        );
        showToast("Produto atualizado com sucesso!");
      } else {
        const { product } = await createProduct(token, storeId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          price,
          promotional_price: promotionalPriceNum,
          image: form.image || undefined,
          category_id: categoryIdParam || undefined,
          category: categoryNameParam,
          sale_type: form.sale_type,
        });
        setProducts((prev) => [product, ...prev]);
        showToast("Produto criado com sucesso!");
      }
      setShowForm(false);
      if (categoryNameParam) {
        const { categories: cats } = await listProducts(token, storeId);
        setCategories(cats);
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao salvar produto",
        "error",
      );
    }
    setSaving(false);
  };

  const handleToggleAvailability = async (p: StoreProduct) => {
    if (!token) return;
    try {
      const { product } = await updateProduct(token, p.id, {
        is_available: !p.is_available,
      });
      setProducts((prev) => prev.map((x) => (x.id === p.id ? product : x)));
      showToast(
        product.is_available
          ? `${product.name} está disponível para venda.`
          : `${product.name} foi pausado temporariamente.`,
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
      setSelectedProductIds((prev) =>
        prev.filter((id) => id !== deleteTarget.id),
      );
      showToast(`${deleteTarget.name} foi excluído.`);
      setDeleteTarget(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao excluir",
        "error",
      );
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
    if (!token || !addonsProductId || !newAddonName.trim() || !newAddonPrice)
      return;
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
      showToast(
        err instanceof Error ? err.message : "Erro ao criar adicional",
        "error",
      );
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
          : `${updated.name} está pausado.`,
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
      showToast(
        err instanceof Error ? err.message : "Erro ao excluir adicional",
        "error",
      );
    }
  };

  // Bulk Discount Modal Handlers
  const openBulkDiscountModal = (
    scope: "selected" | "category" | "all" = "selected",
  ) => {
    setBulkTargetScope(scope);
    if (scope === "category" && categories.length > 0) {
      setBulkCategoryId(categories[0].id);
    }
    setBulkDiscountPercent("");
    setShowBulkModal(true);
  };

  const handleApplyBulkDiscount = async (clear: boolean = false) => {
    if (!token || !storeId) return;
    const pct = parseFloat(bulkDiscountPercent);
    if (!clear && (isNaN(pct) || pct <= 0 || pct >= 100)) {
      showToast(
        "Informe uma porcentagem de desconto válida entre 1% e 99%",
        "error",
      );
      return;
    }

    setBulkSaving(true);
    try {
      const payload: {
        product_ids?: string[];
        category_id?: string;
        apply_to_all?: boolean;
        discount_percent?: number;
        clear_discount?: boolean;
      } = {
        clear_discount: clear,
        discount_percent: clear ? undefined : pct,
      };

      if (bulkTargetScope === "selected") {
        if (selectedProductIds.length === 0) {
          showToast("Nenhum produto selecionado", "error");
          setBulkSaving(false);
          return;
        }
        payload.product_ids = selectedProductIds;
      } else if (bulkTargetScope === "category") {
        if (!bulkCategoryId) {
          showToast("Selecione uma categoria", "error");
          setBulkSaving(false);
          return;
        }
        payload.category_id = bulkCategoryId;
      } else {
        payload.apply_to_all = true;
      }

      const { products: updatedProducts } = await batchDiscountProducts(
        token,
        storeId,
        payload,
      );
      setProducts(updatedProducts);
      setSelectedProductIds([]);
      setShowBulkModal(false);
      showToast(
        clear
          ? "Promoção removida dos produtos com sucesso!"
          : `Desconto de ${pct}% aplicado com sucesso!`,
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao aplicar promoção em lote",
        "error",
      );
    }
    setBulkSaving(false);
  };

  // Affected products helper for bulk preview
  const getBulkAffectedProducts = (): StoreProduct[] => {
    if (bulkTargetScope === "selected") {
      return products.filter((p) => selectedProductIds.includes(p.id));
    } else if (bulkTargetScope === "category") {
      return products.filter(
        (p) =>
          p.category_id === bulkCategoryId || p.category === bulkCategoryId,
      );
    } else {
      return products;
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
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Loja Não Encontrada
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Você precisa criar e configurar sua loja na aba{" "}
          <strong>Minha Loja</strong> antes de gerenciar seus produtos.
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
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Produtos
            </h1>
            <span>
              ({products.length} cadastrado{products.length !== 1 ? "s" : ""})
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Gerencie seu cardápio, adicione preços promocionais e aplique
            descontos em lote.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowCategoriesModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors cursor-pointer active:scale-98"
          >
            <Folder className="h-4.5 w-4.5 text-slate-500 dark:text-slate-400" />
            <span>Categorias</span>
          </button>
          <button
            onClick={() =>
              openBulkDiscountModal(
                selectedProductIds.length > 0 ? "selected" : "all",
              )
            }
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 px-4 py-2.5 text-sm font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-all shadow-xs cursor-pointer active:scale-98"
          >
            <Percent className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>Promoção em Lote</span>
          </button>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/10 cursor-pointer active:scale-98"
          >
            <Plus className="h-4.5 w-4.5" />
            Novo Produto
          </button>
        </div>
      </div>

      {/* Floating Bulk Actions Bar when items are selected */}
      {selectedProductIds.length > 0 && (
        <div className="sticky top-4 z-40 flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30">
              {selectedProductIds.length}
            </span>
            <span className="text-sm font-semibold text-slate-200">
              produto{selectedProductIds.length > 1 ? "s" : ""} selecionado
              {selectedProductIds.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openBulkDiscountModal("selected")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Aplicar Desconto (%)</span>
            </button>
            <button
              onClick={() => handleApplyBulkDiscount(true)}
              disabled={bulkSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-650 text-slate-200 text-xs font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remover Promoção</span>
            </button>
            <button
              onClick={() => setSelectedProductIds([])}
              className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Deselecionar
            </button>
          </div>
        </div>
      )}

      {/* Search and Category Filters */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto por nome ou descrição..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-900 py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`p-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
              selectedCategory === "all"
                ? "bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/10"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:border-slate-350 dark:hover:border-slate-700"
            }`}
          >
            Todos os itens
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`p-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategory === cat.id
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/10"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:border-slate-350 dark:hover:border-slate-700"
              }`}
            >
              {cat.name}
            </button>
          ))}
          <button
            onClick={() => setShowCategoriesModal(true)}
            className="p-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-850 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/50 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Gerenciar</span>
          </button>
        </div>
      </div>

      {/* Main List Area */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 py-20 text-center text-sm text-slate-400 dark:text-slate-650 bg-white dark:bg-slate-900">
          <ShoppingBag className="w-16 h-16 text-slate-300 dark:text-slate-800 mx-auto mb-4" />
          <p className="font-bold text-base text-slate-700 dark:text-slate-350">
            {search || selectedCategory !== "all"
              ? "Nenhum produto correspondente."
              : "Nenhum produto cadastrado."}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
            {search || selectedCategory !== "all"
              ? "Tente alterar os termos da busca ou limpar os filtros de categoria."
              : "Comece inserindo seu primeiro produto no cardápio."}
          </p>
        </div>
      ) : (
        /* GORGEOUS DESIGN SYSTEM HORIZONTAL CARD VIEW */
        <div className="grid grid-cols-1 gap-6">
          {filtered.map((p) => {
            const isSelected = selectedProductIds.includes(p.id);
            return (
              <div
                key={p.id}
                className={`group p-2 relative flex flex-col sm:flex-row bg-white dark:bg-slate-900 rounded-lg border transition-all duration-300 ${
                  isSelected
                    ? "border-emerald-500 ring-2 ring-emerald-500/10 shadow-lg bg-emerald-50/5 dark:bg-emerald-950/5"
                    : "border-slate-150 dark:border-slate-800/85 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg hover:shadow-slate-100 dark:hover:shadow-none"
                }`}
              >
                {/* Image Section */}
                <div className="relative w-full sm:w-44 aspect-video sm:aspect-square bg-slate-50 dark:bg-slate-950 overflow-hidden flex-shrink-0 rounded-lg">
                  {/* Select Checkbox Overlay */}
                  <button
                    onClick={() => toggleSelectProduct(p.id)}
                    className={`absolute top-3 left-3 z-10 flex h-7 w-7 items-center justify-center rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-md border cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                      isSelected
                        ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                        : "border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-650"
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4.5 h-4.5" />
                    ) : (
                      <Square className="w-4.5 h-4.5" />
                    )}
                  </button>

                  {/* Product Image */}
                  {p.image ? (
                    <Image
                      src={`${API_URL}${p.image}`}
                      alt={p.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 bg-slate-50 dark:bg-slate-950">
                      <Package className="h-10 w-10 stroke-[1.5]" />
                      <span className="text-[10px] font-semibold tracking-wider uppercase mt-1">
                        Sem Imagem
                      </span>
                    </div>
                  )}
                </div>

                {/* Content Body */}
                <div className="flex flex-col flex-1 p-5 min-w-0 justify-between">
                  <div>
                    {/* Category & Status Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase">
                        {p.category || "Sem Categoria"}
                      </span>
                      <button
                        onClick={() => handleToggleAvailability(p)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-xs cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                          p.is_available
                            ? "bg-emerald-500 text-white animate-in fade-in duration-200"
                            : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-350"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full bg-current ${p.is_available ? "animate-pulse" : "opacity-60"}`}
                        />
                        {p.is_available ? "Disponível" : "Pausado"}
                      </button>
                    </div>

                    {/* Product Name */}
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 mt-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-450 transition-colors">
                      {p.name}
                    </h4>

                    {/* Description */}
                    <p className="text-xs text-slate-505 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {p.description ||
                        "Nenhuma descrição adicionada para este produto."}
                    </p>
                  </div>

                  {/* Pricing and Actions Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 mt-3">
                    {/* Pricing */}
                    <div className="flex items-center gap-2">
                      {p.promotional_price &&
                      p.promotional_price > 0 &&
                      p.promotional_price < p.price ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 line-through">
                            {formatProductPrice(p.price)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                              {formatProductPrice(p.promotional_price)}
                            </span>
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 py-0.5 rounded font-extrabold">
                              -
                              {Math.round(
                                ((p.price - p.promotional_price) / p.price) *
                                  100,
                              )}
                              %
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-base font-extrabold text-slate-850 dark:text-slate-100">
                          {formatProductPrice(p.price)}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-450 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg whitespace-nowrap">
                        {p.sale_type === "weight" ? "Peso" : "Unid."}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openAddons(p.id)}
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-650 dark:text-slate-350 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 transition-all cursor-pointer border border-slate-200 dark:border-slate-800 hover:border-transparent"
                      >
                        <ListPlus className="w-3.5 h-3.5" />
                        <span>Addons</span>
                      </button>
                      <button
                        onClick={() => openEditForm(p)}
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-650 dark:text-slate-350 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 transition-all cursor-pointer border border-slate-200 dark:border-slate-800 hover:border-transparent"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer border border-rose-100 dark:border-rose-950/20 hover:border-transparent"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SINGLE PRODUCT FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xs p-4 pt-[5vh]">
          <div className="w-full max-w-xl rounded-xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800/80 animate-in fade-in zoom-in-98 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {editingProduct ? "Editar Produto" : "Novo Produto"}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {editingProduct
                      ? "Altere os detalhes e preço do seu produto."
                      : "Insira as informações básicas, imagens e precificação do produto."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Nome do produto <span className="text-rose-500">*</span>
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 p-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                    placeholder="Ex: Hambúrguer Duplo com Bacon"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Descrição
                </label>
                <div className="relative group">
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    rows={2.5}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 p-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none transition-all placeholder:text-slate-400"
                    placeholder="Ingredientes, porção, tamanho, alergênicos..."
                  />
                </div>
              </div>

              {/* Pricing section with Custom UI Switch */}
              <div className="p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-150 dark:border-slate-800/40">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-355 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Modelo de Precificação
                  </span>

                  {/* Promotion Mode Switcher */}
                  <div className="flex p-0.5 rounded-xl bg-slate-150 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPromoInputs(false);
                        updateFormPricing({ source: "clear" });
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        !showPromoInputs
                          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-750 dark:hover:text-slate-300"
                      }`}
                    >
                      Preço Único
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPromoInputs(true)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        showPromoInputs
                          ? "bg-amber-500 text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-750 dark:hover:text-slate-300"
                      }`}
                    >
                      Promoção
                    </button>
                  </div>
                </div>

                {!showPromoInputs ? (
                  /* Simple Pricing */
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Preço de Venda <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-slate-400 dark:text-slate-505">
                        R$
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.price}
                        onChange={(e) =>
                          updateFormPricing({
                            price: e.target.value,
                            source: "price",
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-500"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                ) : (
                  /* Promotional Pricing Layout */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Price Normal */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Preço Normal <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            R$
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.price}
                            onChange={(e) =>
                              updateFormPricing({
                                price: e.target.value,
                                source: "price",
                              })
                            }
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {/* Discount Percent */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Desconto (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max="99"
                            value={form.discount_percent}
                            onChange={(e) =>
                              updateFormPricing({
                                discount_percent: e.target.value,
                                source: "discount",
                              })
                            }
                            className="w-full rounded-xl border border-amber-500/35 bg-amber-500/5 dark:bg-amber-500/10 dark:text-slate-100 px-3 py-2.5 pr-8 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-bold text-amber-600 dark:text-amber-400 transition-all"
                            placeholder="Ex: 15"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-amber-600 dark:text-amber-400">
                            %
                          </div>
                        </div>
                      </div>

                      {/* Promo Price */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Preço Promo
                        </label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 dark:text-emerald-450">
                            R$
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.promotional_price}
                            onChange={(e) =>
                              updateFormPricing({
                                promotional_price: e.target.value,
                                source: "promo",
                              })
                            }
                            className="w-full rounded-xl border border-emerald-500/35 bg-emerald-500/5 dark:bg-emerald-500/10 dark:text-slate-100 pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-600 dark:text-emerald-450 transition-all"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick Discount Buttons */}
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Aplicar Desconto Rápido:
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {[5, 10, 15, 20, 25, 30, 50].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() =>
                              updateFormPricing({
                                discount_percent: String(pct),
                                source: "discount",
                              })
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                              form.discount_percent === String(pct)
                                ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400"
                            }`}
                          >
                            {pct}% OFF
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Live Calculation */}
                    {(() => {
                      const p = parseFloat(form.price);
                      const promo = parseFloat(form.promotional_price);
                      if (
                        !isNaN(p) &&
                        !isNaN(promo) &&
                        p > 0 &&
                        promo > 0 &&
                        promo < p
                      ) {
                        const diff = p - promo;
                        const pct = Math.round((diff / p) * 100);
                        return (
                          <div className="p-3.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-between text-xs animate-in slide-in-from-top-1 duration-150">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-700 dark:text-slate-200 font-medium">
                                Cliente economiza{" "}
                                <strong className="font-bold text-slate-900 dark:text-white">
                                  R$ {diff.toFixed(2)}
                                </strong>{" "}
                                ({pct}% de desconto)
                              </span>
                            </div>
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-455 text-sm">
                              R$ {promo.toFixed(2)}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>

              {/* Category & Sale Type Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Sale Type */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Cobrança / Venda
                  </label>
                  <div className="relative">
                    <select
                      value={form.sale_type}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          sale_type: e.target.value as SaleType,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer appearance-none transition-all pr-10"
                    >
                      <option value="unit">Por Unidade (Unid.)</option>
                      <option value="weight">Por Peso (kg)</option>
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-505">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Category Selection */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Categoria do Produto
                  </label>
                  <div className="relative">
                    <select
                      value={form.category_id}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, category_id: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer appearance-none transition-all pr-10"
                    >
                      <option value="">Sem categoria definida</option>
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
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-550">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Image Uploader */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Imagem do Produto
                </label>
                <div className="flex flex-col items-stretch">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  {form.image ? (
                    <div className="relative group/img-preview w-44 h-44 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shadow-inner flex items-center justify-center">
                      <Image
                        src={`${API_URL}${form.image}`}
                        alt="Preview"
                        fill
                        className="object-cover transition-transform duration-300 group-hover/img-preview:scale-105"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img-preview:opacity-100 transition-opacity flex flex-col gap-2 items-center justify-center backdrop-blur-xs">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md hover:scale-105 transition-all cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Alterar Imagem</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, image: "" }))}
                          className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-md hover:scale-105 transition-all cursor-pointer"
                        >
                          <Trash className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="h-28 w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-800 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col items-center justify-center cursor-pointer transition-all text-slate-400 hover:text-emerald-500 dark:text-slate-650 disabled:opacity-50 hover:shadow-xs group"
                    >
                      {uploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                          <span className="text-xs text-slate-500">
                            Enviando imagem...
                          </span>
                        </div>
                      ) : (
                        <>
                          <UploadCloud className="h-7 w-7 mb-1.5 text-slate-400 dark:text-slate-505 group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-350">
                            Carregar foto do produto
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            Clique ou arraste um arquivo (JPG, PNG)
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveProduct}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-650 text-white px-4 py-3 text-sm font-bold transition-all cursor-pointer shadow-sm shadow-emerald-600/10 active:scale-[0.99] disabled:opacity-50"
              >
                <span>
                  {saving
                    ? "Salvando..."
                    : editingProduct
                      ? "Salvar Alterações"
                      : "Criar Produto"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK DISCOUNT / BATCH PROMOTION MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 pt-[5vh]">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  Promoção em Lote
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Aplique ou remova desconto percentual em vários produtos
                  simultaneamente.
                </p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              {/* Scope Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Aplicar Desconto em:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkTargetScope("selected")}
                    disabled={selectedProductIds.length === 0}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      bulkTargetScope === "selected"
                        ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Selecionados ({selectedProductIds.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkTargetScope("category")}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      bulkTargetScope === "category"
                        ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Por Categoria</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkTargetScope("all")}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      bulkTargetScope === "all"
                        ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Todos os Itens ({products.length})</span>
                  </button>
                </div>
              </div>

              {/* Category Dropdown if Category scope */}
              {bulkTargetScope === "category" && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Selecione a Categoria:
                  </label>
                  <select
                    value={bulkCategoryId}
                    onChange={(e) => setBulkCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Percentage Input & Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Porcentagem de Desconto (%):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="99"
                    value={bulkDiscountPercent}
                    onChange={(e) => setBulkDiscountPercent(e.target.value)}
                    placeholder="Ex: 20"
                    className="w-full rounded-lg border border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/20 dark:text-slate-100 px-4 py-3 text-base focus:ring-2 focus:ring-amber-500 outline-none font-bold text-amber-600 dark:text-amber-400"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-amber-600 dark:text-amber-400">
                    % OFF
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  {[10, 15, 20, 25, 30, 50].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setBulkDiscountPercent(String(pct))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        bulkDiscountPercent === String(pct)
                          ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview List */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Prévia dos produtos afetados (
                  {getBulkAffectedProducts().length}):
                </label>
                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30 p-2">
                  {getBulkAffectedProducts().length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-400">
                      Nenhum produto selecionado para esta opção.
                    </p>
                  ) : (
                    getBulkAffectedProducts().map((p) => {
                      const numPct = parseFloat(bulkDiscountPercent);
                      const hasDiscount =
                        !isNaN(numPct) && numPct > 0 && numPct < 100;
                      const calculatedPromo = hasDiscount
                        ? p.price * (1 - numPct / 100)
                        : null;
                      return (
                        <div
                          key={p.id}
                          className="py-2 px-1 flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                            {p.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 line-through">
                              R$ {p.price.toFixed(2)}
                            </span>
                            {calculatedPromo ? (
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                R$ {calculatedPromo.toFixed(2)} (-{numPct}%)
                              </span>
                            ) : (
                              <span className="text-slate-500">
                                R$ {p.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button
                type="button"
                onClick={() => handleApplyBulkDiscount(true)}
                disabled={bulkSaving || getBulkAffectedProducts().length === 0}
                className="flex-1 rounded-lg border border-slate-250 dark:border-slate-800 px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors cursor-pointer disabled:opacity-40"
              >
                Limpar Descontos
              </button>
              <button
                type="button"
                onClick={() => handleApplyBulkDiscount(false)}
                disabled={
                  bulkSaving ||
                  !bulkDiscountPercent ||
                  getBulkAffectedProducts().length === 0
                }
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-amber-600 text-white px-4 py-3 text-sm font-extrabold transition-all cursor-pointer shadow-sm shadow-amber-500/10 active:scale-98 disabled:opacity-50"
              >
                <span>{bulkSaving ? "Aplicando..." : "Aplicar Desconto"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center text-rose-500 mb-4 border border-rose-100 dark:border-rose-900/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Excluir Produto
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Tem certeza que deseja remover{" "}
              <strong>{deleteTarget.name}</strong>? Esta ação não pode ser
              desfeita.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-lg border border-slate-250 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer shadow-sm shadow-rose-600/10 active:scale-98 disabled:opacity-50"
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
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Adicionais / Complementos
                </h3>
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
                className="flex-1 rounded-lg border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={newAddonPrice}
                onChange={(e) => setNewAddonPrice(e.target.value)}
                placeholder="R$ 0.00"
                className="w-24 rounded-lg border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400"
              />
              <button
                onClick={handleCreateAddon}
                disabled={addonSaving || !newAddonName.trim() || !newAddonPrice}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-650 text-white px-4 py-2.5 text-sm font-bold transition-all shadow-sm shadow-emerald-600/10 cursor-pointer active:scale-95 disabled:opacity-50"
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
                  <p className="text-xs text-slate-450 dark:text-slate-550 font-medium">
                    Carregando adicionais...
                  </p>
                </div>
              ) : addons.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-600">
                  Nenhum adicional cadastrado para este produto.
                </div>
              ) : (
                addons.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3.5 bg-red-900  rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleAddon(a)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                          a.is_available
                            ? "bg-emerald-500"
                            : "bg-slate-200 dark:bg-slate-850"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                            a.is_available
                              ? "translate-x-4.5"
                              : "translate-x-0.5"
                          }`}
                        />
                      </button>
                      <div>
                        <p
                          className={`text-sm font-bold transition-colors ${a.is_available ? "text-slate-800 dark:text-slate-200" : "text-slate-405 dark:text-slate-550 line-through"}`}
                        >
                          {a.name}
                        </p>
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                          {formatProductPrice(a.price)}
                        </p>
                      </div>
                    </div>
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

      {/* CATEGORIES MANAGEMENT MODAL */}
      {showCategoriesModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 pt-[5vh]">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  Gerenciar Categorias
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Organize seus produtos criando, editando e ordenando as
                  categorias.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCategoriesModal(false);
                  setEditingCategoryId(null);
                  setNewCategoryName("");
                }}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nova Categoria Form */}
            <div className="mt-6 p-4 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">
                Nova Categoria
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
                  placeholder="Ex: Congelados, Bebidas, Lanches..."
                  className="flex-1 rounded-lg border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                />
                <button
                  onClick={handleCreateCategory}
                  disabled={categorySaving || !newCategoryName.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {categorySaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>Adicionar</span>
                </button>
              </div>
            </div>

            {/* List of Categories */}
            <div className="mt-6 max-h-[50vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850 border border-slate-150 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/20">
              {categories.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-650">
                  Nenhuma categoria cadastrada. Crie uma acima.
                </div>
              ) : (
                categories.map((cat, i) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Order buttons */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => handleMoveCategory(i, -1)}
                          disabled={i === 0}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                          title="Mover para cima"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveCategory(i, 1)}
                          disabled={i === categories.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                          title="Mover para baixo"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Sort Index */}
                      <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-600 w-5">
                        {i + 1}
                      </span>

                      {/* Name / Inline Edit */}
                      <div className="flex-1 min-w-0 pr-4">
                        {editingCategoryId === cat.id ? (
                          <input
                            autoFocus
                            value={editingCategoryName}
                            onChange={(e) =>
                              setEditingCategoryName(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleUpdateCategory(cat.id);
                              if (e.key === "Escape")
                                setEditingCategoryId(null);
                            }}
                            className="w-full rounded-lg border border-slate-250 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 px-2.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate block">
                            {cat.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {editingCategoryId === cat.id ? (
                        <>
                          <button
                            onClick={() => handleUpdateCategory(cat.id)}
                            disabled={categorySaving}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg cursor-pointer"
                            title="Salvar"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingCategoryId(null)}
                            className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingCategoryId(cat.id);
                              setEditingCategoryName(cat.name);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                            title="Editar nome"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteCategoryTarget(cat)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  setShowCategoriesModal(false);
                  setEditingCategoryId(null);
                  setNewCategoryName("");
                }}
                className="rounded-lg border border-slate-250 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY DELETE CONFIRMATION MODAL */}
      {deleteCategoryTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center text-rose-500 mb-4 border border-rose-100 dark:border-rose-900/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Excluir Categoria
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Tem certeza que deseja excluir a categoria{" "}
              <strong>{deleteCategoryTarget.name}</strong>? Os produtos
              associados continuarão existindo, mas ficarão sem categoria.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteCategoryTarget(null)}
                className="flex-1 rounded-xl border border-slate-250 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteCategory}
                disabled={categorySaving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer shadow-sm shadow-rose-600/10 active:scale-98 disabled:opacity-50"
              >
                {categorySaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4.5 w-4.5" />
                )}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
