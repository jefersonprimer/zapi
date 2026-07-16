use axum::{extract::{Path, State}, http::StatusCode, Json};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::models::pix::{CreatePixKeyRequest, PixKey, UpdatePixKeyRequest};

pub async fn get_my_pix_key(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pix = sqlx::query_as::<_, PixKey>(
        "SELECT id, user_id, pix_type, pix_value, full_name, visibility, created_at, updated_at FROM pix_keys WHERE user_id = $1",
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

    match pix {
        Some(pix) => Ok(Json(json!({ "pix_key": pix }))),
        None => Ok(Json(json!({ "pix_key": null }))),
    }
}

pub async fn upsert_pix_key(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreatePixKeyRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let valid_types = ["celular", "cpf", "email", "aleatoria"];
    if !valid_types.contains(&body.pix_type.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid pix_type. Must be: celular, cpf, email, or aleatoria" })),
        ));
    }

    if body.pix_value.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "pix_value cannot be empty" })),
        ));
    }

    if body.full_name.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "full_name cannot be empty" })),
        ));
    }

    let visibility = body.visibility.unwrap_or_else(|| "contatos".to_string());
    let valid_visibilities = ["todos", "contatos", "ninguem"];
    if !valid_visibilities.contains(&visibility.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid visibility. Must be: todos, contatos, or ninguem" })),
        ));
    }

    let pix = sqlx::query_as::<_, PixKey>(
        "INSERT INTO pix_keys (user_id, pix_type, pix_value, full_name, visibility) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET pix_type = $2, pix_value = $3, full_name = $4, visibility = $5, updated_at = NOW()
         RETURNING id, user_id, pix_type, pix_value, full_name, visibility, created_at, updated_at",
    )
    .bind(auth.0)
    .bind(&body.pix_type)
    .bind(&body.pix_value)
    .bind(&body.full_name)
    .bind(&visibility)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({
        "status": "success",
        "pix_key": pix,
    })))
}

pub async fn update_pix_key(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<UpdatePixKeyRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let existing = sqlx::query_as::<_, PixKey>(
        "SELECT id, user_id, pix_type, pix_value, full_name, visibility, created_at, updated_at FROM pix_keys WHERE user_id = $1",
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

    let existing = match existing {
        Some(row) => row,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "No pix key found. Create one first." })),
            ));
        }
    };

    let pix_type = body.pix_type.unwrap_or(existing.pix_type);
    let pix_value = body.pix_value.unwrap_or(existing.pix_value);
    let full_name = body.full_name.unwrap_or(existing.full_name);
    let visibility = body.visibility.unwrap_or(existing.visibility);

    let valid_types = ["celular", "cpf", "email", "aleatoria"];
    if !valid_types.contains(&pix_type.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid pix_type" })),
        ));
    }

    let valid_visibilities = ["todos", "contatos", "ninguem"];
    if !valid_visibilities.contains(&visibility.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid visibility" })),
        ));
    }

    let pix = sqlx::query_as::<_, PixKey>(
        "UPDATE pix_keys SET pix_type = $1, pix_value = $2, full_name = $3, visibility = $4, updated_at = NOW() WHERE user_id = $5
         RETURNING id, user_id, pix_type, pix_value, full_name, visibility, created_at, updated_at",
    )
    .bind(&pix_type)
    .bind(&pix_value)
    .bind(&full_name)
    .bind(&visibility)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({
        "status": "success",
        "pix_key": pix,
    })))
}

pub async fn delete_pix_key(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let result = sqlx::query("DELETE FROM pix_keys WHERE user_id = $1")
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
            Json(json!({ "error": "No pix key found to delete" })),
        ));
    }

    Ok(Json(json!({ "status": "success", "message": "Pix key deleted" })))
}

pub async fn get_user_pix_key(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pix = sqlx::query_as::<_, PixKey>(
        "SELECT id, user_id, pix_type, pix_value, full_name, visibility, created_at, updated_at FROM pix_keys WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let pix = match pix {
        Some(p) => p,
        None => {
            return Ok(Json(json!({ "pix_key": null })));
        }
    };

    let visibility = pix.visibility.as_str();

    if visibility == "ninguem" && user_id != auth.0 {
        return Ok(Json(json!({ "pix_key": null })));
    }

    if visibility == "contatos" && user_id != auth.0 {
        let is_contact = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM contacts WHERE user_id = $1 AND contact_id = $2 AND is_blocked = false)",
        )
        .bind(auth.0)
        .bind(user_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;

        let is_mutual = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM contacts WHERE user_id = $1 AND contact_id = $2 AND is_blocked = false)",
        )
        .bind(user_id)
        .bind(auth.0)
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("database error: {}", e) })),
            )
        })?;

        if !is_contact || !is_mutual {
            return Ok(Json(json!({ "pix_key": null })));
        }
    }

    Ok(Json(json!({ "pix_key": pix })))
}
