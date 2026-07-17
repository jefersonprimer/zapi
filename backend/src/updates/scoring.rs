pub fn calculate_score(
    post_age_hours: f64,
    likes_count: i32,
    comments_count: i32,
    shares_count: i32,
    is_from_contact: bool,
    is_from_followed_channel: bool,
    is_from_followed_business: bool,
    is_pinned: bool,
) -> f64 {
    let mut score = 0.0;

    score += likes_count as f64 * 1.0;
    score += comments_count as f64 * 2.0;
    score += shares_count as f64 * 3.0;

    if is_from_contact {
        score += 50.0;
    }
    if is_from_followed_channel {
        score += 30.0;
    }
    if is_from_followed_business {
        score += 20.0;
    }

    let decay = (-post_age_hours / 24.0).exp();
    score *= decay;

    if is_pinned {
        score += 10000.0;
    }

    score
}
