use engine_rs::fixtures::{fixture_names, named_fixture};
use engine_rs::{
    complete_session, initialize_cycle, plan_session, EngineInputV1, EngineOutputV1, Operation,
};

fn main() {
    if let Err(message) = run() {
        eprintln!("{message}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let fixture_name = std::env::args()
        .nth(1)
        .ok_or_else(|| usage_error("missing fixture name"))?;

    let input = named_fixture(&fixture_name).ok_or_else(|| unknown_fixture_error(&fixture_name))?;
    let output = execute_fixture(&input).map_err(|error| error.to_string())?;

    print_json_section("INPUT", &input)?;
    print_json_section("OUTPUT", &output)?;

    Ok(())
}

fn execute_fixture(input: &EngineInputV1) -> Result<EngineOutputV1, engine_rs::EngineError> {
    match input.operation {
        Operation::InitializeCycle => initialize_cycle(input),
        Operation::PlanSession => plan_session(input),
        Operation::CompleteSession => complete_session(input),
    }
}

fn print_json_section<T: serde::Serialize>(label: &str, value: &T) -> Result<(), String> {
    let json = serde_json::to_string_pretty(value)
        .map_err(|error| format!("failed to serialize {label}: {error}"))?;
    println!("{label}");
    println!("{json}");
    Ok(())
}

fn usage_error(message: &str) -> String {
    format!("{message}\nusage: cargo run --bin inspect_engine -- <fixture-name>")
}

fn unknown_fixture_error(name: &str) -> String {
    format!(
        "Unknown fixture: {name}\nSupported fixtures:\n{}",
        fixture_names()
            .iter()
            .map(|fixture| format!("- {fixture}"))
            .collect::<Vec<_>>()
            .join("\n")
    )
}
