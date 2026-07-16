use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;

use super::models::{CreateNoteRequest, Note, UpdateNoteRequest};

pub async fn list_notes(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let notes = sqlx::query_as::<_, Note>(
        r#"
        SELECT id, user_id, title, content, is_favorite, created_at, updated_at
        FROM notes
        WHERE user_id = $1
        ORDER BY is_favorite DESC, updated_at DESC
        "#,
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

    Ok(Json(notes))
}

pub async fn create_note(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateNoteRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let note = sqlx::query_as::<_, Note>(
        r#"
        INSERT INTO notes (user_id, title, content)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, title, content, is_favorite, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(&payload.title)
    .bind(&payload.content)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    Ok((StatusCode::CREATED, Json(note)))
}

pub async fn get_note(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(note_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let note = sqlx::query_as::<_, Note>(
        r#"
        SELECT id, user_id, title, content, is_favorite, created_at, updated_at
        FROM notes
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(note_id)
    .bind(user_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    match note {
        Some(n) => Ok(Json(n)),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Note not found" })),
        )),
    }
}

pub async fn update_note(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(note_id): Path<Uuid>,
    Json(payload): Json<UpdateNoteRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let existing = sqlx::query_as::<_, Note>(
        r#"
        SELECT id, user_id, title, content, is_favorite, created_at, updated_at
        FROM notes
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(note_id)
    .bind(user_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    let existing = match existing {
        Some(n) => n,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Note not found" })),
            ))
        }
    };

    let title = payload.title.unwrap_or(existing.title);
    let content = payload.content.unwrap_or(existing.content);
    let is_favorite = payload.is_favorite.unwrap_or(existing.is_favorite);

    let note = sqlx::query_as::<_, Note>(
        r#"
        UPDATE notes
        SET title = $1, content = $2, is_favorite = $3, updated_at = now()
        WHERE id = $4 AND user_id = $5
        RETURNING id, user_id, title, content, is_favorite, created_at, updated_at
        "#,
    )
    .bind(&title)
    .bind(&content)
    .bind(is_favorite)
    .bind(note_id)
    .bind(user_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    Ok(Json(note))
}

pub async fn delete_note(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(note_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let result = sqlx::query(
        "DELETE FROM notes WHERE id = $1 AND user_id = $2",
    )
    .bind(note_id)
    .bind(user_id)
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
            Json(json!({ "error": "Note not found" })),
        ));
    }

    Ok(Json(json!({ "status": "success" })))
}
