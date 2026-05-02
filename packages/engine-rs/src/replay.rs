use crate::rng::sha256_hex;
use serde_json::{Map, Number, Value};

pub const CANONICALIZATION_VERSION: &str = "canon-replay-v1";
pub const LEGACY_CANONICALIZATION_VERSION: &str = "canon-v1";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NumericScale {
    KgCent,
    Ratio4,
    Score2,
}

impl NumericScale {
    fn factor(self) -> i64 {
        match self {
            Self::KgCent | Self::Score2 => 100,
            Self::Ratio4 => 10_000,
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::KgCent => "kg-cent",
            Self::Ratio4 => "ratio-4",
            Self::Score2 => "score-2",
        }
    }
}

pub fn accepted_canonicalization_version(version: &str) -> bool {
    matches!(
        version,
        CANONICALIZATION_VERSION | LEGACY_CANONICALIZATION_VERSION
    )
}

pub fn canonical_policy_version() -> &'static str {
    CANONICALIZATION_VERSION
}

pub fn quantize_f64(value: f64, scale: NumericScale) -> f64 {
    let factor = scale.factor() as f64;
    let scaled = value * factor;
    let rounded = if scaled.is_sign_negative() {
        (scaled - 0.5).ceil()
    } else {
        (scaled + 0.5).floor()
    };
    let quantized = rounded / factor;
    if quantized == 0.0 {
        0.0
    } else {
        quantized
    }
}

pub fn number_from_scaled_f64(value: f64, scale: NumericScale) -> Number {
    Number::from_f64(quantize_f64(value, scale)).expect("quantized number must be finite")
}

pub fn validate_number_scale(
    number: &Number,
    scale: NumericScale,
    path: &str,
) -> Result<(), String> {
    let value = number
        .as_f64()
        .ok_or_else(|| format!("field `{path}` must be a finite {}", scale.label()))?;
    if !value.is_finite() || value == 0.0 && value.is_sign_negative() {
        return Err(format!("field `{path}` must be a finite {}", scale.label()));
    }
    let scaled = value * scale.factor() as f64;
    if (scaled - scaled.round()).abs() > 1e-9 {
        return Err(format!(
            "field `{path}` must fit {} fixed-point scale",
            scale.label()
        ));
    }
    Ok(())
}

pub fn hash_value(value: &Value) -> Result<String, String> {
    canonical_json_bytes(value).map(|bytes| format!("sha256:{}", sha256_hex(&bytes)))
}

pub fn canonical_json_bytes(value: &Value) -> Result<String, String> {
    let mut output = String::new();
    write_canonical_json(value, &mut output)?;
    Ok(output)
}

fn write_canonical_json(value: &Value, output: &mut String) -> Result<(), String> {
    match value {
        Value::Null => output.push_str("null"),
        Value::Bool(true) => output.push_str("true"),
        Value::Bool(false) => output.push_str("false"),
        Value::String(text) => output.push_str(
            &serde_json::to_string(text)
                .map_err(|error| format!("string serialization failed: {error}"))?,
        ),
        Value::Number(number) => write_number(number, output)?,
        Value::Array(items) => {
            output.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                write_canonical_json(item, output)?;
            }
            output.push(']');
        }
        Value::Object(entries) => write_object(entries, output)?,
    }
    Ok(())
}

fn write_object(entries: &Map<String, Value>, output: &mut String) -> Result<(), String> {
    let mut keys = entries.keys().collect::<Vec<_>>();
    keys.sort_by(|left, right| left.as_bytes().cmp(right.as_bytes()));

    output.push('{');
    for (index, key) in keys.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }
        output.push_str(
            &serde_json::to_string(key)
                .map_err(|error| format!("object key serialization failed: {error}"))?,
        );
        output.push(':');
        write_canonical_json(
            entries
                .get(*key)
                .expect("canonical object key should resolve to a value"),
            output,
        )?;
    }
    output.push('}');
    Ok(())
}

fn write_number(number: &Number, output: &mut String) -> Result<(), String> {
    let text = number.to_string();
    if text.contains('e') || text.contains('E') || text == "-0" {
        return Err(format!("number `{text}` is not canonical replay material"));
    }
    output.push_str(&text);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn canonical_json_sorts_object_keys_and_preserves_array_order() {
        let value = json!({
            "z": [3, 2, 1],
            "a": {
                "b": true,
                "a": null
            }
        });

        assert_eq!(
            canonical_json_bytes(&value).expect("canonical bytes"),
            r#"{"a":{"a":null,"b":true},"z":[3,2,1]}"#
        );
    }

    #[test]
    fn quantize_f64_rounds_half_away_from_zero_at_scale() {
        assert_eq!(quantize_f64(0.805, NumericScale::Score2), 0.81);
        assert_eq!(quantize_f64(82.555, NumericScale::KgCent), 82.56);
        assert_eq!(quantize_f64(0.12345, NumericScale::Ratio4), 0.1235);
    }

    #[test]
    fn validate_number_scale_rejects_excess_precision() {
        let value = Number::from_f64(100.001).expect("finite");

        let error = validate_number_scale(&value, NumericScale::KgCent, "weight")
            .expect_err("excess precision should fail");

        assert!(error.contains("kg-cent"));
    }

    #[test]
    fn hash_value_emits_sha256_prefixed_lowercase_hex() {
        let hash = hash_value(&json!({"b": 2, "a": 1})).expect("hash");
        let digest = hash.strip_prefix("sha256:").expect("sha256 prefix");

        assert_eq!(digest.len(), 64);
        assert!(digest
            .chars()
            .all(|character| character.is_ascii_hexdigit() && !character.is_ascii_uppercase()));
    }
}
