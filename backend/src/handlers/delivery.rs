use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, patch, post, put},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::geocode::{eta_minutes, geocode_address, haversine_km};
use crate::models::delivery::*;
use crate::payment::provider::PaymentProvider;
use crate::AppState;

const STORE_COLS: &str = "id, owner_id, name, description, (SELECT avatar_url FROM users WHERE users.id = stores.owner_id) AS avatar, image_banner, phone, cnpj, pix_key, category, delivery_fee, minimum_order, city, state, street, number, neighborhood, cep, latitude, longitude, prep_time_minutes, accepts_delivery, accepts_pickup, schedule_days, is_open, score, ratings_count, payment_account_id, order_accept_timeout_minutes, created_at, updated_at";
const SLOT_COLS: &str = "id, store_id, start_time, end_time, fee, fulfillment_type, is_active, sort_order, created_at, updated_at";

const PRODUCT_COLS: &str = "id, store_id, name, description, price, promotional_price, image, category, category_id, sale_type, is_available, stock, created_at, updated_at";

const ORDER_ITEM_COLS: &str = "id, order_id, product_id, product_name, product_image, quantity, unit_price, subtotal, observation, addons, sale_type, quantity_decimal";

async fn enrich_stores_json(
    pool: &PgPool,
    stores: Vec<Store>,
    user_lat: Option<f64>,
    user_lng: Option<f64>,
) -> Result<Value, sqlx::Error> {
    let store_ids: Vec<Uuid> = stores.iter().map(|s| s.id).collect();
    let hours = if store_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, StoreHours>(
            "SELECT id, store_id, day_of_week, open_time, close_time, is_closed, created_at, updated_at \
             FROM store_hours WHERE store_id = ANY($1)",
        )
        .bind(&store_ids)
        .fetch_all(pool)
        .await?
    };

    use std::collections::{HashMap, HashSet};
    let mut hours_by_store: HashMap<Uuid, Vec<StoreHours>> = HashMap::new();
    for h in hours {
        hours_by_store.entry(h.store_id).or_default().push(h);
    }

    let stores_with_coupons = if store_ids.is_empty() {
        HashSet::new()
    } else {
        let active_coupon_store_ids = sqlx::query_scalar::<_, Uuid>(
            "SELECT DISTINCT store_id FROM store_coupons \
             WHERE is_active = TRUE \
               AND (expires_at IS NULL OR expires_at > NOW()) \
               AND (max_uses IS NULL OR current_uses < max_uses) \
               AND store_id = ANY($1)"
        )
        .bind(&store_ids)
        .fetch_all(pool)
        .await?;
        active_coupon_store_ids.into_iter().collect::<HashSet<Uuid>>()
    };

    let stores_with_promotions = if store_ids.is_empty() {
        HashSet::new()
    } else {
        let active_promo_store_ids = sqlx::query_scalar::<_, Uuid>(
            "SELECT DISTINCT store_id FROM store_products \
             WHERE is_available = TRUE \
               AND promotional_price IS NOT NULL \
               AND promotional_price > 0 \
               AND promotional_price < price \
               AND store_id = ANY($1)"
        )
        .bind(&store_ids)
        .fetch_all(pool)
        .await?;
        active_promo_store_ids.into_iter().collect::<HashSet<Uuid>>()
    };

    let mut items: Vec<(Option<f64>, Value)> = stores
        .into_iter()
        .map(|s| {
            let mut v = serde_json::to_value(&s).unwrap_or(json!({}));
            let store_hours = hours_by_store.get(&s.id).cloned().unwrap_or_default();
            v["hours"] = serde_json::to_value(&store_hours).unwrap_or(json!([]));
            let has_coupons = stores_with_coupons.contains(&s.id);
            let has_promotions = stores_with_promotions.contains(&s.id) || has_coupons;
            v["has_coupons"] = json!(has_coupons);
            v["has_promotions"] = json!(has_promotions);
            let dist = match (user_lat, user_lng, s.latitude, s.longitude) {
                (Some(ulat), Some(ulng), Some(slat), Some(slng)) => {
                    let d = haversine_km(ulat, ulng, slat, slng);
                    let rounded = (d * 10.0).round() / 10.0;
                    v["distance_km"] = json!(rounded);
                    v["eta_min"] = json!(eta_minutes(s.prep_time_minutes, d));
                    Some(d)
                }
                _ => None,
            };
            (dist, v)
        })
        .collect();

    if user_lat.is_some() && user_lng.is_some() {
        items.sort_by(|a, b| match (a.0, b.0) {
            (Some(x), Some(y)) => x.partial_cmp(&y).unwrap_or(std::cmp::Ordering::Equal),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            _ => std::cmp::Ordering::Equal,
        });
    }

    Ok(json!({ "stores": items.into_iter().map(|(_, v)| v).collect::<Vec<_>>() }))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/addresses", get(list_addresses).post(create_address))
        .route("/addresses/:id", put(update_address).delete(delete_address))
        .route("/stores", get(list_stores).post(create_store))
        .route("/stores/search", get(search_stores))
        .route("/promotions", get(list_promotions))
        .route("/stores/:id", get(get_store).put(update_store))
        .route("/stores/:id/toggle", patch(toggle_store))
        .route("/stores/:id/products", get(list_products).post(create_product))
        .route("/stores/:id/products/batch-discount", post(batch_discount))
        .route("/stores/:id/categories", get(list_categories).post(create_category))
        .route("/stores/:id/categories/reorder", put(reorder_categories))
        .route("/stores/:id/pix", get(get_store_pix))
        .route("/stores/:id/hours", get(list_store_hours).post(create_store_hours))
        .route("/stores/:id/slots", get(list_delivery_slots).post(create_delivery_slot))
        .route("/stores/:id/coupons", get(list_store_coupons).post(create_coupon))
        .route("/stores/:id/reviews", get(list_store_reviews).post(create_store_review))
        .route("/products/:id", put(update_product).delete(delete_product))
        .route("/products/:id/addons", get(list_addons).post(create_addon))
        .route("/addons/:id", put(update_addon).delete(delete_addon))
        .route("/categories/:id", put(update_category).delete(delete_category))
        .route("/stores/:id/hours/:hour_id", put(update_store_hours).delete(delete_store_hours))
        .route("/stores/:id/slots/:slot_id", put(update_delivery_slot).delete(delete_delivery_slot))
        .route("/coupons/:id", put(update_coupon).delete(delete_coupon))
        .route("/coupons/validate", post(validate_coupon))
        .route("/orders", get(list_orders).post(create_order))
        .route("/orders/:id", get(get_order))
        .route("/orders/:id/status", put(update_order_status))
        .route("/orders/:id/simulate-pay", post(simulate_payment))
        .route("/orders/:id/cancel", post(cancel_order))
        .route("/vendor/stores", get(get_vendor_store))
        .route("/vendor/orders", get(list_vendor_orders))
}

// ─── Address Handlers ───

pub async fn list_addresses(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let addresses = sqlx::query_as::<_, UserAddress>(
        "SELECT id, user_id, label, estado, cidade, bairro, cep, rua, numero, ponto_referencia, is_default, latitude, longitude, created_at, updated_at
         FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC",
    )
    .bind(auth.0)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "addresses": addresses })))
}

pub async fn create_address(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateAddressRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let valid_labels = ["casa", "trabalho", "outro"];
    if !valid_labels.contains(&body.label.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid label. Must be: casa, trabalho, or outro" })),
        ));
    }

    if body.estado.len() != 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "estado must be 2 characters (UF)" })),
        ));
    }

    let is_default = body.is_default.unwrap_or(false);

    if is_default {
        sqlx::query("UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1")
            .bind(auth.0)
            .execute(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("database error: {}", e) })),
                )
            })?;
    }

    let coords = geocode_address(
        &body.rua,
        &body.numero,
        &body.bairro,
        &body.cidade,
        &body.estado,
        &body.cep,
    )
    .await;
    let (latitude, longitude) = match coords {
        Some((lat, lng)) => (Some(lat), Some(lng)),
        None => (None, None),
    };

    let address = sqlx::query_as::<_, UserAddress>(
        "INSERT INTO user_addresses (user_id, label, estado, cidade, bairro, cep, rua, numero, ponto_referencia, is_default, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, user_id, label, estado, cidade, bairro, cep, rua, numero, ponto_referencia, is_default, latitude, longitude, created_at, updated_at",
    )
    .bind(auth.0)
    .bind(&body.label)
    .bind(&body.estado)
    .bind(&body.cidade)
    .bind(&body.bairro)
    .bind(&body.cep)
    .bind(&body.rua)
    .bind(&body.numero)
    .bind(&body.ponto_referencia)
    .bind(is_default)
    .bind(latitude)
    .bind(longitude)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "address": address })))
}

pub async fn update_address(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAddressRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let existing = sqlx::query_as::<_, UserAddress>(
        "SELECT id, user_id, label, estado, cidade, bairro, cep, rua, numero, ponto_referencia, is_default, latitude, longitude, created_at, updated_at
         FROM user_addresses WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let existing = match existing {
        Some(row) => row,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Address not found" })),
            ));
        }
    };

    let label = body.label.unwrap_or_else(|| existing.label.clone());
    let estado = body.estado.unwrap_or_else(|| existing.estado.clone());
    let cidade = body.cidade.unwrap_or_else(|| existing.cidade.clone());
    let bairro = body.bairro.unwrap_or_else(|| existing.bairro.clone());
    let cep = body.cep.unwrap_or_else(|| existing.cep.clone());
    let rua = body.rua.unwrap_or_else(|| existing.rua.clone());
    let numero = body.numero.unwrap_or_else(|| existing.numero.clone());
    let ponto_referencia = body
        .ponto_referencia
        .unwrap_or_else(|| existing.ponto_referencia.clone());
    let is_default = body.is_default.unwrap_or(existing.is_default);

    let valid_labels = ["casa", "trabalho", "outro"];
    if !valid_labels.contains(&label.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid label" })),
        ));
    }

    if estado.len() != 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "estado must be 2 characters" })),
        ));
    }

    if is_default {
        sqlx::query("UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1 AND id != $2")
            .bind(auth.0)
            .bind(id)
            .execute(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("database error: {}", e) })),
                )
            })?;
    }

    let address_changed = rua != existing.rua
        || numero != existing.numero
        || bairro != existing.bairro
        || cidade != existing.cidade
        || estado != existing.estado
        || cep != existing.cep;

    let (latitude, longitude) = if address_changed {
        match geocode_address(&rua, &numero, &bairro, &cidade, &estado, &cep).await {
            Some((lat, lng)) => (Some(lat), Some(lng)),
            None => (None, None),
        }
    } else {
        (existing.latitude, existing.longitude)
    };

    let address = sqlx::query_as::<_, UserAddress>(
        "UPDATE user_addresses SET label = $1, estado = $2, cidade = $3, bairro = $4, cep = $5, rua = $6, numero = $7,
         ponto_referencia = $8, is_default = $9, latitude = $10, longitude = $11, updated_at = NOW()
         WHERE id = $12 AND user_id = $13
         RETURNING id, user_id, label, estado, cidade, bairro, cep, rua, numero, ponto_referencia, is_default, latitude, longitude, created_at, updated_at",
    )
    .bind(&label)
    .bind(&estado)
    .bind(&cidade)
    .bind(&bairro)
    .bind(&cep)
    .bind(&rua)
    .bind(&numero)
    .bind(&ponto_referencia)
    .bind(is_default)
    .bind(latitude)
    .bind(longitude)
    .bind(id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "address": address })))
}

pub async fn delete_address(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let result = sqlx::query("DELETE FROM user_addresses WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(auth.0)
        .execute(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Address not found" })),
        ));
    }

    Ok(Json(json!({ "status": "success", "message": "Address deleted" })))
}

// ─── Store Handlers ───

#[derive(Deserialize)]
pub struct StoreFilters {
    pub state: Option<String>,
    pub city: Option<String>,
    pub category: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
}

pub async fn list_stores(
    State(pool): State<PgPool>,
    Query(filters): Query<StoreFilters>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut query = format!(
        "SELECT {} FROM stores WHERE is_open = TRUE",
        STORE_COLS
    );
    let mut bind_values: Vec<String> = Vec::new();
    let mut param_idx = 1;

    if let Some(ref state_val) = filters.state {
        query.push_str(&format!(
            " AND UPPER(TRIM(state)) = UPPER(TRIM(${}))",
            param_idx
        ));
        bind_values.push(state_val.clone());
        param_idx += 1;
    }

    if let Some(ref city) = filters.city {
        query.push_str(&format!(
            " AND LOWER(TRIM(city)) = LOWER(TRIM(${}))",
            param_idx
        ));
        bind_values.push(city.clone());
        param_idx += 1;
    }

    if let Some(ref category) = filters.category {
        query.push_str(&format!(" AND category = ${}", param_idx));
        bind_values.push(category.clone());
    }

    query.push_str(" ORDER BY created_at DESC");

    let mut q = sqlx::query_as::<_, Store>(&query);
    for val in &bind_values {
        q = q.bind(val);
    }

    let stores = q.fetch_all(&pool).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let enriched = enrich_stores_json(&pool, stores, filters.lat, filters.lng)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;

    Ok(Json(enriched))
}

pub async fn search_stores(
    State(pool): State<PgPool>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let q = match params.get("q") {
        Some(q) if !q.trim().is_empty() => q.clone(),
        _ => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Query parameter 'q' is required" })),
            ));
        }
    };

    let search_pattern = format!("%{}%", q);
    let mut query = format!(
        "SELECT {} FROM stores WHERE is_open = TRUE AND name ILIKE $1",
        STORE_COLS
    );
    let mut bind_strings: Vec<String> = vec![search_pattern];
    let mut param_idx = 2;

    if let Some(state_val) = params.get("state").filter(|s| !s.trim().is_empty()) {
        query.push_str(&format!(
            " AND UPPER(TRIM(state)) = UPPER(TRIM(${}))",
            param_idx
        ));
        bind_strings.push(state_val.clone());
        param_idx += 1;
    }

    if let Some(city) = params.get("city").filter(|s| !s.trim().is_empty()) {
        query.push_str(&format!(
            " AND LOWER(TRIM(city)) = LOWER(TRIM(${}))",
            param_idx
        ));
        bind_strings.push(city.clone());
        param_idx += 1;
    }

    if let Some(category) = params.get("category").filter(|s| !s.trim().is_empty()) {
        query.push_str(&format!(" AND category = ${}", param_idx));
        bind_strings.push(category.clone());
        // param_idx unused after last bind — kept for consistency if more filters are added
    }

    query.push_str(" ORDER BY created_at DESC");

    let mut qb = sqlx::query_as::<_, Store>(&query);
    for val in &bind_strings {
        qb = qb.bind(val);
    }

    let stores = qb.fetch_all(&pool).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let user_lat = params.get("lat").and_then(|s| s.parse().ok());
    let user_lng = params.get("lng").and_then(|s| s.parse().ok());

    let enriched = enrich_stores_json(&pool, stores, user_lat, user_lng)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;

    Ok(Json(enriched))
}

pub async fn get_store(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Query(filters): Query<StoreFilters>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let store = sqlx::query_as::<_, Store>(
        &format!("SELECT {} FROM stores WHERE id = $1", STORE_COLS),
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let store = match store {
        Some(s) => s,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Store not found" })),
            ));
        }
    };

    let products = sqlx::query_as::<_, StoreProduct>(
        &format!(
            "SELECT {} FROM store_products WHERE store_id = $1
             ORDER BY category ASC, created_at DESC",
            PRODUCT_COLS
        ),
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let categories = sqlx::query_as::<_, StoreProductCategory>(
        "SELECT id, store_id, name, sort_order, created_at
         FROM store_product_categories WHERE store_id = $1 ORDER BY sort_order ASC, name ASC",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let hours = sqlx::query_as::<_, StoreHours>(
        "SELECT id, store_id, day_of_week, open_time, close_time, is_closed, created_at, updated_at
         FROM store_hours WHERE store_id = $1 ORDER BY day_of_week ASC",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let slots = sqlx::query_as::<_, StoreDeliverySlot>(
        &format!(
            "SELECT {} FROM store_delivery_slots WHERE store_id = $1 AND is_active = TRUE ORDER BY sort_order ASC, start_time ASC",
            SLOT_COLS
        ),
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let coupons = sqlx::query_as::<_, StoreCoupon>(
        "SELECT id, store_id, code, discount_type, discount_value, min_order, max_uses, current_uses, product_id, category, applies_to, expires_at, is_active, created_at, updated_at
         FROM store_coupons 
         WHERE store_id = $1 
           AND is_active = TRUE 
           AND (max_uses IS NULL OR current_uses < max_uses)
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let mut store_json = serde_json::to_value(&store).unwrap_or(json!({}));
    if let (Some(ulat), Some(ulng), Some(slat), Some(slng)) =
        (filters.lat, filters.lng, store.latitude, store.longitude)
    {
        let d = haversine_km(ulat, ulng, slat, slng);
        let rounded = (d * 10.0).round() / 10.0;
        store_json["distance_km"] = json!(rounded);
        store_json["eta_min"] = json!(eta_minutes(store.prep_time_minutes, d));
    }

    Ok(Json(json!({
        "store": store_json,
        "products": products,
        "categories": categories,
        "hours": hours,
        "slots": slots,
        "coupons": coupons
    })))
}

pub async fn create_store(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateStoreRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let valid_categories = [
        "restaurante", "fast_food", "lanchonete", "lanches", "pizza", "marmita",
        "padaria", "salgados", "pastel", "confeitaria", "acai", "sorvete", "cafe",
        "comida_japonesa", "comida_italiana", "comida_chinesa", "comida_arabe", "comida_mexicana",
        "frango_assado", "churrascaria", "saudavel", "vegetariana", "comida_brasileira",
        "mercado", "acougue", "hortifruti", "bebidas", "conveniencia", "queijos_frios", "peixaria",
        "farmacia", "petshop", "flores", "tabacaria", "shopping", "barbeiro", "salao", "estetica",
        "tatuagem", "clinica", "dentista", "oficina", "personal", "fotografo", "outro",
    ];
    if !valid_categories.contains(&body.category.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid category" })),
        ));
    }

    if body.state.len() != 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "state must be 2 characters (UF)" })),
        ));
    }

    let existing = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE owner_id = $1)",
    )
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if existing {
        return Err((
            StatusCode::CONFLICT,
            Json(json!({ "error": "You already have a store" })),
        ));
    }

    let delivery_fee = body.delivery_fee.unwrap_or(0.0);
    let minimum_order = body.minimum_order.unwrap_or(0.0);
    let prep_time_minutes = body.prep_time_minutes.unwrap_or(20).max(1);
    let street = body.street.filter(|s| !s.trim().is_empty());
    let cnpj = body.cnpj.filter(|s| !s.trim().is_empty());
    let number = body.number.filter(|s| !s.trim().is_empty());
    let neighborhood = body.neighborhood.filter(|s| !s.trim().is_empty());
    let cep = body.cep.filter(|s| !s.trim().is_empty());

    let coords = geocode_address(
        street.as_deref().unwrap_or(""),
        number.as_deref().unwrap_or(""),
        neighborhood.as_deref().unwrap_or(""),
        &body.city,
        &body.state,
        cep.as_deref().unwrap_or(""),
    )
    .await;
    let (latitude, longitude) = match coords {
        Some((lat, lng)) => (Some(lat), Some(lng)),
        None => (None, None),
    };

    let payment_account_id = body.payment_account_id.clone().unwrap_or_else(|| {
        format!("acc_{}", uuid::Uuid::now_v7().to_string()[..8].to_string())
    });
    let order_accept_timeout_minutes = body.order_accept_timeout_minutes.unwrap_or(10);

    let user_avatar = sqlx::query_scalar::<_, Option<String>>(
        "SELECT avatar_url FROM users WHERE id = $1"
    )
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .unwrap_or(None);

    let avatar = body.avatar.clone().or(user_avatar);

    if body.avatar.is_some() {
        sqlx::query("UPDATE users SET avatar_url = $1 WHERE id = $2")
            .bind(&body.avatar)
            .bind(auth.0)
            .execute(&pool)
            .await
            .ok();

        sqlx::query("UPDATE publishers SET avatar_url = $1 WHERE type = 'user' AND ref_id = $2")
            .bind(&body.avatar)
            .bind(auth.0)
            .execute(&pool)
            .await
            .ok();
    }

    let store = sqlx::query_as::<_, Store>(
        &format!(
            "INSERT INTO stores (owner_id, name, description, avatar, image_banner, phone, cnpj, pix_key, category, delivery_fee, minimum_order, city, state, street, number, neighborhood, cep, latitude, longitude, prep_time_minutes, payment_account_id, order_accept_timeout_minutes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
             RETURNING {}",
            STORE_COLS
        ),
    )
    .bind(auth.0)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&avatar)
    .bind(&body.image_banner)
    .bind(&body.phone)
    .bind(&cnpj)
    .bind(&body.pix_key)
    .bind(&body.category)
    .bind(delivery_fee)
    .bind(minimum_order)
    .bind(&body.city)
    .bind(&body.state)
    .bind(&street)
    .bind(&number)
    .bind(&neighborhood)
    .bind(&cep)
    .bind(latitude)
    .bind(longitude)
    .bind(prep_time_minutes)
    .bind(payment_account_id)
    .bind(order_accept_timeout_minutes)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    // Seed default delivery/pickup time slots for new stores
    let default_slots = [
        ("08:00", "09:00", 10.0, 0),
        ("10:00", "11:00", 10.0, 1),
        ("11:00", "12:00", 10.0, 2),
        ("14:00", "15:00", 10.0, 3),
        ("15:00", "16:00", 10.0, 4),
        ("16:00", "17:00", 10.0, 5),
        ("17:00", "18:00", 10.0, 6),
    ];
    for (start, end, fee, sort) in default_slots {
        sqlx::query(
            "INSERT INTO store_delivery_slots (store_id, start_time, end_time, fee, fulfillment_type, sort_order)
             VALUES ($1, $2, $3, $4, 'ambos', $5)",
        )
        .bind(store.id)
        .bind(start)
        .bind(end)
        .bind(fee)
        .bind(sort)
        .execute(&pool)
        .await
        .ok();
    }

    Ok(Json(json!({ "status": "success", "store": store })))
}

pub async fn update_store(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateStoreRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let existing = sqlx::query_as::<_, Store>(
        &format!("SELECT {} FROM stores WHERE id = $1 AND owner_id = $2", STORE_COLS),
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let existing = match existing {
        Some(s) => s,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Store not found or not owned by you" })),
            ));
        }
    };

    let name = body.name.unwrap_or_else(|| existing.name.clone());
    let description = body.description.unwrap_or_else(|| existing.description.clone());
    let avatar = match body.avatar.clone() {
        Some(Some(s)) if s.trim().is_empty() => None,
        Some(inner) => inner,
        None => existing.avatar.clone(),
    };

    if body.avatar.is_some() {
        sqlx::query("UPDATE users SET avatar_url = $1 WHERE id = $2")
            .bind(&avatar)
            .bind(auth.0)
            .execute(&pool)
            .await
            .ok();

        sqlx::query("UPDATE publishers SET avatar_url = $1 WHERE type = 'user' AND ref_id = $2")
            .bind(&avatar)
            .bind(auth.0)
            .execute(&pool)
            .await
            .ok();
    }
    let image_banner = match body.image_banner {
        Some(Some(s)) if s.trim().is_empty() => None,
        Some(inner) => inner,
        None => existing.image_banner.clone(),
    };
    let phone = body.phone.unwrap_or_else(|| existing.phone.clone());
    let cnpj = match body.cnpj {
        Some(Some(s)) if s.trim().is_empty() => None,
        Some(inner) => inner,
        None => existing.cnpj.clone(),
    };
    let pix_key = body.pix_key.unwrap_or_else(|| existing.pix_key.clone());
    let category = body.category.unwrap_or_else(|| existing.category.clone());
    let delivery_fee = body.delivery_fee.unwrap_or(existing.delivery_fee);
    let minimum_order = body.minimum_order.unwrap_or(existing.minimum_order);
    let city = body.city.unwrap_or_else(|| existing.city.clone());
    let state = body.state.unwrap_or_else(|| existing.state.clone());
    let street = match body.street {
        Some(Some(s)) if s.trim().is_empty() => None,
        Some(inner) => inner,
        None => existing.street.clone(),
    };
    let number = match body.number {
        Some(Some(s)) if s.trim().is_empty() => None,
        Some(inner) => inner,
        None => existing.number.clone(),
    };
    let neighborhood = match body.neighborhood {
        Some(Some(s)) if s.trim().is_empty() => None,
        Some(inner) => inner,
        None => existing.neighborhood.clone(),
    };
    let cep = match body.cep {
        Some(Some(s)) if s.trim().is_empty() => None,
        Some(inner) => inner,
        None => existing.cep.clone(),
    };
    let prep_time_minutes = body
        .prep_time_minutes
        .unwrap_or(existing.prep_time_minutes)
        .max(1);
    let accepts_delivery = body.accepts_delivery.unwrap_or(existing.accepts_delivery);
    let accepts_pickup = body.accepts_pickup.unwrap_or(existing.accepts_pickup);
    let schedule_days = body
        .schedule_days
        .unwrap_or(existing.schedule_days)
        .clamp(1, 14);

    let valid_categories = [
        "restaurante", "fast_food", "lanchonete", "lanches", "pizza", "marmita",
        "padaria", "salgados", "pastel", "confeitaria", "acai", "sorvete", "cafe",
        "comida_japonesa", "comida_italiana", "comida_chinesa", "comida_arabe", "comida_mexicana",
        "frango_assado", "churrascaria", "saudavel", "vegetariana", "comida_brasileira",
        "mercado", "acougue", "hortifruti", "bebidas", "conveniencia", "queijos_frios", "peixaria",
        "farmacia", "petshop", "flores", "tabacaria", "shopping", "barbeiro", "salao", "estetica",
        "tatuagem", "clinica", "dentista", "oficina", "personal", "fotografo", "outro",
    ];
    if !valid_categories.contains(&category.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid category" })),
        ));
    }

    if state.len() != 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "state must be 2 characters (UF)" })),
        ));
    }

    let address_changed = street != existing.street
        || number != existing.number
        || neighborhood != existing.neighborhood
        || cep != existing.cep
        || city != existing.city
        || state != existing.state;

    let (latitude, longitude) = if address_changed {
        match geocode_address(
            street.as_deref().unwrap_or(""),
            number.as_deref().unwrap_or(""),
            neighborhood.as_deref().unwrap_or(""),
            &city,
            &state,
            cep.as_deref().unwrap_or(""),
        )
        .await
        {
            Some((lat, lng)) => (Some(lat), Some(lng)),
            None => (None, None),
        }
    } else {
        (existing.latitude, existing.longitude)
    };

    let payment_account_id = body.payment_account_id.clone().or(existing.payment_account_id);
    let order_accept_timeout_minutes = body.order_accept_timeout_minutes.unwrap_or(existing.order_accept_timeout_minutes);

    let store = sqlx::query_as::<_, Store>(
        &format!(
            "UPDATE stores SET name = $1, description = $2, avatar = $3, image_banner = $4, phone = $5, cnpj = $6, pix_key = $7, category = $8,
             delivery_fee = $9, minimum_order = $10, city = $11, state = $12, street = $13, number = $14, neighborhood = $15, cep = $16,
             latitude = $17, longitude = $18, prep_time_minutes = $19, accepts_delivery = $20, accepts_pickup = $21, schedule_days = $22,
             payment_account_id = $23, order_accept_timeout_minutes = $24, updated_at = NOW()
             WHERE id = $25 AND owner_id = $26
             RETURNING {}",
            STORE_COLS
        ),
    )
    .bind(&name)
    .bind(&description)
    .bind(&avatar)
    .bind(&image_banner)
    .bind(&phone)
    .bind(&cnpj)
    .bind(&pix_key)
    .bind(&category)
    .bind(delivery_fee)
    .bind(minimum_order)
    .bind(&city)
    .bind(&state)
    .bind(&street)
    .bind(&number)
    .bind(&neighborhood)
    .bind(&cep)
    .bind(latitude)
    .bind(longitude)
    .bind(prep_time_minutes)
    .bind(accepts_delivery)
    .bind(accepts_pickup)
    .bind(schedule_days)
    .bind(payment_account_id)
    .bind(order_accept_timeout_minutes)
    .bind(id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "store": store })))
}

pub async fn toggle_store(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let store = sqlx::query_as::<_, Store>(
        &format!(
            "UPDATE stores SET is_open = NOT is_open, updated_at = NOW()
             WHERE id = $1 AND owner_id = $2
             RETURNING {}",
            STORE_COLS
        ),
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let store = match store {
        Some(s) => s,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Store not found or not owned by you" })),
            ));
        }
    };

    Ok(Json(json!({ "status": "success", "store": store })))
}

pub async fn get_vendor_store(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let store = sqlx::query_as::<_, Store>(
        &format!("SELECT {} FROM stores WHERE owner_id = $1", STORE_COLS),
    )
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    match store {
        Some(s) => Ok(Json(json!({ "store": s }))),
        None => Ok(Json(json!({ "store": null }))),
    }
}

// ─── Product Category Handlers ───

async fn resolve_category_for_product(
    pool: &PgPool,
    store_id: Uuid,
    category_id: Option<Uuid>,
    category_name: Option<String>,
) -> Result<(Option<Uuid>, String), (StatusCode, Json<Value>)> {
    if let Some(cid) = category_id {
        let cat = sqlx::query_as::<_, StoreProductCategory>(
            "SELECT id, store_id, name, sort_order, created_at
             FROM store_product_categories WHERE id = $1 AND store_id = $2",
        )
        .bind(cid)
        .bind(store_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;

        return match cat {
            Some(c) => Ok((Some(c.id), c.name)),
            None => Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Category not found for this store" })),
            )),
        };
    }

    if let Some(name) = category_name {
        let trimmed = name.trim().to_string();
        if trimmed.is_empty() {
            return Ok((None, "outro".to_string()));
        }

        let existing = sqlx::query_as::<_, StoreProductCategory>(
            "SELECT id, store_id, name, sort_order, created_at
             FROM store_product_categories WHERE store_id = $1 AND name = $2",
        )
        .bind(store_id)
        .bind(&trimmed)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;

        if let Some(c) = existing {
            return Ok((Some(c.id), c.name));
        }

        let created = sqlx::query_as::<_, StoreProductCategory>(
            "INSERT INTO store_product_categories (store_id, name, sort_order)
             VALUES ($1, $2, COALESCE((SELECT MAX(sort_order) + 1 FROM store_product_categories WHERE store_id = $1), 0))
             RETURNING id, store_id, name, sort_order, created_at",
        )
        .bind(store_id)
        .bind(&trimmed)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;

        return Ok((Some(created.id), created.name));
    }

    Ok((None, "outro".to_string()))
}

pub async fn list_categories(
    State(pool): State<PgPool>,
    Path(store_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let categories = sqlx::query_as::<_, StoreProductCategory>(
        "SELECT id, store_id, name, sort_order, created_at
         FROM store_product_categories WHERE store_id = $1 ORDER BY sort_order ASC, name ASC",
    )
    .bind(store_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "categories": categories })))
}

pub async fn create_category(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(store_id): Path<Uuid>,
    Json(body): Json<CreateCategoryRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let owns = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)",
    )
    .bind(store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if !owns {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Store not found or not owned by you" })),
        ));
    }

    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Category name is required" })),
        ));
    }

    let sort_order = if let Some(s) = body.sort_order {
        s
    } else {
        sqlx::query_scalar::<_, Option<i32>>(
            "SELECT MAX(sort_order) FROM store_product_categories WHERE store_id = $1",
        )
        .bind(store_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?
        .map(|m| m + 1)
        .unwrap_or(0)
    };

    let category = sqlx::query_as::<_, StoreProductCategory>(
        "INSERT INTO store_product_categories (store_id, name, sort_order)
         VALUES ($1, $2, $3)
         RETURNING id, store_id, name, sort_order, created_at",
    )
    .bind(store_id)
    .bind(&name)
    .bind(sort_order)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("unique") || msg.contains("duplicate") {
            (
                StatusCode::CONFLICT,
                Json(json!({ "error": "Category already exists" })),
            )
        } else {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        }
    })?;

    Ok(Json(json!({ "status": "success", "category": category })))
}

pub async fn update_category(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCategoryRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let existing = sqlx::query_as::<_, StoreProductCategory>(
        "SELECT c.id, c.store_id, c.name, c.sort_order, c.created_at
         FROM store_product_categories c
         JOIN stores s ON s.id = c.store_id
         WHERE c.id = $1 AND s.owner_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let existing = match existing {
        Some(c) => c,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Category not found or not owned by you" })),
            ));
        }
    };

    let name = body
        .name
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty())
        .unwrap_or(existing.name.clone());
    let sort_order = body.sort_order.unwrap_or(existing.sort_order);

    let category = sqlx::query_as::<_, StoreProductCategory>(
        "UPDATE store_product_categories SET name = $1, sort_order = $2 WHERE id = $3
         RETURNING id, store_id, name, sort_order, created_at",
    )
    .bind(&name)
    .bind(sort_order)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("unique") || msg.contains("duplicate") {
            (
                StatusCode::CONFLICT,
                Json(json!({ "error": "Category already exists" })),
            )
        } else {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        }
    })?;

    // Keep product.category text in sync for coupons
    if name != existing.name {
        sqlx::query("UPDATE store_products SET category = $1 WHERE category_id = $2")
            .bind(&name)
            .bind(id)
            .execute(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("database error: {}", e) })),
                )
            })?;
    }

    Ok(Json(json!({ "status": "success", "category": category })))
}

pub async fn delete_category(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let result = sqlx::query(
        "DELETE FROM store_product_categories
         WHERE id = $1 AND store_id IN (SELECT id FROM stores WHERE owner_id = $2)",
    )
    .bind(id)
    .bind(auth.0)
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Category not found or not owned by you" })),
        ));
    }

    Ok(Json(json!({ "status": "success", "message": "Category deleted" })))
}

pub async fn reorder_categories(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(store_id): Path<Uuid>,
    Json(body): Json<ReorderCategoriesRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let owns = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)",
    )
    .bind(store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if !owns {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Store not found or not owned by you" })),
        ));
    }

    for item in &body.items {
        sqlx::query(
            "UPDATE store_product_categories SET sort_order = $1 WHERE id = $2 AND store_id = $3",
        )
        .bind(item.sort_order)
        .bind(item.id)
        .bind(store_id)
        .execute(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;
    }

    let categories = sqlx::query_as::<_, StoreProductCategory>(
        "SELECT id, store_id, name, sort_order, created_at
         FROM store_product_categories WHERE store_id = $1 ORDER BY sort_order ASC, name ASC",
    )
    .bind(store_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "categories": categories })))
}

// ─── Product Handlers ───

pub async fn list_products(
    State(pool): State<PgPool>,
    Path(store_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let products = sqlx::query_as::<_, StoreProduct>(
        &format!(
            "SELECT {} FROM store_products WHERE store_id = $1
             ORDER BY category ASC, created_at DESC",
            PRODUCT_COLS
        ),
    )
    .bind(store_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let categories = sqlx::query_as::<_, StoreProductCategory>(
        "SELECT id, store_id, name, sort_order, created_at
         FROM store_product_categories WHERE store_id = $1 ORDER BY sort_order ASC, name ASC",
    )
    .bind(store_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "products": products, "categories": categories })))
}

pub async fn create_product(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(store_id): Path<Uuid>,
    Json(body): Json<CreateProductRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let store = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)",
    )
    .bind(store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if !store {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Store not found or not owned by you" })),
        ));
    }

    if body.price <= 0.0 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Price must be greater than 0" })),
        ));
    }

    let sale_type = body.sale_type.unwrap_or_else(|| "unit".to_string());
    if sale_type != "unit" && sale_type != "weight" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "sale_type must be 'unit' or 'weight'" })),
        ));
    }

    let (category_id, category) =
        resolve_category_for_product(&pool, store_id, body.category_id, body.category).await?;

    let product = sqlx::query_as::<_, StoreProduct>(
        &format!(
            "INSERT INTO store_products (store_id, name, description, price, promotional_price, image, category, category_id, sale_type, stock)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING {}",
            PRODUCT_COLS
        ),
    )
    .bind(store_id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.price)
    .bind(body.promotional_price)
    .bind(&body.image)
    .bind(&category)
    .bind(category_id)
    .bind(&sale_type)
    .bind(body.stock)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "product": product })))
}

pub async fn update_product(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateProductRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let existing = sqlx::query_as::<_, StoreProduct>(
        "SELECT sp.id, sp.store_id, sp.name, sp.description, sp.price, sp.promotional_price, sp.image, sp.category,
                sp.category_id, sp.sale_type, sp.is_available, sp.stock, sp.created_at, sp.updated_at
         FROM store_products sp JOIN stores s ON s.id = sp.store_id
         WHERE sp.id = $1 AND s.owner_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let existing = match existing {
        Some(p) => p,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Product not found or not owned by you" })),
            ));
        }
    };

    let name = body.name.unwrap_or(existing.name);
    let description = body.description.unwrap_or(existing.description);
    let price = body.price.unwrap_or(existing.price);
    let promotional_price = match body.promotional_price {
        Some(inner) => inner,
        None => existing.promotional_price,
    };
    let image = match body.image {
        Some(Some(s)) if s.trim().is_empty() => None,
        Some(inner) => inner,
        None => existing.image,
    };
    let is_available = body.is_available.unwrap_or(existing.is_available);
    let stock = match body.stock {
        Some(inner) => inner,
        None => existing.stock,
    };

    let sale_type = body.sale_type.unwrap_or(existing.sale_type);
    if sale_type != "unit" && sale_type != "weight" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "sale_type must be 'unit' or 'weight'" })),
        ));
    }

    let (category_id, category) = if body.category_id.is_some() || body.category.is_some() {
        let cid = match body.category_id {
            Some(inner) => inner,
            None => existing.category_id,
        };
        resolve_category_for_product(&pool, existing.store_id, cid, body.category).await?
    } else {
        (existing.category_id, existing.category)
    };

    if price <= 0.0 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Price must be greater than 0" })),
        ));
    }

    let product = sqlx::query_as::<_, StoreProduct>(
        &format!(
            "UPDATE store_products SET name = $1, description = $2, price = $3, promotional_price = $4, image = $5,
             category = $6, category_id = $7, sale_type = $8, is_available = $9, stock = $10, updated_at = NOW()
             WHERE id = $11
             RETURNING {}",
            PRODUCT_COLS
        ),
    )
    .bind(&name)
    .bind(&description)
    .bind(price)
    .bind(promotional_price)
    .bind(&image)
    .bind(&category)
    .bind(category_id)
    .bind(&sale_type)
    .bind(is_available)
    .bind(stock)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "product": product })))
}

pub async fn delete_product(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let result = sqlx::query(
        "DELETE FROM store_products WHERE id = $1 AND store_id IN (SELECT id FROM stores WHERE owner_id = $2)",
    )
    .bind(id)
    .bind(auth.0)
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Product not found or not owned by you" })),
        ));
    }

    Ok(Json(json!({ "status": "success", "message": "Product deleted" })))
}

#[derive(Debug, Deserialize)]
pub struct BatchDiscountRequest {
    pub product_ids: Option<Vec<Uuid>>,
    pub category_id: Option<Uuid>,
    pub apply_to_all: Option<bool>,
    pub discount_percent: Option<f64>,
    pub clear_discount: Option<bool>,
}

pub async fn batch_discount(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(store_id): Path<Uuid>,
    Json(body): Json<BatchDiscountRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)",
    )
    .bind(store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("database error: {}", e) }))))?;

    if !is_owner {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Store not owned by user" }))));
    }

    let clear = body.clear_discount.unwrap_or(false);
    let pct = body.discount_percent.unwrap_or(0.0);

    if !clear && (pct <= 0.0 || pct >= 100.0) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "Discount percentage must be between 0 and 100" }))));
    }

    if clear {
        if let Some(ids) = &body.product_ids {
            if !ids.is_empty() {
                sqlx::query(
                    "UPDATE store_products SET promotional_price = NULL, updated_at = NOW()
                     WHERE store_id = $1 AND id = ANY($2)",
                )
                .bind(store_id)
                .bind(ids)
                .execute(&pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;
            }
        } else if let Some(cat_id) = body.category_id {
            sqlx::query(
                "UPDATE store_products SET promotional_price = NULL, updated_at = NOW()
                 WHERE store_id = $1 AND category_id = $2",
            )
            .bind(store_id)
            .bind(cat_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;
        } else if body.apply_to_all.unwrap_or(false) {
            sqlx::query(
                "UPDATE store_products SET promotional_price = NULL, updated_at = NOW()
                 WHERE store_id = $1",
            )
            .bind(store_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;
        }
    } else {
        let multiplier = (100.0 - pct) / 100.0;
        if let Some(ids) = &body.product_ids {
            if !ids.is_empty() {
                sqlx::query(
                    "UPDATE store_products SET promotional_price = ROUND((price * $1)::numeric, 2)::double precision, updated_at = NOW()
                     WHERE store_id = $2 AND id = ANY($3)",
                )
                .bind(multiplier)
                .bind(store_id)
                .bind(ids)
                .execute(&pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;
            }
        } else if let Some(cat_id) = body.category_id {
            sqlx::query(
                "UPDATE store_products SET promotional_price = ROUND((price * $1)::numeric, 2)::double precision, updated_at = NOW()
                 WHERE store_id = $2 AND category_id = $3",
            )
            .bind(multiplier)
            .bind(store_id)
            .bind(cat_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;
        } else if body.apply_to_all.unwrap_or(false) {
            sqlx::query(
                "UPDATE store_products SET promotional_price = ROUND((price * $1)::numeric, 2)::double precision, updated_at = NOW()
                 WHERE store_id = $2",
            )
            .bind(multiplier)
            .bind(store_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;
        }
    }

    let products = sqlx::query_as::<_, StoreProduct>(
        &format!("SELECT {} FROM store_products WHERE store_id = $1 ORDER BY created_at DESC", PRODUCT_COLS),
    )
    .bind(store_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("database error: {}", e) }))))?;

    Ok(Json(json!({ "status": "success", "products": products })))
}

// ─── Addon Handlers ───

pub async fn list_addons(
    State(pool): State<PgPool>,
    Path(product_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let addons = sqlx::query_as::<_, ProductAddon>(
        "SELECT id, product_id, name, price, is_available, created_at
         FROM product_addons WHERE product_id = $1 ORDER BY created_at ASC",
    )
    .bind(product_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "addons": addons })))
}

pub async fn create_addon(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(product_id): Path<Uuid>,
    Json(body): Json<CreateAddonRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let owned = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM store_products sp JOIN stores s ON s.id = sp.store_id WHERE sp.id = $1 AND s.owner_id = $2)",
    )
    .bind(product_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if !owned {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Product not found or not owned by you" })),
        ));
    }

    let is_available = body.is_available.unwrap_or(true);

    let addon = sqlx::query_as::<_, ProductAddon>(
        "INSERT INTO product_addons (product_id, name, price, is_available)
         VALUES ($1, $2, $3, $4)
         RETURNING id, product_id, name, price, is_available, created_at",
    )
    .bind(product_id)
    .bind(&body.name)
    .bind(body.price)
    .bind(is_available)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "addon": addon })))
}

pub async fn update_addon(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAddonRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let existing = sqlx::query_as::<_, ProductAddon>(
        "SELECT pa.id, pa.product_id, pa.name, pa.price, pa.is_available, pa.created_at
         FROM product_addons pa JOIN store_products sp ON sp.id = pa.product_id JOIN stores s ON s.id = sp.store_id
         WHERE pa.id = $1 AND s.owner_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let existing = match existing {
        Some(a) => a,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Addon not found or not owned by you" })),
            ));
        }
    };

    let name = body.name.unwrap_or(existing.name);
    let price = body.price.unwrap_or(existing.price);
    let is_available = body.is_available.unwrap_or(existing.is_available);

    let addon = sqlx::query_as::<_, ProductAddon>(
        "UPDATE product_addons SET name = $1, price = $2, is_available = $3
         WHERE id = $4
         RETURNING id, product_id, name, price, is_available, created_at",
    )
    .bind(&name)
    .bind(price)
    .bind(is_available)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "addon": addon })))
}

pub async fn delete_addon(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let result = sqlx::query(
        "DELETE FROM product_addons WHERE id = $1 AND product_id IN (
            SELECT sp.id FROM store_products sp JOIN stores s ON s.id = sp.store_id WHERE s.owner_id = $2
        )",
    )
    .bind(id)
    .bind(auth.0)
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Addon not found or not owned by you" })),
        ));
    }

    Ok(Json(json!({ "status": "success", "message": "Addon deleted" })))
}

// ─── Store Hours Handlers ───

pub async fn list_store_hours(
    State(pool): State<PgPool>,
    Path(store_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let hours = sqlx::query_as::<_, StoreHours>(
        "SELECT id, store_id, day_of_week, open_time, close_time, is_closed, created_at, updated_at
         FROM store_hours WHERE store_id = $1 ORDER BY day_of_week ASC",
    )
    .bind(store_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "hours": hours })))
}

pub async fn create_store_hours(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(store_id): Path<Uuid>,
    Json(body): Json<CreateStoreHoursRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let owned = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)",
    )
    .bind(store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if !owned {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Store not found or not owned by you" })),
        ));
    }

    if body.day_of_week < 0 || body.day_of_week > 6 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "day_of_week must be 0-6" })),
        ));
    }

    let is_closed = body.is_closed.unwrap_or(false);

    let hours = sqlx::query_as::<_, StoreHours>(
        "INSERT INTO store_hours (store_id, day_of_week, open_time, close_time, is_closed)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (store_id, day_of_week) DO UPDATE SET open_time = $3, close_time = $4, is_closed = $5, updated_at = NOW()
         RETURNING id, store_id, day_of_week, open_time, close_time, is_closed, created_at, updated_at",
    )
    .bind(store_id)
    .bind(body.day_of_week)
    .bind(&body.open_time)
    .bind(&body.close_time)
    .bind(is_closed)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "hours": hours })))
}

pub async fn update_store_hours(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((store_id, hour_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateStoreHoursRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let existing = sqlx::query_as::<_, StoreHours>(
        "SELECT sh.id, sh.store_id, sh.day_of_week, sh.open_time, sh.close_time, sh.is_closed, sh.created_at, sh.updated_at
         FROM store_hours sh JOIN stores s ON s.id = sh.store_id
         WHERE sh.id = $1 AND sh.store_id = $2 AND s.owner_id = $3",
    )
    .bind(hour_id)
    .bind(store_id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let existing = match existing {
        Some(h) => h,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Hours not found" })),
            ));
        }
    };

    let open_time = body.open_time.unwrap_or(existing.open_time);
    let close_time = body.close_time.unwrap_or(existing.close_time);
    let is_closed = body.is_closed.unwrap_or(existing.is_closed);

    let hours = sqlx::query_as::<_, StoreHours>(
        "UPDATE store_hours SET open_time = $1, close_time = $2, is_closed = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING id, store_id, day_of_week, open_time, close_time, is_closed, created_at, updated_at",
    )
    .bind(&open_time)
    .bind(&close_time)
    .bind(is_closed)
    .bind(hour_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "hours": hours })))
}

pub async fn delete_store_hours(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((store_id, hour_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let result = sqlx::query(
        "DELETE FROM store_hours WHERE id = $1 AND store_id = $2 AND store_id IN (SELECT id FROM stores WHERE owner_id = $3)",
    )
    .bind(hour_id)
    .bind(store_id)
    .bind(auth.0)
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Hours not found" })),
        ));
    }

    Ok(Json(json!({ "status": "success", "message": "Hours deleted" })))
}

// ─── Delivery Slots Handlers ───

pub async fn list_delivery_slots(
    State(pool): State<PgPool>,
    Path(store_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let slots = sqlx::query_as::<_, StoreDeliverySlot>(
        &format!(
            "SELECT {} FROM store_delivery_slots WHERE store_id = $1 ORDER BY sort_order ASC, start_time ASC",
            SLOT_COLS
        ),
    )
    .bind(store_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "slots": slots })))
}

pub async fn create_delivery_slot(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(store_id): Path<Uuid>,
    Json(body): Json<CreateDeliverySlotRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let owned = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)",
    )
    .bind(store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if !owned {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Not your store" })),
        ));
    }

    let fulfillment_type = body
        .fulfillment_type
        .unwrap_or_else(|| "ambos".to_string());
    if !["entrega", "retirada", "ambos"].contains(&fulfillment_type.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "fulfillment_type must be entrega, retirada, or ambos" })),
        ));
    }

    let fee = body.fee.unwrap_or(0.0).max(0.0);
    let is_active = body.is_active.unwrap_or(true);
    let sort_order = body.sort_order.unwrap_or(0);

    let slot = sqlx::query_as::<_, StoreDeliverySlot>(
        &format!(
            "INSERT INTO store_delivery_slots (store_id, start_time, end_time, fee, fulfillment_type, is_active, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING {}",
            SLOT_COLS
        ),
    )
    .bind(store_id)
    .bind(&body.start_time)
    .bind(&body.end_time)
    .bind(fee)
    .bind(&fulfillment_type)
    .bind(is_active)
    .bind(sort_order)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "slot": slot })))
}

pub async fn update_delivery_slot(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((store_id, slot_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateDeliverySlotRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let existing = sqlx::query_as::<_, StoreDeliverySlot>(
        "SELECT ds.id, ds.store_id, ds.start_time, ds.end_time, ds.fee, ds.fulfillment_type, ds.is_active, ds.sort_order, ds.created_at, ds.updated_at
         FROM store_delivery_slots ds
         JOIN stores s ON s.id = ds.store_id
         WHERE ds.id = $1 AND ds.store_id = $2 AND s.owner_id = $3",
    )
    .bind(slot_id)
    .bind(store_id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let existing = match existing {
        Some(s) => s,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Slot not found" })),
            ));
        }
    };

    let start_time = body.start_time.unwrap_or(existing.start_time);
    let end_time = body.end_time.unwrap_or(existing.end_time);
    let fee = body.fee.unwrap_or(existing.fee).max(0.0);
    let fulfillment_type = body.fulfillment_type.unwrap_or(existing.fulfillment_type);
    if !["entrega", "retirada", "ambos"].contains(&fulfillment_type.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "fulfillment_type must be entrega, retirada, or ambos" })),
        ));
    }
    let is_active = body.is_active.unwrap_or(existing.is_active);
    let sort_order = body.sort_order.unwrap_or(existing.sort_order);

    let slot = sqlx::query_as::<_, StoreDeliverySlot>(
        &format!(
            "UPDATE store_delivery_slots SET start_time = $1, end_time = $2, fee = $3, fulfillment_type = $4,
             is_active = $5, sort_order = $6, updated_at = NOW()
             WHERE id = $7
             RETURNING {}",
            SLOT_COLS
        ),
    )
    .bind(&start_time)
    .bind(&end_time)
    .bind(fee)
    .bind(&fulfillment_type)
    .bind(is_active)
    .bind(sort_order)
    .bind(slot_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "slot": slot })))
}

pub async fn delete_delivery_slot(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((store_id, slot_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let result = sqlx::query(
        "DELETE FROM store_delivery_slots WHERE id = $1 AND store_id = $2 AND store_id IN (SELECT id FROM stores WHERE owner_id = $3)",
    )
    .bind(slot_id)
    .bind(store_id)
    .bind(auth.0)
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Slot not found" })),
        ));
    }

    Ok(Json(json!({ "status": "success", "message": "Slot deleted" })))
}

// ─── Coupon Handlers ───

pub async fn list_store_coupons(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(store_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let owned = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)",
    )
    .bind(store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if !owned {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Store not found or not owned by you" })),
        ));
    }

    let coupons = sqlx::query_as::<_, StoreCoupon>(
        "SELECT id, store_id, code, discount_type, discount_value, min_order, max_uses, current_uses, product_id, category, applies_to, expires_at, is_active, created_at, updated_at
         FROM store_coupons WHERE store_id = $1 ORDER BY created_at DESC",
    )
    .bind(store_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "coupons": coupons })))
}

pub async fn create_coupon(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(store_id): Path<Uuid>,
    Json(body): Json<CreateCouponRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let owned = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)",
    )
    .bind(store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if !owned {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Store not found or not owned by you" })),
        ));
    }

    let valid_discount_types = ["percentage", "fixed"];
    if !valid_discount_types.contains(&body.discount_type.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "discount_type must be 'percentage' or 'fixed'" })),
        ));
    }

    let applies_to = body.applies_to.unwrap_or_else(|| "all".to_string());
    let valid_applies_to = ["all", "product", "category"];
    if !valid_applies_to.contains(&applies_to.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "applies_to must be 'all', 'product', or 'category'" })),
        ));
    }

    let min_order = body.min_order.unwrap_or(0.0);
    let expires_at: Option<DateTime<Utc>> = body.expires_at.as_ref().and_then(|s| {
        chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S")
            .ok()
            .map(|ndt| ndt.and_utc())
    });

    let coupon = sqlx::query_as::<_, StoreCoupon>(
        "INSERT INTO store_coupons (store_id, code, discount_type, discount_value, min_order, max_uses, product_id, category, applies_to, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, store_id, code, discount_type, discount_value, min_order, max_uses, current_uses, product_id, category, applies_to, expires_at, is_active, created_at, updated_at",
    )
    .bind(store_id)
    .bind(body.code.to_uppercase())
    .bind(&body.discount_type)
    .bind(body.discount_value)
    .bind(min_order)
    .bind(body.max_uses)
    .bind(body.product_id)
    .bind(&body.category)
    .bind(&applies_to)
    .bind(expires_at)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "coupon": coupon })))
}

pub async fn update_coupon(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCouponRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let existing = sqlx::query_as::<_, StoreCoupon>(
        "SELECT sc.id, sc.store_id, sc.code, sc.discount_type, sc.discount_value, sc.min_order, sc.max_uses, sc.current_uses, sc.product_id, sc.category, sc.applies_to, sc.expires_at, sc.is_active, sc.created_at, sc.updated_at
         FROM store_coupons sc JOIN stores s ON s.id = sc.store_id
         WHERE sc.id = $1 AND s.owner_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let existing = match existing {
        Some(c) => c,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Coupon not found or not owned by you" })),
            ));
        }
    };

    let code = body.code.map(|c| c.to_uppercase()).unwrap_or(existing.code);
    let discount_type = body.discount_type.unwrap_or(existing.discount_type);
    let discount_value = body.discount_value.unwrap_or(existing.discount_value);
    let min_order = body.min_order.unwrap_or(existing.min_order);
    let max_uses = body.max_uses.unwrap_or(existing.max_uses);
    let product_id = body.product_id.unwrap_or(existing.product_id);
    let category = body.category.unwrap_or(existing.category);
    let applies_to = body.applies_to.unwrap_or(existing.applies_to);
    let is_active = body.is_active.unwrap_or(existing.is_active);

    let expires_at = match body.expires_at {
        None => existing.expires_at,
        Some(None) => None,
        Some(Some(s)) => chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S")
            .ok()
            .map(|ndt| ndt.and_utc())
            .or(existing.expires_at),
    };

    let coupon = sqlx::query_as::<_, StoreCoupon>(
        "UPDATE store_coupons SET code = $1, discount_type = $2, discount_value = $3, min_order = $4, max_uses = $5,
         product_id = $6, category = $7, applies_to = $8, expires_at = $9, is_active = $10, updated_at = NOW()
         WHERE id = $11
         RETURNING id, store_id, code, discount_type, discount_value, min_order, max_uses, current_uses, product_id, category, applies_to, expires_at, is_active, created_at, updated_at",
    )
    .bind(&code)
    .bind(&discount_type)
    .bind(discount_value)
    .bind(min_order)
    .bind(max_uses)
    .bind(product_id)
    .bind(&category)
    .bind(&applies_to)
    .bind(expires_at)
    .bind(is_active)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "coupon": coupon })))
}

pub async fn delete_coupon(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let result = sqlx::query(
        "DELETE FROM store_coupons WHERE id = $1 AND store_id IN (SELECT id FROM stores WHERE owner_id = $2)",
    )
    .bind(id)
    .bind(auth.0)
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Coupon not found or not owned by you" })),
        ));
    }

    Ok(Json(json!({ "status": "success", "message": "Coupon deleted" })))
}

pub async fn validate_coupon(
    State(pool): State<PgPool>,
    _auth: AuthUser,
    Json(body): Json<ValidateCouponRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let coupon = sqlx::query_as::<_, StoreCoupon>(
        "SELECT id, store_id, code, discount_type, discount_value, min_order, max_uses, current_uses, product_id, category, applies_to, expires_at, is_active, created_at, updated_at
         FROM store_coupons WHERE code = $1 AND is_active = TRUE",
    )
    .bind(body.code.to_uppercase())
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let coupon = match coupon {
        Some(c) => c,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Cupom não encontrado" })),
            ));
        }
    };

    if let Some(max) = coupon.max_uses {
        if coupon.current_uses >= max {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Cupom atingiu o limite de uso" })),
            ));
        }
    }

    if let Some(exp) = coupon.expires_at {
        if Utc::now() > exp {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Cupom expirado" })),
            ));
        }
    }

    if body.subtotal < coupon.min_order {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("Pedido mínimo para este cupom: R$ {:.2}", coupon.min_order) })),
        ));
    }

    let items = body.items.as_deref().unwrap_or(&[]);
    match coupon.applies_to.as_str() {
        "product" => {
            let Some(product_id) = coupon.product_id else {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Cupom de produto mal configurado" })),
                ));
            };
            if !items.iter().any(|item| item.product_id == product_id) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Cupom válido apenas para um produto específico" })),
                ));
            }
        }
        "category" => {
            let Some(ref category) = coupon.category else {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Cupom de categoria mal configurado" })),
                ));
            };
            if !items.iter().any(|item| item.category.as_ref() == Some(category)) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Cupom válido apenas para uma categoria específica" })),
                ));
            }
        }
        _ => {}
    }

    let discount = match coupon.discount_type.as_str() {
        "percentage" => (body.subtotal * coupon.discount_value / 100.0).min(body.subtotal),
        "fixed" => coupon.discount_value.min(body.subtotal),
        _ => 0.0,
    };

    Ok(Json(json!({
        "valid": true,
        "coupon_id": coupon.id,
        "discount": discount,
        "discount_type": coupon.discount_type,
        "discount_value": coupon.discount_value,
    })))
}

// ─── PIX Handler ───

pub async fn get_store_pix(
    State(pool): State<PgPool>,
    Path(store_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let store = sqlx::query_as::<_, Store>(
        &format!("SELECT {} FROM stores WHERE id = $1", STORE_COLS),
    )
    .bind(store_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let store = match store {
        Some(s) => s,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Store not found" })),
            ));
        }
    };

    let pix = sqlx::query_as::<_, crate::models::pix::PixKey>(
        "SELECT id, user_id, pix_type, pix_value, full_name, visibility, created_at, updated_at
         FROM pix_keys WHERE user_id = $1",
    )
    .bind(store.owner_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({
        "store_pix_key": store.pix_key,
        "owner_pix": pix,
    })))
}

// ─── Order Handlers ───

pub async fn create_order(
    State(pool): State<PgPool>,
    State(ws_state): State<crate::ws::WsState>,
    State(call_manager): State<crate::signaling::CallManager>,
    auth: AuthUser,
    Json(body): Json<CreateOrderRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if body.items.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Order must have at least one item" })),
        ));
    }

    let store = sqlx::query_as::<_, Store>(
        &format!("SELECT {} FROM stores WHERE id = $1", STORE_COLS),
    )
    .bind(body.store_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let store = match store {
        Some(s) => s,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Store not found" })),
            ));
        }
    };

    if !store.is_open {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Store is closed" })),
        ));
    }

    let fulfillment_type = body
        .fulfillment_type
        .clone()
        .unwrap_or_else(|| "entrega".to_string());
    if !["entrega", "retirada"].contains(&fulfillment_type.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "fulfillment_type must be entrega or retirada" })),
        ));
    }
    if fulfillment_type == "entrega" && !store.accepts_delivery {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Esta loja não aceita entrega" })),
        ));
    }
    if fulfillment_type == "retirada" && !store.accepts_pickup {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Esta loja não aceita retirada" })),
        ));
    }

    let scheduled_date = match &body.scheduled_date {
        Some(s) => chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "scheduled_date must be YYYY-MM-DD" })),
            )
        })?,
        None => chrono::Utc::now().date_naive(),
    };

    // Check if the store is closed on the scheduled weekday
    {
        use chrono::Datelike;
        let scheduled_weekday = scheduled_date.weekday().num_days_from_sunday() as i32;
        
        let store_hours = sqlx::query_as::<_, StoreHours>(
            "SELECT id, store_id, day_of_week, open_time, close_time, is_closed, created_at, updated_at
             FROM store_hours WHERE store_id = $1",
        )
        .bind(body.store_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;

        // If there are store hours configured, the scheduled day must be present and not closed.
        // If there are no store hours configured at all, we also treat it as closed.
        if store_hours.is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "A loja não possui horários de funcionamento configurados" })),
            ));
        }

        let day_config = store_hours.iter().find(|sh| sh.day_of_week == scheduled_weekday);
        match day_config {
            Some(sh) => {
                if sh.is_closed {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(json!({ "error": "A loja está fechada na data agendada" })),
                    ));
                }
            }
            None => {
                // Day not configured, treat as closed
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "A loja não funciona no dia da semana agendado" })),
                ));
            }
        }
    }

    let mut slot_start = body.slot_start.clone();
    let mut slot_end = body.slot_end.clone();
    let mut delivery_fee = if fulfillment_type == "entrega" {
        store.delivery_fee
    } else {
        0.0
    };

    if let Some(slot_id) = body.slot_id {
        let slot = sqlx::query_as::<_, StoreDeliverySlot>(
            "SELECT id, store_id, start_time, end_time, fee, fulfillment_type, is_active, sort_order, created_at, updated_at
             FROM store_delivery_slots WHERE id = $1 AND store_id = $2 AND is_active = TRUE",
        )
        .bind(slot_id)
        .bind(body.store_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;

        let slot = match slot {
            Some(s) => s,
            None => {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Horário de agendamento inválido" })),
                ));
            }
        };

        if slot.fulfillment_type != "ambos" && slot.fulfillment_type != fulfillment_type {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Este horário não está disponível para o tipo escolhido" })),
            ));
        }

        slot_start = Some(slot.start_time.clone());
        slot_end = Some(slot.end_time.clone());
        delivery_fee = if fulfillment_type == "entrega" {
            slot.fee
        } else {
            0.0
        };
    } else if slot_start.is_none() || slot_end.is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Selecione um horário de entrega/retirada" })),
        ));
    }

    let address_snapshot = if fulfillment_type == "retirada" {
        serde_json::json!({
            "label": "retirada",
            "estado": store.state,
            "cidade": store.city,
            "bairro": store.neighborhood.clone().unwrap_or_default(),
            "cep": store.cep.clone().unwrap_or_default(),
            "rua": store.street.clone().unwrap_or_else(|| store.name.clone()),
            "numero": store.number.clone().unwrap_or_default(),
            "ponto_referencia": "Retirada na loja",
        })
    } else {
        let address_id = body.address_id.ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "address_id is required for delivery" })),
            )
        })?;

        let address = sqlx::query_as::<_, UserAddress>(
            "SELECT id, user_id, label, estado, cidade, bairro, cep, rua, numero, ponto_referencia, is_default, latitude, longitude, created_at, updated_at
             FROM user_addresses WHERE id = $1 AND user_id = $2",
        )
        .bind(address_id)
        .bind(auth.0)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;

        let address = match address {
            Some(a) => a,
            None => {
                return Err((
                    StatusCode::NOT_FOUND,
                    Json(json!({ "error": "Address not found" })),
                ));
            }
        };

        serde_json::json!({
            "label": address.label,
            "estado": address.estado,
            "cidade": address.cidade,
            "bairro": address.bairro,
            "cep": address.cep,
            "rua": address.rua,
            "numero": address.numero,
            "ponto_referencia": address.ponto_referencia,
        })
    };

    let mut subtotal: f64 = 0.0;
    // product_id, name, image, quantity, unit_price, subtotal, observation, addons, sale_type, quantity_decimal
    let mut order_items_data: Vec<(
        Uuid,
        String,
        Option<String>,
        i32,
        f64,
        f64,
        Option<String>,
        serde_json::Value,
        String,
        Option<f64>,
    )> = Vec::new();

    let mut stock_alerts: Vec<(String, f64)> = Vec::new();

    for item in &body.items {
        let product = sqlx::query_as::<_, StoreProduct>(
            &format!(
                "SELECT {} FROM store_products WHERE id = $1 AND store_id = $2 AND is_available = TRUE",
                PRODUCT_COLS
            ),
        )
        .bind(item.product_id)
        .bind(body.store_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;

        let product = match product {
            Some(p) => p,
            None => {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": format!("Product {} not found or unavailable", item.product_id) })),
                ));
            }
        };

        let is_weight = product.sale_type == "weight";
        let (quantity, quantity_decimal, qty_multiplier) = if is_weight {
            let kg = item.quantity_decimal.unwrap_or(0.0);
            if kg < 0.1 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Weight quantity must be at least 0.1 kg" })),
                ));
            }
            // Keep INT quantity as 1 for weight items (display uses quantity_decimal)
            (1_i32, Some(kg), kg)
        } else {
            let qty = item.quantity.unwrap_or(0);
            if qty <= 0 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Quantity must be at least 1" })),
                ));
            }
            (qty, None, qty as f64)
        };

        // Stock check
        if let Some(stock_val) = product.stock {
            if stock_val <= 0.0 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": format!("Produto '{}' esgotado no estoque", product.name) })),
                ));
            }
            if qty_multiplier > stock_val {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": format!("Estoque insuficiente para o produto '{}'. Disponível: {}", product.name, stock_val) })),
                ));
            }

            let new_stock = (stock_val - qty_multiplier).max(0.0);
            let is_available_update = if new_stock <= 0.0 {
                "is_available = FALSE, "
            } else {
                ""
            };

            sqlx::query(&format!(
                "UPDATE store_products SET {}stock = $1, updated_at = NOW() WHERE id = $2",
                is_available_update
            ))
            .bind(new_stock)
            .bind(product.id)
            .execute(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("database error: {}", e) })),
                )
            })?;

            if new_stock <= 10.0 {
                stock_alerts.push((product.name.clone(), new_stock));
            }
        }

        let mut item_addons_total: f64 = 0.0;
        let mut addons_data: Vec<serde_json::Value> = Vec::new();

        if is_weight {
            if item.addon_ids.as_ref().map(|a| !a.is_empty()).unwrap_or(false) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Addons are not allowed for weight products" })),
                ));
            }
        } else if let Some(ref addon_ids) = item.addon_ids {
            for addon_id in addon_ids {
                let addon = sqlx::query_as::<_, ProductAddon>(
                    "SELECT id, product_id, name, price, is_available, created_at
                     FROM product_addons WHERE id = $1 AND product_id = $2 AND is_available = TRUE",
                )
                .bind(addon_id)
                .bind(item.product_id)
                .fetch_optional(&pool)
                .await
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": format!("database error: {}", e) })),
                    )
                })?;

                if let Some(a) = addon {
                    item_addons_total += a.price;
                    addons_data.push(serde_json::json!({
                        "id": a.id,
                        "name": a.name,
                        "price": a.price,
                    }));
                }
            }
        }

        let unit_price_with_addons = product.price + item_addons_total;
        let item_subtotal = unit_price_with_addons * qty_multiplier;
        subtotal += item_subtotal;

        order_items_data.push((
            item.product_id,
            product.name,
            product.image,
            quantity,
            product.price,
            item_subtotal,
            item.observation.clone(),
            serde_json::json!(addons_data),
            product.sale_type.clone(),
            quantity_decimal,
        ));
    }

    if subtotal < store.minimum_order {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": format!("Minimum order is R$ {:.2}. Current subtotal: R$ {:.2}", store.minimum_order, subtotal)
            })),
        ));
    }

    // Apply coupon
    let mut discount: f64 = 0.0;
    let mut coupon_id: Option<Uuid> = None;
    let mut coupon_code: Option<String> = None;

    if let Some(ref code) = body.coupon_code {
        let coupon_result = sqlx::query_as::<_, StoreCoupon>(
            "SELECT id, store_id, code, discount_type, discount_value, min_order, max_uses, current_uses, product_id, category, applies_to, expires_at, is_active, created_at, updated_at
             FROM store_coupons WHERE code = $1 AND store_id = $2 AND is_active = TRUE",
        )
        .bind(code.to_uppercase())
        .bind(body.store_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;

        if let Some(c) = coupon_result {
            let mut valid = true;

            if let Some(max) = c.max_uses {
                if c.current_uses >= max {
                    valid = false;
                }
            }

            if let Some(exp) = c.expires_at {
                if Utc::now() > exp {
                    valid = false;
                }
            }

            if subtotal < c.min_order {
                valid = false;
            }

            if valid {
                discount = match c.discount_type.as_str() {
                    "percentage" => (subtotal * c.discount_value / 100.0).min(subtotal),
                    "fixed" => c.discount_value.min(subtotal),
                    _ => 0.0,
                };
                coupon_id = Some(c.id);
                coupon_code = Some(c.code);

                sqlx::query("UPDATE store_coupons SET current_uses = current_uses + 1 WHERE id = $1")
                    .bind(c.id)
                    .execute(&pool)
                    .await
                    .ok();
            }
        }
    }

    let total = (subtotal - discount) + delivery_fee;

    let order = sqlx::query_as::<_, Order>(
        "INSERT INTO orders (user_id, store_id, subtotal, delivery_fee, discount, total, observation, address_snapshot, coupon_id, coupon_code, fulfillment_type, scheduled_date, slot_start, slot_end, payment_method, payment_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending')
         RETURNING id, user_id, store_id, status::text, subtotal, delivery_fee, discount, total, observation, address_snapshot, coupon_code, fulfillment_type, scheduled_date, slot_start, slot_end, payment_method, payment_status, payment_details, created_at, updated_at",
    )
    .bind(auth.0)
    .bind(body.store_id)
    .bind(subtotal)
    .bind(delivery_fee)
    .bind(discount)
    .bind(total)
    .bind(&body.observation)
    .bind(&address_snapshot)
    .bind(coupon_id)
    .bind(&coupon_code)
    .bind(&fulfillment_type)
    .bind(scheduled_date)
    .bind(&slot_start)
    .bind(&slot_end)
    .bind(&body.payment_method)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    for item_data in &order_items_data {
        sqlx::query(
            "INSERT INTO order_items (order_id, product_id, product_name, product_image, quantity, unit_price, subtotal, observation, addons, sale_type, quantity_decimal)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        )
        .bind(order.id)
        .bind(item_data.0)
        .bind(&item_data.1)
        .bind(&item_data.2)
        .bind(item_data.3)
        .bind(item_data.4)
        .bind(item_data.5)
        .bind(&item_data.6)
        .bind(&item_data.7)
        .bind(&item_data.8)
        .bind(item_data.9)
        .execute(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;
    }

    // Create Splits
    let seller_account_id = store.payment_account_id.clone().unwrap_or_else(|| {
        format!("acc_vendedor_{}", store.owner_id.to_string()[..8].to_uppercase())
    });
    let zapi_fee = (order.total * 0.05 * 100.0).round() / 100.0;
    let seller_share = order.total - zapi_fee;

    let splits = vec![
        crate::payment::provider::PaymentSplit {
            recipient_account_id: seller_account_id.clone(),
            percentage: 95.0,
            amount: seller_share,
        },
        crate::payment::provider::PaymentSplit {
            recipient_account_id: "zapi_platform".to_string(),
            percentage: 5.0,
            amount: zapi_fee,
        },
    ];

    // Call Mock Payment Provider
    let payment_provider = crate::payment::MockProvider;
    let payment_req = crate::payment::provider::PaymentRequest {
        order_id: order.id,
        amount: order.total,
        payment_method: body.payment_method.clone(),
        splits: splits.clone(),
    };
    let payment_res = payment_provider.create_payment(payment_req).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Payment error: {}", e) })),
        )
    })?;

    // Create a transaction in payment_transactions and get its id
    let tx_row: (Uuid,) = sqlx::query_as(
        "INSERT INTO payment_transactions (order_id, provider_payment_id, amount, payment_method, status, details)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id"
    )
    .bind(order.id)
    .bind(&payment_res.payment_id)
    .bind(order.total)
    .bind(&body.payment_method)
    .bind(payment_res.status.to_uppercase())
    .bind(&payment_res.details)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;
    let tx_id = tx_row.0;

    // Save payment splits breakdown to payment_splits
    for split in &splits {
        let recipient_type = if split.recipient_account_id == "zapi_platform" {
            "PLATFORM"
        } else {
            "SELLER"
        };
        sqlx::query(
            "INSERT INTO payment_splits (payment_transaction_id, recipient_type, recipient_id, amount, percentage, status)
             VALUES ($1, $2, $3, $4, $5, 'PENDING')"
        )
        .bind(tx_id)
        .bind(recipient_type)
        .bind(&split.recipient_account_id)
        .bind(split.amount)
        .bind(split.percentage)
        .execute(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;
    }

    let final_order_status = if payment_res.status == "paid" {
        "WAITING_STORE_CONFIRMATION"
    } else {
        "PENDING"
    };

    // Update order payment status and details
    let order = sqlx::query_as::<_, Order>(
        "UPDATE orders 
         SET status = $1, payment_status = $2, payment_details = $3, updated_at = NOW() 
         WHERE id = $4
         RETURNING id, user_id, store_id, status::text, subtotal, delivery_fee, discount, total, observation, address_snapshot, coupon_code, fulfillment_type, scheduled_date, slot_start, slot_end, payment_method, payment_status, payment_details, created_at, updated_at",
    )
    .bind(final_order_status)
    .bind(&payment_res.status)
    .bind(&payment_res.details)
    .bind(order.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    // Create deliveries tracking entry if delivery is chosen
    if order.fulfillment_type == "entrega" || order.fulfillment_type == "delivery" {
        sqlx::query("INSERT INTO deliveries (order_id, status) VALUES ($1, 'PENDING')")
            .bind(order.id)
            .execute(&pool)
            .await
            .ok();
    }

    // Only send order message to seller if payment is approved (paid)
    if order.payment_status == "paid" {
        let mut items_desc = String::new();
        for item in &order_items_data {
            let qty_str = if item.8 == "weight" {
                format!("{:.3}kg", item.9.unwrap_or(0.0))
            } else {
                format!("{}x", item.3)
            };
            items_desc.push_str(&format!("{} {}\n", qty_str, item.1));
        }

        let order_short_id = &order.id.to_string()[..8].to_uppercase();
        let content_text = format!(
            "🛒 {}\n\nObrigado pela sua compra!\n\nPedido #{}\n\n{}Total: R$ {:.2}\n\nStatus:\n🟢 Pago (Aguardando vendedor)",
            store.name,
            order_short_id,
            items_desc,
            total
        );

        let _ = send_delivery_chat_message(
            &pool,
            &ws_state,
            &call_manager,
            store.owner_id,
            auth.0,
            order.id,
            content_text,
            "ORDER_CARD",
        )
        .await;
    }

    // Send stock alerts to the delivery chat so the seller is notified
    for (prod_name, left) in stock_alerts {
        let alert_text = if left <= 0.0 {
            format!("⚠️ ALERTA DE ESTOQUE: O produto '{}' ESGOTOU e foi marcado como indisponível.", prod_name)
        } else {
            format!("⚠️ ALERTA DE ESTOQUE: O produto '{}' tem apenas {:.1} itens restantes.", prod_name, left)
        };
        let _ = send_delivery_chat_message(
            &pool,
            &ws_state,
            &call_manager,
            store.owner_id,
            auth.0,
            order.id,
            alert_text,
            "SYSTEM_EVENT",
        )
        .await;
    }

    Ok(Json(json!({ "status": "success", "order": order })))
}

pub async fn list_orders(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let orders = sqlx::query_as::<_, Order>(
        "SELECT id, user_id, store_id, status::text, subtotal, delivery_fee, discount, total, observation, address_snapshot, coupon_code, fulfillment_type, scheduled_date, slot_start, slot_end, payment_method, payment_status, payment_details, created_at, updated_at
         FROM orders WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(auth.0)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "orders": orders })))
}

pub async fn get_order(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let order = sqlx::query_as::<_, Order>(
        "SELECT o.id, o.user_id, o.store_id, o.status::text, o.subtotal, o.delivery_fee, o.discount, o.total, o.observation, o.address_snapshot, o.coupon_code, o.fulfillment_type, o.scheduled_date, o.slot_start, o.slot_end, o.payment_method, o.payment_status, o.payment_details, o.created_at, o.updated_at
         FROM orders o
         LEFT JOIN stores s ON s.id = o.store_id
         WHERE o.id = $1 AND (o.user_id = $2 OR s.owner_id = $2)",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let order = match order {
        Some(o) => o,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Order not found" })),
            ));
        }
    };

    let items = sqlx::query_as::<_, OrderItem>(
        &format!(
            "SELECT {} FROM order_items WHERE order_id = $1",
            ORDER_ITEM_COLS
        ),
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let store = sqlx::query_as::<_, Store>(
        &format!("SELECT {} FROM stores WHERE id = $1", STORE_COLS),
    )
    .bind(order.store_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "order": order, "items": items, "store": store })))
}

pub async fn update_order_status(
    State(pool): State<PgPool>,
    State(ws_state): State<crate::ws::WsState>,
    State(call_manager): State<crate::signaling::CallManager>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateOrderStatusRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let valid_statuses = ["PENDING_PAYMENT", "PAID", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REJECTED"];
    if !valid_statuses.contains(&body.status.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid status" })),
        ));
    }

    let existing = sqlx::query_as::<_, Order>(
        "SELECT o.id, o.user_id, o.store_id, o.status::text, o.subtotal, o.delivery_fee, o.discount, o.total, o.observation, o.address_snapshot, o.coupon_code, o.fulfillment_type, o.scheduled_date, o.slot_start, o.slot_end, o.payment_method, o.payment_status, o.payment_details, o.created_at, o.updated_at
         FROM orders o JOIN stores s ON s.id = o.store_id
         WHERE o.id = $1 AND s.owner_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let existing = match existing {
        Some(o) => o,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Order not found or not owned by your store" })),
            ));
        }
    };

    let order = sqlx::query_as::<_, Order>(
        "UPDATE orders SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, user_id, store_id, status::text, subtotal, delivery_fee, discount, total, observation, address_snapshot, coupon_code, fulfillment_type, scheduled_date, slot_start, slot_end, payment_method, payment_status, payment_details, created_at, updated_at",
    )
    .bind(&body.status)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if body.status != existing.status {
        let (title, message) = match body.status.as_str() {
            "ACCEPTED" => ("Pedido aceito!", "Seu pedido foi aceito"),
            "OUT_FOR_DELIVERY" => {
                if existing.fulfillment_type == "retirada" {
                    ("Pronto para retirada!", "Seu pedido está pronto para retirar na loja")
                } else {
                    ("A caminho!", "Seu pedido saiu pra entrega")
                }
            }
            "DELIVERED" => {
                if existing.fulfillment_type == "retirada" {
                    ("Retirado!", "Seu pedido foi retirado")
                } else {
                    ("Entregue!", "Seu pedido foi entregue")
                }
            }
            "CANCELLED" => ("Pedido cancelado", "Infelizmente seu pedido foi cancelado"),
            "REJECTED" => ("Pedido recusado", "Infelizmente seu pedido foi recusado pelo estabelecimento"),
            _ => ("", ""),
        };

        if !title.is_empty() {
            let devices: Vec<(String,)> = sqlx::query_as(
                "SELECT token FROM device_tokens WHERE user_id = $1",
            )
            .bind(existing.user_id)
            .fetch_all(&pool)
            .await
            .unwrap_or_default();

            for (token,) in devices {
                sqlx::query(
                    "INSERT INTO notification_queue (user_id, device_token, title, body, data_payload) VALUES ($1, $2, $3, $4, $5)",
                )
                .bind(existing.user_id)
                .bind(&token)
                .bind(title)
                .bind(message)
                .bind(serde_json::json!({ "order_id": id }))
                .execute(&pool)
                .await
                .ok();
            }
        }

        let order_short_id = &id.to_string()[..8].to_uppercase();
        let status_msg = match body.status.as_str() {
            "ACCEPTED" => "🟢 Pedido confirmado\n\nSeu pedido está sendo separado.",
            "PREPARING" => "👨‍🍳 Preparando\n\nSeu pedido está sendo preparado.",
            "READY" => "🚚 Pronto para retirada\n\nSeu pedido já está pronto para ser retirado.",
            "OUT_FOR_DELIVERY" => {
                if existing.fulfillment_type == "retirada" {
                    "🚚 Pronto para retirada\n\nSeu pedido já está pronto para ser retirado."
                } else {
                    "🚚 Saiu para entrega\n\nSeu pedido saiu para entrega."
                }
            }
            "DELIVERED" => {
                if existing.fulfillment_type == "retirada" {
                    "✅ Pedido retirado\n\nEsperamos que tenha gostado!"
                } else {
                    "✅ Pedido entregue\n\nEsperamos que tenha gostado!"
                }
            }
            "CANCELLED" => "❌ Pedido cancelado\n\nInfelizmente seu pedido foi cancelado.",
            "REJECTED" => "❌ Pedido recusado\n\nInfelizmente seu pedido foi recusado pelo estabelecimento.",
            _ => "",
        };

        if !status_msg.is_empty() {
            let content_text = format!(
                "🧾 Pedido #{}\n\n{}",
                order_short_id,
                status_msg
            );
            
            let _ = send_delivery_chat_message(
                &pool,
                &ws_state,
                &call_manager,
                auth.0, // store owner
                existing.user_id, // buyer
                id, // order id
                content_text,
                "TEXT",
            ).await;
        }
    }

    Ok(Json(json!({ "status": "success", "order": order })))
}

pub async fn list_vendor_orders(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let orders = sqlx::query_as::<_, Order>(
        "SELECT o.id, o.user_id, o.store_id, o.status::text, o.subtotal, o.delivery_fee, o.discount, o.total, o.observation, o.address_snapshot, o.coupon_code, o.fulfillment_type, o.scheduled_date, o.slot_start, o.slot_end, o.payment_method, o.payment_status, o.payment_details, o.created_at, o.updated_at
         FROM orders o JOIN stores s ON s.id = o.store_id
         WHERE s.owner_id = $1 AND o.payment_status = 'paid'
         ORDER BY o.created_at DESC",
    )
    .bind(auth.0)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "orders": orders })))
}

// ─── Store Review Handlers ───

pub async fn create_store_review(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(store_id): Path<Uuid>,
    Json(body): Json<CreateReviewRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if body.rating < 0 || body.rating > 5 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Rating must be between 0 and 5" })),
        ));
    }

    // Check if store exists
    let store_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1)",
    )
    .bind(store_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if !store_exists {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Store not found" })),
        ));
    }

    // Start a database transaction to insert/update review and update store score
    let mut tx = pool.begin().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("failed to start transaction: {}", e) })),
        )
    })?;

    // Insert or update the review
    let review = sqlx::query_as::<_, StoreReview>(
        "INSERT INTO store_reviews (store_id, user_id, rating, comment, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (store_id, user_id)
         DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()
         RETURNING id, store_id, user_id, rating, comment, created_at, updated_at",
    )
    .bind(store_id)
    .bind(auth.0)
    .bind(body.rating)
    .bind(&body.comment)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("failed to save review: {}", e) })),
        )
    })?;

    // Update store average rating and count
    sqlx::query(
        "UPDATE stores
         SET score = COALESCE((SELECT AVG(rating)::DOUBLE PRECISION FROM store_reviews WHERE store_id = $1), 0.00),
             ratings_count = (SELECT COUNT(*)::INT FROM store_reviews WHERE store_id = $1)
         WHERE id = $1",
    )
    .bind(store_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("failed to update store average score: {}", e) })),
        )
    })?;

    tx.commit().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("failed to commit transaction: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "review": review })))
}

pub async fn list_store_reviews(
    State(pool): State<PgPool>,
    Path(store_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let reviews = sqlx::query_as::<_, StoreReviewWithUser>(
        "SELECT r.id, r.store_id, r.user_id, COALESCE(u.name, u.username) AS user_name, u.avatar_url AS user_avatar, r.rating, r.comment, r.created_at, r.updated_at
         FROM store_reviews r
         JOIN users u ON r.user_id = u.id
         WHERE r.store_id = $1
         ORDER BY r.created_at DESC",
    )
    .bind(store_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "reviews": reviews })))
}

async fn send_delivery_chat_message(
    pool: &PgPool,
    ws_state: &crate::ws::WsState,
    call_manager: &crate::signaling::CallManager,
    sender_id: Uuid,
    recipient_id: Uuid,
    order_id: Uuid,
    content_text: String,
    msg_type: &str,
) -> Result<(), sqlx::Error> {
    if sender_id == recipient_id {
        return Ok(());
    }

    let existing: Option<(Uuid,)> = sqlx::query_as(
        "SELECT c.id FROM chats c
         JOIN chat_participants cp1 ON cp1.chat_id = c.id AND cp1.user_id = $1
         JOIN chat_participants cp2 ON cp2.chat_id = c.id AND cp2.user_id = $2
         WHERE c.is_group = false
         LIMIT 1",
    )
    .bind(sender_id)
    .bind(recipient_id)
    .fetch_optional(pool)
    .await?;

    let chat_id = match existing {
        Some((id,)) => id,
        None => {
            let (new_chat_id,): (Uuid,) = sqlx::query_as(
                "INSERT INTO chats (is_group) VALUES (false) RETURNING id",
            )
            .fetch_one(pool)
            .await?;
            
            sqlx::query("INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2), ($1, $3)")
                .bind(new_chat_id)
                .bind(sender_id)
                .bind(recipient_id)
                .execute(pool)
                .await?;
            new_chat_id
        }
    };

    let message_id = Uuid::now_v7();
    let mut msg = sqlx::query_as::<_, crate::models::message::Message>(
        "INSERT INTO messages (id, chat_id, sender_id, content, order_id, msg_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING
            id,
            chat_id,
            sender_id,
            (SELECT username FROM users WHERE id = $3) AS sender_username,
            content,
            image_url,
            order_id,
            msg_type,
            created_at,
            deleted_for_everyone,
            deleted_at",
    )
    .bind(message_id)
    .bind(chat_id)
    .bind(sender_id)
    .bind(&content_text)
    .bind(order_id)
    .bind(msg_type)
    .fetch_one(pool)
    .await?;

    msg.status = Some("sent".to_string());

    let _ = ws_state
        .broadcast(chat_id, &serde_json::to_string(&json!({"type": "new_message", "message": msg})).unwrap())
        .await;

    let participants: Vec<(Uuid, Option<chrono::DateTime<chrono::Utc>>, Option<bool>)> = sqlx::query_as(
        "SELECT user_id, notification_muted_until, notification_muted_forever FROM chat_participants WHERE chat_id = $1"
    )
    .bind(chat_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut offline_user_ids = Vec::new();
    for (p_id, p_muted_until, p_muted_forever) in &participants {
        let p_id = *p_id;
        let p_muted_forever = p_muted_forever.unwrap_or(false);
        if p_id != sender_id {
            let is_muted = if p_muted_forever {
                true
            } else if let Some(until) = p_muted_until {
                *until > chrono::Utc::now()
            } else {
                false
            };

            let presence = call_manager.get_presence(p_id);
            match presence {
                Some(crate::signaling::PresenceState::Active) => {
                    let ws_notif = json!({
                        "type": "new_message_notification",
                        "chat_id": chat_id,
                        "message": msg.clone()
                    }).to_string();
                    call_manager.send_to_user(p_id, &ws_notif);
                }
                Some(crate::signaling::PresenceState::Background) => {
                    let ws_notif = json!({
                        "type": "new_message_notification",
                        "chat_id": chat_id,
                        "message": msg.clone()
                    }).to_string();
                    call_manager.send_to_user(p_id, &ws_notif);
                    if !is_muted {
                        offline_user_ids.push(p_id);
                    }
                }
                None => {
                    if !is_muted {
                        offline_user_ids.push(p_id);
                    }
                }
            }
        }

        let update_msg = json!({
            "type": "chat_list_update",
            "chat_id": chat_id
        }).to_string();
        call_manager.send_to_user(p_id, &update_msg);
    }

    let sender_name = msg.sender_username.clone();
    let push_text = content_text.clone();
    let pool_clone = pool.clone();
    if !offline_user_ids.is_empty() {
        tokio::spawn(async move {
            crate::push::send_push_notification(
                &pool_clone,
                chat_id,
                &sender_name,
                &push_text,
                None,
                offline_user_ids,
            )
            .await;
        });
    }

    Ok(())
}

pub async fn execute_order_cancellation_and_refund(
    pool: &PgPool,
    ws_state: &crate::ws::WsState,
    call_manager: &crate::signaling::CallManager,
    order_id: Uuid,
    user_id: Uuid,
    store_owner_id: Uuid,
    _store_name: &str,
    total_amount: f64,
    cancelled_by: &str,
    reason: &str,
) -> Result<(), sqlx::Error> {
    let order_status: (String,) = sqlx::query_as(
        "SELECT status FROM orders WHERE id = $1"
    )
    .bind(order_id)
    .fetch_one(pool)
    .await?;
    
    if order_status.0 == "CANCELLED" || order_status.0 == "REJECTED" {
        return Ok(());
    }

    let final_status = if cancelled_by == "STORE" { "REJECTED" } else { "CANCELLED" };
    
    sqlx::query(
        "UPDATE orders SET status = $1, payment_status = 'refunded', updated_at = NOW() WHERE id = $2"
    )
    .bind(final_status)
    .bind(order_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO order_cancellations (order_id, cancelled_by, reason) VALUES ($1, $2, $3)"
    )
    .bind(order_id)
    .bind(cancelled_by)
    .bind(reason)
    .execute(pool)
    .await?;

    let transaction: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT id, provider_payment_id FROM payment_transactions WHERE order_id = $1 AND status = 'PAID' ORDER BY created_at DESC LIMIT 1"
    )
    .bind(order_id)
    .fetch_optional(pool)
    .await?;

    if let Some((tx_id, provider_payment_id)) = transaction {
        let payment_provider = crate::payment::MockProvider;
        if let Ok(_refund_res) = payment_provider.refund_payment(&provider_payment_id).await {
            let provider_refund_id = format!("ref_{}", uuid::Uuid::new_v4().to_string()[..12].to_string());
            sqlx::query(
                "INSERT INTO refunds (order_id, payment_transaction_id, amount, status, provider_refund_id)
                 VALUES ($1, $2, $3, 'COMPLETED', $4)"
            )
            .bind(order_id)
            .bind(tx_id)
            .bind(total_amount)
            .bind(&provider_refund_id)
            .execute(pool)
            .await?;

            sqlx::query(
                "UPDATE payment_splits SET status = 'REFUNDED' WHERE payment_transaction_id = $1"
            )
            .bind(tx_id)
            .execute(pool)
            .await?;

            let order_short_id = &order_id.to_string()[..8].to_uppercase();
            let who_str = match cancelled_by {
                "STORE" => "pelo vendedor",
                "CUSTOMER" => "pelo cliente",
                _ => "automaticamente pelo sistema"
            };
            let refund_text = format!(
                "❌ Pedido #{}\n\nStatus: Cancelado {}\nMotivo: {}\n\n💰 Reembolso concluído: R$ {:.2} foi estornado para sua conta.",
                order_short_id,
                who_str,
                reason,
                total_amount
            );

            let _ = send_delivery_chat_message(
                pool,
                ws_state,
                call_manager,
                store_owner_id,
                user_id,
                order_id,
                refund_text,
                "SYSTEM_EVENT",
            )
            .await;
        }
    }

    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct CancelOrderRequest {
    pub cancelled_by: String, // "CUSTOMER", "STORE"
    pub reason: String,
}

pub async fn cancel_order(
    State(pool): State<PgPool>,
    State(ws_state): State<crate::ws::WsState>,
    State(call_manager): State<crate::signaling::CallManager>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<CancelOrderRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let order = sqlx::query_as::<_, Order>(
        "SELECT id, user_id, store_id, status::text, subtotal, delivery_fee, discount, total, observation, address_snapshot, coupon_code, fulfillment_type, scheduled_date, slot_start, slot_end, payment_method, payment_status, payment_details, created_at, updated_at
         FROM orders WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let order = match order {
        Some(o) => o,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Order not found" })),
            ));
        }
    };

    let store = sqlx::query_as::<_, Store>(
        &format!("SELECT {} FROM stores WHERE id = $1", STORE_COLS),
    )
    .bind(order.store_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    if body.cancelled_by == "CUSTOMER" && order.user_id != auth.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Only the buyer can cancel this order as CUSTOMER" })),
        ));
    }

    if body.cancelled_by == "STORE" && store.owner_id != auth.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Only the store owner can cancel this order as STORE" })),
        ));
    }

    if order.status == "DELIVERED" || order.status == "CANCELLED" || order.status == "REJECTED" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("Cannot cancel order in status: {}", order.status) })),
        ));
    }

    if body.cancelled_by == "CUSTOMER" && order.status != "PENDING" && order.status != "WAITING_STORE_CONFIRMATION" && order.status != "ACCEPTED" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Cannot cancel order after preparation has started" })),
        ));
    }

    execute_order_cancellation_and_refund(
        &pool,
        &ws_state,
        &call_manager,
        order.id,
        order.user_id,
        store.owner_id,
        &store.name,
        order.total,
        &body.cancelled_by,
        &body.reason,
    )
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Cancellation failed: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "message": "Order cancelled and refund initiated" })))
}

pub async fn simulate_payment(
    State(pool): State<PgPool>,
    State(ws_state): State<crate::ws::WsState>,
    State(call_manager): State<crate::signaling::CallManager>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let order = sqlx::query_as::<_, Order>(
        "SELECT id, user_id, store_id, status::text, subtotal, delivery_fee, discount, total, observation, address_snapshot, coupon_code, fulfillment_type, scheduled_date, slot_start, slot_end, payment_method, payment_status, payment_details, created_at, updated_at
         FROM orders WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let order = match order {
        Some(o) => o,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Order not found" })),
            ));
        }
    };

    if order.payment_status != "pending" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("Order is not in pending payment status. Current: {}", order.payment_status) })),
        ));
    }

    let transaction_id = format!("tx_sim_{}", uuid::Uuid::new_v4().to_string()[..12].to_string());
    
    // Simulate webhook idempotency check with audit logging:
    let provider_event_id = format!("evt_{}", uuid::Uuid::new_v4().to_string()[..12].to_string());
    let event_payload = serde_json::json!({
        "transaction_id": transaction_id,
        "amount": order.total,
        "status": "paid"
    });

    // 1. Insert payment event for idempotency
    let is_event_new = sqlx::query(
        "INSERT INTO payment_events (provider_event_id, event_type, provider, payload, processed, processed_at)
         VALUES ($1, 'payment.success', 'MOCK', $2, TRUE, NOW())
         ON CONFLICT (provider_event_id) DO NOTHING"
    )
    .bind(&provider_event_id)
    .bind(&event_payload)
    .execute(&pool)
    .await
    .map(|r| r.rows_affected() > 0)
    .unwrap_or(false);

    if !is_event_new {
        return Ok(Json(json!({ "status": "success", "order": order })));
    }

    // 2. Fetch merchant payment account and calculate splits
    let store = sqlx::query_as::<_, Store>(
        &format!("SELECT {} FROM stores WHERE id = $1", STORE_COLS),
    )
    .bind(order.store_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Store not found for this order" })),
        )
    })?;

    let seller_account_id = store.payment_account_id.clone().unwrap_or_else(|| {
        format!("acc_vendedor_{}", store.owner_id.to_string()[..8].to_uppercase())
    });
    let zapi_fee = (order.total * 0.05 * 100.0).round() / 100.0;
    let seller_share = order.total - zapi_fee;

    let splits = vec![
        crate::payment::provider::PaymentSplit {
            recipient_account_id: seller_account_id.clone(),
            percentage: 95.0,
            amount: seller_share,
        },
        crate::payment::provider::PaymentSplit {
            recipient_account_id: "zapi_platform".to_string(),
            percentage: 5.0,
            amount: zapi_fee,
        },
    ];

    let new_details = serde_json::json!({
        "simulated": true,
        "transaction_id": transaction_id,
        "paid_at": chrono::Utc::now().to_rfc3339(),
        "splits": splits
    });

    // 3. Insert transaction log and get tx_id
    let tx_row: (Uuid,) = sqlx::query_as(
        "INSERT INTO payment_transactions (order_id, provider_payment_id, amount, payment_method, status, details)
         VALUES ($1, $2, $3, $4, 'PAID', $5)
         RETURNING id"
    )
    .bind(order.id)
    .bind(&transaction_id)
    .bind(order.total)
    .bind(order.payment_method.as_deref().unwrap_or("pix"))
    .bind(&new_details)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;
    let tx_id = tx_row.0;

    // 4. Save splits breakdown
    for split in &splits {
        let recipient_type = if split.recipient_account_id == "zapi_platform" {
            "PLATFORM"
        } else {
            "SELLER"
        };
        sqlx::query(
            "INSERT INTO payment_splits (payment_transaction_id, recipient_type, recipient_id, amount, percentage, status)
             VALUES ($1, $2, $3, $4, $5, 'PENDING')"
        )
        .bind(tx_id)
        .bind(recipient_type)
        .bind(&split.recipient_account_id)
        .bind(split.amount)
        .bind(split.percentage)
        .execute(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;
    }

    // 5. Update order status to 'WAITING_STORE_CONFIRMATION' and payment_status to 'paid'
    let order = sqlx::query_as::<_, Order>(
        "UPDATE orders 
         SET status = 'WAITING_STORE_CONFIRMATION', payment_status = 'paid', payment_details = $1, updated_at = NOW() 
         WHERE id = $2
         RETURNING id, user_id, store_id, status::text, subtotal, delivery_fee, discount, total, observation, address_snapshot, coupon_code, fulfillment_type, scheduled_date, slot_start, slot_end, payment_method, payment_status, payment_details, created_at, updated_at",
    )
    .bind(&new_details)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let order_items = sqlx::query_as::<_, OrderItem>(
        &format!("SELECT {} FROM order_items WHERE order_id = $1", ORDER_ITEM_COLS),
    )
    .bind(order.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let mut items_desc = String::new();
    for item in &order_items {
        let qty_str = if item.sale_type == "weight" {
            format!("{:.3}kg", item.quantity_decimal.unwrap_or(0.0))
        } else {
            format!("{}x", item.quantity)
        };
        items_desc.push_str(&format!("{} {}\n", qty_str, item.product_name));
    }

    let order_short_id = &order.id.to_string()[..8].to_uppercase();
    let content_text = format!(
        "🛒 {}\n\nObrigado pela sua compra!\n\nPedido #{}\n\n{}Total: R$ {:.2}\n\nStatus:\n🟢 Pago (Aguardando vendedor)",
        store.name,
        order_short_id,
        items_desc,
        order.total
    );

    // 5. Send message with ORDER_CARD type
    let _ = send_delivery_chat_message(
        &pool,
        &ws_state,
        &call_manager,
        store.owner_id,
        auth.0,
        order.id,
        content_text,
        "ORDER_CARD",
    )
    .await;

    let devices: Vec<(String,)> = sqlx::query_as(
        "SELECT token FROM device_tokens WHERE user_id = $1",
    )
    .bind(auth.0)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    for (token,) in devices {
        sqlx::query(
            "INSERT INTO notification_queue (user_id, device_token, title, body, data_payload) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(auth.0)
        .bind(&token)
        .bind("Pagamento confirmado!")
        .bind(format!("Seu pagamento para o pedido #{} foi aprovado.", order_short_id))
        .bind(serde_json::json!({ "order_id": order.id }))
        .execute(&pool)
        .await
        .ok();
    }

    Ok(Json(json!({ "status": "paid", "order": order })))
}

pub async fn list_promotions(
    State(pool): State<PgPool>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let items = sqlx::query_as::<_, PromotionalProductItem>(
        "SELECT 
            sp.id, 
            sp.store_id, 
            s.name AS store_name, 
            (SELECT avatar_url FROM users u WHERE u.id = s.owner_id) AS store_avatar, 
            s.city AS store_city, 
            s.delivery_fee, 
            s.minimum_order, 
            s.is_open AS is_store_open, 
            sp.name, 
            sp.description, 
            sp.price, 
            sp.promotional_price, 
            sp.image, 
            sp.category, 
            sp.sale_type, 
            sp.is_available
         FROM store_products sp
         JOIN stores s ON s.id = sp.store_id
         WHERE sp.promotional_price IS NOT NULL 
           AND sp.promotional_price > 0 
           AND sp.promotional_price < sp.price 
           AND sp.is_available = TRUE
         ORDER BY s.is_open DESC, ((sp.price - sp.promotional_price) / sp.price) DESC
         LIMIT 30"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({ "promotions": items })))
}
