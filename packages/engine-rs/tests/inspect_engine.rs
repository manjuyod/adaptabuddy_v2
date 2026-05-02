use engine_rs::fixtures::{fixture_names, named_fixture};
use engine_rs::{complete_session, initialize_cycle, plan_session, Operation};
use std::path::PathBuf;
use std::process::Command;

fn run_fixture(name: &str) {
    let input = named_fixture(name).unwrap_or_else(|| panic!("missing fixture {name}"));
    match input.operation {
        Operation::InitializeCycle => {
            initialize_cycle(&input)
                .unwrap_or_else(|error| panic!("fixture {name} failed: {error}"));
        }
        Operation::PlanSession => {
            plan_session(&input).unwrap_or_else(|error| panic!("fixture {name} failed: {error}"));
        }
        Operation::CompleteSession => {
            complete_session(&input)
                .unwrap_or_else(|error| panic!("fixture {name} failed: {error}"));
        }
    }
}

#[test]
fn fixture_catalog_names_build_and_execute_successfully() {
    let expected = [
        "initialize-cycle-baseline",
        "plan-baseline",
        "plan-no-solution",
        "plan-injury-blocked",
        "plan-severe-fatigue",
        "complete-baseline",
        "complete-note-only-variant",
        "complete-compromised",
        "complete-partial",
        "complete-missed",
    ];

    assert_eq!(fixture_names(), expected);

    for name in expected {
        run_fixture(name);
    }
}

#[test]
fn cli_prints_input_and_output_for_a_valid_fixture() {
    let binary = inspect_engine_binary();
    let output = Command::new(binary)
        .arg("plan-baseline")
        .output()
        .expect("running inspect_engine");

    assert!(
        output.status.success(),
        "expected success, stderr was: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("INPUT"));
    assert!(stdout.contains("OUTPUT"));
    assert!(stdout.contains("\"schemaVersion\""));
}

#[test]
fn cli_rejects_unknown_fixture_names() {
    let binary = inspect_engine_binary();
    let output = Command::new(binary)
        .arg("not-a-fixture")
        .output()
        .expect("running inspect_engine");

    assert!(!output.status.success(), "expected non-zero exit");

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("Unknown fixture"));
    assert!(stderr.contains("plan-baseline"));
    assert!(stderr.contains("complete-missed"));
}

fn inspect_engine_binary() -> PathBuf {
    if let Ok(path) = std::env::var("CARGO_BIN_EXE_inspect_engine") {
        return PathBuf::from(path);
    }

    let current_exe = std::env::current_exe().expect("resolving current test executable");
    current_exe
        .parent()
        .and_then(|path| path.parent())
        .expect("test executable should live under target/<profile>/deps")
        .join(format!("inspect_engine{}", std::env::consts::EXE_SUFFIX))
}
