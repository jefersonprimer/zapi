use axum::{
    extract::{State, Path},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use crate::auth::AuthUser;

#[derive(Debug, FromRow, Serialize)]
pub struct ContactResponse {
    pub contact_id: Uuid,
    pub username: String,
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct AddContactRequest {
    pub contact_id: Uuid,
}

pub async fn list_contacts(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let contacts = sqlx::query_as::<_, ContactResponse>(
        r#"
        SELECT c.contact_id, u.username, u.email
        FROM contacts c
        JOIN users u ON c.contact_id = u.id
        WHERE c.user_id = $1
        ORDER BY u.username ASC
        "#
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    Ok(Json(contacts))
}

pub async fn add_contact(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Json(payload): Json<AddContactRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let contact_id = payload.contact_id;
    if user_id == contact_id {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "You cannot add yourself as a contact" })),
        ));
    }

    // Check if user exists
    let user_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)"
    )
    .bind(contact_id)
    .fetch_one(&pool)
    .await
    .unwrap_or(false);

    if !user_exists {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Contact user not found" })),
        ));
    }

    sqlx::query(
        "INSERT INTO contacts (user_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
    )
    .bind(user_id)
    .bind(contact_id)
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    Ok((StatusCode::CREATED, Json(json!({ "status": "success" }))))
}

pub async fn remove_contact(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(contact_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let result = sqlx::query(
        "DELETE FROM contacts WHERE user_id = $1 AND contact_id = $2"
    )
    .bind(user_id)
    .bind(contact_id)
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Contact not found" })),
        ));
    }

    Ok(Json(json!({ "status": "success" })))
}
