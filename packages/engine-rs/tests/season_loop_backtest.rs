use serde_json::Value;
use std::path::PathBuf;
use std::process::Command;

#[test]
fn season_loop_backtest_binary_emits_multi_season_summary_json() {
    let binary = season_loop_backtest_binary();
    let output = Command::new(binary)
        .arg("5")
        .output()
        .expect("running season_loop_backtest");

    assert!(
        output.status.success(),
        "expected success, stderr was: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: Value =
        serde_json::from_str(&stdout).expect("season_loop_backtest should emit JSON");

    let archetypes = parsed["archetypes"]
        .as_array()
        .expect("archetypes should be an array");
    assert_eq!(archetypes.len(), 5, "stdout: {stdout}");
    assert_eq!(
        archetypes
            .iter()
            .filter_map(|entry| entry["seasonRank"].as_str())
            .collect::<std::collections::BTreeSet<_>>(),
        std::collections::BTreeSet::from(["A", "B", "C", "D", "S"])
    );

    let invariant_failures = parsed["invariantFailures"]
        .as_array()
        .expect("invariantFailures should be an array");
    assert!(invariant_failures.is_empty(), "stdout: {stdout}");
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
