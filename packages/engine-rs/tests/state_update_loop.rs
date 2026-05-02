use engine_rs::domain::SessionOutcomeClassification;
use engine_rs::state_update::{
    apply_engine_owned_state_patch, build_completion_state_patch, LastSuccessfulLoadPatch,
    ProgressionAction, ProgressionTrend,
};
use serde_json::{json, Value};

fn base_planning_context() -> Value {
    json!({
        "athleteProfile": {
            "height": 178,
            "weight": 82.5,
            "trainingAge": 3,
            "goalBias": "strength",
            "availableDaysPerWeek": 3,
            "classArchetype": "hybrid"
        },
        "injuryState": {
            "activeLimitations": [],
            "blockedMovementPatterns": []
        },
        "performanceState": {
            "knownLifts": {
                "bench-press": {
                    "estimated1RM": 112.5,
                    "lastWeight": 100,
                    "lastReps": 5
                }
            }
        },
        "activeProgramState": {
            "programId": "program-upper-1",
            "currentDayIndex": 1,
            "currentMicrocycle": 2
        },
        "recentCompletions": [
            {
                "exerciseId": "bench-press",
                "completedAt": "2026-02-10T10:00:00.000Z",
                "quality": "complete_clean"
            }
        ],
        "uiState": {
            "theme": "sand",
            "coachDrawerOpen": true
        }
    })
}

fn existing_engine_owned_context() -> Value {
    json!({
        "athleteProfile": {
            "height": 178,
            "weight": 82.5,
            "trainingAge": 3,
            "goalBias": "strength",
            "availableDaysPerWeek": 3,
            "classArchetype": "hybrid"
        },
        "readinessState": {
            "systemicFatigue": "moderate",
            "muscleFatigue": {
                "chest": 20,
                "back": 12
            },
            "sleepDebtHours": 3
        },
        "injuryState": {
            "activeLimitations": [],
            "blockedMovementPatterns": []
        },
        "performanceState": {
            "knownLifts": {
                "bench-press": {
                    "estimated1RM": 112.5,
                    "lastWeight": 100,
                    "lastReps": 5
                }
            }
        },
        "progressionState": {
            "bench-press": {
                "currentAction": "maintain",
                "trend": "stalled",
                "lastSuccessfulLoad": {
                    "weight": 95,
                    "reps": 4
                },
                "consecutiveSuccessfulCompletions": 1,
                "consecutiveStallOrRegressionCount": 0,
                "swapRecommendationCount": 0,
                "lastSessionOutcomeClassification": "complete_clean",
                "lastCompletedAt": "2026-02-10T10:00:00.000Z"
            },
            "barbell-row": {
                "currentAction": "maintain",
                "trend": "improving",
                "lastSuccessfulLoad": {
                    "weight": 80,
                    "reps": 8
                },
                "consecutiveSuccessfulCompletions": 2,
                "consecutiveStallOrRegressionCount": 0,
                "swapRecommendationCount": 0,
                "lastSessionOutcomeClassification": "complete_clean",
                "lastCompletedAt": "2026-02-12T09:00:00.000Z"
            }
        },
        "gamificationState": {
            "xp": 140,
            "level": 3,
            "adherenceStreak": 6,
            "completedSessionCount": 12,
            "missedSessionCount": 0,
            "lastAdherenceOutcomeClassification": "complete_clean",
            "lastAwardedAt": "2026-02-10T10:00:00.000Z",
            "bonusPoints": 11
        },
        "activeProgramState": {
            "programId": "program-upper-1",
            "currentDayIndex": 1,
            "currentMicrocycle": 2
        },
        "recentCompletions": [
            {
                "exerciseId": "bench-press",
                "completedAt": "2026-02-10T10:00:00.000Z",
                "quality": "complete_clean"
            }
        ],
        "uiState": {
            "theme": "sand",
            "coachDrawerOpen": true
        }
    })
}

fn completion_patch() -> engine_rs::state_update::EngineOwnedStatePatch {
    build_completion_state_patch(
        "bench-press",
        ProgressionAction::Overload,
        ProgressionTrend::Improving,
        Some(LastSuccessfulLoadPatch {
            weight: json!(100),
            reps: json!(6),
        }),
        2,
        0,
        0,
        SessionOutcomeClassification::CompleteCompromised,
        "2026-02-13T11:10:00.000Z",
        Some(json!("mild")),
        165,
        4,
        7,
        13,
        0,
        SessionOutcomeClassification::CompleteCompromised,
        "2026-02-13T11:10:00.000Z",
    )
}

#[test]
fn applying_a_completion_patch_preserves_unrelated_planning_context_state() {
    let patch = completion_patch();
    let next_state = apply_engine_owned_state_patch(&base_planning_context(), &patch);

    assert_eq!(
        next_state["athleteProfile"],
        base_planning_context()["athleteProfile"]
    );
    assert_eq!(
        next_state["injuryState"],
        base_planning_context()["injuryState"]
    );
    assert_eq!(
        next_state["performanceState"],
        base_planning_context()["performanceState"]
    );
    assert_eq!(
        next_state["activeProgramState"],
        base_planning_context()["activeProgramState"]
    );
    assert_eq!(
        next_state["recentCompletions"],
        base_planning_context()["recentCompletions"]
    );
    assert_eq!(next_state["uiState"], base_planning_context()["uiState"]);

    assert_eq!(
        next_state["progressionState"]["bench-press"]["currentAction"],
        json!("overload")
    );
    assert_eq!(
        next_state["progressionState"]["bench-press"]["trend"],
        json!("improving")
    );
    assert_eq!(
        next_state["progressionState"]["bench-press"]["lastSuccessfulLoad"],
        json!({
            "weight": 100,
            "reps": 6
        })
    );
    assert_eq!(
        next_state["progressionState"]["bench-press"]["consecutiveSuccessfulCompletions"],
        json!(2)
    );
    assert_eq!(
        next_state["progressionState"]["bench-press"]["consecutiveStallOrRegressionCount"],
        json!(0)
    );
    assert_eq!(
        next_state["progressionState"]["bench-press"]["swapRecommendationCount"],
        json!(0)
    );
    assert_eq!(
        next_state["progressionState"]["bench-press"]["lastSessionOutcomeClassification"],
        json!("complete_compromised")
    );
    assert_eq!(
        next_state["progressionState"]["bench-press"]["lastCompletedAt"],
        json!("2026-02-13T11:10:00.000Z")
    );
    assert_eq!(
        next_state["readinessState"]["systemicFatigue"],
        json!("mild")
    );
    assert_eq!(next_state["gamificationState"]["xp"], json!(165));
    assert_eq!(next_state["gamificationState"]["level"], json!(4));
    assert_eq!(next_state["gamificationState"]["adherenceStreak"], json!(7));
    assert_eq!(
        next_state["gamificationState"]["completedSessionCount"],
        json!(13)
    );
    assert_eq!(
        next_state["gamificationState"]["missedSessionCount"],
        json!(0)
    );
    assert_eq!(
        next_state["gamificationState"]["lastAdherenceOutcomeClassification"],
        json!("complete_compromised")
    );
    assert_eq!(
        next_state["gamificationState"]["lastAwardedAt"],
        json!("2026-02-13T11:10:00.000Z")
    );
}

#[test]
fn applying_a_completion_patch_is_replay_stable_for_next_planning_contexts() {
    let patch = completion_patch();
    let first = apply_engine_owned_state_patch(&base_planning_context(), &patch);
    let second = apply_engine_owned_state_patch(&base_planning_context(), &patch);

    assert_eq!(first, second);
    assert_eq!(
        first["progressionState"]["bench-press"]["currentAction"],
        json!("overload")
    );
    assert_eq!(first["gamificationState"]["level"], json!(4));
}

#[test]
fn applying_a_completion_patch_merges_existing_buckets_without_rewriting_unrelated_fields() {
    let patch = completion_patch();
    let next_state = apply_engine_owned_state_patch(&existing_engine_owned_context(), &patch);

    assert_eq!(
        next_state["progressionState"]["barbell-row"],
        json!({
            "currentAction": "maintain",
            "trend": "improving",
            "lastSuccessfulLoad": {
                "weight": 80,
                "reps": 8
            },
            "consecutiveSuccessfulCompletions": 2,
            "consecutiveStallOrRegressionCount": 0,
            "swapRecommendationCount": 0,
            "lastSessionOutcomeClassification": "complete_clean",
            "lastCompletedAt": "2026-02-12T09:00:00.000Z"
        })
    );
    assert_eq!(
        next_state["readinessState"]["muscleFatigue"],
        json!({
            "chest": 20,
            "back": 12
        })
    );
    assert_eq!(next_state["readinessState"]["sleepDebtHours"], json!(3));
    assert_eq!(next_state["gamificationState"]["bonusPoints"], json!(11));
    assert_eq!(
        next_state["uiState"],
        existing_engine_owned_context()["uiState"]
    );
    assert_eq!(
        next_state["progressionState"]["bench-press"]["currentAction"],
        json!("overload")
    );
    assert_eq!(
        next_state["readinessState"]["systemicFatigue"],
        json!("mild")
    );
    assert_eq!(next_state["gamificationState"]["xp"], json!(165));
    assert_eq!(next_state["gamificationState"]["level"], json!(4));
    assert_eq!(next_state["gamificationState"]["adherenceStreak"], json!(7));
    assert_eq!(
        next_state["gamificationState"]["completedSessionCount"],
        json!(13)
    );
    assert_eq!(
        next_state["gamificationState"]["missedSessionCount"],
        json!(0)
    );
    assert_eq!(
        next_state["gamificationState"]["lastAdherenceOutcomeClassification"],
        json!("complete_compromised")
    );
    assert_eq!(
        next_state["gamificationState"]["lastAwardedAt"],
        json!("2026-02-13T11:10:00.000Z")
    );
}
