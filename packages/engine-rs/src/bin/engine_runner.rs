use engine_rs::{
    advance_cycle, complete_session, initialize_cycle, plan_session, EngineInputV1, EngineOutputV1,
    Operation,
};
use std::io::{self, Read};

fn main() {
    if let Err(message) = run() {
        eprintln!("{message}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let mut buffer = String::new();
    io::stdin()
        .read_to_string(&mut buffer)
        .map_err(|error| format!("failed to read stdin: {error}"))?;

    let input: EngineInputV1 =
        serde_json::from_str(&buffer).map_err(|error| format!("failed to parse input: {error}"))?;

    let output = execute(&input).map_err(|error| error.to_string())?;
    let json = serde_json::to_string(&output)
        .map_err(|error| format!("failed to serialize output: {error}"))?;
    println!("{json}");

    Ok(())
}

fn execute(input: &EngineInputV1) -> Result<EngineOutputV1, engine_rs::EngineError> {
    match input.operation {
        Operation::InitializeCycle => initialize_cycle(input),
        Operation::PlanSession => plan_session(input),
        Operation::CompleteSession => complete_session(input),
        Operation::AdvanceCycle => advance_cycle(input),
    }
}
