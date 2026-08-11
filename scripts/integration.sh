#!/usr/bin/env bash
# Final integration pass: merges each module branch into staging and runs a
# session to check cross-module seams. Never touches main.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
cd "$REPO_ROOT"

git checkout staging 2>/dev/null || git checkout -b staging

MODULES_JSON="$REPO_ROOT/MODULES.json"
COUNT=$(jq '.modules | length' "$MODULES_JSON")

for i in $(seq 0 $((COUNT - 1))); do
  BRANCH=$(jq -r ".modules[$i].branch" "$MODULES_JSON")
  NAME=$(jq -r ".modules[$i].name" "$MODULES_JSON")
  log "Merging $NAME ($BRANCH) into staging..."
  if ! git merge --no-edit "$BRANCH"; then
    log "MERGE CONFLICT on $NAME. Leaving repo in conflict state for human review. Stopping integration."
    exit 1
  fi
done

LOGFILE="$LOG_DIR/integration.log"
: > "$LOGFILE"
PROMPT="Read CLAUDE.md and SPEC.md. All module branches have just been merged into staging. Check cross-module seams: does the dashboard read what social/CRM/pipeline/inventory write, are notification priorities consistent, do shared types match usage across apps/*. Report findings and fix straightforward issues; flag anything requiring a product decision in PROGRESS-integration.md rather than guessing."
PID=$(launch_session "integration" "$REPO_ROOT" "$PROMPT" "$LOGFILE")
log "Integration review session launched, PID $pid"
log "When this completes, a human should review staging before merging to main."
