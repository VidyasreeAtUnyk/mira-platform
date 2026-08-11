#!/usr/bin/env bash
# THE RESUME MECHANISM.
#
# Run this on a schedule (cron, every 10-15 min) on a machine that stays on
# (see note in chat re: laptop sleep — a small always-on VM is the reliable
# option; a caffeinated/plugged-in laptop works for a single overnight test).
#
# For each tracked session (phase0, or fanned-out modules), this script:
#   - checks if it's still running
#   - if it finished clean -> mark done, leave it
#   - if it hit a rate limit -> wait, then relaunch with a "continue" prompt
#     that points at the PROGRESS file, NOT the original prompt (avoids
#     restarting from scratch)
#   - if it crashed for another reason -> relaunch once, then flag for a human
#     after repeated failures (don't loop forever silently)
#
# This is a polling relauncher, not a true background daemon that survives
# independent of being invoked — that's what the cron entry is for.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

MAX_RETRIES=${MIRA_MAX_RETRIES:-6}   # cap so a broken module doesn't retry forever
RETRY_STATE_DIR="$LOG_DIR/retries"
mkdir -p "$RETRY_STATE_DIR"

cd "$REPO_ROOT"

check_and_resume() {
  local name="$1" workdir="$2" logfile="$3" progress_file_rel="$4" original_prompt="$5"
  local progress_file="$workdir/$progress_file_rel"
  local retry_file="$RETRY_STATE_DIR/${name}.count"
  local retries=0
  [ -f "$retry_file" ] && retries=$(cat "$retry_file")

  if progress_says_done "$progress_file"; then
    log "[$name] PROGRESS reports DONE. Nothing to do."
    return 0
  fi

  if session_finished_clean "$logfile"; then
    log "[$name] Session exited cleanly but PROGRESS doesn't say done — relaunching to continue."
  elif hit_rate_limit "$logfile"; then
    log "[$name] Detected rate-limit stop."
  else
    if pgrep -f "claude.*$name" >/dev/null 2>&1; then
      log "[$name] Still running. No action."
      return 0
    fi
    log "[$name] Session appears stopped (not clean, not clearly rate-limited)."
  fi

  if [ "$retries" -ge "$MAX_RETRIES" ]; then
    log "[$name] WARNING: hit max retries ($MAX_RETRIES). Not relaunching automatically."
    log "[$name] >>> Needs a human look. Check $progress_file and $logfile. <<<"
    return 0
  fi

  retries=$((retries + 1))
  echo "$retries" > "$retry_file"

  local resume_prompt="Read CLAUDE.md and SPEC.md. Read $progress_file_rel — this is a resumed session, a prior session was interrupted (likely a usage limit reset). Continue exactly from the 'Next' section. Do not restart from scratch. Original task for context: $original_prompt"

  log "[$name] Relaunching (attempt $retries/$MAX_RETRIES)..."
  : > "$logfile"
  local pid
  pid=$(launch_session "$name" "$workdir" "$resume_prompt" "$logfile")
  log "[$name] Relaunched, PID $pid"
}

# --- Phase 0 ---
if [ -f "$LOG_DIR/phase0.pid" ] && [ ! -f "$LOG_DIR/.phase0-done" ]; then
  MODULES_JSON="$REPO_ROOT/MODULES.json"
  P0_WORKTREE=$(jq -r '.phase0.worktree' "$MODULES_JSON")
  P0_PROGRESS=$(jq -r '.phase0.progress_file' "$MODULES_JSON")
  P0_PROMPT=$(jq -r '.phase0.prompt' "$MODULES_JSON")
  check_and_resume "phase0" "$P0_WORKTREE" "$LOG_DIR/phase0.log" "$P0_PROGRESS" "$P0_PROMPT"

  if progress_says_done "$P0_WORKTREE/$P0_PROGRESS"; then
    (cd "$P0_WORKTREE" && git tag phase0-complete 2>/dev/null || true)
    touch "$LOG_DIR/.phase0-done"
    log "Phase 0 complete and tagged. Triggering fan-out."
    "$SCRIPT_DIR/fan_out.sh"
  fi
fi

# --- Fanned-out modules ---
if [ -f "$LOG_DIR/pids.txt" ]; then
  while IFS=: read -r name pid logfile progress workdir branch; do
    [ -z "$name" ] && continue
    check_and_resume "$name" "$workdir" "$logfile" "$progress" "(see MODULES.json)"
  done < "$LOG_DIR/pids.txt"

  # If every module reports done, trigger integration once.
  if [ ! -f "$LOG_DIR/.integration-done" ]; then
    ALL_DONE=true
    while IFS=: read -r name pid logfile progress workdir branch; do
      [ -z "$name" ] && continue
      progress_says_done "$workdir/$progress" || ALL_DONE=false
    done < "$LOG_DIR/pids.txt"

    if [ "$ALL_DONE" = true ]; then
      log "All modules report done. Running integration pass."
      "$SCRIPT_DIR/integration.sh"
      touch "$LOG_DIR/.integration-done"
    fi
  fi
fi

log "monitor.sh pass complete."
