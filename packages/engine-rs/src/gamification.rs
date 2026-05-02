use serde::{Deserialize, Serialize};

/// Completion quality classes used by the MVP gamification reward model.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CompletionQuality {
    CompleteClean,
    CompleteCompromised,
    Partial,
    Missed,
}

/// Progression action classes used by the MVP gamification reward model.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProgressionAction {
    Overload,
    Maintain,
    Regress,
    Swap,
}

/// Deterministic XP breakdown for a completed session.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct XpAwardBreakdown {
    pub quality_xp: i64,
    pub streak_bonus_xp: i64,
    pub progression_bonus_xp: i64,
    pub xp_delta: i64,
    pub total_xp: i64,
    pub level_before: u32,
    pub level_after: u32,
    pub level_up: bool,
}

const COMPLETE_CLEAN_XP: i64 = 15;
const COMPLETE_COMPROMISED_XP: i64 = 10;
const PARTIAL_XP: i64 = 5;
const MISSED_XP: i64 = 0;
const STREAK_BONUS_CAP: i64 = 5;
const OVERLOAD_BONUS_XP: i64 = 5;

/// Returns the base XP value for a completion quality.
pub fn completion_quality_xp(quality: CompletionQuality) -> i64 {
    match quality {
        CompletionQuality::CompleteClean => COMPLETE_CLEAN_XP,
        CompletionQuality::CompleteCompromised => COMPLETE_COMPROMISED_XP,
        CompletionQuality::Partial => PARTIAL_XP,
        CompletionQuality::Missed => MISSED_XP,
    }
}

/// Returns the deterministic streak bonus. The reward is capped so it stays bounded.
pub fn streak_bonus_xp(adherence_streak: u32) -> i64 {
    i64::from(adherence_streak.min(STREAK_BONUS_CAP as u32))
}

/// Returns the deterministic progression bonus.
///
/// MVP rule: overload earns the bonus, other actions do not.
pub fn progression_bonus_xp(action: ProgressionAction) -> i64 {
    match action {
        ProgressionAction::Overload => OVERLOAD_BONUS_XP,
        ProgressionAction::Maintain | ProgressionAction::Regress | ProgressionAction::Swap => 0,
    }
}

/// Deterministic level threshold function.
///
/// Thresholds are cumulative and intentionally coarse so a session can award XP
/// without always leveling up. This keeps the MVP stable while leaving room for
/// future tuning.
pub fn level_from_xp(total_xp: i64) -> u32 {
    let xp = total_xp.max(0);

    match xp {
        0..=49 => 1,
        50..=99 => 2,
        100..=199 => 3,
        200..=349 => 4,
        350..=549 => 5,
        550..=799 => 6,
        _ => 7 + ((xp - 800) / 300) as u32,
    }
}

/// Returns the minimum XP required to enter the provided level.
pub fn xp_threshold_for_level(level: u32) -> Option<i64> {
    match level {
        0 => None,
        1 => Some(0),
        2 => Some(50),
        3 => Some(100),
        4 => Some(200),
        5 => Some(350),
        6 => Some(550),
        _ => Some(800 + i64::from(level - 7) * 300),
    }
}

/// Returns the next threshold after the provided XP total.
pub fn next_level_threshold(total_xp: i64) -> Option<i64> {
    let current_level = level_from_xp(total_xp);
    xp_threshold_for_level(current_level + 1)
}

/// Returns the next deterministic completed-session milestone threshold.
pub fn next_completed_session_milestone(completed_session_count: u32) -> u32 {
    match completed_session_count {
        0 => 1,
        1..=4 => 5,
        5..=9 => 10,
        10..=24 => 25,
        25..=49 => 50,
        _ => 100,
    }
}

/// Returns the post-award level-up indicator.
pub fn level_up_indicator(current_xp: i64, xp_delta: i64) -> bool {
    let total_xp = current_xp.saturating_add(xp_delta).max(0);
    level_from_xp(current_xp) != level_from_xp(total_xp)
}

/// Computes the deterministic XP award breakdown for a completion.
pub fn award_completion_xp(
    current_xp: i64,
    adherence_streak: u32,
    quality: CompletionQuality,
    progression_action: ProgressionAction,
) -> XpAwardBreakdown {
    let quality_xp = completion_quality_xp(quality);
    let streak_bonus_xp = streak_bonus_xp(adherence_streak);
    let progression_bonus_xp = progression_bonus_xp(progression_action);
    let xp_delta = quality_xp + streak_bonus_xp + progression_bonus_xp;
    let total_xp = current_xp.saturating_add(xp_delta).max(0);
    let level_before = level_from_xp(current_xp);
    let level_after = level_from_xp(total_xp);

    XpAwardBreakdown {
        quality_xp,
        streak_bonus_xp,
        progression_bonus_xp,
        xp_delta,
        total_xp,
        level_before,
        level_after,
        level_up: level_before != level_after,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn completion_quality_and_bonus_tables_match_spec() {
        assert_eq!(completion_quality_xp(CompletionQuality::CompleteClean), 15);
        assert_eq!(
            completion_quality_xp(CompletionQuality::CompleteCompromised),
            10
        );
        assert_eq!(completion_quality_xp(CompletionQuality::Partial), 5);
        assert_eq!(completion_quality_xp(CompletionQuality::Missed), 0);

        assert_eq!(streak_bonus_xp(0), 0);
        assert_eq!(streak_bonus_xp(4), 4);
        assert_eq!(streak_bonus_xp(5), 5);
        assert_eq!(streak_bonus_xp(8), 5);

        assert_eq!(progression_bonus_xp(ProgressionAction::Overload), 5);
        assert_eq!(progression_bonus_xp(ProgressionAction::Maintain), 0);
        assert_eq!(progression_bonus_xp(ProgressionAction::Regress), 0);
        assert_eq!(progression_bonus_xp(ProgressionAction::Swap), 0);
    }

    #[test]
    fn level_thresholds_extend_past_level_seven() {
        assert_eq!(level_from_xp(0), 1);
        assert_eq!(level_from_xp(49), 1);
        assert_eq!(level_from_xp(50), 2);
        assert_eq!(level_from_xp(799), 6);
        assert_eq!(level_from_xp(800), 7);
        assert_eq!(level_from_xp(1099), 7);
        assert_eq!(level_from_xp(1100), 8);
        assert_eq!(level_from_xp(1399), 8);
        assert_eq!(level_from_xp(1400), 9);

        assert_eq!(xp_threshold_for_level(1), Some(0));
        assert_eq!(xp_threshold_for_level(6), Some(550));
        assert_eq!(xp_threshold_for_level(7), Some(800));
        assert_eq!(xp_threshold_for_level(8), Some(1100));
        assert_eq!(xp_threshold_for_level(9), Some(1400));
        assert_eq!(xp_threshold_for_level(0), None);

        assert_eq!(next_level_threshold(799), Some(800));
        assert_eq!(next_level_threshold(800), Some(1100));
        assert_eq!(next_level_threshold(1100), Some(1400));
    }

    #[test]
    fn completed_session_milestones_are_deterministic_and_stepwise() {
        assert_eq!(next_completed_session_milestone(0), 1);
        assert_eq!(next_completed_session_milestone(1), 5);
        assert_eq!(next_completed_session_milestone(4), 5);
        assert_eq!(next_completed_session_milestone(5), 10);
        assert_eq!(next_completed_session_milestone(10), 25);
        assert_eq!(next_completed_session_milestone(25), 50);
        assert_eq!(next_completed_session_milestone(50), 100);
    }

    #[test]
    fn level_up_indicator_only_fires_when_threshold_is_crossed() {
        assert!(!level_up_indicator(20, 10));
        assert!(!level_up_indicator(49, 0));
        assert!(level_up_indicator(49, 1));
        assert!(level_up_indicator(799, 1));
        assert!(!level_up_indicator(800, 0));
        assert!(!level_up_indicator(900, 50));
    }

    #[test]
    fn award_completion_xp_reports_breakdown_and_saturates_negative_totals() {
        let award = award_completion_xp(
            -20,
            8,
            CompletionQuality::CompleteCompromised,
            ProgressionAction::Overload,
        );

        assert_eq!(
            award,
            XpAwardBreakdown {
                quality_xp: 10,
                streak_bonus_xp: 5,
                progression_bonus_xp: 5,
                xp_delta: 20,
                total_xp: 0,
                level_before: 1,
                level_after: 1,
                level_up: false,
            }
        );

        let level_up_award = award_completion_xp(
            49,
            0,
            CompletionQuality::CompleteClean,
            ProgressionAction::Maintain,
        );

        assert_eq!(level_up_award.quality_xp, 15);
        assert_eq!(level_up_award.streak_bonus_xp, 0);
        assert_eq!(level_up_award.progression_bonus_xp, 0);
        assert_eq!(level_up_award.xp_delta, 15);
        assert_eq!(level_up_award.total_xp, 64);
        assert_eq!(level_up_award.level_before, 1);
        assert_eq!(level_up_award.level_after, 2);
        assert!(level_up_award.level_up);
    }
}
