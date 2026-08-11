#!/usr/bin/env bash
# Shared helpers for the Mira orchestration scripts.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$REPO_ROOT/.mira-logs"
mkdir -p "$LOG_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_DIR/orchestrator.log"
}

# Launch a Claude Code session on a given prompt, in a given directory,
# logging output and exit status. Runs in the background; caller tracks PID.
# Usage: launch_session <name> <workdir> <prompt_text> <logfile>
launch_session() {
  local name="$1" workdir="$2" prompt="$3" logfile="$4"
  log "Launching session '$name' in $workdir"
  (
    cd "$workdir"
    # --print keeps it non-interactive; adjust flags to your installed Claude Code version.
    claude --print "$prompt" >> "$logfile" 2>&1
    echo "EXIT_CODE:$?" >> "$logfile"
  ) &
  echo $!  # return PID
}

# Detect whether a session's log indicates a rate-limit stop rather than a
# clean finish or crash. Adjust the grep pattern if Claude Code's message text differs.
hit_rate_limit() {
  local logfile="$1"
  grep -qiE "rate limit|usage limit|resets at|try again later" "$logfile" 2>/dev/null
}

session_finished_clean() {
  local logfile="$1"
  grep -q "EXIT_CODE:0" "$logfile" 2>/dev/null
}

progress_says_done() {
  local progress_file="$1"
  [ -f "$progress_file" ] && grep -qi "status: *done" "$progress_file"
}
