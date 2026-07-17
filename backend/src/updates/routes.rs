use axum::routing::{delete, get, post};
use axum::Router;

use crate::AppState;

use super::handlers;

pub fn router() -> Router<AppState> {
    Router::new()
        // Publishers (specific paths before :id)
        .route("/publishers", post(handlers::create_publisher))
        .route("/publishers/me", get(handlers::get_my_publisher))
        .route("/publishers/by-user/:user_id", get(handlers::get_publisher_by_user))
        .route("/publishers/:id/posts", get(handlers::list_publisher_posts))
        .route("/publishers/:id", get(handlers::get_publisher))
        // Stories
        .route("/stories", get(handlers::list_stories).post(handlers::create_story))
        .route("/stories/:id", delete(handlers::expire_story))
        .route("/stories/:id/view", post(handlers::mark_story_viewed))
        .route("/stories/publisher/:publisher_id", get(handlers::get_publisher_stories))
        // Posts (Feed)
        .route("/posts", get(handlers::list_feed).post(handlers::create_post))
        .route("/posts/:id", get(handlers::get_post).delete(handlers::delete_post))
        .route("/posts/:id/like", post(handlers::toggle_like))
        .route("/posts/:id/comment", get(handlers::list_comments).post(handlers::add_comment))
        .route("/posts/:id/comment/:comment_id", delete(handlers::delete_comment))
        .route("/posts/:id/comment/:comment_id/like", post(handlers::toggle_comment_like))
        .route("/posts/:id/share", post(handlers::share_post))
        .route("/posts/:id/vote", post(handlers::vote_poll))
        .route("/posts/:id/save", post(handlers::toggle_save))
        .route("/posts/:id/hide", post(handlers::hide_post))
        // Saved Posts
        .route("/saved", get(handlers::list_saved_posts))
        // Follow (specific paths before :publisher_id)
        .route("/follow/user/:user_id", post(handlers::toggle_follow_by_user))
        .route("/follow/:publisher_id", post(handlers::toggle_follow))
        .route("/following", get(handlers::list_following))
        .route("/followers", get(handlers::list_followers))
        // Moderation
        .route("/blocks/:publisher_id", post(handlers::toggle_block))
        .route("/mutes/:publisher_id", post(handlers::toggle_mute))
        .route("/reports", post(handlers::create_report))
}
