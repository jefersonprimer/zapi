use axum::{
    extract::{Multipart, State, Query},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use std::path::Path;
use uuid::Uuid;

use crate::auth::AuthUser;

pub async fn upload_image(
    State(_pool): State<PgPool>,
    auth: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let upload_dir = Path::new("uploads");

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "invalid multipart data" })),
            )
        })? {
        let file_name = field
            .file_name()
            .unwrap_or("file")
            .to_string();

        let ext = file_name
            .rsplit('.')
            .next()
            .unwrap_or("bin")
            .to_lowercase();

        let is_audio_name = file_name.to_lowercase().contains("audio");
        let (subfolder, max_size, label) = if is_audio_name {
            ("audio", 25 * 1024 * 1024, "Voice message (max 25MB)")
        } else {
            match ext.as_str() {
                "jpg" | "jpeg" | "png" | "gif" | "webp" => ("images", 20 * 1024 * 1024, "Photo (max 20MB)"),
                "mp4" | "mov" | "webm" | "mkv" | "avi" | "quicktime" | "qt" | "3gp" | "m4v" | "flv" | "wmv" | "mpg" | "mpeg" => ("videos", 250 * 1024 * 1024, "Video (max 250MB)"),
                "mp3" | "wav" | "caf" | "ogg" => ("audio", 50 * 1024 * 1024, "Audio (max 50MB)"),
                "aac" | "m4a" | "opus" => ("audio", 25 * 1024 * 1024, "Voice message (max 25MB)"),
                _ => ("documents", 500 * 1024 * 1024, "Document (max 500MB)"),
            }
        };

        let target_dir = upload_dir.join(subfolder);
        tokio::fs::create_dir_all(&target_dir)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "failed to create upload directory" })),
                )
            })?;

        let data = field.bytes().await.map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to read file data" })),
            )
        })?;

        if data.len() > max_size {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("file too large. {} limit exceeded.", label) })),
            ));
        }

        let file_stem = std::path::Path::new(&file_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("file");

        let sanitized_stem: String = file_stem
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '-' || c == '_' {
                    c
                } else if c.is_whitespace() {
                    '-'
                } else {
                    '_'
                }
            })
            .collect();

        let truncated_stem = if sanitized_stem.len() > 50 {
            &sanitized_stem[..50]
        } else {
            &sanitized_stem
        };

        let filename = if truncated_stem.is_empty() {
            format!("{}_{}.{}", auth.0, Uuid::new_v4(), ext)
        } else {
            format!("{}_{}_{}.{}", auth.0, Uuid::new_v4(), truncated_stem, ext)
        };
        let filepath = target_dir.join(&filename);

        tokio::fs::write(&filepath, &data).await.map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to save file" })),
            )
        })?;

        return Ok(Json(json!({ "url": format!("/uploads/{}/{}", subfolder, filename) })));
    }

    Err((
        StatusCode::BAD_REQUEST,
        Json(json!({ "error": "no file provided" })),
    ))
}

#[derive(Debug, serde::Deserialize)]
pub struct CheckHashQuery {
    pub hash: String,
}

pub async fn check_hash(
    State(pool): State<PgPool>,
    _auth: AuthUser,
    Query(query): Query<CheckHashQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let remote_url: Option<String> = sqlx::query_scalar(
        "SELECT remote_url FROM attachments WHERE sha256 = $1 LIMIT 1"
    )
    .bind(&query.hash)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if let Some(url) = remote_url {
        Ok(Json(json!({ "exists": true, "url": url })))
    } else {
        Ok(Json(json!({ "exists": false })))
    }
}
