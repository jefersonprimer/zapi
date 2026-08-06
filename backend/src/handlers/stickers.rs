use axum::{
    extract::{Multipart, State},
    http::{StatusCode, header},
    response::IntoResponse,
    Json,
};
use serde_json::{json, Value};
use sqlx::PgPool;

use crate::auth::AuthUser;

/// URL of the background-removal microservice.
/// Falls back to the Docker service name, then localhost.
fn bg_remover_url() -> String {
    std::env::var("BG_REMOVER_URL")
        .unwrap_or_else(|_| "http://bg-remover:5050".to_string())
}

/// POST /stickers/remove-bg
///
/// Accepts a multipart form with an `image` field.
/// Forwards it to the rembg microservice which:
///   1. Removes the background using U²-Net AI
///   2. Resizes to 512×512 with transparent padding
///   3. Returns a WebP with alpha channel
///
/// The resulting WebP bytes are returned directly to the client.
pub async fn remove_background(
    State(_pool): State<PgPool>,
    _auth: AuthUser,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    // Extract the image field from the incoming multipart request
    let mut image_data: Option<(Vec<u8>, String)> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        tracing::error!("Failed to read multipart field: {}", e);
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invalid multipart data" })),
        )
    })? {
        let name = field.name().unwrap_or("").to_string();
        if name == "image" {
            let file_name = field.file_name().unwrap_or("image.png").to_string();
            let data = field.bytes().await.map_err(|e| {
                tracing::error!("Failed to read image bytes: {}", e);
                (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "failed to read image data" })),
                )
            })?;

            // Max 20MB for sticker source images
            if data.len() > 20 * 1024 * 1024 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "image too large, max 20MB" })),
                ));
            }

            image_data = Some((data.to_vec(), file_name));
        }
    }

    let (data, filename) = image_data.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "no 'image' field provided" })),
        )
    })?;

    let remover_url = format!("{}/remove-bg", bg_remover_url());
    tracing::info!(
        "Forwarding {}KB image to bg-remover at {}",
        data.len() / 1024,
        remover_url
    );

    // Build multipart form for the microservice
    let part = reqwest::multipart::Part::bytes(data)
        .file_name(filename)
        .mime_str("application/octet-stream")
        .unwrap();

    let form = reqwest::multipart::Form::new().part("image", part);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| {
            tracing::error!("Failed to create HTTP client: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "internal error" })),
            )
        })?;

    let response = client
        .post(&remover_url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("bg-remover request failed: {}", e);
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({ "error": "background removal service unavailable" })),
            )
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::error!("bg-remover returned {}: {}", status, body);
        return Err((
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": format!("bg-remover error: {}", body) })),
        ));
    }

    let webp_bytes = response.bytes().await.map_err(|e| {
        tracing::error!("Failed to read bg-remover response: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to read processed image" })),
        )
    })?;

    tracing::info!(
        "Background removal complete, returning {}KB WebP sticker",
        webp_bytes.len() / 1024
    );

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "image/webp"),
            (
                header::CONTENT_DISPOSITION,
                "inline; filename=\"sticker.webp\"",
            ),
            (header::CACHE_CONTROL, "public, max-age=86400"),
        ],
        webp_bytes,
    ))
}

/// POST /stickers/remove-bg-url
///
/// Accepts JSON with a `url` field pointing to a remote image.
/// Downloads it, then forwards to the bg-remover service.
#[derive(Debug, serde::Deserialize)]
pub struct RemoveBgUrlRequest {
    pub url: String,
}

pub async fn remove_background_url(
    State(_pool): State<PgPool>,
    _auth: AuthUser,
    Json(body): Json<RemoveBgUrlRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| {
            tracing::error!("HTTP client error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "internal error" })),
            )
        })?;

    // Download the source image
    tracing::info!("Downloading source image from: {}", body.url);
    let img_response = client.get(&body.url).send().await.map_err(|e| {
        tracing::error!("Failed to download source image: {}", e);
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "failed to download source image" })),
        )
    })?;

    if !img_response.status().is_success() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "source image URL returned error" })),
        ));
    }

    let img_bytes = img_response.bytes().await.map_err(|e| {
        tracing::error!("Failed to read source image: {}", e);
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "failed to read source image" })),
        )
    })?;

    if img_bytes.len() > 20 * 1024 * 1024 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "image too large, max 20MB" })),
        ));
    }

    // Forward to bg-remover microservice
    let remover_url = format!("{}/remove-bg", bg_remover_url());
    let part = reqwest::multipart::Part::bytes(img_bytes.to_vec())
        .file_name("image.png")
        .mime_str("application/octet-stream")
        .unwrap();

    let form = reqwest::multipart::Form::new().part("image", part);

    let response = client
        .post(&remover_url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("bg-remover request failed: {}", e);
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({ "error": "background removal service unavailable" })),
            )
        })?;

    if !response.status().is_success() {
        let body_text = response.text().await.unwrap_or_default();
        return Err((
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": format!("bg-remover error: {}", body_text) })),
        ));
    }

    let webp_bytes = response.bytes().await.map_err(|e| {
        tracing::error!("Failed to read bg-remover response: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to read processed image" })),
        )
    })?;

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "image/webp"),
            (
                header::CONTENT_DISPOSITION,
                "inline; filename=\"sticker.webp\"",
            ),
            (header::CACHE_CONTROL, "public, max-age=86400"),
        ],
        webp_bytes,
    ))
}
