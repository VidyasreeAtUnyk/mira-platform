# Progress — phase0 — shared-schema-and-crm-merge

Status: done

## Done
- Root npm workspace set up (`package.json` with `workspaces: ["apps/*","packages/*"]`); root `package-lock.json` is now
  canonical, per-app `package-lock.json` files removed.
- `packages/shared-types`: canonical TS types for the merged schema (agents, leads, interactions, engagement_events,
  proposals, ai_suggestions, audit_log, properties, property_price_history, dld_price_index), plus the lead lifecycle
  state machine (`stage.ts`) and the `CRM_STATUS_TO_STAGE`/`STAGE_TO_CRM_STATUS` mapping. Ships as a **precompiled**
  package (`npm run build`, output in `dist/`, committed) so both Next.js's bundler and lead-agent's NodeNext/tsx
  toolchain can consume it without extension-resolution fights. `npm install` at repo root auto-rebuilds it via
  `postinstall`. Added `property_interest` (free text) to `Lead`/`CreateLeadInput` this run -- see Notes.
- `packages/shared-db/schema.sql`: canonical Postgres schema for the merged model. Verified applying cleanly to a
  fresh local Postgres 16 database, and (this run) exercised for real by `apps/lead-agent`'s full db layer.
- `apps/crm` consumes `@mira/shared-types` (`src/types/index.ts` is a thin re-export). Migrations
  `apps/crm/supabase/migrations/004_shared_schema_merge.sql` and `005_lead_agent_property_interest.sql` (this run)
  bring CRM's Supabase schema up to the shared shape. **Verified**: `001` through `005` applied in sequence against a
  scratch local Postgres 16 database this run (stub `auth.uid()` for RLS syntax only) -- applies clean.
  **Not yet applied to the real Supabase project** -- no live Supabase credentials exist anywhere in this repo (see
  Blockers). `apps/crm` typechecks clean (`npx tsc --noEmit`, re-verified this run after the shared-types change).
- **`apps/lead-agent` fully migrated off `node:sqlite` onto the shared Postgres schema this run** (the piece the
  previous run left as "In progress"). Every file that touched the old `DatabaseSync`-based db layer was converted:
  - `src/db/client.ts`: `pg` `Pool`-based, applies `packages/shared-db/schema.sql` + this app's own
    `src/db/local-schema.sql` on first use (same idempotent "apply on startup" pattern as before). Registers a
    `numeric` type parser (pg returns `numeric` columns as strings by default -- `budget_min/max`, `price`,
    `avg_price` need real numbers for the arithmetic in `findMatchingProperties`/`getPropertyMarketData`/
    `stateMachine`).
  - `src/db/local-schema.sql` (new): `run_state`/`run_metrics`, app-local per CLAUDE.md's module-boundary rule,
    applied against the same database as the shared tables.
  - `src/db/queries.ts`: full async rewrite against `pg`, positional (`$1, $2, ...`) params, uuid ids throughout.
    `interactions`→`engagement_events`, `timestamp`→`created_at` column renames applied at every call site.
  - `src/domain/types.ts`: re-exports the shared types instead of redefining them (`Interaction`→`EngagementEvent`,
    `Actor`→`AuditActor`); `RunMetric`/`RunOutcomeKind` stay local (app-local table).
  - `src/domain/stateMachine.ts`: now imports `STAGE_EDGES`/`isLegalStageTransition`/`canReactivateFrom` from
    `@mira/shared-types` instead of defining its own copy; keeps the lead-agent-specific pure functions
    (`hasSufficientProfile`, `nextStageAfterMessageSend`, etc.) which aren't part of the shared contract.
  - `src/domain/grounding.ts`, `dealClose.ts`, `metrics.ts`: async, `Db`-typed, jsonb columns read as already-parsed
    objects (no `JSON.parse` -- that was a real gotcha, see Notes).
  - `src/tools/*.ts` (all 10) + `src/tools/index.ts`/`types.ts`: `execute` is now `async`, ids are uuid strings
    (Zod: `z.string().uuid()`), `sendMessage` reads `lead.phone` (was `lead.contact`).
  - `src/agent/openaiTools.ts`: JSON schemas sent to the model changed from `{type: "integer"}` to
    `{type: "string", description: "UUID"}` for every id field the model round-trips.
  - `src/agent/loop.ts`, `queue.ts`, `runQueue.ts`, `resumeWorker.ts`: async throughout, `leadId: string`.
  - `src/agent/demoResume.ts`: reworked away from deleting SQLite file/WAL/SHM sidecars (no file to delete) to a
    dedicated `mira_leadagent_demo` Postgres database, truncated+reseeded per run. Spawns the worker via `npx tsx`
    (not a hand-built path to tsx's CLI entry) -- npm workspaces hoist `tsx` to the repo root's `node_modules`, and
    a constructed `../../node_modules/tsx/dist/cli.mjs` path breaks under hoisting (caught and fixed this run --
    see Notes).
  - `src/db/seed.ts`: full rewrite. Ids are DB-generated uuids now, not fixed integers 1-8, so `seedDatabase()`
    returns a `{leads: {alice, bob, ...}, properties: {maple, oak, ...}}` name→id map; every caller (CLI, evals,
    demo) looks a lead up by name instead of hardcoding a number.
  - `src/db/reset.ts`: `TRUNCATE ... CASCADE` (all shared + local tables) instead of deleting a SQLite file.
  - `src/cli/index.ts`: every command `async`/`await`s the db layer; `parsePositiveInt` replaced with a UUID-format
    `parseId` (CLI users now pass UUIDs, not small integers -- a real, visible CLI UX change, expected given "UUID
    ids instead of integer autoincrement" was explicit in the previous run's plan).
  - `src/tests/testHelpers.ts` + all 5 `*.test.ts` files + `src/tests/run.ts`: `createTestDb()` now connects to a
    dedicated `mira_leadagent_test` Postgres database and `TRUNCATE ... CASCADE`s every relevant table before each
    call (functionally equivalent isolation to the old fresh `:memory:` db per test, without needing per-test
    transaction/rollback plumbing). Every test's fixture lead/property ids are generated via `randomUUID()` in the
    test itself instead of hardcoded integers.
  - `src/evals/run.ts`: converted the same way, using a dedicated `mira_leadagent_evals` database and
    `seedDatabase()`'s returned id map. **Not run this session** -- evals call the real OpenAI API and no
    `OPENAI_API_KEY` exists in this sandbox; converted for correctness (typechecks) but unverified end-to-end. Flag
    for whoever has an API key to run `npm run evals` for real confidence.
  - `package.json`: added `pg`/`@types/pg`/`@mira/shared-types` deps, removed nothing (`node:sqlite` was a Node
    builtin, no package to remove). `.env.example` gained `DATABASE_URL` (empty, no value committed).

## In progress
- Nothing -- both apps read/write the shared schema now. See Blockers for what's genuinely left (all environment/
  credentials issues, not code).

## Update -- 2026-08-14, Agent Core (SPEC.md phase 1) budget governor wired
`apps/lead-agent`'s reasoning loop (`src/agent/loop.ts`) already existed in full from Phase 0 -- OpenAI tool-calling,
propose/approve/send state machine, retry/backoff, resumable queue processing (`src/agent/runQueue.ts`) -- but had
never been run against a live `OPENAI_API_KEY`, and had no hard cap on call volume. This run added:
- `src/agent/budgetGovernor.ts` + a new app-local `ai_call_log` table (`src/db/local-schema.sql`) -- hard cap
  (`AGENT_CORE_DAILY_CALL_CAP`, default/current value 50/day), persisted in Postgres so it survives restarts and
  holds across concurrent workers. App-local rather than shared, per the precedent `packages/shared-db/README.md`
  already documents for `apps/social-assistant`'s own `ai_call_log` -- no cross-module Agent Core exists yet to
  justify a shared ledger.
- Wired into `loop.ts` (checked before every real completion call; a budget-exceeded lead escalates gracefully via
  the existing `escalate_to_agent` tool, same as any other LLM failure) and `runQueue.ts` (a cheap pre-check skips
  starting a fresh pass entirely once the cap is spent, rather than parking every queued lead one at a time).
- `apps/lead-agent/.env` (gitignored, not committed) now has a real `OPENAI_API_KEY` and `DATABASE_URL` pointed at
  `mira_staging_dev` -- the same database every other module reads, so this app's proposals genuinely feed
  `apps/dashboard`'s Review Queue now, not a disconnected local database.
- **Verified live, with explicit human sign-off before spending real API calls**: cap-forced-to-0 test correctly
  refused with zero spend; a real run against one lead (`Fatima Hassan`) made a real OpenAI request, correctly
  recorded it against the budget ledger (1/50), and hit a real 429 from the OpenAI account's own tokens-per-minute
  limit (100k/100k used) -- the retry/backoff logic correctly recognized OpenAI's own stated ~11h reset as not worth
  retrying and escalated the lead cleanly instead of hanging, exactly as designed. The account behind the supplied
  key needs billing/a higher tier before further live runs will actually produce proposals -- not a code blocker.

This is the first real instance of Agent Core's "scheduled + event-triggered reasoning loop" running against live
data, scoped to module 1 (CRM + lead follow-up) only. A true cross-module Agent Core (reasoning over inventory
compliance alerts, social captions, comms drafts too) is still not built -- see SPEC.md phase 1 and
PROGRESS-integration.md's roadmap notes.

## Next
For whoever picks this up (a human, or a future module-branch session per MODULES.json Step 2, now unblocked):
1. Supply real Supabase Postgres credentials (see Blockers) and run `supabase db push` (or apply
   `001`-`005` manually) against the actual project; point `apps/lead-agent`'s `DATABASE_URL` at the same database
   so "shared schema" is genuinely one physical database, not two identically-shaped local ones.
2. Run `npm run evals` (needs `OPENAI_API_KEY`) for full end-to-end confidence beyond the unit test suite.
3. CRM's Kanban board still reads the legacy `status` column, not `stage` -- see Blockers, needs a product decision.
4. Module branches (dashboard, trackers, social-assistant, comms-hub, pipeline-listings, inventory-developer) can
   now start per MODULES.json Step 2 -- `phase0-complete` is tagged as of this run's final commit.

## Blockers / needs human input
- **No live Postgres/Supabase credentials exist anywhere in this repo.** Same blocker as last run, now also
  applying to `apps/lead-agent`: its `DATABASE_URL` defaults to a local no-password dev database
  (`postgres://localhost:5432/mira_leadagent_dev`) purely for local dev/test -- not pointed at the real Supabase
  project, because that connection string doesn't exist here. Until a human supplies it, `apps/crm` and
  `apps/lead-agent` are schema-identical but not actually sharing one physical database yet.
  1. Migration `005_lead_agent_property_interest.sql` (like `004`) verified against scratch local Postgres only.
  2. `apps/lead-agent`'s `DATABASE_URL` needs the real Supabase Postgres connection string (not the `NEXT_PUBLIC_
     SUPABASE_*` REST/anon values `apps/crm` uses) once available.
- **CRM's Kanban board still reads/writes the legacy `status` column**, not `stage` -- unchanged from last run,
  still a product decision (7 columns vs the full 9-stage funnel), not something to guess at.
- **`apps/lead-agent`'s evals suite (`npm run evals`) was converted but not run** -- needs a real `OPENAI_API_KEY`,
  which doesn't exist in this sandbox. The 26-test unit suite (no API key needed) passed in full; the evals are the
  next tier of confidence (full LLM-driven scenarios) and should be run by whoever has a key before relying on this
  in anger.
- **`apps/lead-agent`'s resumability demo (`npm run demo:resume`) could not be exercised past the "spawn a child,
  it calls the real OpenAI API" point** -- verified the plumbing (seed, spawn via `npx tsx`, db close/reopen across
  process boundaries, state readback) works correctly; the child process fails fast on the missing API key exactly
  as designed (`getClient()` throws before any tool call), so the actual kill-mid-run/resume race is unverified.

## Notes / decisions made
- **Canonical DB engine = Postgres (via CRM's existing Supabase project).** Unchanged from last run's decision --
  see prior notes below.
- **`leads.stage` (9 values) canonical, `leads.status` (7 values) kept unenforced/display-only.** Unchanged.
- **`interactions` vs `engagement_events`, `proposals` vs `ai_suggestions` kept separate.** Unchanged.
- **`property_interest` (free text) added to `leads` this run** (migration 005): a gap found while wiring up
  `apps/lead-agent`'s `findMatchingProperties`/`hasSufficientProfile` -- its fixture/demo data describes what a
  lead wants as free text ("house", "condo", "studio apartment", "penthouse") that doesn't parse onto `property_
  type`'s enum (apartment/villa/townhouse/commercial/land), neither in vocabulary nor granularity. Same pattern as
  `location_pref` sitting alongside `preferred_areas` in migration 004: structured field for CRM's leads, freeform
  field for lead-agent's discovery-stage leads, kept separate rather than lossily forcing one onto the other.
- **pg's default `numeric`→string parsing was a real, silent-failure-shaped gotcha.** `budget_min/max`, `price`,
  `avg_price` are all Postgres `numeric`; `node-postgres` returns those as strings by default (avoids float
  precision loss on values outside safe-integer range) -- `p.price > lead.budget_max * 1.1` would have silently
  done string concatenation instead of a numeric comparison if left unhandled. Fixed once, centrally, via a
  `pg.types.setTypeParser` registration in `db/client.ts` rather than casting at every call site.
- **jsonb columns come back already parsed.** `audit_log.input_json`/`output_json`, `ai_suggestions`-adjacent jsonb
  columns -- `node-postgres` parses `jsonb` into JS values automatically. The old SQLite code stored these as `TEXT`
  and `JSON.parse`d them at every read site; porting that pattern forward unchanged would have thrown on data that
  was already an object. Every read site (`grounding.ts`, `queries.ts`'s `getEscalationStatus`, `metrics.ts`, the
  CLI's `history` command, tests) was updated to treat these as plain objects.
- **npm workspace hoisting broke a hand-built path to `tsx`'s CLI entry point.** `demoResume.ts` (written before the
  previous run's workspace migration) constructed `path.join(__dirname, "..", "..", "node_modules", "tsx", "dist",
  "cli.mjs")`, which resolves correctly when `tsx` is installed locally to `apps/lead-agent` but breaks once
  workspace hoisting moves it to the repo root's `node_modules` instead -- exactly what happened here (caught by
  actually running the script, not just typechecking it: `import.meta.resolve` was tried first and also failed,
  since `tsx`'s `package.json` doesn't expose `./dist/cli.mjs` as an `exports` subpath). Fixed by spawning via
  `npx tsx <path>` (PATH-based resolution, which npx already knows how to walk up to a hoisted root) instead of
  constructing a path by hand. Worth checking for the same class of bug in any other script written before the
  workspace migration that shells out to a dev dependency's CLI.
- **Test isolation uses truncate-before-each-test against a real Postgres database, not per-test transactions.**
  The old SQLite tests got free isolation from a fresh `:memory:` db per test. The equivalent here would be a
  transaction-per-test (BEGIN before, ROLLBACK after, every query in the test going through that one client) --
  correct but requires threading a checked-out `PoolClient` through the whole call chain and an explicit
  after-each hook the test runner (`src/tests/run.ts`) doesn't currently have. Chose the simpler
  `TRUNCATE ... CASCADE` at the top of `createTestDb()` instead: each of the 26 tests already generates its own
  fresh `randomUUID()` fixture ids and doesn't depend on any other test's leftover state, so truncation gives the
  same practical isolation at a fraction of the plumbing, at the cost of a bit of extra round-trip time (test suite
  still runs in a couple of seconds). Revisit if the suite grows large enough for that to matter.

## Verification performed this run
- `packages/shared-types`: `npm install && npx tsc --noEmit` clean; rebuilt via `npm run build` (precompiled
  `dist/` output, committed).
- `apps/crm`: `npx tsc --noEmit` clean after the `property_interest` addition (re-verified, not just assumed
  unaffected).
- `apps/crm/supabase/migrations/001` through `005` applied in sequence to a fresh scratch local Postgres 16
  database (stub `auth.uid()` for RLS syntax only) -- applies clean.
- `apps/lead-agent`: `npx tsc --noEmit` (strict mode) clean.
- `apps/lead-agent`: full unit test suite, **26/26 passed** against a real local Postgres 16 database
  (`mira_leadagent_test`), not a mock -- `npm run test` equivalent, run via
  `TEST_DATABASE_URL=... npx tsx src/tests/run.ts`.
- `apps/lead-agent`: seeded a real local Postgres dev database (`mira_leadagent_dev`) end-to-end via
  `src/db/seed.ts`, then exercised `dashboard`/`metrics`/`proposals` CLI commands against it -- correct output,
  correct uuid ids, correct stage/segment rendering.
- `apps/lead-agent`: manually drove the full tool-call chain against the seeded dev database outside the test
  suite -- `get_lead_context` → `find_matching_properties` (confirmed numeric `price`/`budget_max` comparison works
  correctly, not string comparison) → `get_property_market_data` → `propose_message` → approve → `send_message`.
  Confirmed the lead's `stage` transitioned `new` → `contacted`, `contact_count` incremented, `last_contacted_at`
  set correctly.
- `apps/lead-agent`: ran `demoResume.ts` end-to-end. Seed/spawn/db-close-reopen/state-readback plumbing all work
  correctly across the process boundary; the actual OpenAI call fails fast on the missing API key exactly as
  designed (not a bug -- expected in a sandbox with no key), so the kill-mid-run race itself is unverified.
- Did **not** run `npm run evals` (needs a real `OPENAI_API_KEY`, none available here) -- see Blockers.
- Did **not** apply any migration to a real Supabase project (no credentials available here) -- see Blockers.

## phase0-complete
Completion criterion from MODULES.json's phase0 prompt -- "shared schema/types exist under packages/, and both
apps/crm and apps/lead-agent read/write it" -- is met and verified locally to the fullest extent possible without
live Supabase credentials (which don't exist anywhere in this repo; see Blockers). Per CLAUDE.md, missing
credentials are flagged rather than guessed at or blocking indefinitely -- the remaining "point both apps at the
same real database" step is an environment/ops action for a human with access, not something this or any future
automated run can do blind.

**The tag itself could NOT be pushed this run.** `git tag -a phase0-complete ... && git push origin
phase0-complete` was attempted on the final commit (`6f94f77`); the push consistently failed with `HTTP 403` /
"the remote end hung up unexpectedly" (confirmed not transient -- retried once, same error). This session's git
credentials appear scoped to pushing the `claude/*` branch only, not tag refs, and no GitHub-API-based
tag-creation tool was available either (only read tools -- `get_tag`/`list_tags` -- were exposed). **A human needs
to run `git tag phase0-complete 6f94f77 && git push origin phase0-complete` (or create the tag via the GitHub UI/
API) once this branch is reviewed** -- until that tag exists on the remote, future automated runs following the
orchestration prompt will correctly see Phase 0 as still incomplete (per the "check whether the git tag
phase0-complete exists" step) and will re-enter Phase 0 rather than proceeding to Step 2 module work, even though
the code itself is done. This is the safe failure mode (no module work starts on a false premise) but it does mean
Step 2 stays blocked until a human pushes the tag.
