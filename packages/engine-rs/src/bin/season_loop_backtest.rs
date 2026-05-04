use engine_rs::{advance_cycle, fixtures, initialize_cycle};
use serde_json::json;

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let cycles: usize = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "1".to_string())
        .parse()
        .map_err(|e| format!("invalid cycle count: {e}"))?;

    let scenarios = [
        ("S", fixtures::advance_cycle_s_rank_input()),
        ("A", fixtures::advance_cycle_a_rank_input()),
        ("B", fixtures::advance_cycle_b_rank_input()),
        ("C", fixtures::advance_cycle_c_rank_input()),
        ("D", fixtures::advance_cycle_d_rank_input()),
    ];
    let scenario_count = scenarios.len();

    let mut archetypes = Vec::new();
    let mut invariant_failures = Vec::new();

    for (label, input) in scenarios.into_iter().take(cycles.min(scenario_count)) {
        let output = advance_cycle(&input).map_err(|error| error.to_string())?;
        let next_cycle_request = output.result["nextCycleRequest"].clone();

        let mut initialize_input = fixtures::initialize_cycle_baseline_input();
        initialize_input.request = next_cycle_request.clone();
        if let Err(error) = initialize_cycle(&initialize_input) {
            invariant_failures.push(format!("{label} nextCycleRequest rejected: {error}"));
        }

        archetypes.push(json!({
            "seasonIndex": output.result["seasonIndex"],
            "seasonRank": output.result["seasonRank"],
            "seasonSummary": output.result["seasonSummary"],
            "awards": output.result["awards"],
            "nextCycleRequest": next_cycle_request,
        }));
    }

    let summary = json!({
        "archetypes": archetypes,
        "invariantFailures": invariant_failures,
    });

    println!(
        "{}",
        serde_json::to_string_pretty(&summary).map_err(|error| error.to_string())?
    );

    Ok(())
}
