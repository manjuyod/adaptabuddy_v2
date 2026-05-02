use sha2::{Digest, Sha256};

pub fn fnv1a64(input: &str) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in input.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

pub fn fnv1a64_hex(input: &str) -> String {
    format!("{:016x}", fnv1a64(input))
}

pub fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn derive_subseed(seed: &str, scope: &str, cycle_index: i64, subject: &str) -> String {
    let material = format!("{seed}|{scope}|{cycle_index}|{subject}");
    format!(
        "{seed}:{scope}:{cycle_index}:{subject}:{}",
        fnv1a64_hex(&material)
    )
}

pub fn seeded_fraction(seed: &str, scope: &str, cycle_index: i64, subject: &str) -> f64 {
    let material = derive_subseed(seed, scope, cycle_index, subject);
    let value = fnv1a64(&material);
    (value as f64) / (u64::MAX as f64)
}

pub fn seeded_index(seed: &str, scope: &str, cycle_index: i64, subject: &str, len: usize) -> usize {
    if len == 0 {
        return 0;
    }
    let material = derive_subseed(seed, scope, cycle_index, subject);
    (fnv1a64(&material) as usize) % len
}

pub fn seeded_order<T: Clone>(
    seed: &str,
    scope: &str,
    cycle_index: i64,
    subject: &str,
    values: &[T],
) -> Vec<T> {
    if values.is_empty() {
        return Vec::new();
    }

    let mut indexed = values
        .iter()
        .cloned()
        .enumerate()
        .map(|(index, value)| {
            let material = format!("{seed}|{scope}|{cycle_index}|{subject}|{index}");
            (fnv1a64(&material), index, value)
        })
        .collect::<Vec<_>>();

    indexed.sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)));

    indexed.into_iter().map(|(_, _, value)| value).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fnv_hash_hex_is_stable_and_lowercase() {
        assert_eq!(fnv1a64(""), 0xcbf29ce484222325);
        assert_eq!(fnv1a64_hex(""), "cbf29ce484222325");
        assert_eq!(fnv1a64_hex("hello"), "a430d84680aabd0b");
    }

    #[test]
    fn sha256_hash_hex_is_stable_and_lowercase() {
        assert_eq!(
            sha256_hex("hello"),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[test]
    fn derive_subseed_is_deterministic_and_includes_inputs() {
        let seed = "seed-123";
        let scope = "scope-a";
        let cycle_index = 17;
        let subject = "candidate-9";

        let first = derive_subseed(seed, scope, cycle_index, subject);
        let second = derive_subseed(seed, scope, cycle_index, subject);

        assert_eq!(first, second);
        assert!(first.starts_with("seed-123:scope-a:17:candidate-9:"));
        assert_eq!(
            first,
            format!(
                "{seed}:{scope}:{cycle_index}:{subject}:{}",
                fnv1a64_hex(&format!("{seed}|{scope}|{cycle_index}|{subject}"))
            )
        );
    }

    #[test]
    fn seeded_fraction_is_deterministic_and_bounded() {
        let first = seeded_fraction("seed-123", "scope-a", 17, "candidate-9");
        let second = seeded_fraction("seed-123", "scope-a", 17, "candidate-9");

        assert_eq!(first, second);
        assert!((0.0..=1.0).contains(&first));
    }

    #[test]
    fn seeded_index_handles_empty_and_is_bounded() {
        assert_eq!(seeded_index("seed-123", "scope-a", 17, "candidate-9", 0), 0);

        let first = seeded_index("seed-123", "scope-a", 17, "candidate-9", 5);
        let second = seeded_index("seed-123", "scope-a", 17, "candidate-9", 5);

        assert_eq!(first, second);
        assert!(first < 5);
    }

    #[test]
    fn seeded_order_is_deterministic_and_preserves_values() {
        let values = vec![4, 1, 3, 2, 1];
        let first = seeded_order("seed-123", "scope-a", 17, "candidate-9", &values);
        let second = seeded_order("seed-123", "scope-a", 17, "candidate-9", &values);

        assert_eq!(first, second);

        let mut original = values.clone();
        let mut ordered = first.clone();
        original.sort();
        ordered.sort();
        assert_eq!(original, ordered);
    }

    #[test]
    fn seeded_order_is_stable_for_identical_input() {
        let values = vec!["a", "b", "c", "d"];
        let first = seeded_order("seed-123", "scope-a", 17, "candidate-9", &values);
        let second = seeded_order("seed-123", "scope-a", 17, "candidate-9", &values);

        assert_eq!(first, second);
    }
}
