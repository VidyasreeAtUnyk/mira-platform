#!/usr/bin/env bash
# Runs Phase 0 (shared schema + CRM/lead-agent merge) as a single session.
# On success, tags phase0-complete and triggers fan_out.sh.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

MODULES_JSON="$REPO_ROOT/MODULES.json"
PHASE0_NAME=$(jq -r '.phase0.name' "$MODULES_JSON")
PHASE0_BRANCH=$(jq -r '.phase0.branch' "$MODULES_JSON")
PHASE0_WORKTREE=$(jq -r '.phase0.worktree' "$MODULES_JSON")
PHASE0_PROGRESS=$(jq -r '.phase0.progress_file' "$MODULES_JSON")
PHASE0_PROMPT=$(jq -r '.phase0.prompt' "$MODULES_JSON")

cd "$REPO_ROOT"

if git rev-parse phase0-complete >/dev/null 2>&1; then
  log "phase0-complete tag already exists — skipping Phase 0, going straight to fan-out."
  "$SCRIPT_DIR/fan_out.sh"
  exit 0
fi

if [ ! -d "$PHASE0_WORKTREE" ]; then
  git worktree add -b "$PHASE0_BRANCH" "$PHASE0_WORKTREE"
fi

LOGFILE="$LOG_DIR/phase0.log"
: > "$LOGFILE"

PID=$(launch_session "$PHASE0_NAME" "$PHASE0_WORKTREE" "$PHASE0_PROMPT" "$LOGFILE")
log "Phase 0 session PID: $PID"
echo "$PID" > "$LOG_DIR/phase0.pid"

log "Phase 0 launched. monitor.sh will detect completion or rate-limit and act accordingly."
