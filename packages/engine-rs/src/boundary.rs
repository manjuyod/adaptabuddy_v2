use crate::domain::{
    AdvanceCycleResult, AthleteStateSnapshot, CanonicalClassArchetype, CompleteSessionResult,
    DecisionLogEntry, DeterministicRejection, FatigueLevel, InitializeCycleResult,
    PlanSessionResult, ReferenceSnapshot, StatePatch,
};
use crate::replay::{self, NumericScale};
use crate::{Determinism, EngineInputV1, EngineOutputV1, Operation, ReplayReceipt, SCHEMA_VERSION};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum BoundaryError {
    SchemaVersionMismatch {
        expected: &'static str,
        found: String,
    },
    InvalidSnapshot {
        context: &'static str,
        message: String,
    },
    InvalidOutput {
        context: &'static str,
        message: String,
    },
}

impl core::fmt::Display for BoundaryError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Self::SchemaVersionMismatch { expected, found } => {
                write!(
                    f,
                    "schema version mismatch: expected {expected}, found {found}"
                )
            }
            Self::InvalidSnapshot { context, message } => {
                write!(f, "invalid {context} snapshot: {message}")
            }
            Self::InvalidOutput { context, message } => {
                write!(f, "invalid {context} output: {message}")
            }
        }
    }
}

impl std::error::Error for BoundaryError {}

impl From<serde_json::Error> for BoundaryError {
    fn from(error: serde_json::Error) -> Self {
        Self::InvalidSnapshot {
            context: "json",
            message: error.to_string(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PolicySnapshot {
    pub novelty_budget: u32,
    pub class_archetype_bias: serde_json::Number,
    pub fatigue_block_threshold: FatigueLevel,
    pub seeded_tie_break_band: serde_json::Number,
}

#[derive(Clone, Debug, PartialEq)]
pub struct TypedEngineInput {
    pub schema_version: String,
    pub operation: Operation,
    pub determinism: Determinism,
    pub reference_snapshot: ReferenceSnapshot,
    pub state_snapshot: AthleteStateSnapshot,
    pub policy_snapshot: PolicySnapshot,
    pub initialize_cycle_class_choice: Option<CanonicalClassArchetype>,
    pub request: Value,
    pub metadata: Value,
}

#[derive(Clone, Debug, PartialEq)]
pub struct TypedEngineOutput {
    pub schema_version: String,
    pub operation: Operation,
    pub result: TypedEngineResult,
    pub state_patch: StatePatch,
    pub events: Vec<Value>,
    pub decision_log: Vec<DecisionLogEntry>,
    pub replay_receipt: ReplayReceipt,
}

#[derive(Clone, Debug, PartialEq)]
pub enum TypedEngineResult {
    InitializeCycle(InitializeCycleResult),
    PlanSession(PlanSessionResult),
    CompleteSession(CompleteSessionResult),
    AdvanceCycle(AdvanceCycleResult),
    DeterministicRejection(DeterministicRejection),
}

impl PolicySnapshot {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

pub fn parse_reference_snapshot(value: &Value) -> Result<ReferenceSnapshot, BoundaryError> {
    ReferenceSnapshot::from_value(value).map_err(|error| BoundaryError::InvalidSnapshot {
        context: "reference",
        message: error.to_string(),
    })
}

pub fn parse_state_snapshot(value: &Value) -> Result<AthleteStateSnapshot, BoundaryError> {
    AthleteStateSnapshot::from_value(value).map_err(|error| BoundaryError::InvalidSnapshot {
        context: "state",
        message: error.to_string(),
    })
}

pub fn parse_policy_snapshot(value: &Value) -> Result<PolicySnapshot, BoundaryError> {
    let policy =
        PolicySnapshot::from_value(value).map_err(|error| BoundaryError::InvalidSnapshot {
            context: "policy",
            message: error.to_string(),
        })?;
    validate_policy_snapshot(&policy)?;
    Ok(policy)
}

fn operation_label(operation: &Operation) -> &'static str {
    match operation {
        Operation::InitializeCycle => "initialize_cycle",
        Operation::PlanSession => "plan_session",
        Operation::CompleteSession => "complete_session",
        Operation::AdvanceCycle => "advance_cycle",
    }
}

fn invalid_policy(message: impl Into<String>) -> BoundaryError {
    BoundaryError::InvalidSnapshot {
        context: "policy",
        message: message.into(),
    }
}

fn invalid_determinism(message: impl Into<String>) -> BoundaryError {
    BoundaryError::InvalidSnapshot {
        context: "determinism",
        message: message.into(),
    }
}

fn invalid_reference(message: impl Into<String>) -> BoundaryError {
    BoundaryError::InvalidSnapshot {
        context: "reference",
        message: message.into(),
    }
}

fn validate_policy_snapshot(policy: &PolicySnapshot) -> Result<(), BoundaryError> {
    replay::validate_number_scale(
        &policy.class_archetype_bias,
        NumericScale::Ratio4,
        "classArchetypeBias",
    )
    .map_err(invalid_policy)?;
    let class_archetype_bias = policy
        .class_archetype_bias
        .as_f64()
        .ok_or_else(|| invalid_policy("field `classArchetypeBias` must be a finite number"))?;
    if !(0.0..=0.15).contains(&class_archetype_bias) {
        return Err(invalid_policy(
            "field `classArchetypeBias` must be in 0..=0.15",
        ));
    }

    replay::validate_number_scale(
        &policy.seeded_tie_break_band,
        NumericScale::Score2,
        "seededTieBreakBand",
    )
    .map_err(invalid_policy)?;
    let seeded_tie_break_band = policy
        .seeded_tie_break_band
        .as_f64()
        .ok_or_else(|| invalid_policy("field `seededTieBreakBand` must be a finite number"))?;
    if !(0.0..=1.0).contains(&seeded_tie_break_band) {
        return Err(invalid_policy(
            "field `seededTieBreakBand` must be >= 0 and <= 1",
        ));
    }

    Ok(())
}

fn validate_determinism(determinism: &Determinism) -> Result<(), BoundaryError> {
    if !replay::accepted_canonicalization_version(&determinism.canonicalization_version) {
        return Err(invalid_determinism(format!(
            "field `canonicalizationVersion` has unsupported value `{}`",
            determinism.canonicalization_version
        )));
    }

    Ok(())
}

fn validate_reference_hash(
    determinism: &Determinism,
    reference_snapshot: &ReferenceSnapshot,
) -> Result<(), BoundaryError> {
    let reference_value = reference_snapshot
        .to_value()
        .map_err(|error| invalid_reference(error.to_string()))?;
    let actual = replay::hash_value(&reference_value).map_err(invalid_reference)?;
    if actual != determinism.reference_hash {
        return Err(invalid_reference(format!(
            "referenceHash mismatch: expected {}, computed {actual}",
            determinism.reference_hash
        )));
    }

    Ok(())
}

fn validate_number_value_scale(
    operation: &Operation,
    value: &Value,
    scale: NumericScale,
    path: &str,
) -> Result<(), BoundaryError> {
    let number = value
        .as_number()
        .ok_or_else(|| invalid_request(operation, format!("field `{path}` must be a number")))?;
    replay::validate_number_scale(number, scale, path)
        .map_err(|message| invalid_request(operation, message))
}

fn invalid_state(message: impl Into<String>) -> BoundaryError {
    BoundaryError::InvalidSnapshot {
        context: "state",
        message: message.into(),
    }
}

fn validate_state_number_scale(
    value: &Value,
    scale: NumericScale,
    path: &str,
) -> Result<(), BoundaryError> {
    let number = value
        .as_number()
        .ok_or_else(|| invalid_state(format!("field `{path}` must be a number")))?;
    replay::validate_number_scale(number, scale, path).map_err(invalid_state)
}

fn validate_state_numeric_policy(state_snapshot: &Value) -> Result<(), BoundaryError> {
    for path in [
        &["athleteProfile", "weight"][..],
        &["performanceState", "knownLifts", "*", "estimated1RM"][..],
        &["performanceState", "knownLifts", "*", "lastWeight"][..],
        &[
            "progressionState",
            "records",
            "*",
            "previousPerformanceReference",
            "weight",
        ][..],
    ] {
        validate_weight_paths(state_snapshot, path)?;
    }

    Ok(())
}

fn validate_weight_paths(current: &Value, path: &[&str]) -> Result<(), BoundaryError> {
    if path.is_empty() {
        return validate_state_number_scale(current, NumericScale::KgCent, "weight");
    }

    let (head, tail) = path.split_first().expect("path should be non-empty");
    if *head == "*" {
        if let Some(array) = current.as_array() {
            for item in array {
                validate_weight_paths(item, tail)?;
            }
        } else if let Some(object) = current.as_object() {
            for item in object.values() {
                validate_weight_paths(item, tail)?;
            }
        }
        return Ok(());
    }

    if let Some(next) = current.get(*head) {
        validate_weight_paths(next, tail)?;
    }

    Ok(())
}

fn invalid_request(operation: &Operation, message: impl Into<String>) -> BoundaryError {
    BoundaryError::InvalidSnapshot {
        context: "request",
        message: format!("{} request: {}", operation_label(operation), message.into()),
    }
}

fn expect_request_object<'a>(
    operation: &Operation,
    value: &'a Value,
) -> Result<&'a Map<String, Value>, BoundaryError> {
    value
        .as_object()
        .ok_or_else(|| invalid_request(operation, "expected top-level object"))
}

fn reject_unknown_fields(
    operation: &Operation,
    map: &Map<String, Value>,
    allowed_fields: &[&str],
) -> Result<(), BoundaryError> {
    if let Some(field) = map
        .keys()
        .find(|key| !allowed_fields.contains(&key.as_str()))
    {
        return Err(invalid_request(
            operation,
            format!("unknown field `{field}`"),
        ));
    }

    Ok(())
}

fn expect_string_field<'a>(
    operation: &Operation,
    map: &'a Map<String, Value>,
    key: &str,
) -> Result<&'a str, BoundaryError> {
    map.get(key)
        .ok_or_else(|| invalid_request(operation, format!("missing field `{key}`")))?
        .as_str()
        .ok_or_else(|| invalid_request(operation, format!("field `{key}` must be a string")))
}

fn expect_nonempty_string_field<'a>(
    operation: &Operation,
    map: &'a Map<String, Value>,
    key: &str,
) -> Result<&'a str, BoundaryError> {
    let value = expect_string_field(operation, map, key)?;
    if value.is_empty() {
        return Err(invalid_request(
            operation,
            format!("field `{key}` must be a non-empty string"),
        ));
    }

    Ok(value)
}

fn expect_initialize_cycle_class_choice(
    operation: &Operation,
    map: &Map<String, Value>,
    key: &str,
) -> Result<CanonicalClassArchetype, BoundaryError> {
    match expect_nonempty_string_field(operation, map, key)? {
        "strength" => Ok(CanonicalClassArchetype::Strength),
        "hybrid" => Ok(CanonicalClassArchetype::Hybrid),
        _ => Err(invalid_request(
            operation,
            format!("field `{key}` must be one of strength|hybrid"),
        )),
    }
}

fn parse_initialize_cycle_class_choice(
    operation: &Operation,
    request: &Value,
) -> Result<Option<CanonicalClassArchetype>, BoundaryError> {
    if !matches!(operation, Operation::InitializeCycle) {
        return Ok(None);
    }

    let request = expect_request_object(operation, request)?;
    let profile = expect_object_field(operation, request, "profile")?;
    expect_initialize_cycle_class_choice(operation, profile, "classChoice").map(Some)
}

fn expect_i64_field(
    operation: &Operation,
    map: &Map<String, Value>,
    key: &str,
) -> Result<i64, BoundaryError> {
    map.get(key)
        .ok_or_else(|| invalid_request(operation, format!("missing field `{key}`")))?
        .as_i64()
        .ok_or_else(|| invalid_request(operation, format!("field `{key}` must be an integer")))
}

fn expect_nullable_i64_field(
    operation: &Operation,
    map: &Map<String, Value>,
    key: &str,
) -> Result<Option<i64>, BoundaryError> {
    let value = map
        .get(key)
        .ok_or_else(|| invalid_request(operation, format!("missing field `{key}`")))?;
    if value.is_null() {
        return Ok(None);
    }

    value
        .as_i64()
        .map(Some)
        .ok_or_else(|| invalid_request(operation, format!("field `{key}` must be an integer")))
}

fn expect_array_field<'a>(
    operation: &Operation,
    map: &'a Map<String, Value>,
    key: &str,
) -> Result<&'a Vec<Value>, BoundaryError> {
    map.get(key)
        .ok_or_else(|| invalid_request(operation, format!("missing field `{key}`")))?
        .as_array()
        .ok_or_else(|| invalid_request(operation, format!("field `{key}` must be an array")))
}

fn expect_object_field<'a>(
    operation: &Operation,
    map: &'a Map<String, Value>,
    key: &str,
) -> Result<&'a Map<String, Value>, BoundaryError> {
    map.get(key)
        .ok_or_else(|| invalid_request(operation, format!("missing field `{key}`")))?
        .as_object()
        .ok_or_else(|| invalid_request(operation, format!("field `{key}` must be an object")))
}

fn expect_optional_string_field(
    operation: &Operation,
    map: &Map<String, Value>,
    key: &str,
) -> Result<(), BoundaryError> {
    if let Some(value) = map.get(key) {
        if !value.is_string() {
            return Err(invalid_request(
                operation,
                format!("field `{key}` must be a string"),
            ));
        }
    }

    Ok(())
}

fn expect_number_field(
    operation: &Operation,
    map: &Map<String, Value>,
    key: &str,
) -> Result<f64, BoundaryError> {
    map.get(key)
        .ok_or_else(|| invalid_request(operation, format!("missing field `{key}`")))?
        .as_f64()
        .ok_or_else(|| invalid_request(operation, format!("field `{key}` must be a number")))
}

fn expect_nonnegative_i64_field(
    operation: &Operation,
    map: &Map<String, Value>,
    key: &str,
) -> Result<i64, BoundaryError> {
    let value = expect_i64_field(operation, map, key)?;
    if value < 0 {
        return Err(invalid_request(
            operation,
            format!("field `{key}` must be >= 0"),
        ));
    }

    Ok(value)
}

fn expect_u32_i64_field(
    operation: &Operation,
    map: &Map<String, Value>,
    key: &str,
) -> Result<u32, BoundaryError> {
    let value = expect_nonnegative_i64_field(operation, map, key)?;
    u32::try_from(value)
        .map_err(|_| invalid_request(operation, format!("field `{key}` must be <= {}", u32::MAX)))
}

fn expect_nonnegative_number_field(
    operation: &Operation,
    map: &Map<String, Value>,
    key: &str,
) -> Result<f64, BoundaryError> {
    let value = expect_number_field(operation, map, key)?;
    if value < 0.0 {
        return Err(invalid_request(
            operation,
            format!("field `{key}` must be >= 0"),
        ));
    }

    Ok(value)
}

fn expect_bounded_nullable_i64_field(
    operation: &Operation,
    map: &Map<String, Value>,
    key: &str,
    min: i64,
    max: i64,
) -> Result<Option<i64>, BoundaryError> {
    let value = expect_nullable_i64_field(operation, map, key)?;
    if let Some(value) = value {
        if !(min..=max).contains(&value) {
            return Err(invalid_request(
                operation,
                format!("field `{key}` must be in {min}..={max}"),
            ));
        }
    }

    Ok(value)
}

fn is_rfc3339_utc_datetime(value: &str) -> bool {
    if value.len() < 20 || !value.ends_with('Z') {
        return false;
    }

    let bytes = value.as_bytes();
    for &index in &[4, 7] {
        if bytes.get(index) != Some(&b'-') {
            return false;
        }
    }
    if bytes.get(10) != Some(&b'T') || bytes.get(13) != Some(&b':') || bytes.get(16) != Some(&b':')
    {
        return false;
    }

    let fractional_start = 19;
    let fraction = &value[fractional_start..value.len() - 1];
    if !(fraction.is_empty()
        || (fraction.starts_with('.') && fraction[1..].chars().all(|c| c.is_ascii_digit())))
    {
        return false;
    }

    let digit_ranges = [(0, 4), (5, 7), (8, 10), (11, 13), (14, 16), (17, 19)];
    if digit_ranges.iter().any(|(start, end)| {
        !value[*start..*end]
            .chars()
            .all(|character| character.is_ascii_digit())
    }) {
        return false;
    }

    let parse_component = |start: usize, end: usize| value[start..end].parse::<u32>().ok();
    let month = parse_component(5, 7).unwrap_or_default();
    let day = parse_component(8, 10).unwrap_or_default();
    let year = parse_component(0, 4).unwrap_or_default();
    let hour = parse_component(11, 13).unwrap_or_default();
    let minute = parse_component(14, 16).unwrap_or_default();
    let second = parse_component(17, 19).unwrap_or_default();
    let max_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 {
                29
            } else {
                28
            }
        }
        _ => 0,
    };

    (1..=12).contains(&month)
        && (1..=max_day).contains(&day)
        && hour <= 23
        && minute <= 59
        && second <= 59
}

fn expect_datetime_field(
    operation: &Operation,
    map: &Map<String, Value>,
    key: &str,
) -> Result<(), BoundaryError> {
    let value = expect_string_field(operation, map, key)?;
    if !is_rfc3339_utc_datetime(value) {
        return Err(invalid_request(
            operation,
            format!("field `{key}` must be an RFC3339 datetime"),
        ));
    }

    Ok(())
}

fn expect_optional_datetime_field(
    operation: &Operation,
    map: &Map<String, Value>,
    key: &str,
) -> Result<(), BoundaryError> {
    if let Some(value) = map.get(key) {
        let value = value.as_str().ok_or_else(|| {
            invalid_request(
                operation,
                format!("field `{key}` must be an RFC3339 datetime"),
            )
        })?;
        if !is_rfc3339_utc_datetime(value) {
            return Err(invalid_request(
                operation,
                format!("field `{key}` must be an RFC3339 datetime"),
            ));
        }
    }

    Ok(())
}

fn validate_plan_session_request(
    operation: &Operation,
    value: &Value,
) -> Result<(), BoundaryError> {
    let request = expect_request_object(operation, value)?;
    reject_unknown_fields(
        operation,
        request,
        &["programId", "sessionFocus", "microcycleIndex"],
    )?;
    let _ = expect_nonempty_string_field(operation, request, "programId")?;
    let _ = expect_nonempty_string_field(operation, request, "sessionFocus")?;
    let _ = expect_nonnegative_i64_field(operation, request, "microcycleIndex")?;
    Ok(())
}

fn validate_complete_session_request(
    operation: &Operation,
    value: &Value,
) -> Result<(), BoundaryError> {
    let request = expect_request_object(operation, value)?;
    reject_unknown_fields(operation, request, &["session"])?;

    let session = expect_object_field(operation, request, "session")?;
    reject_unknown_fields(
        operation,
        session,
        &[
            "programDayId",
            "seed",
            "startedAt",
            "completedAt",
            "exercises",
            "overallRpe",
            "notes",
        ],
    )?;

    let _ = expect_nonempty_string_field(operation, session, "programDayId")?;
    let _ = expect_nonempty_string_field(operation, session, "seed")?;
    expect_datetime_field(operation, session, "startedAt")?;
    expect_optional_datetime_field(operation, session, "completedAt")?;
    let _ = expect_bounded_nullable_i64_field(operation, session, "overallRpe", 1, 10)?;
    expect_optional_string_field(operation, session, "notes")?;

    let exercises = expect_array_field(operation, session, "exercises")?;
    if exercises.is_empty() {
        return Err(invalid_request(
            operation,
            "field `session.exercises` must include at least one exercise",
        ));
    }

    for (exercise_index, exercise) in exercises.iter().enumerate() {
        let exercise = exercise.as_object().ok_or_else(|| {
            invalid_request(
                operation,
                format!("field `session.exercises[{exercise_index}]` must be an object"),
            )
        })?;
        reject_unknown_fields(operation, exercise, &["slotId", "exerciseId", "sets"])?;
        let _ = expect_nonempty_string_field(operation, exercise, "slotId")?;
        let _ = expect_nonempty_string_field(operation, exercise, "exerciseId")?;

        let sets = expect_array_field(operation, exercise, "sets")?;
        if sets.is_empty() {
            return Err(invalid_request(
                operation,
                format!(
                    "field `session.exercises[{exercise_index}].sets` must include at least one set"
                ),
            ));
        }

        for (set_index, set) in sets.iter().enumerate() {
            let set = set.as_object().ok_or_else(|| {
                invalid_request(
                    operation,
                    format!("field `session.exercises[{exercise_index}].sets[{set_index}]` must be an object"),
                )
            })?;
            reject_unknown_fields(
                operation,
                set,
                &["setIndex", "weight", "reps", "rir", "notes"],
            )?;
            let _ = expect_nonnegative_i64_field(operation, set, "setIndex")?;
            let _ = expect_nonnegative_number_field(operation, set, "weight")?;
            validate_number_value_scale(
                operation,
                set.get("weight").expect("weight was already required"),
                NumericScale::KgCent,
                "weight",
            )?;
            let _ = expect_nonnegative_i64_field(operation, set, "reps")?;
            let _ = expect_bounded_nullable_i64_field(operation, set, "rir", 0, 10)?;
            expect_optional_string_field(operation, set, "notes")?;
        }
    }

    Ok(())
}

fn challenge_template_exercise_slug(template: &Map<String, Value>) -> Option<&str> {
    template
        .get("exercise")
        .and_then(Value::as_object)
        .and_then(|exercise| exercise.get("slug"))
        .and_then(Value::as_str)
        .filter(|slug| !slug.is_empty())
}

fn validate_program_adaptation_inputs(
    operation: &Operation,
    request: &Map<String, Value>,
) -> Result<(), BoundaryError> {
    let Some(inputs_value) = request.get("programAdaptationInputs") else {
        return Ok(());
    };
    let inputs = inputs_value.as_object().ok_or_else(|| {
        invalid_request(
            operation,
            "field `programAdaptationInputs` must be an object",
        )
    })?;
    reject_unknown_fields(
        operation,
        inputs,
        &["challengeBaselines", "strengthBaselines"],
    )?;

    if let Some(baselines_value) = inputs.get("challengeBaselines") {
        let baselines = baselines_value.as_object().ok_or_else(|| {
            invalid_request(
                operation,
                "field `programAdaptationInputs.challengeBaselines` must be an object",
            )
        })?;
        for (slug, baseline_value) in baselines {
            if slug.is_empty() {
                return Err(invalid_request(
                    operation,
                    "field `programAdaptationInputs.challengeBaselines` keys must be non-empty",
                ));
            }
            let baseline = baseline_value.as_object().ok_or_else(|| {
                invalid_request(
                    operation,
                    format!(
                        "field `programAdaptationInputs.challengeBaselines.{slug}` must be an object"
                    ),
                )
            })?;
            reject_unknown_fields(operation, baseline, &["maxReps"])?;
            let _ = expect_u32_i64_field(operation, baseline, "maxReps")?;
        }
    }

    if let Some(baselines_value) = inputs.get("strengthBaselines") {
        let baselines = baselines_value.as_object().ok_or_else(|| {
            invalid_request(
                operation,
                "field `programAdaptationInputs.strengthBaselines` must be an object",
            )
        })?;
        reject_unknown_fields(
            operation,
            baselines,
            &["squat", "deadlift", "bench_press", "overhead_press"],
        )?;
        for (lift, baseline_value) in baselines {
            let baseline = baseline_value.as_object().ok_or_else(|| {
                invalid_request(
                    operation,
                    format!(
                        "field `programAdaptationInputs.strengthBaselines.{lift}` must be an object"
                    ),
                )
            })?;
            reject_unknown_fields(
                operation,
                baseline,
                &["estimatedOneRepMax", "unit", "source"],
            )?;
            let estimate = expect_number_field(operation, baseline, "estimatedOneRepMax")?;
            if estimate <= 0.0 {
                return Err(invalid_request(
                    operation,
                    format!(
                        "field `programAdaptationInputs.strengthBaselines.{lift}.estimatedOneRepMax` must be positive"
                    ),
                ));
            }
            let unit = expect_nonempty_string_field(operation, baseline, "unit")?;
            if !matches!(unit, "kg" | "lbs") {
                return Err(invalid_request(
                    operation,
                    format!(
                        "field `programAdaptationInputs.strengthBaselines.{lift}.unit` must be kg or lbs"
                    ),
                ));
            }
            if let Some(source) = baseline.get("source") {
                if source.as_str().filter(|value| !value.is_empty()).is_none() {
                    return Err(invalid_request(
                        operation,
                        format!(
                            "field `programAdaptationInputs.strengthBaselines.{lift}.source` must be a non-empty string"
                        ),
                    ));
                }
            }
        }
    }

    Ok(())
}

fn validate_initialize_cycle_request(
    operation: &Operation,
    reference_snapshot: &ReferenceSnapshot,
    value: &Value,
) -> Result<(), BoundaryError> {
    let request = expect_request_object(operation, value)?;
    reject_unknown_fields(
        operation,
        request,
        &[
            "profile",
            "macrocycleWeeks",
            "selectedPrograms",
            "programAdaptationInputs",
        ],
    )?;
    validate_program_adaptation_inputs(operation, request)?;

    let profile = expect_object_field(operation, request, "profile")?;
    reject_unknown_fields(
        operation,
        profile,
        &[
            "classChoice",
            "goalBias",
            "availableDaysPerWeek",
            "fatiguePreference",
            "injuryMuscleGroupSlugs",
        ],
    )?;
    let _ = expect_initialize_cycle_class_choice(operation, profile, "classChoice")?;
    let _ = expect_nonempty_string_field(operation, profile, "goalBias")?;
    let available_days = expect_i64_field(operation, profile, "availableDaysPerWeek")?;
    if !(1..=7).contains(&available_days) {
        return Err(invalid_request(
            operation,
            "field `profile.availableDaysPerWeek` must be in 1..=7",
        ));
    }
    let fatigue_preference = expect_nonempty_string_field(operation, profile, "fatiguePreference")?;
    if !matches!(fatigue_preference, "low" | "moderate" | "high") {
        return Err(invalid_request(
            operation,
            "field `profile.fatiguePreference` must be one of low, moderate, or high",
        ));
    }
    let injury_slugs = expect_array_field(operation, profile, "injuryMuscleGroupSlugs")?;
    for (index, slug) in injury_slugs.iter().enumerate() {
        if slug.as_str().filter(|value| !value.is_empty()).is_none() {
            return Err(invalid_request(
                operation,
                format!(
                    "field `profile.injuryMuscleGroupSlugs[{index}]` must be a non-empty string"
                ),
            ));
        }
    }

    let macrocycle_weeks = expect_i64_field(operation, request, "macrocycleWeeks")?;
    if !(1..=52).contains(&macrocycle_weeks) {
        return Err(invalid_request(
            operation,
            "field `macrocycleWeeks` must be in 1..=52",
        ));
    }

    let selected_programs = expect_array_field(operation, request, "selectedPrograms")?;
    if selected_programs.is_empty() {
        return Err(invalid_request(
            operation,
            "field `selectedPrograms` must include at least one program",
        ));
    }

    for (program_index, program) in selected_programs.iter().enumerate() {
        let program = program.as_object().ok_or_else(|| {
            invalid_request(
                operation,
                format!("field `selectedPrograms[{program_index}]` must be an object"),
            )
        })?;
        reject_unknown_fields(
            operation,
            program,
            &[
                "programId",
                "weight",
                "days",
                "templateKind",
                "adaptiveTemplate",
            ],
        )?;
        let program_id = expect_nonempty_string_field(operation, program, "programId")?;
        if !reference_snapshot
            .programs
            .iter()
            .any(|reference_program| reference_program.id == program_id)
        {
            return Err(invalid_request(
                operation,
                format!(
                    "field `selectedPrograms[{program_index}].programId` must exist in referenceSnapshot.programs"
                ),
            ));
        }
        let weight = expect_number_field(operation, program, "weight")?;
        validate_number_value_scale(
            operation,
            program.get("weight").expect("weight was already required"),
            NumericScale::Ratio4,
            "selectedPrograms.weight",
        )?;
        if !(0.0..=1.0).contains(&weight) || weight == 0.0 {
            return Err(invalid_request(
                operation,
                format!("field `selectedPrograms[{program_index}].weight` must be > 0 and <= 1"),
            ));
        }

        let template_kind = program
            .get("templateKind")
            .and_then(Value::as_str)
            .unwrap_or("slot_based");
        if !matches!(
            template_kind,
            "slot_based" | "challenge_progression" | "hypertrophy_engine_v1"
        ) {
            return Err(invalid_request(
                operation,
                format!(
                    "field `selectedPrograms[{program_index}].templateKind` must be slot_based, challenge_progression, or hypertrophy_engine_v1"
                ),
            ));
        }

        if template_kind != "slot_based" {
            if available_days != 3 {
                return Err(invalid_request(
                    operation,
                    format!(
                        "field `profile.availableDaysPerWeek` must be 3 for adaptive program `{program_id}`"
                    ),
                ));
            }
            let adaptive_template = expect_object_field(operation, program, "adaptiveTemplate")?;
            if template_kind == "challenge_progression" {
                let slug = challenge_template_exercise_slug(adaptive_template).ok_or_else(|| {
                    invalid_request(
                        operation,
                        format!(
                            "field `selectedPrograms[{program_index}].adaptiveTemplate.exercise.slug` is required"
                        ),
                    )
                })?;
                if adaptive_template
                    .get("initial_test_groups")
                    .and_then(Value::as_array)
                    .filter(|groups| !groups.is_empty())
                    .is_none()
                {
                    return Err(invalid_request(
                        operation,
                        format!(
                            "field `selectedPrograms[{program_index}].adaptiveTemplate.initial_test_groups` must include at least one group"
                        ),
                    ));
                }
                if adaptive_template
                    .get("groups")
                    .and_then(Value::as_object)
                    .filter(|groups| !groups.is_empty())
                    .is_none()
                {
                    return Err(invalid_request(
                        operation,
                        format!(
                            "field `selectedPrograms[{program_index}].adaptiveTemplate.groups` must be a non-empty object"
                        ),
                    ));
                }
                let baseline = request
                    .get("programAdaptationInputs")
                    .and_then(|inputs| inputs.get("challengeBaselines"))
                    .and_then(|baselines| baselines.get(slug))
                    .and_then(|baseline| baseline.get("maxReps"));
                if baseline.is_none() {
                    return Err(invalid_request(
                        operation,
                        format!("challenge baseline for `{slug}` is required"),
                    ));
                }
            } else if adaptive_template
                .get("sessions")
                .and_then(Value::as_array)
                .filter(|sessions| sessions.len() == 3)
                .is_none()
            {
                return Err(invalid_request(
                    operation,
                    format!(
                        "field `selectedPrograms[{program_index}].adaptiveTemplate.sessions` must include three sessions"
                    ),
                ));
            }

            continue;
        }

        let days = expect_array_field(operation, program, "days")?;
        if days.is_empty() {
            return Err(invalid_request(
                operation,
                format!(
                    "field `selectedPrograms[{program_index}].days` must include at least one day"
                ),
            ));
        }
        for (day_index, day) in days.iter().enumerate() {
            let day = day.as_object().ok_or_else(|| {
                invalid_request(
                    operation,
                    format!(
                        "field `selectedPrograms[{program_index}].days[{day_index}]` must be an object"
                    ),
                )
            })?;
            reject_unknown_fields(
                operation,
                day,
                &["programDayId", "dayIndex", "name", "slots"],
            )?;
            let _ = expect_nonempty_string_field(operation, day, "programDayId")?;
            let _ = expect_nonempty_string_field(operation, day, "name")?;
            let _ = expect_u32_i64_field(operation, day, "dayIndex")?;

            let slots = expect_array_field(operation, day, "slots")?;
            if slots.is_empty() {
                return Err(invalid_request(
                    operation,
                    format!(
                        "field `selectedPrograms[{program_index}].days[{day_index}].slots` must include at least one slot"
                    ),
                ));
            }

            for (slot_index, slot) in slots.iter().enumerate() {
                let slot = slot.as_object().ok_or_else(|| {
                    invalid_request(
                        operation,
                        format!(
                            "field `selectedPrograms[{program_index}].days[{day_index}].slots[{slot_index}]` must be an object"
                        ),
                    )
                })?;
                reject_unknown_fields(
                    operation,
                    slot,
                    &[
                        "slotId",
                        "slotIndex",
                        "slotType",
                        "movementPattern",
                        "lockedExerciseId",
                        "setsMin",
                        "setsMax",
                        "repsMin",
                        "repsMax",
                        "muscleTargets",
                        "tagsRequired",
                        "prescription",
                    ],
                )?;
                let _ = expect_nonempty_string_field(operation, slot, "slotId")?;
                let slot_type = expect_nonempty_string_field(operation, slot, "slotType")?;
                if !matches!(
                    slot_type,
                    "main" | "accessory" | "conditioning" | "warmup" | "cooldown"
                ) {
                    return Err(invalid_request(
                        operation,
                        format!(
                            "field `selectedPrograms[{program_index}].days[{day_index}].slots[{slot_index}].slotType` must be one of main, accessory, conditioning, warmup, or cooldown"
                        ),
                    ));
                }
                let _ = expect_u32_i64_field(operation, slot, "slotIndex")?;
                let sets_min = i64::from(expect_u32_i64_field(operation, slot, "setsMin")?);
                let sets_max = i64::from(expect_u32_i64_field(operation, slot, "setsMax")?);
                let reps_min = i64::from(expect_u32_i64_field(operation, slot, "repsMin")?);
                let reps_max = i64::from(expect_u32_i64_field(operation, slot, "repsMax")?);
                if sets_min <= 0 || sets_max <= 0 || reps_min <= 0 || reps_max <= 0 {
                    return Err(invalid_request(
                        operation,
                        format!(
                            "field `selectedPrograms[{program_index}].days[{day_index}].slots[{slot_index}]` set and rep bounds must be positive"
                        ),
                    ));
                }
                if sets_min > sets_max {
                    return Err(invalid_request(
                        operation,
                        format!(
                            "field `selectedPrograms[{program_index}].days[{day_index}].slots[{slot_index}]` requires `setsMin` <= `setsMax`"
                        ),
                    ));
                }
                if reps_min > reps_max {
                    return Err(invalid_request(
                        operation,
                        format!(
                            "field `selectedPrograms[{program_index}].days[{day_index}].slots[{slot_index}]` requires `repsMin` <= `repsMax`"
                        ),
                    ));
                }
                if let Some(pattern) = slot.get("movementPattern") {
                    if !pattern.is_null() && pattern.as_str().is_none() {
                        return Err(invalid_request(
                            operation,
                            format!(
                                "field `selectedPrograms[{program_index}].days[{day_index}].slots[{slot_index}].movementPattern` must be a string or null"
                            ),
                        ));
                    }
                }
                if let Some(locked_exercise_id) = slot.get("lockedExerciseId") {
                    if !locked_exercise_id.is_null() && locked_exercise_id.as_str().is_none() {
                        return Err(invalid_request(
                            operation,
                            format!(
                                "field `selectedPrograms[{program_index}].days[{day_index}].slots[{slot_index}].lockedExerciseId` must be a string or null"
                            ),
                        ));
                    }
                }
                if let Some(prescription) = slot.get("prescription") {
                    if !prescription.is_null() && prescription.as_object().is_none() {
                        return Err(invalid_request(
                            operation,
                            format!(
                                "field `selectedPrograms[{program_index}].days[{day_index}].slots[{slot_index}].prescription` must be an object or null"
                            ),
                        ));
                    }
                }
                let targets = expect_object_field(operation, slot, "muscleTargets")?;
                for value in targets.values() {
                    if value.as_f64().filter(|number| *number >= 0.0).is_none() {
                        return Err(invalid_request(
                            operation,
                            format!(
                                "field `selectedPrograms[{program_index}].days[{day_index}].slots[{slot_index}].muscleTargets` must contain non-negative numeric values"
                            ),
                        ));
                    }
                    validate_number_value_scale(
                        operation,
                        value,
                        NumericScale::Ratio4,
                        "muscleTargets",
                    )?;
                }
                let tags = expect_array_field(operation, slot, "tagsRequired")?;
                for (tag_index, tag) in tags.iter().enumerate() {
                    if tag.as_str().filter(|value| !value.is_empty()).is_none() {
                        return Err(invalid_request(
                            operation,
                            format!(
                                "field `selectedPrograms[{program_index}].days[{day_index}].slots[{slot_index}].tagsRequired[{tag_index}]` must be a non-empty string"
                            ),
                        ));
                    }
                }
            }
        }
    }

    Ok(())
}

fn validate_request(
    operation: &Operation,
    reference_snapshot: &ReferenceSnapshot,
    value: &Value,
) -> Result<(), BoundaryError> {
    match operation {
        Operation::InitializeCycle => {
            validate_initialize_cycle_request(operation, reference_snapshot, value)
        }
        Operation::PlanSession => validate_plan_session_request(operation, value),
        Operation::CompleteSession => validate_complete_session_request(operation, value),
        Operation::AdvanceCycle => validate_advance_cycle_request(operation, value),
    }
}

fn validate_advance_cycle_request(
    operation: &Operation,
    value: &Value,
) -> Result<(), BoundaryError> {
    let request = value.as_object().ok_or_else(|| {
        invalid_request(
            operation,
            "field `request` must be an object for advance_cycle",
        )
    })?;

    reject_unknown_fields(
        operation,
        request,
        &[
            "seasonIndex",
            "completionRate",
            "adherence",
            "completionQuality",
            "progression",
            "recovery",
            "consistency",
            "focus",
        ],
    )?;

    let season_index = request
        .get("seasonIndex")
        .and_then(Value::as_u64)
        .ok_or_else(|| invalid_request(operation, "field `seasonIndex` must be an integer >= 1"))?;
    if season_index == 0 {
        return Err(invalid_request(
            operation,
            "field `seasonIndex` must be >= 1",
        ));
    }

    let completion_rate = request
        .get("completionRate")
        .and_then(Value::as_f64)
        .ok_or_else(|| invalid_request(operation, "field `completionRate` must be a number"))?;
    if !(0.0..=1.0).contains(&completion_rate) {
        return Err(invalid_request(
            operation,
            "field `completionRate` must be within 0..=1",
        ));
    }

    if let Some(focus) = request.get("focus") {
        if !focus.is_string() {
            return Err(invalid_request(operation, "field `focus` must be a string"));
        }
    }

    for key in ["adherence", "progression", "recovery", "consistency"] {
        if let Some(value) = request.get(key) {
            if !value.is_number() {
                return Err(invalid_request(
                    operation,
                    format!("field `{key}` must be a number"),
                ));
            }
        }
    }

    if let Some(value) = request.get("completionQuality") {
        if !value.is_number() && !value.is_string() {
            return Err(invalid_request(
                operation,
                "field `completionQuality` must be a string or number",
            ));
        }
    }

    Ok(())
}

pub fn parse_input(input: &EngineInputV1) -> Result<TypedEngineInput, BoundaryError> {
    if input.schema_version != SCHEMA_VERSION {
        return Err(BoundaryError::SchemaVersionMismatch {
            expected: SCHEMA_VERSION,
            found: input.schema_version.clone(),
        });
    }

    validate_determinism(&input.determinism)?;
    let reference_snapshot = parse_reference_snapshot(&input.reference_snapshot)?;
    validate_reference_hash(&input.determinism, &reference_snapshot)?;
    validate_state_numeric_policy(&input.state_snapshot)?;
    validate_request(&input.operation, &reference_snapshot, &input.request)?;

    Ok(TypedEngineInput {
        schema_version: input.schema_version.clone(),
        operation: input.operation.clone(),
        determinism: input.determinism.clone(),
        reference_snapshot,
        state_snapshot: parse_state_snapshot(&input.state_snapshot)?,
        policy_snapshot: parse_policy_snapshot(&input.policy_snapshot)?,
        initialize_cycle_class_choice: parse_initialize_cycle_class_choice(
            &input.operation,
            &input.request,
        )?,
        request: input.request.clone(),
        metadata: input.metadata.clone(),
    })
}

pub fn parse_output(output: &EngineOutputV1) -> Result<TypedEngineOutput, BoundaryError> {
    if output.schema_version != SCHEMA_VERSION {
        return Err(BoundaryError::SchemaVersionMismatch {
            expected: SCHEMA_VERSION,
            found: output.schema_version.clone(),
        });
    }

    Ok(TypedEngineOutput {
        schema_version: output.schema_version.clone(),
        operation: output.operation.clone(),
        result: parse_result(&output.operation, &output.result)?,
        state_patch: StatePatch::from_value(&output.state_patch).map_err(|error| {
            BoundaryError::InvalidOutput {
                context: "statePatch",
                message: error.to_string(),
            }
        })?,
        events: output.events.clone(),
        decision_log: output
            .decision_log
            .iter()
            .map(|entry| {
                DecisionLogEntry::from_value(entry).map_err(|error| BoundaryError::InvalidOutput {
                    context: "decisionLog",
                    message: error.to_string(),
                })
            })
            .collect::<Result<Vec<_>, _>>()?,
        replay_receipt: output.replay_receipt.clone(),
    })
}

pub fn to_public_input(input: &TypedEngineInput) -> Result<EngineInputV1, BoundaryError> {
    if input.schema_version != SCHEMA_VERSION {
        return Err(BoundaryError::SchemaVersionMismatch {
            expected: SCHEMA_VERSION,
            found: input.schema_version.clone(),
        });
    }

    Ok(EngineInputV1 {
        schema_version: input.schema_version.clone(),
        operation: input.operation.clone(),
        determinism: input.determinism.clone(),
        reference_snapshot: input.reference_snapshot.to_value().map_err(|error| {
            BoundaryError::InvalidSnapshot {
                context: "reference",
                message: error.to_string(),
            }
        })?,
        state_snapshot: input.state_snapshot.to_value().map_err(|error| {
            BoundaryError::InvalidSnapshot {
                context: "state",
                message: error.to_string(),
            }
        })?,
        policy_snapshot: input.policy_snapshot.to_value().map_err(|error| {
            BoundaryError::InvalidSnapshot {
                context: "policy",
                message: error.to_string(),
            }
        })?,
        request: input.request.clone(),
        metadata: input.metadata.clone(),
    })
}

pub fn to_public_output(output: &TypedEngineOutput) -> Result<EngineOutputV1, BoundaryError> {
    if output.schema_version != SCHEMA_VERSION {
        return Err(BoundaryError::SchemaVersionMismatch {
            expected: SCHEMA_VERSION,
            found: output.schema_version.clone(),
        });
    }

    Ok(EngineOutputV1 {
        schema_version: output.schema_version.clone(),
        operation: output.operation.clone(),
        result: to_result_value(&output.result)?,
        state_patch: output.state_patch.to_value().map_err(|error| {
            BoundaryError::InvalidOutput {
                context: "statePatch",
                message: error.to_string(),
            }
        })?,
        events: output.events.clone(),
        decision_log: output
            .decision_log
            .iter()
            .map(|entry| {
                entry
                    .to_value()
                    .map_err(|error| BoundaryError::InvalidOutput {
                        context: "decisionLog",
                        message: error.to_string(),
                    })
            })
            .collect::<Result<Vec<_>, _>>()?,
        replay_receipt: output.replay_receipt.clone(),
    })
}

fn parse_result(operation: &Operation, value: &Value) -> Result<TypedEngineResult, BoundaryError> {
    if value.get("status").and_then(Value::as_str) == Some("deterministic_rejection") {
        return DeterministicRejection::from_value(value)
            .map(TypedEngineResult::DeterministicRejection)
            .map_err(|error| BoundaryError::InvalidOutput {
                context: "result",
                message: error.to_string(),
            });
    }

    match operation {
        Operation::InitializeCycle => InitializeCycleResult::from_value(value)
            .map_err(|error| BoundaryError::InvalidOutput {
                context: "result",
                message: error.to_string(),
            })
            .and_then(|result| {
                if result
                    .macrocycle
                    .sessions
                    .iter()
                    .any(|session| session.class_archetype != result.resolved_class_archetype)
                {
                    return Err(BoundaryError::InvalidOutput {
                        context: "result",
                        message:
                            "initialize_cycle result sessions must match resolvedClassArchetype"
                                .to_string(),
                    });
                }

                Ok(TypedEngineResult::InitializeCycle(result))
            }),
        Operation::PlanSession => PlanSessionResult::from_value(value)
            .map(TypedEngineResult::PlanSession)
            .map_err(|error| BoundaryError::InvalidOutput {
                context: "result",
                message: error.to_string(),
            }),
        Operation::CompleteSession => CompleteSessionResult::from_value(value)
            .map(TypedEngineResult::CompleteSession)
            .map_err(|error| BoundaryError::InvalidOutput {
                context: "result",
                message: error.to_string(),
            }),
        Operation::AdvanceCycle => AdvanceCycleResult::from_value(value)
            .map(TypedEngineResult::AdvanceCycle)
            .map_err(|error| BoundaryError::InvalidOutput {
                context: "result",
                message: error.to_string(),
            }),
    }
}

fn to_result_value(result: &TypedEngineResult) -> Result<Value, BoundaryError> {
    match result {
        TypedEngineResult::InitializeCycle(result) => {
            result
                .to_value()
                .map_err(|error| BoundaryError::InvalidOutput {
                    context: "result",
                    message: error.to_string(),
                })
        }
        TypedEngineResult::PlanSession(result) => {
            result
                .to_value()
                .map_err(|error| BoundaryError::InvalidOutput {
                    context: "result",
                    message: error.to_string(),
                })
        }
        TypedEngineResult::CompleteSession(result) => {
            result
                .to_value()
                .map_err(|error| BoundaryError::InvalidOutput {
                    context: "result",
                    message: error.to_string(),
                })
        }
        TypedEngineResult::AdvanceCycle(result) => {
            result
                .to_value()
                .map_err(|error| BoundaryError::InvalidOutput {
                    context: "result",
                    message: error.to_string(),
                })
        }
        TypedEngineResult::DeterministicRejection(result) => {
            result
                .to_value()
                .map_err(|error| BoundaryError::InvalidOutput {
                    context: "result",
                    message: error.to_string(),
                })
        }
    }
}

pub fn parse_result_value(
    operation: &Operation,
    value: &Value,
) -> Result<TypedEngineResult, BoundaryError> {
    parse_result(operation, value)
}

impl TypedEngineInput {
    pub fn from_public(input: &EngineInputV1) -> Result<Self, BoundaryError> {
        parse_input(input)
    }

    pub fn to_public(&self) -> Result<EngineInputV1, BoundaryError> {
        to_public_input(self)
    }
}

impl TypedEngineOutput {
    pub fn from_public(output: &EngineOutputV1) -> Result<Self, BoundaryError> {
        parse_output(output)
    }

    pub fn to_public(&self) -> Result<EngineOutputV1, BoundaryError> {
        to_public_output(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{
        DecisionInputRef, DecisionStepType, DeterministicRejectionCode,
        DeterministicRejectionStatus, ProgressionAction, ProgressionActionSummary,
        ProgressionTrend, ScoreBreakdown,
    };
    use serde_json::json;

    fn reference_snapshot_value() -> Value {
        json!({
            "referenceVersion": "2026-02",
            "exercises": [
                {
                    "id": "bench-press",
                    "slug": "bench-press",
                    "name": "Bench Press",
                    "movementPattern": "push",
                    "equipment": ["barbell", "bench"],
                    "tags": ["compound"]
                }
            ],
            "programs": [
                {
                    "id": "program-upper-1",
                    "slug": "upper-strength",
                    "name": "Upper Strength",
                    "daysPerWeek": 3
                }
            ]
        })
    }

    fn state_snapshot_value() -> Value {
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
                    "chest": 20
                }
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
                "records": [
                    {
                        "exerciseId": "bench-press",
                        "previousPerformanceReference": {
                            "weight": 100,
                            "reps": 5
                        },
                        "trend": "improving",
                        "currentAction": "maintain",
                        "consecutiveSuccessfulCompletions": 1,
                        "consecutiveStallOrRegressionCount": 0,
                        "swapRecommendationCount": 0,
                        "lastSessionOutcomeClassification": "complete_clean",
                        "lastCompletedAt": "2026-02-10T10:00:00.000Z"
                    }
                ]
            },
            "gamificationState": {
                "xp": 140,
                "level": 3,
                "adherenceStreak": 6,
                "completedSessionCount": 12,
                "missedSessionCount": 0,
                "lastAdherenceOutcomeClassification": "complete_clean",
                "lastAwardedAt": "2026-02-10T10:00:00.000Z"
            },
            "activeProgramState": {
                "programId": "program-upper-1",
                "currentDayIndex": 1,
                "currentMicrocycle": 2
            },
            "recentCompletions": []
        })
    }

    fn policy_snapshot_value() -> Value {
        json!({
            "noveltyBudget": 1,
            "classArchetypeBias": 0.1,
            "fatigueBlockThreshold": "severe",
            "seededTieBreakBand": 0.05
        })
    }

    fn valid_input(schema_version: &str, operation: Operation) -> EngineInputV1 {
        EngineInputV1 {
            schema_version: schema_version.to_string(),
            operation,
            determinism: Determinism {
                seed: "seed-boundary-test".to_string(),
                effective_at: "2026-02-13T10:00:00.000Z".to_string(),
                rule_version: "rules-2026-02".to_string(),
                reference_hash:
                    "sha256:212d2dd9712941ef2db5156f126cf2a54049916ea0b309c8c2fd80e8eec6ac3c"
                        .to_string(),
                canonicalization_version: "canon-replay-v1".to_string(),
            },
            reference_snapshot: reference_snapshot_value(),
            state_snapshot: state_snapshot_value(),
            policy_snapshot: policy_snapshot_value(),
            request: json!({
                "programId": "program-upper-1",
                "sessionFocus": "upper_push",
                "microcycleIndex": 2
            }),
            metadata: json!({
                "correlationId": "trace-boundary-test"
            }),
        }
    }

    fn valid_output(schema_version: &str, operation: Operation) -> EngineOutputV1 {
        EngineOutputV1 {
            schema_version: schema_version.to_string(),
            operation,
            result: json!({
                "recommendedSessionId": "session-plan-boundary-test",
                "recommendedMovementFamily": "upper_push",
                "selectedExerciseIds": ["bench-press"],
                "sessionRationale": "Boundary test payload.",
                "progressionActionSummary": [
                    {
                        "exerciseId": "bench-press",
                        "action": "maintain",
                        "trend": "improving"
                    }
                ],
                "scoreBreakdown": {
                    "progressionNeed": 0.8,
                    "fatigueCompatibility": 0.9,
                    "classBias": 0.1,
                    "novelty": 0.2
                }
            }),
            state_patch: json!({}),
            events: vec![],
            decision_log: vec![json!({
                "stepType": "filter",
                "ruleId": "boundary_test",
                "inputsUsed": [{"path": "stateSnapshot.readinessState"}],
                "outcome": "pass"
            })],
            replay_receipt: ReplayReceipt {
                input_hash: "sha256:input-boundary-test".to_string(),
                output_hash: "sha256:output-boundary-test".to_string(),
                seed_used: "seed-boundary-test".to_string(),
                effective_at: "2026-02-13T10:00:00.000Z".to_string(),
                implementation_version: "engine-rs-test".to_string(),
                policy_version: "policy-test".to_string(),
                reference_hash:
                    "sha256:212d2dd9712941ef2db5156f126cf2a54049916ea0b309c8c2fd80e8eec6ac3c"
                        .to_string(),
            },
        }
    }

    #[test]
    fn parse_input_rejects_schema_version_mismatch() {
        let input = valid_input("engine.v0", Operation::PlanSession);

        let error = parse_input(&input).expect_err("schema mismatch should fail");

        assert_eq!(
            error,
            BoundaryError::SchemaVersionMismatch {
                expected: SCHEMA_VERSION,
                found: "engine.v0".to_string()
            }
        );
    }

    #[test]
    fn to_public_input_rejects_schema_version_mismatch() {
        let input = TypedEngineInput {
            schema_version: "engine.v0".to_string(),
            operation: Operation::PlanSession,
            determinism: Determinism {
                seed: "seed-boundary-test".to_string(),
                effective_at: "2026-02-13T10:00:00.000Z".to_string(),
                rule_version: "rules-2026-02".to_string(),
                reference_hash:
                    "sha256:212d2dd9712941ef2db5156f126cf2a54049916ea0b309c8c2fd80e8eec6ac3c"
                        .to_string(),
                canonicalization_version: "canon-replay-v1".to_string(),
            },
            reference_snapshot: ReferenceSnapshot::from_value(&reference_snapshot_value())
                .expect("reference snapshot should deserialize"),
            state_snapshot: AthleteStateSnapshot::from_value(&state_snapshot_value())
                .expect("state snapshot should deserialize"),
            policy_snapshot: PolicySnapshot::from_value(&policy_snapshot_value())
                .expect("policy snapshot should deserialize"),
            initialize_cycle_class_choice: None,
            request: json!({
                "programId": "program-upper-1",
                "sessionFocus": "upper_push",
                "microcycleIndex": 2
            }),
            metadata: json!({"correlationId": "trace-boundary-test"}),
        };

        let error = to_public_input(&input).expect_err("schema mismatch should fail");

        assert_eq!(
            error,
            BoundaryError::SchemaVersionMismatch {
                expected: SCHEMA_VERSION,
                found: "engine.v0".to_string()
            }
        );
    }

    #[test]
    fn parse_output_rejects_schema_version_mismatch() {
        let output = valid_output("engine.v0", Operation::PlanSession);

        let error = parse_output(&output).expect_err("schema mismatch should fail");

        assert_eq!(
            error,
            BoundaryError::SchemaVersionMismatch {
                expected: SCHEMA_VERSION,
                found: "engine.v0".to_string()
            }
        );
    }

    #[test]
    fn to_public_output_rejects_schema_version_mismatch() {
        let output = TypedEngineOutput {
            schema_version: "engine.v0".to_string(),
            operation: Operation::PlanSession,
            result: TypedEngineResult::PlanSession(plan_session_result()),
            state_patch: StatePatch::default(),
            events: vec![],
            decision_log: vec![],
            replay_receipt: ReplayReceipt {
                input_hash: "sha256:input-boundary-test".to_string(),
                output_hash: "sha256:output-boundary-test".to_string(),
                seed_used: "seed-boundary-test".to_string(),
                effective_at: "2026-02-13T10:00:00.000Z".to_string(),
                implementation_version: "engine-rs-test".to_string(),
                policy_version: "policy-test".to_string(),
                reference_hash:
                    "sha256:212d2dd9712941ef2db5156f126cf2a54049916ea0b309c8c2fd80e8eec6ac3c"
                        .to_string(),
            },
        };

        let error = to_public_output(&output).expect_err("schema mismatch should fail");

        assert_eq!(
            error,
            BoundaryError::SchemaVersionMismatch {
                expected: SCHEMA_VERSION,
                found: "engine.v0".to_string()
            }
        );
    }

    #[test]
    fn invalid_state_snapshot_reports_state_context() {
        let value = json!({
            "athleteProfile": {
                "height": 178,
                "weight": 82.5,
                "trainingAge": 3,
                "goalBias": "strength",
                "availableDaysPerWeek": 3,
                "classArchetype": "hybrid"
            }
        });

        let error = parse_state_snapshot(&value).expect_err("missing fields should fail");

        assert!(matches!(
            error,
            BoundaryError::InvalidSnapshot {
                context: "state",
                ..
            }
        ));
    }

    #[test]
    fn invalid_output_decision_log_reports_decision_log_context() {
        let mut output = valid_output(SCHEMA_VERSION, Operation::PlanSession);
        output.decision_log = vec![json!({
            "ruleId": "boundary_test",
            "inputsUsed": [{"path": "stateSnapshot.readinessState"}],
            "outcome": "pass"
        })];

        let error = parse_output(&output).expect_err("invalid decision log should fail");

        assert!(matches!(
            error,
            BoundaryError::InvalidOutput {
                context: "decisionLog",
                ..
            }
        ));
    }

    #[test]
    fn parse_input_caches_initialize_cycle_canonical_class_choice() {
        let mut input = valid_input(SCHEMA_VERSION, Operation::InitializeCycle);
        input.request = json!({
            "profile": {
                "classChoice": "strength",
                "goalBias": "strength",
                "availableDaysPerWeek": 3,
                "fatiguePreference": "moderate",
                "injuryMuscleGroupSlugs": []
            },
            "macrocycleWeeks": 4,
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
        });

        let typed = parse_input(&input).expect("initialize_cycle input should parse");

        assert_eq!(
            typed.initialize_cycle_class_choice,
            Some(CanonicalClassArchetype::Strength)
        );
    }

    #[test]
    fn initialize_cycle_result_rejects_legacy_class_archetype_in_output_boundary() {
        let value = json!({
            "resolvedClassArchetype": "powerlifter",
            "primaryProgramId": "program-upper-1",
            "programBlend": [
                {
                    "programId": "program-upper-1",
                    "weight": 1.0,
                    "role": "primary"
                }
            ],
            "macrocycle": {
                "totalWeeks": 4,
                "mesocycleCount": 1,
                "currentMesocycleIndex": 0,
                "currentMicrocycleIndex": 0,
                "currentSessionIndex": 0,
                "sessions": [
                    {
                        "sessionId": "session-1",
                        "programId": "program-upper-1",
                        "programDayId": "day-strength-1",
                        "programDayName": "Strength Day 1",
                        "macroWeek": 1,
                        "mesocycleIndex": 0,
                        "microcycleIndex": 0,
                        "sessionIndex": 0,
                        "plannedDayOfWeek": 0,
                        "classArchetype": "powerlifter",
                        "slotPayload": []
                    }
                ]
            },
            "initialGamificationState": {
                "xp": 140,
                "level": 3,
                "adherenceStreak": 6,
                "completedSessionCount": 12,
                "missedSessionCount": 0,
                "lastAdherenceOutcomeClassification": "complete_clean",
                "lastAwardedAt": "2026-02-10T10:00:00.000Z"
            }
        });

        let error = parse_result_value(&Operation::InitializeCycle, &value)
            .expect_err("legacy initialize_cycle output should fail");

        assert!(matches!(
            error,
            BoundaryError::InvalidOutput {
                context: "result",
                ..
            }
        ));
    }

    #[test]
    fn initialize_cycle_result_rejects_session_archetype_mismatch_in_output_boundary() {
        let value = json!({
            "resolvedClassArchetype": "hybrid",
            "primaryProgramId": "program-upper-1",
            "programBlend": [
                {
                    "programId": "program-upper-1",
                    "weight": 1.0,
                    "role": "primary"
                }
            ],
            "macrocycle": {
                "totalWeeks": 4,
                "mesocycleCount": 1,
                "currentMesocycleIndex": 0,
                "currentMicrocycleIndex": 0,
                "currentSessionIndex": 0,
                "sessions": [
                    {
                        "sessionId": "session-1",
                        "programId": "program-upper-1",
                        "programDayId": "day-strength-1",
                        "programDayName": "Strength Day 1",
                        "macroWeek": 1,
                        "mesocycleIndex": 0,
                        "microcycleIndex": 0,
                        "sessionIndex": 0,
                        "plannedDayOfWeek": 0,
                        "classArchetype": "strength",
                        "slotPayload": []
                    }
                ]
            },
            "initialGamificationState": {
                "xp": 140,
                "level": 3,
                "adherenceStreak": 6,
                "completedSessionCount": 12,
                "missedSessionCount": 0,
                "lastAdherenceOutcomeClassification": "complete_clean",
                "lastAwardedAt": "2026-02-10T10:00:00.000Z"
            }
        });

        let error = parse_result_value(&Operation::InitializeCycle, &value)
            .expect_err("mismatched initialize_cycle output should fail");

        assert!(matches!(
            error,
            BoundaryError::InvalidOutput {
                context: "result",
                ..
            }
        ));
    }

    #[test]
    fn deterministic_rejection_result_parses_as_a_typed_rejection() {
        let output = valid_output(SCHEMA_VERSION, Operation::PlanSession);
        let value = json!({
            "status": "deterministic_rejection",
            "rejectionCode": "injury_blocked",
            "blockedCandidateIds": ["bench-press", "row"]
        });
        let result =
            parse_result_value(&output.operation, &value).expect("rejection should parse cleanly");

        assert_eq!(
            result,
            TypedEngineResult::DeterministicRejection(DeterministicRejection {
                status: DeterministicRejectionStatus::DeterministicRejection,
                rejection_code: DeterministicRejectionCode::InjuryBlocked,
                blocked_candidate_ids: vec!["bench-press".to_string(), "row".to_string(),],
            })
        );
    }

    #[test]
    fn policy_snapshot_rejects_unknown_fields() {
        let value = json!({
            "noveltyBudget": 1,
            "classArchetypeBias": 0.1,
            "fatigueBlockThreshold": "severe",
            "seededTieBreakBand": 0.05,
            "transportOnlyField": true
        });

        let error = parse_policy_snapshot(&value).expect_err("unknown field should fail");

        assert!(matches!(
            error,
            BoundaryError::InvalidSnapshot {
                context: "policy",
                ..
            }
        ));
        assert!(error.to_string().contains("unknown field"));
    }

    #[test]
    fn typed_input_round_trips_through_public_envelope() {
        let input = TypedEngineInput {
            schema_version: SCHEMA_VERSION.to_string(),
            operation: Operation::PlanSession,
            determinism: Determinism {
                seed: "seed-boundary-test".to_string(),
                effective_at: "2026-02-13T10:00:00.000Z".to_string(),
                rule_version: "rules-2026-02".to_string(),
                reference_hash:
                    "sha256:212d2dd9712941ef2db5156f126cf2a54049916ea0b309c8c2fd80e8eec6ac3c"
                        .to_string(),
                canonicalization_version: "canon-replay-v1".to_string(),
            },
            reference_snapshot: ReferenceSnapshot::from_value(&reference_snapshot_value())
                .expect("reference snapshot should deserialize"),
            state_snapshot: AthleteStateSnapshot::from_value(&state_snapshot_value())
                .expect("state snapshot should deserialize"),
            policy_snapshot: PolicySnapshot::from_value(&policy_snapshot_value())
                .expect("policy snapshot should deserialize"),
            initialize_cycle_class_choice: None,
            request: json!({
                "programId": "program-upper-1",
                "sessionFocus": "upper_push",
                "microcycleIndex": 2
            }),
            metadata: json!({
                "correlationId": "trace-boundary-test"
            }),
        };

        let public = input.to_public().expect("typed input should serialize");
        let round_trip = TypedEngineInput::from_public(&public).expect("public input should parse");

        assert_eq!(round_trip, input);
    }

    #[test]
    fn typed_output_round_trips_through_public_envelope() {
        let output = TypedEngineOutput {
            schema_version: SCHEMA_VERSION.to_string(),
            operation: Operation::PlanSession,
            result: TypedEngineResult::PlanSession(plan_session_result()),
            state_patch: StatePatch::default(),
            events: vec![json!({"kind": "note", "message": "boundary test"})],
            decision_log: vec![DecisionLogEntry {
                step_type: DecisionStepType::Filter,
                rule_id: "boundary_test".to_string(),
                inputs_used: vec![DecisionInputRef {
                    path: "stateSnapshot.readinessState".to_string(),
                    stable_id: None,
                }],
                candidate_id: None,
                computed_value: None,
                outcome: "pass".to_string(),
                details: None,
            }],
            replay_receipt: ReplayReceipt {
                input_hash: "sha256:input-boundary-test".to_string(),
                output_hash: "sha256:output-boundary-test".to_string(),
                seed_used: "seed-boundary-test".to_string(),
                effective_at: "2026-02-13T10:00:00.000Z".to_string(),
                implementation_version: "engine-rs-test".to_string(),
                policy_version: "policy-test".to_string(),
                reference_hash:
                    "sha256:212d2dd9712941ef2db5156f126cf2a54049916ea0b309c8c2fd80e8eec6ac3c"
                        .to_string(),
            },
        };

        let public = output.to_public().expect("typed output should serialize");
        let round_trip =
            TypedEngineOutput::from_public(&public).expect("public output should parse");

        assert_eq!(round_trip, output);
    }

    fn plan_session_result() -> PlanSessionResult {
        PlanSessionResult {
            recommended_session_id: "session-plan-boundary-test".to_string(),
            recommended_movement_family: "upper_push".to_string(),
            selected_exercise_ids: vec!["bench-press".to_string()],
            session_rationale: "Boundary test payload.".to_string(),
            progression_action_summary: vec![ProgressionActionSummary {
                exercise_id: "bench-press".to_string(),
                action: ProgressionAction::Maintain,
                trend: ProgressionTrend::Improving,
            }],
            score_breakdown: ScoreBreakdown {
                progression_need: serde_json::Number::from_f64(0.8).expect("finite number"),
                fatigue_compatibility: serde_json::Number::from_f64(0.9).expect("finite number"),
                class_bias: serde_json::Number::from_f64(0.1).expect("finite number"),
                novelty: serde_json::Number::from_f64(0.2).expect("finite number"),
            },
        }
    }
}
