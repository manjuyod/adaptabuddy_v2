use engine_rs::{advance_cycle, fixtures, initialize_cycle, SCHEMA_VERSION};
use serde_json::{json, Value};

type FixtureFactory = fn() -> engine_rs::EngineInputV1;

const USAGE: &str = "usage: cargo run --manifest-path packages/engine-rs/Cargo.toml --bin season_loop_backtest [--scenario <all|s-rank|a-rank|b-rank|c-rank|d-rank>] [--cycles <positive integer>]";
const ALL_SCENARIOS: [(&str, FixtureFactory); 5] = [
    ("s-rank", fixtures::advance_cycle_s_rank_input),
    ("a-rank", fixtures::advance_cycle_a_rank_input),
    ("b-rank", fixtures::advance_cycle_b_rank_input),
    ("c-rank", fixtures::advance_cycle_c_rank_input),
    ("d-rank", fixtures::advance_cycle_d_rank_input),
];

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

#[derive(Clone, Copy, Default)]
enum ScenarioFilter {
    #[default]
    All,
    SRank,
    ARank,
    BRank,
    CRank,
    DRank,
}

#[derive(Default)]
struct Config {
    scenario_filter: ScenarioFilter,
    cycles: Option<usize>,
}

fn run() -> Result<(), String> {
    let config = parse_args()?;

    let scenario_inputs = scenario_inputs(config.scenario_filter);
    let requested_cycles = config.cycles.unwrap_or(scenario_inputs.len());
    let cycle_count = requested_cycles.min(scenario_inputs.len());

    let mut archetypes = Vec::new();
    let mut invariant_failures = Vec::new();
    let mut rank_timeline = Vec::new();
    let mut awards = Vec::new();
    let mut next_cycle_requests = Vec::new();
    let mut replay_receipts = Vec::new();

    for (label, input) in scenario_inputs.into_iter().take(cycle_count) {
        let output = advance_cycle(&input).map_err(|error| error.to_string())?;
        let next_cycle_request = output.result["nextCycleRequest"].clone();

        let mut initialize_input = fixtures::initialize_cycle_baseline_input();
        initialize_input.request = next_cycle_request.clone();
        if let Err(error) = initialize_cycle(&initialize_input) {
            invariant_failures.push(format!("{label} nextCycleRequest rejected: {error}"));
        }

        let replay_receipt =
            serde_json::to_value(&output.replay_receipt).map_err(|error| error.to_string())?;
        let replay_receipt_summary = replay_receipt_summary(&replay_receipt);
        let season_rank = output.result["seasonRank"].clone();
        let season_awards = output.result["awards"].clone();

        rank_timeline.push(json!({
            "label": label,
            "seasonRank": season_rank,
        }));
        awards.push(json!({
            "label": label,
            "awards": season_awards,
        }));
        next_cycle_requests.push(json!({
            "label": label,
            "nextCycleRequest": next_cycle_request.clone(),
        }));
        replay_receipts.push(json!({
            "label": label,
            "replayReceipt": replay_receipt.clone(),
            "replayReceiptSummary": replay_receipt_summary.clone(),
        }));

        archetypes.push(json!({
            "label": label,
            "seasonIndex": output.result["seasonIndex"],
            "seasonRank": output.result["seasonRank"],
            "seasonSummary": output.result["seasonSummary"],
            "awards": output.result["awards"],
            "nextCycleRequest": next_cycle_request,
            "replayReceipts": replay_receipt,
            "replayReceiptSummary": replay_receipt_summary,
        }));
    }

    let summary = json!({
        "schemaVersion": SCHEMA_VERSION,
        "cycleCount": cycle_count,
        "scenarioFilter": config.scenario_filter.as_str(),
        "rankTimeline": rank_timeline,
        "awards": awards,
        "nextCycleRequests": next_cycle_requests,
        "replayReceipts": replay_receipts,
        "archetypes": archetypes,
        "invariantFailures": invariant_failures,
    });

    println!(
        "{}",
        serde_json::to_string_pretty(&summary).map_err(|error| error.to_string())?
    );

    Ok(())
}

fn parse_args() -> Result<Config, String> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();

    if args.is_empty() {
        return Ok(Config::default());
    }

    let mut config = Config {
        scenario_filter: ScenarioFilter::All,
        cycles: None,
    };

    if !args[0].starts_with("--") {
        let cycles = parse_positive_cycles(&args[0])?;
        if args.len() > 1 {
            return Err(usage_error("unexpected positional argument"));
        }
        config.cycles = Some(cycles);
        return Ok(config);
    }

    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--scenario" => {
                let value = args
                    .get(index + 1)
                    .ok_or_else(|| usage_error("--scenario requires a value"))?;
                config.scenario_filter = ScenarioFilter::from_str(value.as_str())
                    .map_err(|error| usage_error(&error))?;
                index += 2;
            }
            "--cycles" => {
                let value = args
                    .get(index + 1)
                    .ok_or_else(|| usage_error("--cycles requires a value"))?;
                config.cycles =
                    Some(parse_positive_cycles(value).map_err(|error| usage_error(&error))?);
                index += 2;
            }
            unknown => {
                return Err(usage_error(&format!("unknown argument: {unknown}")));
            }
        }
    }

    Ok(config)
}

fn parse_positive_cycles(raw: &str) -> Result<usize, String> {
    let cycles = raw
        .parse::<usize>()
        .map_err(|_| format!("invalid cycle count: {raw}"))?;
    if cycles == 0 {
        return Err("invalid cycle count: must be greater than zero".to_string());
    }
    Ok(cycles)
}

fn scenario_inputs(filter: ScenarioFilter) -> Vec<(&'static str, engine_rs::EngineInputV1)> {
    ALL_SCENARIOS
        .iter()
        .filter(|(label, _)| filter.matches(label))
        .map(|(label, factory)| (*label, factory()))
        .collect()
}

fn replay_receipt_summary(receipt: &Value) -> Value {
    json!({
        "inputHash": receipt.get("inputHash").cloned().unwrap_or(Value::Null),
        "outputHash": receipt.get("outputHash").cloned().unwrap_or(Value::Null),
        "seedUsed": receipt.get("seedUsed").cloned().unwrap_or(Value::Null),
    })
}

impl ScenarioFilter {
    fn as_str(self) -> &'static str {
        match self {
            Self::All => "all",
            Self::SRank => "s-rank",
            Self::ARank => "a-rank",
            Self::BRank => "b-rank",
            Self::CRank => "c-rank",
            Self::DRank => "d-rank",
        }
    }

    fn matches(self, label: &str) -> bool {
        match self {
            Self::All => true,
            Self::SRank => label == "s-rank",
            Self::ARank => label == "a-rank",
            Self::BRank => label == "b-rank",
            Self::CRank => label == "c-rank",
            Self::DRank => label == "d-rank",
        }
    }

    fn from_str(raw: &str) -> Result<Self, String> {
        match raw {
            "all" => Ok(Self::All),
            "s-rank" => Ok(Self::SRank),
            "a-rank" => Ok(Self::ARank),
            "b-rank" => Ok(Self::BRank),
            "c-rank" => Ok(Self::CRank),
            "d-rank" => Ok(Self::DRank),
            _ => Err(format!(
                "invalid scenario: {raw}; supported values are: all, s-rank, a-rank, b-rank, c-rank, d-rank"
            )),
        }
    }
}

fn usage_error(message: &str) -> String {
    format!("{message}\n{USAGE}")
}
