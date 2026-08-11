# CLAUDE.md — Mira Platform build instructions

Read this file first, every session, before doing anything else.

## Startup sequence (every session, no exceptions)
1. Read `SPEC.md` in full.
2. Read `PROGRESS.md` (root rollup) and, if working on a specific module, its
   `PROGRESS-<module>.md`.
3. Read `packages/shared-*` (schema/types) if it exists — this is the contract.
   Do not redefine types that already exist there. If something's missing, add
   to shared packages, don't fork a local copy.
4. Check current git branch/worktree. Confirm it matches the module you're
   meant to be working on (see MODULES.json if unsure).
5. Continue from the "Next" section of the relevant PROGRESS file. Don't
   restart or re-plan from scratch.

## Non-negotiable rules
- **Phase 0 first.** Do not build module-specific code until the shared
  schema/data layer and CRM+lead-agent merge are committed and tagged
  `phase0-complete`. If you're in a module worktree and that tag doesn't
  exist yet, stop and report it — don't improvise a temporary schema.
- **Work on the `staging` branch or a feature branch off it. Never commit
  directly to `main`.** A human reviews and merges to `main`.
- **Commit after every working increment**, not just at session end. This is
  what makes mid-session interruption (rate limit, crash) recoverable.
- **Update the relevant PROGRESS file after every meaningful step.** Format:
  what's done, what's in progress, what's next, any blockers. This is the
  resume mechanism — treat it as load-bearing, not optional bookkeeping.
- **Never touch production data or send anything live** (real emails, real
  WhatsApp messages, real social posts) without it going through the
  review/approval queue design. Everything is draft-and-hold by default at
  this stage of the build.
- **Never store or hardcode credentials, API keys, or portal logins** in code
  or commits. Use env vars / secrets management; if none exists yet, flag it
  and stop rather than guessing.
- **Respect the budget governor design** (SPEC.md) in any code that calls the
  Anthropic API or other paid AI/data services — no unbounded loops of calls.
- **DAMAC/Sobha inventory**: no scraping with stored credentials. Ingestion is
  manual/semi-manual (paste, CSV, screenshot-parse) per SPEC.md. Do not attempt
  to build an automated login-and-scrape flow.

## If you hit the rate limit / session ends mid-task
Before stopping (if you get any warning), write your exact next step into the
PROGRESS file in as much detail as possible — assume the next session has no
memory of this one beyond what's written down.

## Module boundaries (post-Phase-0 fan-out)
Each module works in its own git worktree, on its own branch, touching its own
`apps/<module>/` directory and reading (never redefining) `packages/shared-*`.
Don't reach into another module's directory. Cross-module integration happens
in the dedicated integration pass (see scripts/integration.sh), not ad hoc.

## Tech/process defaults
- Keep changes reviewable — no giant unexplained commits.
- Prefer boring, well-supported libraries over novel ones.
- Write a short note in the module's PROGRESS file on any architectural
  decision that isn't obviously implied by SPEC.md, so a human can review intent.
