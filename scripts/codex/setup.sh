#!/usr/bin/env bash
set -euo pipefail

echo "[codex setup] Node: $(node --version)"
echo "[codex setup] npm: $(npm --version)"

if command -v "${CARGO:-cargo}" >/dev/null 2>&1; then
  CARGO_BIN="${CARGO:-cargo}"
elif [[ -n "${USERPROFILE:-}" ]] && command -v cygpath >/dev/null 2>&1 && [[ -x "$(cygpath -u "$USERPROFILE")/.cargo/bin/cargo.exe" ]]; then
  CARGO_BIN="$(cygpath -u "$USERPROFILE")/.cargo/bin/cargo.exe"
elif [[ -n "${HOME:-}" ]] && [[ -x "$HOME/.cargo/bin/cargo" ]]; then
  CARGO_BIN="$HOME/.cargo/bin/cargo"
else
  echo "[codex setup] cargo is required for packages/engine-rs checks." >&2
  exit 1
fi

echo "[codex setup] cargo: $("$CARGO_BIN" --version)"

npm ci
"$CARGO_BIN" fetch --manifest-path packages/engine-rs/Cargo.toml

echo "[codex setup] complete"
