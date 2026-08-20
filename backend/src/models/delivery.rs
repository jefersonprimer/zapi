use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct UserAddress {
    pub id: Uuid,
    pub user_id: Uuid,
    pub label: String,
    pub estado: String,
    pub cidade: String,
    pub bairro: String,
    pub cep: String,
    pub rua: String,
    pub numero: String,
    pub ponto_referencia: Option<String>,
    pub is_default: bool,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct Store {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub avatar: Option<String>,
    pub image_banner: Option<String>,
    pub phone: Option<String>,
    pub cnpj: Option<String>,
    pub pix_key: String,
    pub category: String,
    pub delivery_fee: f64,
    pub minimum_order: f64,
    pub city: String,
    pub state: String,
    pub street: Option<String>,
    pub number: Option<String>,
    pub neighborhood: Option<String>,
    pub cep: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub prep_time_minutes: i32,
    pub accepts_delivery: bool,
    pub accepts_pickup: bool,
    pub schedule_days: i32,
    pub is_open: bool,
    pub score: f64,
    pub ratings_count: i32,
    pub payment_account_id: Option<String>,
    pub order_accept_timeout_minutes: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct StoreProductCategory {
    pub id: Uuid,
    pub store_id: Uuid,
    pub name: String,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct StoreProduct {
    pub id: Uuid,
    pub store_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub price: f64,
    pub promotional_price: Option<f64>,
    pub image: Option<String>,
    pub category: String,
    pub category_id: Option<Uuid>,
    pub sale_type: String,
    pub is_available: bool,
    pub stock: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}


#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct PromotionalProductItem {
    pub id: Uuid,
    pub store_id: Uuid,
    pub store_name: String,
    pub store_avatar: Option<String>,
    pub store_city: String,
    pub delivery_fee: f64,
    pub minimum_order: f64,
    pub is_store_open: bool,
    pub name: String,
    pub description: Option<String>,
    pub price: f64,
    pub promotional_price: f64,
    pub image: Option<String>,
    pub category: String,
    pub sale_type: String,
    pub is_available: bool,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct ProductAddon {
    pub id: Uuid,
    pub product_id: Uuid,
    pub name: String,
    pub price: f64,
    pub is_available: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct StoreHours {
    pub id: Uuid,
    pub store_id: Uuid,
    pub day_of_week: i32,
    pub open_time: String,
    pub close_time: String,
    pub is_closed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct StoreCoupon {
    pub id: Uuid,
    pub store_id: Uuid,
    pub code: String,
    pub discount_type: String,
    pub discount_value: f64,
    pub min_order: f64,
    pub max_uses: Option<i32>,
    pub current_uses: i32,
    pub product_id: Option<Uuid>,
    pub category: Option<String>,
    pub applies_to: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct StoreDeliverySlot {
    pub id: Uuid,
    pub store_id: Uuid,
    pub start_time: String,
    pub end_time: String,
    pub fee: f64,
    pub fulfillment_type: String,
    pub is_active: bool,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct Order {
    pub id: Uuid,
    pub user_id: Uuid,
    pub store_id: Uuid,
    pub status: String,
    pub subtotal: f64,
    pub delivery_fee: f64,
    pub discount: f64,
    pub total: f64,
    pub observation: Option<String>,
    pub address_snapshot: serde_json::Value,
    pub coupon_code: Option<String>,
    pub fulfillment_type: String,
    pub scheduled_date: Option<chrono::NaiveDate>,
    pub slot_start: Option<String>,
    pub slot_end: Option<String>,
    pub payment_method: Option<String>,
    pub payment_status: String,
    pub payment_details: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct OrderItem {
    pub id: Uuid,
    pub order_id: Uuid,
    pub product_id: Uuid,
    pub product_name: String,
    pub product_image: Option<String>,
    pub quantity: i32,
    pub unit_price: f64,
    pub subtotal: f64,
    pub observation: Option<String>,
    pub addons: serde_json::Value,
    pub sale_type: String,
    pub quantity_decimal: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAddressRequest {
    pub label: String,
    pub estado: String,
    pub cidade: String,
    pub bairro: String,
    pub cep: String,
    pub rua: String,
    pub numero: String,
    pub ponto_referencia: Option<String>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAddressRequest {
    pub label: Option<String>,
    pub estado: Option<String>,
    pub cidade: Option<String>,
    pub bairro: Option<String>,
    pub cep: Option<String>,
    pub rua: Option<String>,
    pub numero: Option<String>,
    pub ponto_referencia: Option<Option<String>>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStoreRequest {
    pub name: String,
    pub description: Option<String>,
    pub avatar: Option<String>,
    pub image_banner: Option<String>,
    pub phone: Option<String>,
    pub cnpj: Option<String>,
    pub pix_key: String,
    pub category: String,
    pub delivery_fee: Option<f64>,
    pub minimum_order: Option<f64>,
    pub city: String,
    pub state: String,
    pub street: Option<String>,
    pub number: Option<String>,
    pub neighborhood: Option<String>,
    pub cep: Option<String>,
    pub prep_time_minutes: Option<i32>,
    pub payment_account_id: Option<String>,
    pub order_accept_timeout_minutes: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStoreRequest {
    pub name: Option<String>,
    pub description: Option<Option<String>>,
    pub avatar: Option<Option<String>>,
    pub image_banner: Option<Option<String>>,
    pub phone: Option<Option<String>>,
    pub cnpj: Option<Option<String>>,
    pub pix_key: Option<String>,
    pub category: Option<String>,
    pub delivery_fee: Option<f64>,
    pub minimum_order: Option<f64>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub street: Option<Option<String>>,
    pub number: Option<Option<String>>,
    pub neighborhood: Option<Option<String>>,
    pub cep: Option<Option<String>>,
    pub prep_time_minutes: Option<i32>,
    pub accepts_delivery: Option<bool>,
    pub accepts_pickup: Option<bool>,
    pub schedule_days: Option<i32>,
    pub payment_account_id: Option<String>,
    pub order_accept_timeout_minutes: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProductRequest {
    pub name: String,
    pub description: Option<String>,
    pub price: f64,
    pub promotional_price: Option<f64>,
    pub image: Option<String>,
    pub category: Option<String>,
    pub category_id: Option<Uuid>,
    pub sale_type: Option<String>,
    pub stock: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProductRequest {
    pub name: Option<String>,
    pub description: Option<Option<String>>,
    pub price: Option<f64>,
    pub promotional_price: Option<Option<f64>>,
    pub image: Option<Option<String>>,
    pub category: Option<String>,
    pub category_id: Option<Option<Uuid>>,
    pub sale_type: Option<String>,
    pub is_available: Option<bool>,
    pub stock: Option<Option<f64>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCategoryRequest {
    pub name: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct ReorderCategoriesRequest {
    pub items: Vec<ReorderCategoryItem>,
}

#[derive(Debug, Deserialize)]
pub struct ReorderCategoryItem {
    pub id: Uuid,
    pub sort_order: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateAddonRequest {
    pub name: String,
    pub price: f64,
    pub is_available: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAddonRequest {
    pub name: Option<String>,
    pub price: Option<f64>,
    pub is_available: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStoreHoursRequest {
    pub day_of_week: i32,
    pub open_time: String,
    pub close_time: String,
    pub is_closed: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStoreHoursRequest {
    pub open_time: Option<String>,
    pub close_time: Option<String>,
    pub is_closed: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCouponRequest {
    pub code: String,
    pub discount_type: String,
    pub discount_value: f64,
    pub min_order: Option<f64>,
    pub max_uses: Option<i32>,
    pub product_id: Option<Uuid>,
    pub category: Option<String>,
    pub applies_to: Option<String>,
    pub expires_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCouponRequest {
    pub code: Option<String>,
    pub discount_type: Option<String>,
    pub discount_value: Option<f64>,
    pub min_order: Option<f64>,
    pub max_uses: Option<Option<i32>>,
    pub product_id: Option<Option<Uuid>>,
    pub category: Option<Option<String>>,
    pub applies_to: Option<String>,
    pub expires_at: Option<Option<String>>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ValidateCouponRequest {
    pub code: String,
    pub subtotal: f64,
    pub items: Option<Vec<CouponItemCheck>>,
}

#[derive(Debug, Deserialize)]
pub struct CouponItemCheck {
    pub product_id: Uuid,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDeliverySlotRequest {
    pub start_time: String,
    pub end_time: String,
    pub fee: Option<f64>,
    pub fulfillment_type: Option<String>,
    pub is_active: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDeliverySlotRequest {
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub fee: Option<f64>,
    pub fulfillment_type: Option<String>,
    pub is_active: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOrderRequest {
    pub store_id: Uuid,
    pub address_id: Option<Uuid>,
    pub items: Vec<OrderItemRequest>,
    pub observation: Option<String>,
    pub coupon_code: Option<String>,
    pub fulfillment_type: Option<String>,
    pub scheduled_date: Option<String>,
    pub slot_id: Option<Uuid>,
    pub slot_start: Option<String>,
    pub slot_end: Option<String>,
    pub payment_method: String,
}

#[derive(Debug, Deserialize)]
pub struct OrderItemRequest {
    pub product_id: Uuid,
    pub quantity: Option<i32>,
    pub quantity_decimal: Option<f64>,
    pub observation: Option<String>,
    pub addon_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrderStatusRequest {
    pub status: String,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct StoreReview {
    pub id: Uuid,
    pub store_id: Uuid,
    pub user_id: Uuid,
    pub rating: i32,
    pub comment: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct StoreReviewWithUser {
    pub id: Uuid,
    pub store_id: Uuid,
    pub user_id: Uuid,
    pub user_name: String,
    pub user_avatar: Option<String>,
    pub rating: i32,
    pub comment: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReviewRequest {
    pub rating: i32,
    pub comment: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct PaymentTransaction {
    pub id: Uuid,
    pub order_id: Uuid,
    pub provider_payment_id: String,
    pub amount: f64,
    pub payment_method: String,
    pub status: String,
    pub details: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[allow(dead_code)]
#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct PaymentSplitDb {
    pub id: Uuid,
    pub payment_transaction_id: Uuid,
    pub recipient_type: String,
    pub recipient_id: String,
    pub amount: f64,
    pub percentage: f64,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[allow(dead_code)]
#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct DeliveryDb {
    pub id: Uuid,
    pub order_id: Uuid,
    pub driver_id: Option<Uuid>,
    pub status: String,
    pub pickup_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

