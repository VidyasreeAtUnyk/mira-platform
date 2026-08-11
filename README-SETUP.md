# Getting this running tonight

## One-time setup
1. Put these files (`SPEC.md`, `CLAUDE.md`, `MODULES.json`, `scripts/`,
   `PROGRESS-template.md`) at the root of your new `mira-platform` monorepo.
2. `git init` it if not already, commit.
3. Copy your CRM folder and lead-follow-up-agent repo in as `apps/crm` and
   `apps/lead-agent` — this is what the Phase 0 session will restructure into
   the shared schema, so just get them into the repo, don't pre-merge by hand.
4. Make scripts executable: `chmod +x scripts/*.sh`
5. Install `jq` if you don't have it: `apt install jq` / `brew install jq`.
6. Copy `PROGRESS-template.md` to `PROGRESS-phase0.md` and one
   `PROGRESS-<module>.md` per entry in MODULES.json, in the repo root (each
   worktree will pick up its own via relative path once created).

## Start the build
```bash
cd mira-platform
./scripts/run_phase0.sh
```
This launches Phase 0 only. Nothing else starts until it's tagged
`phase0-complete`.

## Keep it resuming (this is the rate-limit answer)
Add a cron entry so `monitor.sh` runs every 10-15 minutes, checking for
stalled/rate-limited sessions and relaunching them with a "continue from
PROGRESS" prompt instead of restarting from scratch. This is what makes it
survive the 5-hour usage reset unattended.

```bash
crontab -e
# add:
*/15 * * * * /full/path/to/mira-platform/scripts/monitor.sh >> /full/path/to/mira-platform/.mira-logs/cron.log 2>&1
```

monitor.sh handles three things automatically:
- Phase 0 finishes → tags `phase0-complete` → triggers `fan_out.sh` itself.
- Any module hits a rate limit / stops non-cleanly → relaunches it pointed at
  its own PROGRESS file, up to `MIRA_MAX_RETRIES` (default 6) before flagging
  for a human instead of looping forever.
- All modules report done → runs `integration.sh` once.

## Important honesty check
This works reliably if the machine running it stays powered on and networked
overnight — cron does not fire during sleep. Either:
- keep this laptop plugged in with sleep disabled tonight, or
- run it on a small always-on VM (more reliable long-term, since you'll be
  running this repeatedly, not just once).

If the machine does sleep or lose power, nothing is lost — sessions just
stop where they are. Run `./scripts/monitor.sh` manually once you're back and
it'll pick up exactly where things left off, same as it would from cron.

## In the morning
- Check `.mira-logs/orchestrator.log` for the overall timeline.
- Check each `PROGRESS-*.md` for status.
- If integration ran: review the `staging` branch yourself before merging to
  `main`. Don't auto-merge to main — that stays a human step.
