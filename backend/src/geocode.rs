use serde::Deserialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

static LAST_REQUEST_MS: AtomicU64 = AtomicU64::new(0);

#[derive(Deserialize)]
struct NominatimResult {
    lat: String,
    lon: String,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Geocode a Brazilian address via Nominatim (OSM). Rate-limited to ~1 req/s.
/// Returns (latitude, longitude) or None on failure.
pub async fn geocode_address(
    street: &str,
    number: &str,
    neighborhood: &str,
    city: &str,
    state: &str,
    cep: &str,
) -> Option<(f64, f64)> {
    let last = LAST_REQUEST_MS.load(Ordering::SeqCst);
    let now = now_ms();
    if last > 0 && now.saturating_sub(last) < 1000 {
        tokio::time::sleep(Duration::from_millis(1000 - (now - last))).await;
    }
    LAST_REQUEST_MS.store(now_ms(), Ordering::SeqCst);

    let street_part = format!("{} {}", street.trim(), number.trim())
        .trim()
        .to_string();
    let parts: Vec<&str> = [
        street_part.as_str(),
        neighborhood.trim(),
        city.trim(),
        state.trim(),
        cep.trim(),
        "Brasil",
    ]
    .into_iter()
    .filter(|p| !p.is_empty())
    .collect();

    if parts.len() < 3 {
        return None;
    }

    let query = parts.join(", ");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .ok()?;

    let resp = client
        .get("https://nominatim.openstreetmap.org/search")
        .query(&[
            ("q", query.as_str()),
            ("format", "json"),
            ("limit", "1"),
            ("countrycodes", "br"),
        ])
        .header("User-Agent", "ZapiDelivery/1.0 (delivery@zapi.app)")
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let results: Vec<NominatimResult> = resp.json().await.ok()?;
    let first = results.first()?;
    let lat = first.lat.parse().ok()?;
    let lon = first.lon.parse().ok()?;
    Some((lat, lon))
}

/// Haversine distance in kilometers.
pub fn haversine_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const R: f64 = 6371.0;
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let a = (d_lat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    R * c
}

/// Estimated delivery time: prep + ~2 min per km.
pub fn eta_minutes(prep_time_minutes: i32, distance_km: f64) -> i32 {
    prep_time_minutes + (distance_km * 2.0).ceil() as i32
}
