use serde_json::{json, Value};

pub const TREND_IMPROVING: &str = "improving";
pub const TREND_STALLED: &str = "stalled";
pub const TREND_REGRESSING: &str = "regressing";

pub const ACTION_OVERLOAD: &str = "overload";
pub const ACTION_MAINTAIN: &str = "maintain";
pub const ACTION_REGRESS: &str = "regress";
pub const ACTION_SWAP: &str = "swap";

pub fn clamp_f64(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

pub fn round_f64(value: f64, places: u32) -> f64 {
    let factor = 10_f64.powi(places as i32);
    (value * factor).round() / factor
}

pub fn normalize_slug(value: &str) -> String {
    value
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|ch| match ch {
            'a'..='z' | '0'..='9' => ch,
            _ => '-',
        })
        .collect::<String>()
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

pub fn value_as_f64(value: &Value) -> Option<f64> {
    match value {
        Value::Number(number) => number.as_f64(),
        Value::String(text) => text.parse::<f64>().ok(),
        _ => None,
    }
}

pub fn value_as_i64(value: &Value) -> Option<i64> {
    match value {
        Value::Number(number) => number.as_i64(),
        Value::String(text) => text.parse::<i64>().ok(),
        _ => None,
    }
}

pub fn value_as_str(value: &Value) -> Option<&str> {
    value.as_str()
}

pub fn plan_progression_need(trend: &str, current_action: &str, freshness: f64) -> f64 {
    let trend_bonus = match trend {
        TREND_IMPROVING => 0.12,
        TREND_STALLED => 0.06,
        TREND_REGRESSING => 0.0,
        _ => 0.03,
    };
    let action_bonus = match current_action {
        ACTION_OVERLOAD => 0.06,
        ACTION_MAINTAIN => 0.06,
        ACTION_REGRESS => 0.0,
        ACTION_SWAP => 0.0,
        _ => 0.02,
    };
    round_f64(
        clamp_f64(
            0.72 + trend_bonus + action_bonus + freshness * 0.02,
            0.0,
            1.0,
        ),
        2,
    )
}

pub fn fatigue_compatibility(systemic_fatigue: &str, muscle_fatigue: f64) -> f64 {
    let systemic_penalty = match systemic_fatigue {
        "none" => 0.0,
        "low" => 0.04,
        "moderate" => 0.08,
        "severe" => 0.32,
        _ => 0.16,
    };
    let muscle_penalty = clamp_f64(muscle_fatigue / 500.0, 0.0, 0.28);
    round_f64(
        clamp_f64(1.0 - systemic_penalty - muscle_penalty, 0.0, 1.0),
        2,
    )
}

pub fn class_bias_score(policy_bias: f64) -> f64 {
    round_f64(clamp_f64(policy_bias, 0.0, 0.15), 2)
}

pub fn novelty_score(novelty_budget: f64, seeded_fraction: f64) -> f64 {
    let raw = novelty_budget.clamp(0.0, 1.0) * 0.02;
    let wobble = seeded_fraction * 0.0;
    round_f64(clamp_f64(raw + wobble, 0.0, 0.05), 2)
}

pub fn recommended_session_id(
    _seed: &str,
    program_id: &str,
    microcycle_index: i64,
    session_focus: &str,
) -> String {
    let focus = normalize_slug(session_focus);
    let program = normalize_slug(program_id);
    format!("{program}-{focus}-m{microcycle_index}")
}

pub fn session_rationale(movement_family: &str, action: &str, injury_sensitive: bool) -> String {
    if movement_family == "upper_push" && action == ACTION_OVERLOAD && injury_sensitive {
        return "Fresh enough to overload the main push pattern while preserving shoulder safety."
            .to_string();
    }

    if action == ACTION_REGRESS {
        return "Recovery headroom is tight, so the next step should back off load and preserve momentum.".to_string();
    }

    if action == ACTION_SWAP {
        return "The current movement is blocked, so the engine should preserve the intent with a safer substitute.".to_string();
    }

    format!("Session leans toward {action} for {movement_family}.")
}

pub fn progression_summary(exercise_id: &str, action: &str, trend: &str) -> Value {
    json!({
        "exerciseId": exercise_id,
        "action": action,
        "trend": trend,
    })
}
