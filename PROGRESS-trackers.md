# Progress — trackers

Status: in-progress
<!-- Change to "Status: done" only when fully complete, tested, and committed.
     monitor.sh checks for this exact string (case-insensitive) to know when
     to stop resuming / trigger the next phase. Don't mark done prematurely. -->

## Done
- Read CLAUDE.md, SPEC.md (esp. module 10), MODULES.json, and
  `packages/shared-types`/`packages/shared-db` in full before writing code.
- Verified the cold-start branch claim independently before trusting it:
  confirmed `phase0-complete` tag exists at commit `cde0189` on
  `origin/claude/shared-schema`, confirmed `origin/master` genuinely lacks
  `packages/` (Phase 0 not merged there yet), and confirmed
  `PROGRESS-phase0.md` on that branch says module branches are cleared to
  start. Branched `claude/trackers` off `origin/claude/shared-schema` per
  the task's instructions (see Notes for the full reasoning + human
  follow-up needed).
- Added `Goal` / `GoalProgressEntry` (+ input types, enums,
  `RECOMMENDED_GOAL_METRICS`) to `packages/shared-types/src/domain.ts`,
  rebuilt the committed `dist/` output (`npm run build --workspace=@mira/shared-types`),
  and confirmed `npm run typecheck --workspace=@mira/shared-types` is clean.
- Added `packages/shared-db/migrations/001_trackers_goals.sql`: new
  `goals` + `goal_progress_entries` tables, additive only, referencing the
  existing shared `agents` table. Updated `packages/shared-db/README.md`
  to document the new `migrations/` layering convention.
- **Verified the migration for real**, not just applied: `createdb
  mira_trackers_scratch` on the sandbox's local Postgres 16, applied
  `schema.sql` then `migrations/001_trackers_goals.sql` in sequence (clean,
  no errors), then ran INSERTs proving `goals_scope_agent_consistency` (an
  individual goal with `agent_id null` correctly fails) and
  `goals_period_valid` behave as intended.

## In progress
- Building `apps/trackers` (Next.js app, CRUD for goals + progress entries,
  progress view). Not yet started as of this checkpoint -- see Next.

## Next
- Scaffold `apps/trackers` as a Next.js 16 / React 19 / Tailwind v4 app,
  reusing `apps/crm`'s stack (see its `package.json`/`tsconfig.json`) and
  Supabase auth pattern (`src/lib/supabase/{client,server,service}.ts`,
  `src/proxy.ts` session-refresh middleware, `agents.id = auth.uid()`
  identity model, `get_current_agent_role()` RLS helper). Scoping decision
  already made: skip pulling in `@base-ui/react` + the generated shadcn
  "base-nova" component set that `apps/crm` uses -- write small local
  Tailwind-only primitives (button/card/input/select/label/badge) against
  the same CSS variable tokens instead, to avoid taking on an unfamiliar
  component library's API surface for a one-session build. Document this
  explicitly as a deviation, not silently.
- Build pages: `/` (progress view: my goals + team goals, % to goal,
  streak), `/goals/new` (create), `/goals/[id]` (detail: edit, log
  progress, entry history), `/login`, `/auth/callback`.
- Add `apps/trackers/supabase/migrations/001_goals.sql`: Supabase-flavored
  mirror of `packages/shared-db/migrations/001_trackers_goals.sql` with RLS
  policies (mirroring `apps/crm/supabase/migrations/002_rls_policies.sql`'s
  pattern -- `get_current_agent_role()` already exists in that project once
  apps/crm's migrations are applied there; note the dependency in the file
  header, don't redefine the helper).
- `npx tsc --noEmit` clean in `apps/trackers` before calling this done.
- Commit + push after this next increment, then re-update this file.

## Blockers / needs human input
- No live Supabase project/credentials exist anywhere in this repo (same
  blocker Phase 0 flagged for apps/crm/apps/lead-agent). apps/trackers will
  be built against the same local-Postgres-for-dev/test pattern
  apps/lead-agent uses, with Supabase env vars read from `.env` (not
  committed) exactly like apps/crm. Cannot verify against the real project
  until a human supplies `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.

## Notes / decisions made
- **Branched off `origin/claude/shared-schema`, not `master`, and this is a
  deliberate deviation from the literal "branch off default branch" rule --
  documenting why per the task instructions.** `master` does not yet have
  Phase 0 merged (`packages/` doesn't exist there; verified via `git
  ls-tree -d origin/master --name-only`). The actual Phase 0 deliverable
  lives only on `origin/claude/shared-schema`, tagged `phase0-complete` at
  commit `cde0189` (verified: `git rev-parse phase0-complete` dereferences
  to that commit; `git merge-base --is-ancestor` confirms it's an ancestor
  of `origin/claude/shared-schema`). Building against `master` would have
  meant no shared schema/types to import, forcing a forked local copy --
  explicitly forbidden by CLAUDE.md ("add to shared packages, don't fork a
  local copy"). **A human needs to rebase/re-target `claude/trackers` onto
  `master` once a human merges Phase 0 there** -- this branch's parent
  (`origin/claude/shared-schema`) is not on `master` yet.
- **Goal/progress-entry tables promoted to `packages/shared-db`, not kept
  apps/trackers-local.** Per CLAUDE.md's shared-vs-local judgement call:
  revenue and activity targets are exactly the kind of data SPEC.md's
  Dashboard (module 2, "Today view") and Monthly report (module 11) will
  want to read (progress-to-goal widgets, revenue-vs-target rollups). If
  goals lived in an apps/trackers-only table, those modules would either
  have to reach into apps/trackers' directory (forbidden by CLAUDE.md's
  module-boundary rule) or fork their own copy of the same concept. Kept the
  migration as a new, clearly-separated file rather than editing
  `schema.sql` in place, so it's easy for a human to review as a Phase-0
  follow-on rather than part of the frozen Phase 0 snapshot.
- **`AgentRole` (`agent`/`manager`/`admin`) from the shared schema is
  coarser than SPEC.md's 6-row RBAC table** (Owner/COO, Senior Agent,
  Junior Agent, Marketing/Social, Admin/Ops, Finance). Not something
  trackers should unilaterally redefine (that's a shared-types change with
  CRM/lead-agent implications, out of this module's lane). Mapping used for
  goals visibility: `manager`/`admin` see and edit all goals (individual +
  team); `agent` sees their own individual goals plus all team-wide goals,
  and can only create/edit their own individual goals. Flagging this
  mapping as a best-effort placeholder, not a finished RBAC design -- a
  human should confirm it matches intent once the fuller role set exists.
