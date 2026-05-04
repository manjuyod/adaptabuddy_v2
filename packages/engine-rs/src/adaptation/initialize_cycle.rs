use crate::boundary::{TypedEngineInput, TypedEngineOutput, TypedEngineResult};
use crate::domain::{
    CanonicalClassArchetype, CycleSessionPlan, CycleSessionSlot, DecisionInputRef,
    DecisionLogEntry, DecisionStepType, InitializeCycleResult, MacrocyclePlan, ProgramBlendEntry,
    StatePatch,
};
use serde_json::{json, Map, Number, Value};
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
    locked_exercise_id: Option<String>,
    prescription: Option<Value>,
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

fn read_object<'a>(value: &'a Value, key: &str) -> &'a Value {
    value.get(key).unwrap_or(&Value::Null)
}

fn read_u32(value: &Value, key: &str, default: u32) -> u32 {
    value
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
        .unwrap_or(default)
}

fn read_string(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn challenge_baseline(input: &TypedEngineInput, exercise_slug: &str) -> u32 {
    request_value(input, "programAdaptationInputs")
        .get("challengeBaselines")
        .and_then(|value| value.get(exercise_slug))
        .and_then(|value| value.get("maxReps"))
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
        .unwrap_or(0)
}

fn challenge_group(template: &Value, baseline: u32) -> String {
    template
        .get("initial_test_groups")
        .and_then(Value::as_array)
        .and_then(|groups| {
            groups.iter().find_map(|group| {
                let min = read_u32(group, "min", 0);
                let max = read_u32(group, "max", u32::MAX);
                if baseline >= min && baseline <= max {
                    group
                        .get("group")
                        .and_then(Value::as_str)
                        .map(ToString::to_string)
                } else {
                    None
                }
            })
        })
        .unwrap_or_else(|| "group_1".to_string())
}

fn challenge_days(
    program_id: &str,
    input: &TypedEngineInput,
    template: &Value,
) -> Vec<SelectedProgramDay> {
    let exercise = read_object(template, "exercise");
    let exercise_slug = read_string(exercise, "slug");
    let baseline = challenge_baseline(input, &exercise_slug);
    let group = challenge_group(template, baseline);
    let weeks = template
        .get("groups")
        .and_then(|groups| groups.get(&group))
        .and_then(|group_template| group_template.get("weeks"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut days = Vec::new();
    for week in weeks {
        let week_index = read_u32(&week, "week", (days.len() / 3 + 1) as u32);
        let week_days = week
            .get("days")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        for day in week_days {
            let day_index = read_u32(&day, "day_index", (days.len() % 3 + 1) as u32);
            let rest_seconds = read_u32(&day, "rest_seconds", 60);
            let day_id = format!("{program_id}-w{week_index}-d{day_index}");
            let sets = day
                .get("sets")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let slots = sets
                .iter()
                .enumerate()
                .map(|(set_index, set)| {
                    let reps = read_u32(set, "reps", 1);
                    let set_type = set
                        .get("type")
                        .and_then(Value::as_str)
                        .unwrap_or("fixed")
                        .to_string();
                    SelectedProgramSlot {
                        slot_id: format!("{day_id}-set-{}", set_index + 1),
                        slot_index: set_index as u32,
                        slot_type: "main".to_string(),
                        movement_pattern: None,
                        sets_min: 1,
                        sets_max: 1,
                        reps_min: reps,
                        reps_max: reps,
                        muscle_targets: BTreeMap::new(),
                        tags_required: vec!["challenge".to_string()],
                        locked_exercise_id: if exercise_slug.is_empty() {
                            None
                        } else {
                            Some(exercise_slug.clone())
                        },
                        prescription: Some(json!({
                            "family": "challenge_progression",
                            "challengeGroup": group,
                            "setType": set_type,
                            "restSeconds": rest_seconds,
                            "week": week_index,
                            "dayIndex": day_index,
                            "setIndex": set_index + 1,
                            "baselineMaxReps": baseline,
                        })),
                    }
                })
                .collect::<Vec<_>>();

            days.push(SelectedProgramDay {
                program_day_id: day_id,
                day_index: days.len() as u32,
                name: format!("Challenge Week {week_index} Day {day_index}"),
                slots,
            });
        }
    }

    days
}

fn parse_reps_range(value: &Value) -> (u32, u32) {
    if let Some(reps) = value.as_u64().and_then(|value| u32::try_from(value).ok()) {
        return (reps, reps);
    }

    let Some(text) = value.as_str() else {
        return (1, 1);
    };
    let mut parts = text
        .split('-')
        .filter_map(|part| part.trim().parse::<u32>().ok());
    let min = parts.next().unwrap_or(1);
    let max = parts.next().unwrap_or(min);
    (min, max.max(min))
}

fn hypertrophy_engine_days(template: &Value) -> Vec<SelectedProgramDay> {
    template
        .get("sessions")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .enumerate()
        .map(|(day_index, session)| {
            let day_id = read_string(session, "session_key");
            let name = read_string(session, "label");
            let slots = session
                .get("slots")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .enumerate()
                .map(|(slot_index, slot)| {
                    let sets = read_u32(slot, "sets", 1);
                    let (reps_min, reps_max) = parse_reps_range(read_object(slot, "reps"));
                    let muscle_targets = slot
                        .get("target_muscles")
                        .and_then(Value::as_array)
                        .map(|targets| {
                            targets
                                .iter()
                                .filter_map(Value::as_str)
                                .filter(|muscle| !muscle.is_empty())
                                .filter_map(|muscle| {
                                    Number::from_f64(1.0).map(|weight| (muscle.to_string(), weight))
                                })
                                .collect::<BTreeMap<_, _>>()
                        })
                        .unwrap_or_default();
                    let tags_required = slot
                        .get("tags")
                        .and_then(Value::as_array)
                        .map(|tags| {
                            tags.iter()
                                .filter_map(Value::as_str)
                                .filter(|tag| !tag.is_empty())
                                .map(ToString::to_string)
                                .collect::<Vec<_>>()
                        })
                        .unwrap_or_default();

                    SelectedProgramSlot {
                        slot_id: read_string(slot, "slot_key"),
                        slot_index: slot_index as u32,
                        slot_type: if slot_index == 0 {
                            "main".to_string()
                        } else {
                            "accessory".to_string()
                        },
                        movement_pattern: slot
                            .get("movement_pattern")
                            .and_then(Value::as_str)
                            .map(ToString::to_string),
                        sets_min: sets,
                        sets_max: sets,
                        reps_min,
                        reps_max,
                        muscle_targets,
                        tags_required,
                        locked_exercise_id: None,
                        prescription: Some(json!({
                            "family": "hypertrophy_engine_v1",
                            "poolKey": slot.get("pool_key").and_then(Value::as_str),
                            "focus": session.get("focus").and_then(Value::as_str),
                        })),
                    }
                })
                .collect::<Vec<_>>();

            SelectedProgramDay {
                program_day_id: day_id.clone(),
                day_index: day_index as u32,
                name: if name.is_empty() { day_id } else { name },
                slots,
            }
        })
        .collect()
}

fn selected_programs(input: &TypedEngineInput) -> Vec<SelectedProgram> {
    request_value(input, "selectedPrograms")
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|program| {
            let program_id = program.get("programId")?.as_str()?.to_string();
            let weight = program.get("weight")?.as_f64()?;
            let template_kind = program
                .get("templateKind")
                .and_then(Value::as_str)
                .unwrap_or("slot_based")
                .to_string();
            let adaptive_template = program
                .get("adaptiveTemplate")
                .cloned()
                .unwrap_or(Value::Null);
            let days = if template_kind == "challenge_progression" {
                challenge_days(&program_id, input, &adaptive_template)
            } else if template_kind == "hypertrophy_engine_v1" {
                hypertrophy_engine_days(&adaptive_template)
            } else {
                program
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
                                let sets_min =
                                    u32::try_from(slot.get("setsMin")?.as_u64()?).ok()?;
                                let sets_max =
                                    u32::try_from(slot.get("setsMax")?.as_u64()?).ok()?;
                                let reps_min =
                                    u32::try_from(slot.get("repsMin")?.as_u64()?).ok()?;
                                let reps_max =
                                    u32::try_from(slot.get("repsMax")?.as_u64()?).ok()?;
                                let movement_pattern = slot
                                    .get("movementPattern")
                                    .and_then(Value::as_str)
                                    .map(ToString::to_string);
                                let locked_exercise_id = slot
                                    .get("lockedExerciseId")
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
                                let prescription = slot.get("prescription").cloned();

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
                                    locked_exercise_id,
                                    prescription,
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
                    .collect::<Vec<_>>()
            };

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

fn weekly_set_cap(preference: &str) -> Option<u32> {
    match preference {
        "high" => Some(18),
        "moderate" => Some(27),
        _ => None,
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

fn slot_has_tag(slot: &SelectedProgramSlot, tag: &str) -> bool {
    slot.tags_required.iter().any(|candidate| candidate == tag)
}

fn is_challenge_slot(slot: &SelectedProgramSlot) -> bool {
    slot_has_tag(slot, "challenge")
        || slot
            .prescription
            .as_ref()
            .and_then(|value| value.get("family"))
            .and_then(Value::as_str)
            == Some("challenge_progression")
}

fn injury_matches(slot: &SelectedProgramSlot, injury_slugs: &[String]) -> Vec<String> {
    slot.muscle_targets
        .keys()
        .filter(|muscle| injury_slugs.iter().any(|injury| injury == *muscle))
        .cloned()
        .collect()
}

fn strength_baseline_key(slot: &SelectedProgramSlot) -> Option<&'static str> {
    match slot.movement_pattern.as_deref() {
        Some("squat") | Some("knee_dominant") => Some("squat"),
        Some("deadlift") | Some("hinge") => Some("deadlift"),
        Some("horizontal_press") | Some("bench_press") => Some("bench_press"),
        Some("vertical_press") | Some("overhead_press") => Some("overhead_press"),
        _ => None,
    }
}

fn strength_baseline(input: &TypedEngineInput, slot: &SelectedProgramSlot) -> Option<Value> {
    let key = strength_baseline_key(slot)?;
    request_value(input, "programAdaptationInputs")
        .get("strengthBaselines")
        .and_then(|baselines| baselines.get(key))
        .cloned()
}

fn prescription_object(slot: &SelectedProgramSlot) -> Map<String, Value> {
    slot.prescription
        .as_ref()
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default()
}

fn set_prescription_field(slot: &mut SelectedProgramSlot, key: &str, value: Value) {
    let mut prescription = prescription_object(slot);
    prescription.insert(key.to_string(), value);
    slot.prescription = Some(Value::Object(prescription));
}

fn apply_strength_baseline(input: &TypedEngineInput, slot: &mut SelectedProgramSlot) {
    if let Some(baseline) = strength_baseline(input, slot) {
        set_prescription_field(slot, "strengthBaseline", baseline);
    }
}

fn safe_swap_exercise(
    input: &TypedEngineInput,
    slot: &SelectedProgramSlot,
    injuries: &[String],
) -> Option<(String, String)> {
    let movement_pattern = slot.movement_pattern.as_ref()?;
    let swap_tag = format!("swap_for:{movement_pattern}");
    let contraindicated = injuries
        .iter()
        .map(|injury| format!("contraindicated:{injury}"))
        .collect::<Vec<_>>();

    input
        .reference_snapshot
        .exercises
        .iter()
        .filter(|exercise| exercise.tags.iter().any(|tag| tag == &swap_tag))
        .filter(|exercise| {
            contraindicated
                .iter()
                .all(|blocked| !exercise.tags.iter().any(|tag| tag == blocked))
        })
        .min_by(|left, right| left.id.cmp(&right.id))
        .map(|exercise| (exercise.id.clone(), exercise.movement_pattern.clone()))
}

fn constrain_slot(
    input: &TypedEngineInput,
    slot: &SelectedProgramSlot,
    injury_slugs: &[String],
    adaptation_notes: &mut Vec<DecisionLogEntry>,
) -> Option<SelectedProgramSlot> {
    let matched_injuries = injury_matches(slot, injury_slugs);
    let mut adapted = slot.clone();

    if matched_injuries.is_empty() {
        apply_strength_baseline(input, &mut adapted);
        return Some(adapted);
    }

    if let Some((swap_exercise_id, swap_movement_pattern)) =
        safe_swap_exercise(input, slot, &matched_injuries)
    {
        let original_movement_pattern = adapted.movement_pattern.clone();
        adapted.locked_exercise_id = Some(swap_exercise_id.clone());
        adapted.movement_pattern = Some(swap_movement_pattern);
        set_prescription_field(
            &mut adapted,
            "adaptation",
            json!({
                "action": "swap",
                "injuryMuscleGroupSlugs": matched_injuries,
                "originalMovementPattern": original_movement_pattern,
                "swapExerciseId": swap_exercise_id,
            }),
        );
        apply_strength_baseline(input, &mut adapted);
        adaptation_notes.push(DecisionLogEntry {
            step_type: DecisionStepType::Filter,
            rule_id: "injury_safe_swap".to_string(),
            inputs_used: vec![input_ref("request.profile.injuryMuscleGroupSlugs")],
            candidate_id: Some(slot.slot_id.clone()),
            computed_value: None,
            outcome: "swapped".to_string(),
            details: Some(json!({
                "injuryMuscleGroupSlugs": matched_injuries,
                "swapExerciseId": swap_exercise_id,
            })),
        });
        return Some(adapted);
    }

    if slot.slot_type == "main" {
        adapted.sets_min = adapted.sets_min.div_ceil(2).max(1);
        adapted.sets_max = adapted.sets_max.div_ceil(2).max(adapted.sets_min);
        set_prescription_field(
            &mut adapted,
            "adaptation",
            json!({
                "action": "regress",
                "injuryMuscleGroupSlugs": matched_injuries,
                "reason": "no_safe_swap_available",
            }),
        );
        apply_strength_baseline(input, &mut adapted);
        adaptation_notes.push(DecisionLogEntry {
            step_type: DecisionStepType::Filter,
            rule_id: "injury_regress_or_cap".to_string(),
            inputs_used: vec![input_ref("request.profile.injuryMuscleGroupSlugs")],
            candidate_id: Some(slot.slot_id.clone()),
            computed_value: None,
            outcome: "capped".to_string(),
            details: Some(json!({
                "injuryMuscleGroupSlugs": matched_injuries,
                "originalSetsMin": slot.sets_min,
                "originalSetsMax": slot.sets_max,
                "cappedSetsMin": adapted.sets_min,
                "cappedSetsMax": adapted.sets_max,
            })),
        });
        return Some(adapted);
    }

    adaptation_notes.push(DecisionLogEntry {
        step_type: DecisionStepType::Filter,
        rule_id: "injury_remove".to_string(),
        inputs_used: vec![input_ref("request.profile.injuryMuscleGroupSlugs")],
        candidate_id: Some(slot.slot_id.clone()),
        computed_value: None,
        outcome: "removed".to_string(),
        details: Some(json!({
            "injuryMuscleGroupSlugs": matched_injuries,
        })),
    });
    None
}

fn apply_volume_cap(
    slot: &SelectedProgramSlot,
    weekly_sets_used: &mut u32,
    weekly_cap: Option<u32>,
    adaptation_notes: &mut Vec<DecisionLogEntry>,
) -> Option<SelectedProgramSlot> {
    if is_challenge_slot(slot) {
        return Some(slot.clone());
    }

    let Some(cap) = weekly_cap else {
        *weekly_sets_used = weekly_sets_used.saturating_add(slot.sets_max);
        return Some(slot.clone());
    };

    if weekly_sets_used.saturating_add(slot.sets_max) <= cap {
        *weekly_sets_used = weekly_sets_used.saturating_add(slot.sets_max);
        return Some(slot.clone());
    }

    let remaining = cap.saturating_sub(*weekly_sets_used);
    if remaining > 0 && slot.slot_type == "main" {
        let mut adapted = slot.clone();
        adapted.sets_min = remaining.min(adapted.sets_min).max(1);
        adapted.sets_max = remaining.max(adapted.sets_min);
        set_prescription_field(
            &mut adapted,
            "adaptation",
            json!({
                "action": "volume_cap",
                "weeklySetCap": cap,
                "originalSetsMax": slot.sets_max,
            }),
        );
        *weekly_sets_used = cap;
        adaptation_notes.push(DecisionLogEntry {
            step_type: DecisionStepType::Filter,
            rule_id: "fatigue_volume_cap".to_string(),
            inputs_used: vec![input_ref("request.profile.fatiguePreference")],
            candidate_id: Some(slot.slot_id.clone()),
            computed_value: Some(Number::from(u64::from(cap))),
            outcome: "capped".to_string(),
            details: Some(json!({
                "weeklySetCap": cap,
                "originalSetsMax": slot.sets_max,
            })),
        });
        return Some(adapted);
    }

    adaptation_notes.push(DecisionLogEntry {
        step_type: DecisionStepType::Filter,
        rule_id: "fatigue_volume_cap".to_string(),
        inputs_used: vec![input_ref("request.profile.fatiguePreference")],
        candidate_id: Some(slot.slot_id.clone()),
        computed_value: Some(Number::from(u64::from(cap))),
        outcome: "removed".to_string(),
        details: Some(json!({
            "weeklySetCap": cap,
            "originalSetsMax": slot.sets_max,
        })),
    });
    None
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
        locked_exercise_id: slot.locked_exercise_id.clone(),
        prescription: slot.prescription.clone(),
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
    let weekly_set_cap = weekly_set_cap(&fatigue_preference);

    let primary = programs
        .first()
        .expect("initialize_cycle requires at least one selected program");

    let mut sessions = Vec::new();
    let mut adaptation_notes = Vec::new();
    for week in 0..macrocycle_weeks {
        let mesocycle_index = week / 4;
        let microcycle_index = week % 4;
        let mut weekly_sets_used = 0u32;
        for day_position in 0..available_days {
            let sequence_index = (week * available_days + day_position) as usize;
            let primary_day = &primary.days[sequence_index % primary.days.len()];
            let mut slot_payload = Vec::new();

            for program in &programs {
                let program_day = &program.days[sequence_index % program.days.len()];
                for slot in &program_day.slots {
                    let Some(constrained_slot) =
                        constrain_slot(input, slot, &injury_slugs, &mut adaptation_notes)
                    else {
                        continue;
                    };
                    let Some(capped_slot) = apply_volume_cap(
                        &constrained_slot,
                        &mut weekly_sets_used,
                        weekly_set_cap,
                        &mut adaptation_notes,
                    ) else {
                        continue;
                    };
                    slot_payload.push(build_slot(
                        &program.program_id,
                        &program_day.program_day_id,
                        &capped_slot,
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
            outcome: "aggregate_constrain".to_string(),
            details: Some(json!({
                "primaryProgramId": primary.program_id,
                "scheduleStrategy": "aggregate_selected_programs_then_constrain",
                "fatigueWeeklySetCap": weekly_set_cap,
                "adaptations": adaptation_notes,
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
