#!/usr/bin/env bash
# Launches one Claude Code session per module, each in its own git worktree,
# running concurrently. Requires phase0-complete tag to exist.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

cd "$REPO_ROOT"

if ! git rev-parse phase0-complete >/dev/null 2>&1; then
  log "ERROR: phase0-complete tag not found. Refusing to fan out. Run run_phase0.sh first."
  exit 1
fi

MODULES_JSON="$REPO_ROOT/MODULES.json"
MAX_CONCURRENT=${MIRA_MAX_CONCURRENT:-4}   # budget governor: cap parallel sessions

COUNT=$(jq '.modules | length' "$MODULES_JSON")
log "Fanning out $COUNT modules (max concurrent: $MAX_CONCURRENT)."

: > "$LOG_DIR/pids.txt"

RUNNING=0
for i in $(seq 0 $((COUNT - 1))); do
  NAME=$(jq -r ".modules[$i].name" "$MODULES_JSON")
  BRANCH=$(jq -r ".modules[$i].branch" "$MODULES_JSON")
  WORKTREE=$(jq -r ".modules[$i].worktree" "$MODULES_JSON")
  PROGRESS=$(jq -r ".modules[$i].progress_file" "$MODULES_JSON")
  PROMPT=$(jq -r ".modules[$i].prompt" "$MODULES_JSON")
  LOGFILE="$LOG_DIR/${NAME}.log"

  # Simple concurrency throttle
  while [ "$(jobs -rp | wc -l)" -ge "$MAX_CONCURRENT" ]; do
    sleep 5
  done

  if [ ! -d "$WORKTREE" ]; then
    git worktree add -b "$BRANCH" "$WORKTREE" staging 2>/dev/null || git worktree add -b "$BRANCH" "$WORKTREE"
  fi
  : > "$LOGFILE"

  PID=$(launch_session "$NAME" "$WORKTREE" "$PROMPT" "$LOGFILE")
  echo "$NAME:$PID:$LOGFILE:$PROGRESS:$WORKTREE:$BRANCH" >> "$LOG_DIR/pids.txt"
  log "Started module '$NAME' (PID $PID)"
done

log "All modules launched. monitor.sh will watch for completion / rate-limit / crash."
