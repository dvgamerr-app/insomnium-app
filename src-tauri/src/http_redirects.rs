use reqwest::redirect::Policy;

pub(crate) fn limit(value: Option<i32>) -> Result<Option<usize>, String> {
    match value.unwrap_or(10) {
        -1 => Ok(None),
        value if value >= 0 => Ok(Some(value as usize)),
        _ => Err("Maximum redirects must be -1 or nonnegative.".into()),
    }
}

pub(crate) fn policy(limit: Option<usize>) -> Policy {
    match limit {
        Some(value) => Policy::limited(value),
        None => Policy::custom(|attempt| attempt.follow()),
    }
}
