use axum::routing::get;
use axum::Router;

use crate::AppState;

use super::handlers;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::list_notes).post(handlers::create_note))
        .route(
            "/:id",
            get(handlers::get_note)
                .patch(handlers::update_note)
                .delete(handlers::delete_note),
        )
}
