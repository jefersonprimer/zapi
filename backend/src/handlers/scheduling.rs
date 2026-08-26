use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, patch, post, put},
    Json, Router,
};
use chrono::{DateTime, Utc, NaiveDate, NaiveTime, Datelike};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::models::scheduling::*;
use crate::models::delivery::StoreHours;
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateServiceRequest {
    pub store_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub price: f64,
    pub duration_minutes: i32,
    pub image_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateServiceRequest {
    pub name: String,
    pub description: Option<String>,
    pub price: f64,
    pub duration_minutes: i32,
    pub image_url: Option<String>,
    pub is_available: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateProfessionalRequest {
    pub store_id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub service_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfessionalRequest {
    pub name: String,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub is_active: bool,
    pub service_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct AvailableSlotsQuery {
    pub date: NaiveDate,
    pub service_id: Uuid,
    pub professional_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct Slot {
    pub start: String,
    pub end: String,
    pub available: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateAppointmentRequest {
    pub store_id: Uuid,
    pub service_id: Uuid,
    pub professional_id: Uuid,
    pub appointment_date: NaiveDate,
    pub start_time: String, // "HH:MM"
    pub client_name: String,
    pub client_phone: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStatusRequest {
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct VendorAppointmentsQuery {
    pub store_id: Uuid,
    pub date: Option<NaiveDate>,
}

// Services Handlers
pub async fn list_services(
    State(pool): State<PgPool>,
    Path(store_id): Path<Uuid>,
) -> Result<Json<Vec<Service>>, (StatusCode, Json<Value>)> {
    let services = sqlx::query_as::<_, Service>(
        "SELECT id, store_id, name, description, price::double precision, duration_minutes, image_url, is_available, created_at, updated_at \
         FROM services WHERE store_id = $1 ORDER BY name ASC"
    )
    .bind(store_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(services))
}

pub async fn create_service(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateServiceRequest>,
) -> Result<Json<Service>, (StatusCode, Json<Value>)> {
    // Check if user is owner of the store
    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)"
    )
    .bind(body.store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    if !is_owner {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Not the store owner" }))));
    }

    let service = sqlx::query_as::<_, Service>(
        "INSERT INTO services (store_id, name, description, price, duration_minutes, image_url) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING id, store_id, name, description, price::double precision, duration_minutes, image_url, is_available, created_at, updated_at"
    )
    .bind(body.store_id)
    .bind(body.name)
    .bind(body.description)
    .bind(body.price)
    .bind(body.duration_minutes)
    .bind(body.image_url)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(service))
}

pub async fn update_service(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateServiceRequest>,
) -> Result<Json<Service>, (StatusCode, Json<Value>)> {
    // Check store owner
    let store_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT store_id FROM services WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?
    .ok_or((StatusCode::NOT_FOUND, Json(json!({ "error": "Service not found" }))))?;

    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)"
    )
    .bind(store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    if !is_owner {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Not the store owner" }))));
    }

    let service = sqlx::query_as::<_, Service>(
        "UPDATE services SET name = $1, description = $2, price = $3, duration_minutes = $4, image_url = $5, is_available = $6, updated_at = NOW() \
         WHERE id = $7 \
         RETURNING id, store_id, name, description, price::double precision, duration_minutes, image_url, is_available, created_at, updated_at"
    )
    .bind(body.name)
    .bind(body.description)
    .bind(body.price)
    .bind(body.duration_minutes)
    .bind(body.image_url)
    .bind(body.is_available)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(service))
}

pub async fn delete_service(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let store_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT store_id FROM services WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?
    .ok_or((StatusCode::NOT_FOUND, Json(json!({ "error": "Service not found" }))))?;

    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)"
    )
    .bind(store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    if !is_owner {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Not the store owner" }))));
    }

    sqlx::query("DELETE FROM services WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(json!({ "success": true })))
}

// Professionals Handlers
pub async fn list_professionals(
    State(pool): State<PgPool>,
    Path(store_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let professionals = sqlx::query_as::<_, Professional>(
        "SELECT id, store_id, name, avatar_url, bio, is_active, created_at, updated_at \
         FROM professionals WHERE store_id = $1 ORDER BY name ASC"
    )
    .bind(store_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let mut result = Vec::new();
    for prof in professionals {
        let service_ids = sqlx::query_scalar::<_, Uuid>(
            "SELECT service_id FROM professional_services WHERE professional_id = $1"
        )
        .bind(prof.id)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

        let mut v = serde_json::to_value(&prof).unwrap();
        v["service_ids"] = serde_json::to_value(&service_ids).unwrap();
        result.push(v);
    }

    Ok(Json(json!(result)))
}

pub async fn create_professional(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateProfessionalRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)"
    )
    .bind(body.store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    if !is_owner {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Not the store owner" }))));
    }

    let mut tx = pool.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let prof = sqlx::query_as::<_, Professional>(
        "INSERT INTO professionals (store_id, name, avatar_url, bio) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, store_id, name, avatar_url, bio, is_active, created_at, updated_at"
    )
    .bind(body.store_id)
    .bind(body.name)
    .bind(body.avatar_url)
    .bind(body.bio)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    for s_id in &body.service_ids {
        sqlx::query("INSERT INTO professional_services (professional_id, service_id) VALUES ($1, $2)")
            .bind(prof.id)
            .bind(s_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;
    }

    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let mut v = serde_json::to_value(&prof).unwrap();
    v["service_ids"] = serde_json::to_value(&body.service_ids).unwrap();

    Ok(Json(v))
}

pub async fn update_professional(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateProfessionalRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let store_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT store_id FROM professionals WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?
    .ok_or((StatusCode::NOT_FOUND, Json(json!({ "error": "Professional not found" }))))?;

    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)"
    )
    .bind(store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    if !is_owner {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Not the store owner" }))));
    }

    let mut tx = pool.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let prof = sqlx::query_as::<_, Professional>(
        "UPDATE professionals SET name = $1, avatar_url = $2, bio = $3, is_active = $4, updated_at = NOW() \
         WHERE id = $5 \
         RETURNING id, store_id, name, avatar_url, bio, is_active, created_at, updated_at"
    )
    .bind(body.name)
    .bind(body.avatar_url)
    .bind(body.bio)
    .bind(body.is_active)
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    sqlx::query("DELETE FROM professional_services WHERE professional_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    for s_id in &body.service_ids {
        sqlx::query("INSERT INTO professional_services (professional_id, service_id) VALUES ($1, $2)")
            .bind(id)
            .bind(s_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;
    }

    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let mut v = serde_json::to_value(&prof).unwrap();
    v["service_ids"] = serde_json::to_value(&body.service_ids).unwrap();

    Ok(Json(v))
}

pub async fn delete_professional(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let store_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT store_id FROM professionals WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?
    .ok_or((StatusCode::NOT_FOUND, Json(json!({ "error": "Professional not found" }))))?;

    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)"
    )
    .bind(store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    if !is_owner {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Not the store owner" }))));
    }

    sqlx::query("DELETE FROM professionals WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(json!({ "success": true })))
}

// Available Slots Calculation
pub async fn get_available_slots(
    State(pool): State<PgPool>,
    Path(store_id): Path<Uuid>,
    Query(query): Query<AvailableSlotsQuery>,
) -> Result<Json<Vec<Slot>>, (StatusCode, Json<Value>)> {
    // 1. Get service duration
    let duration = sqlx::query_scalar::<_, i32>(
        "SELECT duration_minutes FROM services WHERE id = $1 AND store_id = $2 AND is_available = TRUE"
    )
    .bind(query.service_id)
    .bind(store_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?
    .ok_or((StatusCode::BAD_REQUEST, Json(json!({ "error": "Invalid service ID" }))))?;

    // 2. Get store hours for this day of week
    let weekday = query.date.weekday().num_days_from_sunday() as i32; // 0 = Sunday, 6 = Saturday
    let store_hour = sqlx::query_as::<_, StoreHours>(
        "SELECT id, store_id, day_of_week, open_time, close_time, is_closed, created_at, updated_at \
         FROM store_hours WHERE store_id = $1 AND day_of_week = $2"
    )
    .bind(store_id)
    .bind(weekday)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let (open_time, close_time) = match store_hour {
        Some(sh) if !sh.is_closed => (sh.open_time, sh.close_time),
        _ => return Ok(Json(Vec::new())), // Closed on this day
    };

    let start_parsed = NaiveTime::parse_from_str(&open_time, "%H:%M")
        .or_else(|_| NaiveTime::parse_from_str(&open_time, "%H:%M:%S"))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Invalid open_time: {}", e) }))))?;
    let end_parsed = NaiveTime::parse_from_str(&close_time, "%H:%M")
        .or_else(|_| NaiveTime::parse_from_str(&close_time, "%H:%M:%S"))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Invalid close_time: {}", e) }))))?;

    // 3. Get existing appointments for this professional on this date
    let appointments = sqlx::query_as::<_, Appointment>(
        "SELECT id, store_id, user_id, service_id, professional_id, appointment_date, start_time, end_time, status, client_name, client_phone, notes, created_at, updated_at \
         FROM appointments WHERE professional_id = $1 AND appointment_date = $2 AND status != 'cancelled'"
    )
    .bind(query.professional_id)
    .bind(query.date)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    // 4. Generate candidate slots every 30 minutes
    let mut slots = Vec::new();
    let mut current_time = start_parsed;
    let slot_step = chrono::Duration::minutes(30);
    let service_duration = chrono::Duration::minutes(duration as i64);

    while current_time + service_duration <= end_parsed {
        let slot_end = current_time + service_duration;
        
        // Check if slot overlaps with any existing appointment
        let mut available = true;
        for app in &appointments {
            // Overlap check: start1 < end2 AND start2 < end1
            if current_time < app.end_time && app.start_time < slot_end {
                available = false;
                break;
            }
        }

        // Also check if slot is in the past if date is today
        if query.date == Utc::now().with_timezone(&chrono::FixedOffset::west_opt(3 * 3600).unwrap()).date_naive() {
            let now_local = Utc::now().with_timezone(&chrono::FixedOffset::west_opt(3 * 3600).unwrap()).time();
            if current_time <= now_local {
                available = false;
            }
        }

        slots.push(Slot {
            start: current_time.format("%H:%M").to_string(),
            end: slot_end.format("%H:%M").to_string(),
            available,
        });

        current_time = current_time + slot_step;
    }

    Ok(Json(slots))
}

// Create Appointment
pub async fn create_appointment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateAppointmentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Parse time
    let start_time = NaiveTime::parse_from_str(&body.start_time, "%H:%M")
        .or_else(|_| NaiveTime::parse_from_str(&body.start_time, "%H:%M:%S"))
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(json!({ "error": "Invalid start_time format" }))))?;

    // Get service duration to calculate end time
    let duration = sqlx::query_scalar::<_, i32>(
        "SELECT duration_minutes FROM services WHERE id = $1 AND store_id = $2 AND is_available = TRUE"
    )
    .bind(body.service_id)
    .bind(body.store_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?
    .ok_or((StatusCode::BAD_REQUEST, Json(json!({ "error": "Invalid service" }))))?;

    let end_time = start_time + chrono::Duration::minutes(duration as i64);

    // Double check availability
    let overlaps = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(\
           SELECT 1 FROM appointments \
           WHERE professional_id = $1 \
             AND appointment_date = $2 \
             AND status != 'cancelled' \
             AND start_time < $4 \
             AND $3 < end_time\
         )"
    )
    .bind(body.professional_id)
    .bind(body.appointment_date)
    .bind(start_time)
    .bind(end_time)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    if overlaps {
        return Err((StatusCode::CONFLICT, Json(json!({ "error": "Professional is not available at this time slot" }))));
    }

    let mut tx = pool.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    // Insert appointment
    let appointment = sqlx::query_as::<_, Appointment>(
        "INSERT INTO appointments (store_id, user_id, service_id, professional_id, appointment_date, start_time, end_time, status, client_name, client_phone, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10) \
         RETURNING id, store_id, user_id, service_id, professional_id, appointment_date, start_time, end_time, status, client_name, client_phone, notes, created_at, updated_at"
    )
    .bind(body.store_id)
    .bind(auth.0)
    .bind(body.service_id)
    .bind(body.professional_id)
    .bind(body.appointment_date)
    .bind(start_time)
    .bind(end_time)
    .bind(body.client_name)
    .bind(body.client_phone)
    .bind(body.notes)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    // Trigger chat notification if a chat exists or create one
    // Let's see if we can find a direct chat between the store owner and the user
    let store_owner_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT owner_id FROM stores WHERE id = $1"
    )
    .bind(body.store_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    // Try to find a direct chat between these two
    let chat_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT c.id FROM chats c \
         JOIN chat_participants p1 ON c.id = p1.chat_id AND p1.user_id = $1 \
         JOIN chat_participants p2 ON c.id = p2.chat_id AND p2.user_id = $2 \
         WHERE c.is_group = FALSE LIMIT 1"
    )
    .bind(auth.0)
    .bind(store_owner_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    if let Some(c_id) = chat_id {
        // Send a system-like message to notify
        let service_name = sqlx::query_scalar::<_, String>(
            "SELECT name FROM services WHERE id = $1"
        )
        .bind(body.service_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

        let msg_content = format!(
            "⏰ Novo agendamento pendente!\nServiço: {}\nData: {}\nHorário: {} - {}\nCliente: {}",
            service_name,
            body.appointment_date.format("%d/%m/%Y"),
            start_time.format("%H:%M"),
            end_time.format("%H:%M"),
            appointment.client_name
        );

        sqlx::query(
            "INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3)"
        )
        .bind(c_id)
        .bind(auth.0) // Sent by the user
        .bind(msg_content)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;
    }

    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(serde_json::to_value(&appointment).unwrap()))
}

// User List Appointments
pub async fn list_my_appointments(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let appointments = sqlx::query(
        "SELECT a.id, a.store_id, a.user_id, a.service_id, a.professional_id, \
                a.appointment_date, a.start_time, a.end_time, a.status, \
                a.client_name, a.client_phone, a.notes, a.created_at, a.updated_at, \
                s.name as store_name, s.avatar as store_avatar, \
                ser.name as service_name, ser.price::double precision as service_price, \
                p.name as professional_name \
         FROM appointments a \
         JOIN stores s ON a.store_id = s.id \
         JOIN services ser ON a.service_id = ser.id \
         JOIN professionals p ON a.professional_id = p.id \
         WHERE a.user_id = $1 \
         ORDER BY a.appointment_date DESC, a.start_time DESC"
    )
    .bind(auth.0)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let list: Vec<Value> = appointments.into_iter().map(|row| {
        use sqlx::Row;
        json!({
            "id": row.get::<Uuid, _>("id"),
            "store_id": row.get::<Uuid, _>("store_id"),
            "store_name": row.get::<String, _>("store_name"),
            "store_avatar": row.get::<Option<String>, _>("store_avatar"),
            "service_id": row.get::<Uuid, _>("service_id"),
            "service_name": row.get::<String, _>("service_name"),
            "service_price": row.get::<f64, _>("service_price"),
            "professional_id": row.get::<Uuid, _>("professional_id"),
            "professional_name": row.get::<String, _>("professional_name"),
            "appointment_date": row.get::<NaiveDate, _>("appointment_date"),
            "start_time": row.get::<NaiveTime, _>("start_time").format("%H:%M").to_string(),
            "end_time": row.get::<NaiveTime, _>("end_time").format("%H:%M").to_string(),
            "status": row.get::<String, _>("status"),
            "client_name": row.get::<String, _>("client_name"),
            "client_phone": row.get::<String, _>("client_phone"),
            "notes": row.get::<Option<String>, _>("notes"),
            "created_at": row.get::<DateTime<Utc>, _>("created_at"),
        })
    }).collect();

    Ok(Json(json!(list)))
}

// Cancel Appointment
pub async fn cancel_appointment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let appointment = sqlx::query_as::<_, Appointment>(
        "SELECT id, store_id, user_id, service_id, professional_id, appointment_date, start_time, end_time, status, client_name, client_phone, notes, created_at, updated_at \
         FROM appointments WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?
    .ok_or((StatusCode::NOT_FOUND, Json(json!({ "error": "Appointment not found" }))))?;

    // Check if the user is either the client or the store owner
    let is_client = appointment.user_id == auth.0;
    let is_store_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)"
    )
    .bind(appointment.store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    if !is_client && !is_store_owner {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Unauthorized" }))));
    }

    let mut tx = pool.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    sqlx::query("UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    // Send chat cancellation notification
    let store_owner_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT owner_id FROM stores WHERE id = $1"
    )
    .bind(appointment.store_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let chat_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT c.id FROM chats c \
         JOIN chat_participants p1 ON c.id = p1.chat_id AND p1.user_id = $1 \
         JOIN chat_participants p2 ON c.id = p2.chat_id AND p2.user_id = $2 \
         WHERE c.is_group = FALSE LIMIT 1"
    )
    .bind(appointment.user_id)
    .bind(store_owner_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    if let Some(c_id) = chat_id {
        let service_name = sqlx::query_scalar::<_, String>(
            "SELECT name FROM services WHERE id = $1"
        )
        .bind(appointment.service_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

        let canceller_name = if is_client { "Cliente" } else { "Estabelecimento" };
        let msg_content = format!(
            "❌ Agendamento Cancelado pelo {}!\nServiço: {}\nData: {}\nHorário: {}",
            canceller_name,
            service_name,
            appointment.appointment_date.format("%d/%m/%Y"),
            appointment.start_time.format("%H:%M")
        );

        sqlx::query(
            "INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3)"
        )
        .bind(c_id)
        .bind(auth.0)
        .bind(msg_content)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;
    }

    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(json!({ "success": true })))
}

// Vendor endpoints (ERP)
pub async fn list_vendor_appointments(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Query(query): Query<VendorAppointmentsQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Verify ownership
    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)"
    )
    .bind(query.store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    if !is_owner {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Unauthorized" }))));
    }

    let rows = if let Some(date) = query.date {
        sqlx::query(
            "SELECT a.id, a.store_id, a.user_id, a.service_id, a.professional_id, \
                    a.appointment_date, a.start_time, a.end_time, a.status, \
                    a.client_name, a.client_phone, a.notes, a.created_at, \
                    ser.name as service_name, ser.price::double precision as service_price, \
                    p.name as professional_name \
             FROM appointments a \
             JOIN services ser ON a.service_id = ser.id \
             JOIN professionals p ON a.professional_id = p.id \
             WHERE a.store_id = $1 AND a.appointment_date = $2 \
             ORDER BY a.start_time ASC"
        )
        .bind(query.store_id)
        .bind(date)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?
    } else {
        sqlx::query(
            "SELECT a.id, a.store_id, a.user_id, a.service_id, a.professional_id, \
                    a.appointment_date, a.start_time, a.end_time, a.status, \
                    a.client_name, a.client_phone, a.notes, a.created_at, \
                    ser.name as service_name, ser.price::double precision as service_price, \
                    p.name as professional_name \
             FROM appointments a \
             JOIN services ser ON a.service_id = ser.id \
             JOIN professionals p ON a.professional_id = p.id \
             WHERE a.store_id = $1 \
             ORDER BY a.appointment_date DESC, a.start_time DESC"
        )
        .bind(query.store_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?
    };

    let list: Vec<Value> = rows.into_iter().map(|row| {
        use sqlx::Row;
        json!({
            "id": row.get::<Uuid, _>("id"),
            "store_id": row.get::<Uuid, _>("store_id"),
            "user_id": row.get::<Uuid, _>("user_id"),
            "service_id": row.get::<Uuid, _>("service_id"),
            "service_name": row.get::<String, _>("service_name"),
            "service_price": row.get::<f64, _>("service_price"),
            "professional_id": row.get::<Uuid, _>("professional_id"),
            "professional_name": row.get::<String, _>("professional_name"),
            "appointment_date": row.get::<NaiveDate, _>("appointment_date"),
            "start_time": row.get::<NaiveTime, _>("start_time").format("%H:%M").to_string(),
            "end_time": row.get::<NaiveTime, _>("end_time").format("%H:%M").to_string(),
            "status": row.get::<String, _>("status"),
            "client_name": row.get::<String, _>("client_name"),
            "client_phone": row.get::<String, _>("client_phone"),
            "notes": row.get::<Option<String>, _>("notes"),
            "created_at": row.get::<DateTime<Utc>, _>("created_at"),
        })
    }).collect();

    Ok(Json(json!(list)))
}

pub async fn update_appointment_status(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateStatusRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let appointment = sqlx::query_as::<_, Appointment>(
        "SELECT id, store_id, user_id, service_id, professional_id, appointment_date, start_time, end_time, status, client_name, client_phone, notes, created_at, updated_at \
         FROM appointments WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?
    .ok_or((StatusCode::NOT_FOUND, Json(json!({ "error": "Appointment not found" }))))?;

    let is_store_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2)"
    )
    .bind(appointment.store_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    if !is_store_owner {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Unauthorized" }))));
    }

    let mut tx = pool.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    sqlx::query("UPDATE appointments SET status = $1, updated_at = NOW() WHERE id = $2")
        .bind(&body.status)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    // Send notification in chat
    let store_owner_id = auth.0;
    let chat_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT c.id FROM chats c \
         JOIN chat_participants p1 ON c.id = p1.chat_id AND p1.user_id = $1 \
         JOIN chat_participants p2 ON c.id = p2.chat_id AND p2.user_id = $2 \
         WHERE c.is_group = FALSE LIMIT 1"
    )
    .bind(appointment.user_id)
    .bind(store_owner_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    if let Some(c_id) = chat_id {
        let service_name = sqlx::query_scalar::<_, String>(
            "SELECT name FROM services WHERE id = $1"
        )
        .bind(appointment.service_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

        let status_text = match body.status.as_str() {
            "confirmed" => "Confirmado ✅",
            "completed" => "Concluído 🏁",
            "cancelled" => "Cancelado ❌",
            _ => &body.status,
        };

        let msg_content = format!(
            "⏰ Seu agendamento foi atualizado!\nServiço: {}\nData: {}\nHorário: {}\nStatus: {}",
            service_name,
            appointment.appointment_date.format("%d/%m/%Y"),
            appointment.start_time.format("%H:%M"),
            status_text
        );

        sqlx::query(
            "INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3)"
        )
        .bind(c_id)
        .bind(store_owner_id)
        .bind(msg_content)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;
    }

    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(json!({ "success": true, "status": body.status })))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/stores/:store_id/services", get(list_services))
        .route("/services", post(create_service))
        .route("/services/:id", put(update_service).delete(delete_service))
        .route("/stores/:store_id/professionals", get(list_professionals))
        .route("/professionals", post(create_professional))
        .route("/professionals/:id", put(update_professional).delete(delete_professional))
        .route("/stores/:store_id/available-slots", get(get_available_slots))
        .route("/appointments", get(list_my_appointments).post(create_appointment))
        .route("/appointments/:id/cancel", post(cancel_appointment))
        .route("/vendor/appointments", get(list_vendor_appointments))
        .route("/appointments/:id/status", patch(update_appointment_status))
}
