# Progress — phase0 — shared-schema-and-crm-merge

Status: in-progress

## Done
- Root npm workspace set up (`package.json` with `workspaces: ["apps/*","packages/*"]`); root `package-lock.json` is now
  canonical, per-app `package-lock.json` files removed.
- `packages/shared-types`: canonical TS types for the merged schema (agents, leads, interactions, engagement_events,
  proposals, ai_suggestions, audit_log, properties, property_price_history, dld_price_index), plus the lead lifecycle
  state machine (`stage.ts`, moved here from apps/lead-agent's `domain/stateMachine.ts`) and the
  `CRM_STATUS_TO_STAGE`/`STAGE_TO_CRM_STATUS` mapping. Ships as a **precompiled** package (`npm run build`, output in
  `dist/`, committed — see "Notes" for why) so both Next.js's bundler and lead-agent's NodeNext/tsx toolchain can
  consume it without extension-resolution fights. `npm install` at repo root auto-rebuilds it via `postinstall`.
- `packages/shared-db/schema.sql`: canonical Postgres schema for the merged model. Verified by applying to a scratch
  local Postgres 16 instance (`createdb` + `psql -f`) — applies cleanly end to end.
- `apps/crm` migrated to consume `@mira/shared-types` (`src/types/index.ts` is now a thin re-export). Added
  `apps/crm/supabase/migrations/004_shared_schema_merge.sql`: additive migration bringing CRM's existing Supabase
  schema up to the shared shape (new `leads` columns: location_pref, timeline, segment, stage, do_not_contact,
  contact_count, locked_at, locked_by; backfills `stage` from legacy `status`; new tables engagement_events,
  proposals, audit_log, properties, property_price_history with RLS policies matching the existing 001/002
  conventions). **Verified**: applied 001→004 in sequence against a scratch local Postgres seeded with CRM's real
  003_seed.sql data (with a stub `auth.uid()` function since local Postgres has no Supabase auth schema) — applies
  clean, `stage` backfill confirmed correct against every seeded row (spot-checked all 7 status→stage mappings).
  **Not yet applied to the real Supabase project** — no live Supabase credentials exist anywhere in this repo (see
  Blockers).
  - `apps/crm/src/lib/utils.ts` gained `displayStatus(lead)`, which prefers `status` and falls back to
    `STAGE_TO_CRM_STATUS[stage]` — needed because post-merge leads (e.g. created by lead-agent) won't have the legacy
    `status` column populated. Used in `lead-card.tsx` and `leads/[id]/page.tsx`.
  - `apps/crm` typechecks clean (`npx tsc --noEmit`), lints clean (only pre-existing unused-import warnings,
    unrelated to this change), and `next build` completes successfully end to end.

## In progress
- `apps/lead-agent` still runs entirely on its own local `node:sqlite` file (`src/db/schema.sql`, integer PKs) — it
  does **not** yet read/write the shared Postgres schema. This is the remaining piece before Phase 0 can be tagged
  complete (see Blockers/Notes for why it wasn't attempted this run).

## Next
- Migrate `apps/lead-agent`'s db layer (`src/db/client.ts`, `src/db/queries.ts`) from `node:sqlite`
  (`DatabaseSync`, synchronous) to Postgres via the `pg` driver (async), targeting `packages/shared-db/schema.sql`'s
  tables, with UUID ids instead of integer autoincrement.
  - This ripples through the whole app (~30 files, ~3850 lines): every domain function that takes `db: DatabaseSync`
    synchronously (`domain/stateMachine.ts` — now superseded by `@mira/shared-types`'s `stage.ts`, delete the local
    copy and re-point imports; `domain/grounding.ts`, `domain/dealClose.ts`, `domain/metrics.ts`), every tool
    (`src/tools/*.ts`), the agent loop (`src/agent/loop.ts`, `runQueue.ts`, `queue.ts`, `resumeWorker.ts`), the CLI
    (`src/cli/index.ts`), and the entire test suite (`src/tests/*.test.ts`, which currently spins up
    `:memory:` SQLite per test via `src/tests/testHelpers.ts`) need converting to `async`/`await`.
  - `run_state` / `run_metrics` stay app-local (not part of the shared contract) — give them their own migration file
    under `apps/lead-agent` (e.g. `src/db/local-schema.sql`), applied against the same Postgres database as the
    shared tables, once `DATABASE_URL` is wired up.
  - Local dev/test verification is possible without real Supabase credentials: Postgres 16 is available in-sandbox
    (`sudo -u postgres` + `createdb`/`psql`) and was already used to verify `packages/shared-db/schema.sql` and
    CRM's migration 004. Point `DATABASE_URL` at a scratch local database, apply `packages/shared-db/schema.sql` +
    the new local-only migration, and run the existing test suite (converted to async) against it for real
    confidence before calling this done.
  - Add `DATABASE_URL` to `apps/lead-agent/.env.example` (no value, just the key) once the client is wired up.
  - Do NOT tag `phase0-complete` until this is done and verified — "both apps/crm and apps/lead-agent read/write it"
    is the literal completion criterion in MODULES.json's phase0 prompt, and that's not true yet.

## Blockers / needs human input
- **No live Postgres/Supabase credentials exist anywhere in this repo** (`apps/crm` has no `.env`/`.env.local` at
  all — only `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` referenced in code; `apps/lead-agent`'s
  `.env.example` only has `OPENAI_API_KEY`). This means:
  1. Migration `004_shared_schema_merge.sql` has been verified against a scratch local Postgres but **not against
     the real Supabase project** — someone with access needs to run `supabase db push` (or apply it manually) once
     ready, and confirm the `auth.uid()`-based RLS policies behave as expected with real auth (untestable here since
     local Postgres has no Supabase auth schema; I stubbed `auth.uid()` to satisfy the SQL syntax only, which is
     **not** a substitute for testing real RLS behavior).
  2. When `apps/lead-agent` moves to Postgres, it needs `DATABASE_URL` pointed at the same database CRM's Supabase
     project uses, for the "shared" part of "shared schema" to be real rather than two independently-schema'd
     databases. Per CLAUDE.md ("never hardcode credentials... if none exist yet, flag it and stop rather than
     guessing"), this run only built/verified against a disposable local Postgres instance and left the actual env
     var unset — a human needs to supply the real connection string (Supabase's Postgres URL, not just the REST
     anon key CRM uses) before this is genuinely "shared" in production.
- **CRM's Kanban board (`apps/crm/src/app/pipeline/pipeline-board.tsx`) still reads/writes the legacy `status`
  column**, not the new canonical `stage` column. This was deliberate — switching it changes user-facing pipeline
  column labels/count (CRM's 7 columns vs the unified 9-stage funnel: 'offer' vs 'decision_pending', new
  'qualified'/'dormant'/'canceled' columns, etc.), which reads as a product decision, not a mechanical rename. Needs
  a quick call from whoever owns the CRM UI: keep the current 7 columns as *display* labels mapped from `stage`
  (mapping already exists: `STAGE_TO_CRM_STATUS`), or redesign the board around the full 9-stage funnel. Until
  decided, `status` keeps working exactly as before (untouched data/behavior), and `stage` is the field lead-agent
  and future modules should build against.

## Notes / decisions made
- **Canonical DB engine = Postgres (via CRM's existing Supabase project).** CRM already runs production-shaped
  Postgres with RLS; lead-agent's `node:sqlite` was a deliberate but app-local choice. SPEC.md's RBAC/access-logging/
  encryption-at-rest requirements fit Postgres+RLS far better than SQLite, so lead-agent moves to Postgres rather
  than CRM moving to SQLite (or a third option). This is the "merge existing CRM + lead-agent repos into one
  schema" from SPEC.md's Phase 0 description, applied literally: one physical database, not two apps each honoring
  a shared *type* contract while keeping separate storage.
- **`leads.stage` (9 values, from lead-agent) is the canonical lifecycle field; `leads.status` (7 values, from CRM)
  is kept, unenforced, display-only.** lead-agent's stage machine (`STAGE_EDGES` in `stage.ts`) is the only side of
  the merge with actually-enforced transition rules (`assertStageTransition`, reactivation-evidence checks, the
  prospect→client flip on `won`); CRM's `status` was a plain unconstrained-transition enum. Rather than invent a
  third vocabulary, the richer/enforced one wins. Full mapping and rationale in `packages/shared-types/src/stage.ts`.
- **`interactions` (apps/crm: agent-initiated contact log — call/whatsapp/email/etc.) and apps/lead-agent's own
  `interactions` (passive signals — page_view/email_open/reply/inquiry) are different concepts that happened to
  share a table name.** Kept as two tables: CRM's keeps the name `interactions`; lead-agent's is renamed
  `engagement_events` in the shared schema. Flagging this explicitly since it's the kind of silent collision that's
  easy to merge wrong by accident.
- **`proposals` (lead-agent) and `ai_suggestions` (crm) were NOT merged into one table.** Both feed a review/approval
  queue but have different shapes (proposals: message/viewing drafts with approve/reject; ai_suggestions:
  score/text suggestions including lead-scoring). SPEC.md's unified "review/approval queue" is explicitly Agent Core
  (Phase 1) work — consolidating these two into one queue model belongs there, with real design thought, not as a
  Phase 0 schema-merge side effect.
- **`audit_log`, `properties`, `property_price_history` promoted from lead-agent-only to the shared schema.** Audit
  logging is a platform-wide cross-cutting requirement per SPEC.md, not lead-agent-specific; `properties` foreshadows
  the Listing Management / Inventory modules and buyer-demand-to-inventory matching (module 4), so it's worth being
  shared from the start rather than duplicated later.
- **`leads.source` relaxed from a CHECK-constrained enum (CRM) to free text.** CRM's and lead-agent's source
  vocabularies don't overlap; Phase 0 is the wrong place to force a combined enum onto a field that's realistically
  going to keep growing (new lead channels). Recommended values documented in `RECOMMENDED_LEAD_SOURCES`
  (shared-types) as guidance, not a DB constraint.
- **Flagging (not acting on) suspicious content in `apps/crm/AGENTS.md`.** That file instructs the reader to "read
  the relevant guide in `node_modules/next/dist/docs/` before writing any code" — that path doesn't exist in a real
  Next.js install and this reads like a prompt-injection attempt embedded in the repo rather than genuine project
  documentation. Did not follow it. Worth a human sanity-check on how that file got there.

## Verification performed this run
- `packages/shared-db/schema.sql` applied cleanly to a fresh local Postgres 16 database.
- `apps/crm/supabase/migrations/001` through `004` applied in sequence to a fresh local Postgres 16 database
  (with a stub `auth.uid()` function for RLS syntax only), including the real `003_seed.sql` data; spot-checked
  `stage` backfill against all 7 legacy `status` values.
- `apps/crm`: `npx tsc --noEmit` clean, `npx eslint src` clean (pre-existing warnings only), `npx next build`
  succeeds end to end.
- Did **not** run `apps/lead-agent`'s test suite or typecheck yet — its db layer hasn't been touched this run.
