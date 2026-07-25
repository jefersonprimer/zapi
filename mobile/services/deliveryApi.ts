import { authFetch, API_URL } from "./api";

export interface UserAddress {
  id: string;
  user_id: string;
  label: "casa" | "trabalho" | "outro";
  estado: string;
  cidade: string;
  bairro: string;
  cep: string;
  rua: string;
  numero: string;
  ponto_referencia: string | null;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  image_banner: string | null;
  phone: string | null;
  cnpj?: string | null;
  pix_key: string;
  category: string;
  delivery_fee: number;
  minimum_order: number;
  city: string;
  state: string;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  cep?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  prep_time_minutes?: number;
  distance_km?: number | null;
  eta_min?: number | null;
  accepts_delivery?: boolean;
  accepts_pickup?: boolean;
  schedule_days?: number;
  is_open: boolean;
  score?: number;
  ratings_count?: number;
  hours?: StoreHours[];
  has_coupons?: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoreReview {
  id: string;
  store_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreReviewWithUser {
  id: string;
  store_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export type SaleType = "unit" | "weight";

export interface StoreProductCategory {
  id: string;
  store_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface StoreProduct {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  promotional_price?: number | null;
  image: string | null;
  category: string;
  category_id: string | null;
  sale_type: SaleType;
  is_available: boolean;
  created_at: string;
  updated_at: string;
  has_addons?: boolean;
  addon_categories?: any[];
}

export interface PromotionalProduct {
  id: string;
  store_id: string;
  store_name: string;
  store_avatar: string | null;
  store_city: string;
  delivery_fee: number;
  minimum_order: number;
  is_store_open: boolean;
  name: string;
  description: string | null;
  price: number;
  promotional_price: number;
  image: string | null;
  category: string;
  sale_type: SaleType;
  is_available: boolean;
}

export interface ProductAddon {
  id: string;
  product_id: string;
  name: string;
  price: number;
  is_available: boolean;
  created_at: string;
}

export interface StoreHours {
  id: string;
  store_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}

export type FulfillmentType = "entrega" | "retirada";
export type SlotFulfillmentType = "entrega" | "retirada" | "ambos";

export interface StoreDeliverySlot {
  id: string;
  store_id: string;
  start_time: string;
  end_time: string;
  fee: number;
  fulfillment_type: SlotFulfillmentType;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StoreCoupon {
  id: string;
  store_id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order: number;
  max_uses: number | null;
  current_uses: number;
  product_id: string | null;
  category: string | null;
  applies_to: "all" | "product" | "category";
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  store_id: string;
  status: "pendente" | "confirmado" | "preparando" | "saiu_entrega" | "entregue" | "PENDING" | "PENDING_PAYMENT" | "PAID" | "WAITING_STORE_CONFIRMATION" | "ACCEPTED" | "PREPARING" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "REJECTED";
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  observation: string | null;
  address_snapshot: {
    label: string;
    estado: string;
    cidade: string;
    bairro: string;
    cep: string;
    rua: string;
    numero: string;
    ponto_referencia: string | null;
  };
  coupon_code: string | null;
  fulfillment_type?: FulfillmentType;
  scheduled_date?: string | null;
  slot_start?: string | null;
  slot_end?: string | null;
  payment_method?: string | null;
  payment_status?: "pending" | "paid" | "failed";
  payment_details?: any | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  observation: string | null;
  addons: { id: string; name: string; price: number }[];
  sale_type: SaleType;
  quantity_decimal: number | null;
}

// ─── Addresses ───

export async function listAddresses(
  token: string
): Promise<{ addresses: UserAddress[] }> {
  return authFetch(`${API_URL}/delivery/addresses`, token);
}

export async function createAddress(
  token: string,
  data: {
    label: string;
    estado: string;
    cidade: string;
    bairro: string;
    cep: string;
    rua: string;
    numero: string;
    ponto_referencia?: string;
    is_default?: boolean;
    latitude?: number | null;
    longitude?: number | null;
  }
): Promise<{ status: string; address: UserAddress }> {
  return authFetch(`${API_URL}/delivery/addresses`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAddress(
  token: string,
  id: string,
  data: {
    label?: string;
    estado?: string;
    cidade?: string;
    bairro?: string;
    cep?: string;
    rua?: string;
    numero?: string;
    ponto_referencia?: string | null;
    is_default?: boolean;
    latitude?: number | null;
    longitude?: number | null;
  }
): Promise<{ status: string; address: UserAddress }> {
  return authFetch(`${API_URL}/delivery/addresses/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteAddress(
  token: string,
  id: string
): Promise<{ status: string; message: string }> {
  return authFetch(`${API_URL}/delivery/addresses/${id}`, token, {
    method: "DELETE",
  });
}

// ─── Stores ───

export type StoreListParams = {
  state?: string;
  city?: string;
  category?: string;
  lat?: number;
  lng?: number;
};

export async function listStores(
  token: string,
  params?: StoreListParams
): Promise<{ stores: Store[] }> {
  const searchParams = new URLSearchParams();
  if (params?.state) searchParams.set("state", params.state);
  if (params?.city) searchParams.set("city", params.city);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.lat != null) searchParams.set("lat", String(params.lat));
  if (params?.lng != null) searchParams.set("lng", String(params.lng));
  const qs = searchParams.toString();
  return authFetch(`${API_URL}/delivery/stores${qs ? `?${qs}` : ""}`, token);
}

export async function searchStores(
  token: string,
  query: string,
  params?: Omit<StoreListParams, "category">
): Promise<{ stores: Store[] }> {
  const searchParams = new URLSearchParams();
  searchParams.set("q", query);
  if (params?.state) searchParams.set("state", params.state);
  if (params?.city) searchParams.set("city", params.city);
  if (params?.lat != null) searchParams.set("lat", String(params.lat));
  if (params?.lng != null) searchParams.set("lng", String(params.lng));
  return authFetch(
    `${API_URL}/delivery/stores/search?${searchParams.toString()}`,
    token
  );
}

export async function getStore(
  token: string,
  storeId: string,
  params?: { lat?: number; lng?: number }
): Promise<{
  store: Store;
  products: StoreProduct[];
  categories: StoreProductCategory[];
  hours: StoreHours[];
  slots: StoreDeliverySlot[];
  coupons?: StoreCoupon[];
}> {
  const searchParams = new URLSearchParams();
  if (params?.lat != null) searchParams.set("lat", String(params.lat));
  if (params?.lng != null) searchParams.set("lng", String(params.lng));
  const qs = searchParams.toString();
  return authFetch(
    `${API_URL}/delivery/stores/${storeId}${qs ? `?${qs}` : ""}`,
    token
  );
}

// ─── Product Categories ───

export async function listCategories(
  token: string,
  storeId: string
): Promise<{ categories: StoreProductCategory[] }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/categories`, token);
}

export async function createCategory(
  token: string,
  storeId: string,
  data: { name: string; sort_order?: number }
): Promise<{ status: string; category: StoreProductCategory }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/categories`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  token: string,
  categoryId: string,
  data: { name?: string; sort_order?: number }
): Promise<{ status: string; category: StoreProductCategory }> {
  return authFetch(`${API_URL}/delivery/categories/${categoryId}`, token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(
  token: string,
  categoryId: string
): Promise<{ status: string; message: string }> {
  return authFetch(`${API_URL}/delivery/categories/${categoryId}`, token, {
    method: "DELETE",
  });
}

export async function reorderCategories(
  token: string,
  storeId: string,
  items: { id: string; sort_order: number }[]
): Promise<{ status: string; categories: StoreProductCategory[] }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/categories/reorder`, token, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

// ─── Products ───

export async function listProducts(
  token: string,
  storeId: string
): Promise<{ products: StoreProduct[]; categories: StoreProductCategory[] }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/products`, token);
}

export async function listProductAddons(
  token: string,
  productId: string
): Promise<{ addons: ProductAddon[] }> {
  return authFetch(`${API_URL}/delivery/products/${productId}/addons`, token);
}

export async function createProductAddon(
  token: string,
  productId: string,
  data: { name: string; price: number; is_available?: boolean }
): Promise<{ status: string; addon: ProductAddon }> {
  return authFetch(`${API_URL}/delivery/products/${productId}/addons`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProductAddon(
  token: string,
  addonId: string,
  data: { name?: string; price?: number; is_available?: boolean }
): Promise<{ status: string; addon: ProductAddon }> {
  return authFetch(`${API_URL}/delivery/addons/${addonId}`, token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProductAddon(
  token: string,
  addonId: string
): Promise<{ status: string; message: string }> {
  return authFetch(`${API_URL}/delivery/addons/${addonId}`, token, {
    method: "DELETE",
  });
}

// ─── Store Hours ───

export async function listStoreHours(
  token: string,
  storeId: string
): Promise<{ hours: StoreHours[] }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/hours`, token);
}

export async function createStoreHours(
  token: string,
  storeId: string,
  data: { day_of_week: number; open_time: string; close_time: string; is_closed?: boolean }
): Promise<{ status: string; hours: StoreHours }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/hours`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateStoreHours(
  token: string,
  storeId: string,
  hourId: string,
  data: { open_time?: string; close_time?: string; is_closed?: boolean }
): Promise<{ status: string; hours: StoreHours }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/hours/${hourId}`, token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteStoreHours(
  token: string,
  storeId: string,
  hourId: string
): Promise<{ status: string; message: string }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/hours/${hourId}`, token, {
    method: "DELETE",
  });
}

// ─── Delivery Slots ───

export async function listDeliverySlots(
  token: string,
  storeId: string
): Promise<{ slots: StoreDeliverySlot[] }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/slots`, token);
}

export async function createDeliverySlot(
  token: string,
  storeId: string,
  data: {
    start_time: string;
    end_time: string;
    fee?: number;
    fulfillment_type?: SlotFulfillmentType;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<{ status: string; slot: StoreDeliverySlot }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/slots`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateDeliverySlot(
  token: string,
  storeId: string,
  slotId: string,
  data: {
    start_time?: string;
    end_time?: string;
    fee?: number;
    fulfillment_type?: SlotFulfillmentType;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<{ status: string; slot: StoreDeliverySlot }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/slots/${slotId}`, token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteDeliverySlot(
  token: string,
  storeId: string,
  slotId: string
): Promise<{ status: string; message: string }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/slots/${slotId}`, token, {
    method: "DELETE",
  });
}

// ─── Coupons ───

export async function listStoreCoupons(
  token: string,
  storeId: string
): Promise<{ coupons: StoreCoupon[] }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/coupons`, token);
}

export async function createCoupon(
  token: string,
  storeId: string,
  data: {
    code: string;
    discount_type: string;
    discount_value: number;
    min_order?: number;
    max_uses?: number;
    product_id?: string;
    category?: string;
    applies_to?: string;
    expires_at?: string;
  }
): Promise<{ status: string; coupon: StoreCoupon }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/coupons`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCoupon(
  token: string,
  couponId: string,
  data: {
    code?: string;
    discount_type?: string;
    discount_value?: number;
    min_order?: number;
    max_uses?: number | null;
    product_id?: string | null;
    category?: string | null;
    applies_to?: string;
    expires_at?: string | null;
    is_active?: boolean;
  }
): Promise<{ status: string; coupon: StoreCoupon }> {
  return authFetch(`${API_URL}/delivery/coupons/${couponId}`, token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCoupon(
  token: string,
  couponId: string
): Promise<{ status: string; message: string }> {
  return authFetch(`${API_URL}/delivery/coupons/${couponId}`, token, {
    method: "DELETE",
  });
}

export async function validateCoupon(
  token: string,
  code: string,
  subtotal: number
): Promise<{ valid: boolean; coupon_id: string; discount: number; discount_type: string; discount_value: number }> {
  return authFetch(`${API_URL}/delivery/coupons/validate`, token, {
    method: "POST",
    body: JSON.stringify({ code, subtotal }),
  });
}

// ─── Orders ───

export async function createOrder(
  token: string,
  data: {
    store_id: string;
    address_id?: string;
    items: {
      product_id: string;
      quantity?: number;
      quantity_decimal?: number;
      observation?: string;
      addon_ids?: string[];
    }[];
    observation?: string;
    coupon_code?: string;
    fulfillment_type?: FulfillmentType;
    scheduled_date?: string;
    slot_id?: string;
    slot_start?: string;
    slot_end?: string;
    payment_method: string;
  }
): Promise<{ status: string; order: Order }> {
  return authFetch(`${API_URL}/delivery/orders`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function simulatePayment(
  token: string,
  orderId: string
): Promise<{ status: string; order: Order }> {
  return authFetch(`${API_URL}/delivery/orders/${orderId}/simulate-pay`, token, {
    method: "POST",
  });
}

export async function listOrders(
  token: string
): Promise<{ orders: Order[] }> {
  return authFetch(`${API_URL}/delivery/orders`, token);
}

export async function getOrder(
  token: string,
  orderId: string
): Promise<{ order: Order; items: OrderItem[]; store: Store }> {
  return authFetch(`${API_URL}/delivery/orders/${orderId}`, token);
}

// ─── PIX ───

export async function getStorePix(
  token: string,
  storeId: string
): Promise<{ store_pix_key: string; owner_pix: any }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/pix`, token);
}

// ─── Vendor ───

export async function getVendorStore(
  token: string
): Promise<{ store: Store | null }> {
  return authFetch(`${API_URL}/delivery/vendor/stores`, token);
}

export async function listVendorOrders(
  token: string
): Promise<{ orders: Order[] }> {
  return authFetch(`${API_URL}/delivery/vendor/orders`, token);
}

export async function createStore(
  token: string,
  data: {
    name: string;
    description?: string;
    avatar?: string;
    image_banner?: string;
    phone?: string;
    cnpj?: string;
    pix_key: string;
    category: string;
    delivery_fee?: number;
    minimum_order?: number;
    city: string;
    state: string;
    street?: string;
    number?: string;
    neighborhood?: string;
    cep?: string;
    prep_time_minutes?: number;
  }
): Promise<{ status: string; store: Store }> {
  return authFetch(`${API_URL}/delivery/stores`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateStore(
  token: string,
  storeId: string,
  data: {
    name?: string;
    description?: string | null;
    avatar?: string | null;
    image_banner?: string | null;
    phone?: string | null;
    cnpj?: string | null;
    pix_key?: string;
    category?: string;
    delivery_fee?: number;
    minimum_order?: number;
    city?: string;
    state?: string;
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    cep?: string | null;
    prep_time_minutes?: number;
    accepts_delivery?: boolean;
    accepts_pickup?: boolean;
    schedule_days?: number;
  }
): Promise<{ status: string; store: Store }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}`, token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function toggleStore(
  token: string,
  storeId: string
): Promise<{ status: string; store: Store }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/toggle`, token, {
    method: "PATCH",
  });
}

export async function createProduct(
  token: string,
  storeId: string,
  data: {
    name: string;
    description?: string;
    price: number;
    image?: string;
    category?: string;
    category_id?: string;
    sale_type?: SaleType;
  }
): Promise<{ status: string; product: StoreProduct }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/products`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProduct(
  token: string,
  productId: string,
  data: {
    name?: string;
    description?: string | null;
    price?: number;
    image?: string | null;
    category?: string;
    category_id?: string | null;
    sale_type?: SaleType;
    is_available?: boolean;
  }
): Promise<{ status: string; product: StoreProduct }> {
  return authFetch(`${API_URL}/delivery/products/${productId}`, token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(
  token: string,
  productId: string
): Promise<{ status: string; message: string }> {
  return authFetch(`${API_URL}/delivery/products/${productId}`, token, {
    method: "DELETE",
  });
}

export async function updateOrderStatus(
  token: string,
  orderId: string,
  status: string
): Promise<{ status: string; order: Order }> {
  return authFetch(`${API_URL}/delivery/orders/${orderId}/status`, token, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export const STORE_CATEGORIES: Record<string, string> = {
  restaurante: "Restaurante",
  padaria: "Padaria",
  mercado: "Mercado",
  farmacia: "Farm\u00e1cia",
  fast_food: "Fast Food",
  lanchonete: "Lanchonete",
  confeitaria: "Confeitaria",
  acougue: "A\u00e7ougue",
  bebidas: "Bebidas",
  outro: "Outro",
};

/** Fallback labels for legacy hardcoded category keys */
export const PRODUCT_CATEGORIES: Record<string, string> = {
  xis: "Xis",
  hamburguer: "Hamb\u00farguer",
  pizza: "Pizza",
  refri: "Refrigerante",
  agua: "\u00c1gua",
  suco: "Suco",
  cerveja: "Cerveja",
  porcao: "Por\u00e7\u00e3o",
  combo: "Combo",
  sobremesa: "Sobremesa",
  acompanhamento: "Acompanhamento",
  outro: "Outro",
};

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  unit: "Por unidade",
  weight: "Por peso (kg)",
};

export const SUGGESTED_PRODUCT_CATEGORIES = [
  "Frutas",
  "Legumes",
  "Verduras",
  "Perec\u00edveis",
  "A\u00e7ougue",
  "Padaria",
  "Bebidas",
  "Limpeza",
  "Higiene",
  " Congelados",
  "Mercearia",
  "Outro",
].map((s) => s.trim());

export function formatProductPrice(price: number, saleType: SaleType = "unit"): string {
  const formatted = `R$ ${price.toFixed(2)}`;
  return saleType === "weight" ? `${formatted}/kg` : formatted;
}

export function formatQuantityLabel(qty: number, saleType: SaleType = "unit"): string {
  if (saleType === "weight") {
    return qty < 1 ? `${(qty * 1000).toFixed(0)} g` : `${qty.toFixed(qty % 1 === 0 ? 0 : 2)} kg`;
  }
  return String(qty);
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pendente: "Aguardando Pagamento",
  PENDING: "Aguardando Pagamento",
  PENDING_PAYMENT: "Aguardando Pagamento",
  PAID: "Pago (Aguardando Confirmação)",
  WAITING_STORE_CONFIRMATION: "Aguardando Confirmação",
  confirmado: "Confirmado",
  ACCEPTED: "Confirmado",
  preparando: "Preparando",
  PREPARING: "Preparando",
  READY: "Pronto para Retirada",
  saiu_entrega: "Saiu para entrega",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  entregue: "Entregue",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
  REJECTED: "Rejeitado pela Loja",
};

export const ORDER_STATUS_LABELS_PICKUP: Record<string, string> = {
  pendente: "Aguardando Pagamento",
  PENDING: "Aguardando Pagamento",
  PENDING_PAYMENT: "Aguardando Pagamento",
  PAID: "Pago (Aguardando Confirmação)",
  WAITING_STORE_CONFIRMATION: "Aguardando Confirmação",
  confirmado: "Confirmado",
  ACCEPTED: "Confirmado",
  preparando: "Preparando",
  PREPARING: "Preparando",
  READY: "Pronto para Retirada",
  saiu_entrega: "Pronto para retirada",
  OUT_FOR_DELIVERY: "Pronto para retirada",
  entregue: "Retirado",
  DELIVERED: "Retirado",
  CANCELLED: "Cancelado",
  REJECTED: "Rejeitado pela Loja",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pendente: "#F59E0B",
  PENDING: "#F59E0B",
  PENDING_PAYMENT: "#F59E0B",
  PAID: "#3B82F6",
  WAITING_STORE_CONFIRMATION: "#3B82F6",
  confirmado: "#3B82F6",
  ACCEPTED: "#10B981",
  preparando: "#8B5CF6",
  PREPARING: "#8B5CF6",
  READY: "#F97316",
  saiu_entrega: "#F97316",
  OUT_FOR_DELIVERY: "#F97316",
  entregue: "#10B981",
  DELIVERED: "#10B981",
  CANCELLED: "#EF4444",
  REJECTED: "#EF4444",
};

export function getOrderStatusLabel(
  status: string,
  fulfillmentType?: FulfillmentType | string | null
): string {
  if (fulfillmentType === "retirada") {
    return ORDER_STATUS_LABELS_PICKUP[status] || status;
  }
  return ORDER_STATUS_LABELS[status] || status;
}

export const WEEKDAYS = [
  { key: 0, label: "Domingo" },
  { key: 1, label: "Segunda" },
  { key: 2, label: "Terça" },
  { key: 3, label: "Quarta" },
  { key: 4, label: "Quinta" },
  { key: 5, label: "Sexta" },
  { key: 6, label: "Sábado" },
];

export async function createStoreReview(
  token: string,
  storeId: string,
  rating: number,
  comment?: string | null
): Promise<{ status: string; review: StoreReview }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/reviews`, token, {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  });
}

export async function listStoreReviews(
  token: string,
  storeId: string
): Promise<{ reviews: StoreReviewWithUser[] }> {
  return authFetch(`${API_URL}/delivery/stores/${storeId}/reviews`, token);
}

