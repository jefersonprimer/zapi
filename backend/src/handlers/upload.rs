use axum::{
    extract::{Multipart, State},
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
    tokio::fs::create_dir_all(upload_dir)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to create upload directory" })),
            )
        })?;

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

        let allowed = [
            "jpg", "jpeg", "png", "gif", "webp",
            "pdf", "txt", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            "mp4", "mov", "webm", "mkv", "avi",
            "mp3", "m4a", "wav", "caf", "aac", "ogg", "3gp"
        ];
        if !allowed.contains(&ext.as_str()) {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "invalid file type. allowed: images, pdf, docx, audio, video" })),
            ));
        }

        let data = field.bytes().await.map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to read file data" })),
            )
        })?;

        if data.len() > 10 * 1024 * 1024 {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "file too large. max 10MB" })),
            ));
        }

        let filename = format!("{}_{}.{}", auth.0, Uuid::new_v4(), ext);
        let filepath = upload_dir.join(&filename);

        tokio::fs::write(&filepath, &data).await.map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to save file" })),
            )
        })?;

        return Ok(Json(json!({ "url": format!("/uploads/{}", filename) })));
    }

    Err((
        StatusCode::BAD_REQUEST,
        Json(json!({ "error": "no file provided" })),
    ))
}
