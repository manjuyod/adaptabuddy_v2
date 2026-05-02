use crate::boundary::{TypedEngineInput, TypedEngineOutput, TypedEngineResult};
use crate::domain::{
    CanonicalClassArchetype, CycleSessionPlan, CycleSessionSlot, DecisionInputRef,
    DecisionLogEntry, DecisionStepType, InitializeCycleResult, MacrocyclePlan, ProgramBlendEntry,
    StatePatch,
};
use serde_json::{json, Number, Value};
use std::cmp::Ordering;
use std::collections::BTreeMap;

use super::{build_replay_receipt, derived_input_hash, derived_output_hash};

#[derive(Clone, Debug)]
struct SelectedProgram {
    program_id: String,
    weight: f64,
    days: Vec<SelectedProgramDay>,
}

#[derive(Clone, Debug)]
struct SelectedProgramDay {
    program_day_id: String,
    day_index: u32,
    name: String,
    slots: Vec<SelectedProgramSlot>,
}

#[derive(Clone, Debug)]
struct SelectedProgramSlot {
    slot_id: String,
    slot_index: u32,
    slot_type: String,
    movement_pattern: Option<String>,
    sets_min: u32,
    sets_max: u32,
    reps_min: u32,
    reps_max: u32,
    muscle_targets: BTreeMap<String, Number>,
    tags_required: Vec<String>,
}

fn request_value<'a>(input: &'a TypedEngineInput, key: &str) -> &'a Value {
    input.request.get(key).unwrap_or(&Value::Null)
}

fn request_string(input: &TypedEngineInput, path: &[&str]) -> String {
    let mut current = &input.request;
    for key in path {
        current = current.get(*key).unwrap_or(&Value::Null);
    }
    current.as_str().unwrap_or_default().to_string()
}

fn initialize_cycle_class_choice(input: &TypedEngineInput) -> CanonicalClassArchetype {
    input
        .initialize_cycle_class_choice
        .clone()
        .expect("initialize_cycle typed input missing canonical class invariant")
}

fn request_u32(input: &TypedEngineInput, path: &[&str], default: u32) -> u32 {
    let mut current = &input.request;
    for key in path {
        current = current.get(*key).unwrap_or(&Value::Null);
    }
    current
        .as_u64()
        .and_then(|value| u32::try_from(value).ok())
        .unwrap_or(default)
}

fn injury_slugs(input: &TypedEngineInput) -> Vec<String> {
    request_value(input, "profile")
        .get("injuryMuscleGroupSlugs")
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn selected_programs(input: &TypedEngineInput) -> Vec<SelectedProgram> {
    request_value(input, "selectedPrograms")
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|program| {
            let program_id = program.get("programId")?.as_str()?.to_string();
            let weight = program.get("weight")?.as_f64()?;
            let days = program
                .get("days")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(|day| {
                    let program_day_id = day.get("programDayId")?.as_str()?.to_string();
                    let day_index = u32::try_from(day.get("dayIndex")?.as_u64()?).ok()?;
                    let name = day.get("name")?.as_str()?.to_string();
                    let slots = day
                        .get("slots")
                        .and_then(Value::as_array)
                        .into_iter()
                        .flatten()
                        .filter_map(|slot| {
                            let slot_id = slot.get("slotId")?.as_str()?.to_string();
                            let slot_index =
                                u32::try_from(slot.get("slotIndex")?.as_u64()?).ok()?;
                            let slot_type = slot.get("slotType")?.as_str()?.to_string();
                            let sets_min = u32::try_from(slot.get("setsMin")?.as_u64()?).ok()?;
                            let sets_max = u32::try_from(slot.get("setsMax")?.as_u64()?).ok()?;
                            let reps_min = u32::try_from(slot.get("repsMin")?.as_u64()?).ok()?;
                            let reps_max = u32::try_from(slot.get("repsMax")?.as_u64()?).ok()?;
                            let movement_pattern = slot
                                .get("movementPattern")
                                .and_then(Value::as_str)
                                .map(ToString::to_string);
                            let muscle_targets = slot
                                .get("muscleTargets")
                                .and_then(Value::as_object)
                                .map(|targets| {
                                    targets
                                        .iter()
                                        .filter_map(|(key, value)| {
                                            value
                                                .as_f64()
                                                .and_then(Number::from_f64)
                                                .map(|value| (key.clone(), value))
                                        })
                                        .collect::<BTreeMap<_, _>>()
                                })
                                .unwrap_or_default();
                            let tags_required = slot
                                .get("tagsRequired")
                                .and_then(Value::as_array)
                                .map(|values| {
                                    values
                                        .iter()
                                        .filter_map(Value::as_str)
                                        .map(ToString::to_string)
                                        .collect::<Vec<_>>()
                                })
                                .unwrap_or_default();

                            Some(SelectedProgramSlot {
                                slot_id,
                                slot_index,
                                slot_type,
                                movement_pattern,
                                sets_min,
                                sets_max,
                                reps_min,
                                reps_max,
                                muscle_targets,
                                tags_required,
                            })
                        })
                        .collect::<Vec<_>>();

                    Some(SelectedProgramDay {
                        program_day_id,
                        day_index,
                        name,
                        slots,
                    })
                })
                .collect::<Vec<_>>();

            Some(SelectedProgram {
                program_id,
                weight,
                days,
            })
        })
        .collect()
}

fn fatigue_preference(input: &TypedEngineInput) -> String {
    request_string(input, &["profile", "fatiguePreference"])
}

fn accessory_cap(preference: &str) -> usize {
    match preference {
        "low" => 0,
        "high" => 2,
        _ => 1,
    }
}

fn sort_programs(programs: &mut [SelectedProgram]) {
    programs.sort_by(|left, right| {
        right
            .weight
            .partial_cmp(&left.weight)
            .unwrap_or(Ordering::Equal)
            .then_with(|| left.program_id.cmp(&right.program_id))
    });

    for program in programs {
        program.days.sort_by(|left, right| {
            left.day_index
                .cmp(&right.day_index)
                .then_with(|| left.program_day_id.cmp(&right.program_day_id))
        });

        for day in &mut program.days {
            day.slots.sort_by(|left, right| {
                left.slot_index
                    .cmp(&right.slot_index)
                    .then_with(|| left.slot_id.cmp(&right.slot_id))
            });
        }
    }
}

fn should_skip_secondary_slot(slot: &SelectedProgramSlot, injury_slugs: &[String]) -> bool {
    if slot.slot_type != "accessory" {
        return true;
    }

    slot.muscle_targets
        .keys()
        .any(|muscle| injury_slugs.iter().any(|injury| injury == muscle))
}

fn build_slot(program_id: &str, day_id: &str, slot: &SelectedProgramSlot) -> CycleSessionSlot {
    CycleSessionSlot {
        slot_id: slot.slot_id.clone(),
        slot_index: slot.slot_index,
        slot_type: slot.slot_type.clone(),
        movement_pattern: slot.movement_pattern.clone(),
        sets_min: slot.sets_min,
        sets_max: slot.sets_max,
        reps_min: slot.reps_min,
        reps_max: slot.reps_max,
        muscle_targets: slot.muscle_targets.clone(),
        tags_required: slot.tags_required.clone(),
        source_program_id: program_id.to_string(),
        source_program_day_id: day_id.to_string(),
    }
}

fn input_ref(path: &str) -> DecisionInputRef {
    DecisionInputRef {
        path: path.to_string(),
        stable_id: None,
    }
}

pub fn initialize_cycle(input: &TypedEngineInput) -> TypedEngineOutput {
    let mut programs = selected_programs(input);
    sort_programs(&mut programs);

    let class_choice = initialize_cycle_class_choice(input);
    let available_days = request_u32(input, &["profile", "availableDaysPerWeek"], 3);
    let macrocycle_weeks = request_u32(input, &["macrocycleWeeks"], 12);
    let injury_slugs = injury_slugs(input);
    let fatigue_preference = fatigue_preference(input);
    let accessory_cap = accessory_cap(&fatigue_preference);

    let primary = programs
        .first()
        .expect("initialize_cycle requires at least one selected program");
    let secondary = programs.iter().skip(1).collect::<Vec<_>>();

    let mut sessions = Vec::new();
    for week in 0..macrocycle_weeks {
        let mesocycle_index = week / 4;
        let microcycle_index = week % 4;
        for day_position in 0..available_days {
            let primary_day = &primary.days[(day_position as usize) % primary.days.len()];
            let mut slot_payload = primary_day
                .slots
                .iter()
                .map(|slot| build_slot(&primary.program_id, &primary_day.program_day_id, slot))
                .collect::<Vec<_>>();

            let mut accessory_count = 0usize;
            for program in &secondary {
                if accessory_count >= accessory_cap {
                    break;
                }

                let secondary_day = &program.days[(day_position as usize) % program.days.len()];
                for slot in &secondary_day.slots {
                    if accessory_count >= accessory_cap {
                        break;
                    }
                    if should_skip_secondary_slot(slot, &injury_slugs) {
                        continue;
                    }
                    if slot.slot_type == "accessory" {
                        accessory_count += 1;
                    }
                    slot_payload.push(build_slot(
                        &program.program_id,
                        &secondary_day.program_day_id,
                        slot,
                    ));
                }
            }

            let session_index = sessions.len() as u32;
            sessions.push(CycleSessionPlan {
                session_id: format!("{}-w{}-d{}", primary.program_id, week + 1, day_position + 1),
                program_id: primary.program_id.clone(),
                program_day_id: primary_day.program_day_id.clone(),
                program_day_name: primary_day.name.clone(),
                macro_week: week + 1,
                mesocycle_index,
                microcycle_index,
                session_index,
                planned_day_of_week: day_position,
                class_archetype: class_choice.clone(),
                slot_payload,
            });
        }
    }

    let result = InitializeCycleResult {
        resolved_class_archetype: class_choice.clone(),
        primary_program_id: primary.program_id.clone(),
        program_blend: programs
            .iter()
            .enumerate()
            .map(|(index, program)| ProgramBlendEntry {
                program_id: program.program_id.clone(),
                weight: Number::from_f64(program.weight).expect("weight should be finite"),
                role: if index == 0 {
                    "primary".to_string()
                } else {
                    "secondary".to_string()
                },
            })
            .collect(),
        macrocycle: MacrocyclePlan {
            total_weeks: macrocycle_weeks,
            mesocycle_count: macrocycle_weeks.div_ceil(4),
            current_mesocycle_index: 0,
            current_microcycle_index: 0,
            current_session_index: 0,
            sessions,
        },
        initial_gamification_state: input.state_snapshot.gamification_state.clone(),
    };

    let decision_log = vec![
        DecisionLogEntry {
            step_type: DecisionStepType::Initialize,
            rule_id: "initialize_profile".to_string(),
            inputs_used: vec![
                input_ref("request.profile.classChoice"),
                input_ref("request.profile.availableDaysPerWeek"),
                input_ref("request.profile.fatiguePreference"),
            ],
            candidate_id: None,
            computed_value: None,
            outcome: class_choice.as_str().to_string(),
            details: Some(json!({
                "injuryMuscleGroupSlugs": injury_slugs,
                "macrocycleWeeks": macrocycle_weeks,
            })),
        },
        DecisionLogEntry {
            step_type: DecisionStepType::Blend,
            rule_id: "program_blend".to_string(),
            inputs_used: vec![input_ref("request.selectedPrograms")],
            candidate_id: Some(primary.program_id.clone()),
            computed_value: None,
            outcome: "primary_selected".to_string(),
            details: Some(json!({
                "primaryProgramId": primary.program_id,
                "fatigueAccessoryCap": accessory_cap,
            })),
        },
        DecisionLogEntry {
            step_type: DecisionStepType::ExpandCycle,
            rule_id: "macrocycle_expansion".to_string(),
            inputs_used: vec![
                input_ref("request.macrocycleWeeks"),
                input_ref("request.selectedPrograms.days"),
            ],
            candidate_id: Some(result.primary_program_id.clone()),
            computed_value: Some(Number::from(result.macrocycle.sessions.len() as u64)),
            outcome: "expanded".to_string(),
            details: Some(json!({
                "sessionCount": result.macrocycle.sessions.len(),
                "mesocycleCount": result.macrocycle.mesocycle_count,
            })),
        },
    ];

    let mut typed_output = TypedEngineOutput {
        schema_version: input.schema_version.clone(),
        operation: input.operation.clone(),
        result: TypedEngineResult::InitializeCycle(result),
        state_patch: StatePatch {
            progression_state: None,
            readiness_state: None,
            gamification_state: Some(input.state_snapshot.gamification_state.clone()),
        },
        events: Vec::new(),
        decision_log,
        replay_receipt: build_replay_receipt(input, String::new(), String::new()),
    };

    let input_hash = derived_input_hash(input);
    let output_hash = derived_output_hash(&typed_output);
    typed_output.replay_receipt = build_replay_receipt(input, input_hash, output_hash);
    typed_output
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::boundary::{parse_policy_snapshot, parse_reference_snapshot, parse_state_snapshot};
    use crate::fixtures;
    use crate::{Determinism, Operation, SCHEMA_VERSION};
    use serde_json::json;

    #[test]
    fn initialize_cycle_panics_when_typed_input_is_missing_cached_class_invariant() {
        let input = TypedEngineInput {
            schema_version: SCHEMA_VERSION.to_string(),
            operation: Operation::InitializeCycle,
            determinism: Determinism {
                seed: fixtures::FIXTURE_SEED.to_string(),
                effective_at: fixtures::EFFECTIVE_AT.to_string(),
                rule_version: "rules-2026-02".to_string(),
                reference_hash: fixtures::REFERENCE_HASH.to_string(),
                canonicalization_version: "canon-replay-v1".to_string(),
            },
            reference_snapshot: parse_reference_snapshot(&fixtures::reference_snapshot())
                .expect("reference snapshot should parse"),
            state_snapshot: parse_state_snapshot(&fixtures::state_snapshot())
                .expect("state snapshot should parse"),
            policy_snapshot: parse_policy_snapshot(&fixtures::policy_snapshot())
                .expect("policy snapshot should parse"),
            initialize_cycle_class_choice: None,
            request: json!({
                "profile": {
                    "classChoice": "strength",
                    "goalBias": "strength",
                    "availableDaysPerWeek": 1,
                    "fatiguePreference": "moderate",
                    "injuryMuscleGroupSlugs": []
                },
                "macrocycleWeeks": 1,
                "selectedPrograms": [
                    {
                        "programId": "program-upper-1",
                        "weight": 1.0,
                        "days": [
                            {
                                "programDayId": "day-strength-1",
                                "dayIndex": 0,
                                "name": "Strength Day 1",
                                "slots": [
                                    {
                                        "slotId": "slot-strength-main",
                                        "slotIndex": 0,
                                        "slotType": "main",
                                        "movementPattern": "push",
                                        "setsMin": 4,
                                        "setsMax": 5,
                                        "repsMin": 3,
                                        "repsMax": 5,
                                        "muscleTargets": { "chest": 1.0 },
                                        "tagsRequired": ["compound"]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }),
            metadata: json!({}),
        };

        let panic = std::panic::catch_unwind(|| initialize_cycle(&input))
            .expect_err("missing cached invariant should panic");
        let message = panic
            .downcast_ref::<String>()
            .map(String::as_str)
            .or_else(|| panic.downcast_ref::<&str>().copied())
            .expect("panic should contain a string message");

        assert!(message.contains("missing canonical class invariant"));
    }
}
