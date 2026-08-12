# Progress — trackers

Status: done
<!-- Change to "Status: done" only when fully complete, tested, and committed.
     monitor.sh checks for this exact string (case-insensitive) to know when
     to stop resuming / trigger the next phase. Don't mark done prematurely. -->

## Done
- (Prior session) Read CLAUDE.md, SPEC.md (module 10), MODULES.json,
  `packages/shared-types`/`packages/shared-db` in full. Added `Goal` /
  `GoalProgressEntry` types + `packages/shared-db/migrations/001_trackers_goals.sql`,
  verified against a scratch Postgres. See git history for that session's
  detail; not repeated here.
- **This session: built the actual `apps/trackers` app end-to-end and
  verified it for real**, not just typechecked. Resumed from the exact
  "Next" list left by the prior session.
- Scaffolded `apps/trackers` as Next.js 16.2.9 / React 19.2.4 / Tailwind v4,
  matching `apps/crm`'s `package.json`/`tsconfig.json`/`next.config.ts`/
  `eslint.config.mjs`/`postcss.config.mjs` conventions. Per the scoping
  decision already made: **no `@base-ui/react` or shadcn "base-nova"** --
  `src/components/ui/{button,card,input,label,select,textarea,badge}.tsx`
  are small hand-written Tailwind components (using `class-variance-authority`
  for variants, same as crm's button, just on a plain `<button>`/`<select>`/
  etc.) against the same CSS variable tokens as `apps/crm/src/app/globals.css`.
  Also skipped `next/font/google` (system font stack instead) to avoid a
  build-time Google Fonts fetch this sandbox's network may not reach --
  same brand tokens either way, noted inline in `layout.tsx`.
- Auth: `src/lib/supabase/{client,server,service}.ts` and `src/proxy.ts`
  mirror `apps/crm`'s files line-for-line (same `agents.id = auth.uid()`
  identity model), **plus** a `isSupabaseConfigured()` gate that only
  activates a local dev/test bypass when `NEXT_PUBLIC_SUPABASE_URL` is unset
  -- see "Notes / decisions made" below, this is the load-bearing decision
  that made real end-to-end verification possible without live Supabase
  credentials (which still don't exist anywhere in this repo).
- Pages built: `/` (progress view -- individual + team goals, split by role:
  agents see "My goals" + all team goals, managers/admins see "Individual
  goals (all agents)" with owner names + team goals), `/goals/new` (create,
  with an "Assign to" agent picker for managers), `/goals/[id]` (detail:
  progress bar + streak + entry count, log-progress form, entry history,
  edit form gated by `canEditGoal`), `/login` (real Supabase password
  sign-in when configured, a "dev mode / Continue to app" notice otherwise),
  `/auth/callback` (magic-link code exchange, mirrors crm's route exactly).
- `apps/trackers/supabase/migrations/001_goals.sql`: Supabase-flavored
  mirror of the shared migration DDL, with RLS policies added (mirrors
  `apps/crm/supabase/migrations/002_rls_policies.sql`'s pattern, calls the
  existing `get_current_agent_role()` rather than redefining it -- header
  documents the dependency and the apply order). **Not applied to any real
  Supabase project** -- none exists (same repo-wide blocker). The RLS
  policies are also not what apps/trackers' own server code relies on at
  runtime -- see the direct-`pg` decision below; they exist as the canonical
  policy statement + defense-in-depth for any other PostgREST client.
- CRUD + the `GoalProgress` aggregation implemented in `src/lib/goals.ts`
  and wired to real Postgres via `src/lib/db.ts` (direct `pg`, schema
  application on first use, same pattern as `apps/lead-agent/src/db/client.ts`).
  Application-code authorization (`canViewGoal`/`canEditGoal`/`canLogProgress`)
  implements the same manager-vs-agent mapping the RLS file states.
- **Verified against real seeded data, for real, this session:**
  1. Stood up local Postgres 16 (`mira_trackers_dev`), applied
     `packages/shared-db/schema.sql` then
     `packages/shared-db/migrations/001_trackers_goals.sql` in sequence --
     clean, no errors.
  2. Ran `apps/trackers/scripts/seed.ts` -- 3 agents (1 manager, 2 agents),
     6 goals (individual + team, across daily/weekly/monthly/quarterly
     cadence, one completed/archived), ~29 realistic progress entries with
     intentional streak/gap patterns. Confirmed via `psql` that the rows
     landed as intended.
  3. Ran `npm run dev` (Turbopack) against that seeded database and
     `curl`'d the rendered HTML with `DEV_AGENT_ID` set to each of the three
     seed agents in turn: confirmed `/` renders correct per-role sections
     (agent view: "My goals" limited to own individual goals + all team
     goals; manager view: "Individual goals (all agents)" with owner names
     + team goals), confirmed the on-page totals/percentages/streaks
     matched hand-calculated sums from the seeded entries (e.g. Farah's
     calls-made goal: 8+9+10+11+12+8+9=67 vs target 20 -> 335%, 7-day
     streak -- matched exactly), confirmed `/goals/[id]` detail renders
     progress + entry history + edit form correctly, confirmed `/goals/new`
     renders (including the manager-only "Assign to" picker), confirmed
     `/login` renders its dev-mode notice, confirmed an unknown goal id
     404s and `/auth/callback` with no code redirects to
     `/login?error=auth_failed` without crashing.
  4. Exercised every CRUD + authorization path through the exact functions
     the server actions call (`createGoal`, `updateGoal`, `addProgressEntry`,
     `getGoalProgress`) against the live seeded database via a throwaway
     script (`scripts/verify-crud.ts`, deleted after use -- not part of the
     shipped app): agent creating their own individual goal (allowed),
     agent creating a goal for someone else (`ForbiddenError`), agent
     creating a team goal (`ForbiddenError`), manager creating a team goal
     (allowed), agent editing someone else's goal (`ForbiddenError`), owner
     editing their own goal (allowed, fields actually changed), agent
     logging progress on someone else's individual goal (`ForbiddenError`),
     two different agents logging progress on the same team goal
     (allowed, `getGoalProgress` correctly summed both entries: 4 + 6 = 10,
     20% of a 50 target, streak 1, entryCount 2 -- all asserted, all
     passed), manager viewing/editing an agent's individual goal (allowed).
     Then re-fetched the live pages and confirmed the new/updated goal
     showed up with the right numbers -- proving the app's read path and
     the verification script's write path are hitting the same real
     database consistently.
  5. Re-ran `npm run dev` / `next build` after adding `revalidate = 0` to
     `/goals/new` (initially missing it, which let Next attempt to
     statically prerender a per-user page at build time -- caught by
     inspecting the build's route table, which listed it `○ Static`
     instead of `ƒ Dynamic`; fixed and re-verified `ƒ` on every
     data-dependent route).
- `npx tsc --noEmit` clean in `apps/trackers` (empty output, exit 0).
- `npx next build` (production build, Turbopack) succeeds cleanly: compiles,
  typechecks, generates the route table with every data-dependent route
  correctly marked dynamic (`ƒ`) and only `/login` and `/_not-found` static.
- Committed and pushed to `origin/claude/trackers`.

## In progress
- Nothing. This module's scoped task list (see the previous session's
  "Next" section) is complete.

## Next (for a human / a future session, not blocking "done" here)
- Supply real Supabase credentials (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) once a
  project exists, then: (a) apply `apps/crm/supabase/migrations/001-005`
  followed by `apps/trackers/supabase/migrations/001_goals.sql` to it,
  (b) create real `agents` rows with matching Supabase Auth users, (c)
  smoke-test `/login` -> session cookie -> `/` end-to-end with the dev
  bypass now correctly inert (`isSupabaseConfigured()` true). None of this
  is possible without credentials that don't exist in this repo yet.
- The still-unresolved branch-parentage issue the prior session flagged
  (see "Notes" below, carried forward unchanged): `claude/trackers` is
  based on `origin/claude/shared-schema` (where `phase0-complete` actually
  lives), not `master` (`master` still lacks `packages/` as of this
  session -- re-verified with `git merge-base --is-ancestor phase0-complete
  origin/master` -> false). A human needs to rebase/re-target once Phase 0
  is merged to `master`.
- Optional follow-ons, not required for module 10's scope: hard delete for
  goals (currently soft-delete via `status = 'archived'`, which was judged
  sufficient), blocking progress-entry logging on `archived`/`completed`
  goals (currently still allowed -- a deliberate non-decision, flagged here
  rather than silently assumed), and the module 2 (Today view) / module 11
  (monthly report) integrations that motivated promoting `goals` to
  `packages/shared-db` in the first place -- those are those modules' work,
  not this one's.

## Blockers / needs human input
- **No live Supabase project/credentials exist anywhere in this repo**
  (same blocker `PROGRESS-phase0.md` and `apps/lead-agent` already flag).
  Everything that depends on it is built to the same shape as `apps/crm`
  and is ready to go the moment credentials exist, but is unverified live.
  Worked around for local verification via the dev-auth bypass described
  below -- that bypass cannot activate once real credentials are set (see
  `src/lib/current-agent.ts`'s header comment for the exact gate).

## Notes / decisions made
- **(Carried forward, unchanged) Branched off `origin/claude/shared-schema`,
  not `master`.** Re-verified this session: `master` still doesn't have
  `packages/` (`git ls-tree -d origin/master --name-only` -> no `packages`
  entry), and `phase0-complete` is still not an ancestor of `origin/master`.
  A human still needs to rebase/re-target this branch onto `master` once a
  human merges Phase 0 there.
- **Data-access architecture deviates from `apps/crm`'s pattern, on
  purpose, documented here per CLAUDE.md.** `apps/crm` reads/writes through
  `supabase-js`'s `.from()` query builder, which talks to Supabase's hosted
  PostgREST/GoTrue stack over HTTPS -- that stack doesn't exist anywhere in
  this sandbox, and standing up the full local Supabase CLI stack (Postgres
  + GoTrue + PostgREST + Kong containers) was judged out of scope for a
  single-session module build (no `supabase` CLI in the sandbox, and
  pulling ~4 Docker images through the sandbox's proxied network wasn't
  worth the time budget against what it would buy). `apps/trackers`
  instead follows the pattern `apps/lead-agent` already established in this
  repo for exactly this situation: connect directly via `pg` against
  `DATABASE_URL` (see `src/lib/db.ts`'s header comment for the full
  writeup). This is also a legitimate *production* pattern for a Next.js
  server against Supabase-hosted Postgres (direct/pooled connection,
  bypassing PostgREST), not merely a dev shim -- but it does mean Postgres
  RLS (the policies in `supabase/migrations/001_goals.sql`) is **not**
  actually enforced on the path apps/trackers' own pages/actions use.
  Equivalent authorization is implemented in application code instead
  (`src/lib/goals.ts`'s `canViewGoal`/`canEditGoal`/`canLogProgress`,
  covered by `verify-crud.ts`'s now-deleted test run). **These two files
  must be kept in sync by hand going forward -- flagging as a real
  maintenance risk for a human to weigh**, not glossing over it.
- **Local dev-auth bypass, added this session, gated on the absence of
  real Supabase config.** Without it, `npm run dev` would be unable to get
  past `/login` at all (the Supabase client would fail on an empty/invalid
  URL before ever reaching a "no session" branch), making it impossible to
  do the real, seeded-data verification this module's task explicitly
  required. `isSupabaseConfigured()` (checked in `src/proxy.ts` and
  `src/lib/current-agent.ts`) is the single gate: when
  `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset, the
  proxy stops redirecting to `/login` and identity resolves to whatever
  agent id is in `DEV_AGENT_ID`; the moment those two env vars are set
  (i.e. any real deployment with actual credentials), this entire branch is
  unreachable and normal Supabase session auth takes over. Not a flag a
  production deploy could leave on by accident -- it's the *absence* of
  real config, and real config is required for the app to be reachable by
  real users at all (Supabase project URL is also what the browser needs).
- **`currentStreakDays` semantics**, implemented in
  `src/lib/goals.ts#computeStreakDays`: read `packages/shared-types`'s doc
  comment ("Consecutive most-recent days (including today) with at least
  one progress entry") literally -- streak is 0 unless *today* has a
  logged entry, no grace period for "haven't logged yet today, but still
  have all day." Verified with seeded data (Omar's deals-closed goal has
  no entry in the last several days -> streak reads 0 despite 2 lifetime
  entries; Farah's calls-made goal has an entry every day through today ->
  streak reads 7). Flagging the alternative reading (streak survives until
  end-of-day even without today's entry) as a defensible product choice a
  human might prefer instead -- this is the only place the rule lives, easy
  to change.
- **(Carried forward, unchanged) `AgentRole` (`agent`/`manager`/`admin`) is
  coarser than SPEC.md's 6-row RBAC table.** Visibility/edit mapping used
  (documented + tested this session): manager/admin see and edit every
  goal; an agent sees their own individual goals plus every team goal, and
  may only create/edit/log progress against their own individual goals or
  log progress against team goals (team goals are collective by design --
  any agent who can see one can contribute to it, but only a manager/admin
  can edit its target/period/status). Still a best-effort placeholder per
  the prior session's note -- a human should confirm it matches intent once
  the fuller role set exists.
- **Goal/progress-entry tables stay promoted to `packages/shared-db`**
  (prior session's decision, unchanged, restated here for continuity): read
  by module 2 (Today view) and module 11 (monthly report) too, per
  SPEC.md -- not this module's data to keep local.
