use serde_json::Value;
use std::path::PathBuf;
use std::process::Command;

#[test]
fn season_loop_backtest_binary_emits_multi_season_summary_json() {
    let parsed = run_season_loop_backtest(&["5"]);

    let archetypes = parsed["archetypes"]
        .as_array()
        .expect("archetypes should be an array");
    assert_eq!(archetypes.len(), 5, "stdout: {parsed}");
    assert_eq!(
        parsed["schemaVersion"].as_str(),
        Some("engine.v1"),
        "stdout: {parsed}"
    );
    assert_eq!(parsed["cycleCount"].as_u64(), Some(5), "stdout: {parsed}");
    assert_eq!(
        parsed["scenarioFilter"].as_str(),
        Some("all"),
        "stdout: {parsed}"
    );
    assert_eq!(
        parsed["rankTimeline"]
            .as_array()
            .expect("rankTimeline should be an array")
            .len(),
        5,
        "stdout: {parsed}"
    );
    assert_eq!(
        parsed["awards"]
            .as_array()
            .expect("awards should be an array")
            .len(),
        5,
        "stdout: {parsed}"
    );
    assert_eq!(
        parsed["nextCycleRequests"]
            .as_array()
            .expect("nextCycleRequests should be an array")
            .len(),
        5,
        "stdout: {parsed}"
    );
    assert_eq!(
        parsed["replayReceipts"]
            .as_array()
            .expect("replayReceipts should be an array")
            .len(),
        5,
        "stdout: {parsed}"
    );
    assert_eq!(
        archetypes
            .iter()
            .filter_map(|entry| entry["seasonRank"].as_str())
            .collect::<std::collections::BTreeSet<_>>(),
        std::collections::BTreeSet::from(["A", "B", "C", "D", "S"])
    );
    for archetype in archetypes {
        assert!(archetype["awards"].is_array(), "stdout: {parsed}");
        assert!(
            archetype["nextCycleRequest"].is_object(),
            "stdout: {parsed}"
        );
        assert!(archetype["replayReceipts"].is_object(), "stdout: {parsed}");
        assert!(
            archetype["replayReceiptSummary"].is_object(),
            "stdout: {parsed}"
        );
    }

    let invariant_failures = parsed["invariantFailures"]
        .as_array()
        .expect("invariantFailures should be an array");
    assert!(invariant_failures.is_empty(), "stdout: {parsed}");
}

#[test]
fn season_loop_backtest_supports_cycles_flag() {
    let parsed = run_season_loop_backtest(&["--cycles", "2"]);

    let archetypes = parsed["archetypes"]
        .as_array()
        .expect("archetypes should be an array");
    assert_eq!(archetypes.len(), 2, "stdout: {parsed}");
    assert_eq!(parsed["cycleCount"].as_u64(), Some(2), "stdout: {parsed}");
    assert_eq!(
        parsed["scenarioFilter"].as_str(),
        Some("all"),
        "stdout: {parsed}"
    );
}

#[test]
fn season_loop_backtest_supports_scenario_and_cycles_flags() {
    let parsed = run_season_loop_backtest(&["--scenario", "all", "--cycles", "3"]);

    let archetypes = parsed["archetypes"]
        .as_array()
        .expect("archetypes should be an array");
    assert_eq!(archetypes.len(), 3, "stdout: {parsed}");
    assert_eq!(parsed["cycleCount"].as_u64(), Some(3), "stdout: {parsed}");
}

#[test]
fn season_loop_backtest_supports_single_rank_scenario_flag() {
    let parsed = run_season_loop_backtest(&["--scenario", "s-rank", "--cycles", "1"]);

    let archetypes = parsed["archetypes"]
        .as_array()
        .expect("archetypes should be an array");
    assert_eq!(archetypes.len(), 1, "stdout: {parsed}");
    assert_eq!(
        parsed["scenarioFilter"].as_str(),
        Some("s-rank"),
        "stdout: {parsed}"
    );
    assert_eq!(
        archetypes[0]["seasonRank"].as_str(),
        Some("S"),
        "stdout: {parsed}"
    );
}

#[test]
fn season_loop_backtest_rejects_invalid_scenario() {
    let binary = season_loop_backtest_binary();
    let output = Command::new(binary)
        .args(["--scenario", "invalid"])
        .output()
        .expect("running season_loop_backtest");

    assert!(
        !output.status.success(),
        "expected failure, stdout was: {}",
        String::from_utf8_lossy(&output.stdout)
    );

    let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
    assert!(stderr.contains("scenario"), "stderr was: {stderr}");
}

#[test]
fn season_loop_backtest_rejects_invalid_cycle_count() {
    let binary = season_loop_backtest_binary();
    let output = Command::new(binary)
        .args(["--cycles", "0"])
        .output()
        .expect("running season_loop_backtest");

    assert!(
        !output.status.success(),
        "expected failure, stdout was: {}",
        String::from_utf8_lossy(&output.stdout)
    );

    let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
    assert!(stderr.contains("cycle"), "stderr was: {stderr}");
}

#[test]
fn season_loop_backtest_report_is_deterministic_for_same_args() {
    let first = run_season_loop_backtest(&["--scenario", "all", "--cycles", "5"]);
    let second = run_season_loop_backtest(&["--scenario", "all", "--cycles", "5"]);

    assert_eq!(first, second);
}

fn season_loop_backtest_binary() -> PathBuf {
    let mut path = std::env::current_exe().expect("current test executable path");
    path.pop();
    if path.ends_with("deps") {
        path.pop();
    }
    let executable = if cfg!(windows) {
        "season_loop_backtest.exe"
    } else {
        "season_loop_backtest"
    };
    path.push(executable);
    path
}

fn run_season_loop_backtest(args: &[&str]) -> Value {
    let binary = season_loop_backtest_binary();
    let output = Command::new(binary)
        .args(args)
        .output()
        .expect("running season_loop_backtest");

    assert!(
        output.status.success(),
        "expected success, stderr was: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout).expect("season_loop_backtest should emit JSON")
}
