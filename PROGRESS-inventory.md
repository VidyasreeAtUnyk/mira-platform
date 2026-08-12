# Progress — inventory-developer

Status: in-progress
<!-- Change to "Status: done" only when fully complete, tested, and committed.
     monitor.sh checks for this exact string (case-insensitive) to know when
     to stop resuming / trigger the next phase. Don't mark done prematurely. -->

## Done
- Cold-started `apps/inventory` as a Node/TypeScript CLI-first app (not Next.js — no UI framework needed
  for this module's scope yet; `commander`-based CLI, `tsx` dev runner, same general db-layer pattern as
  apps/lead-agent).
- **`packages/shared-db/migrations/006_developer_inventory.sql`** (cross-module-relevant — see
  Blockers): additive migration adding new shared tables (developer partner directory, inventory units,
  MOU terms — see file for exact names/columns). Deliberately kept as **new, related-but-distinct**
  tables rather than extending the existing `properties` table: `properties` is apps/crm's own curated
  listing set; developer inventory is a different *source* (external CSV/paste feed, owned by a specific
  developer partner row, carrying fields `properties` has no use for — project name, handover date,
  payment plan, MOU-governed commission terms, ingestion provenance). Full reasoning in the migration
  file header. Does not alter, drop, or rename anything in Phase 0's `schema.sql`.
- `src/domain/types.ts`, `src/db/types.ts`: domain types for developer partners / inventory units / MOU
  terms — **genuinely generic**, not hardcoded to Sobha/DAMAC field names or enums, per SPEC.md's
  explicit requirement.
- `src/ingestion/csv.ts`: real CSV/paste ingestion (case-insensitive, loose header matching for
  real-world export inconsistency; only `project_name` required). Explicitly documented as never logging
  into anything and never storing a developer portal credential — paste and CSV-file both go through this
  same parser. Row-count capped via `src/config/limits.ts` (`MAX_INGESTION_ROWS`).
- `src/domain/mou.ts`: MOU compliance logic (renewal dates, targets, exclusivity terms).
- `src/domain/matching.ts`: buyer-demand-to-inventory matching (`findMatchingInventory()`) — same
  filtering philosophy as apps/lead-agent's `findMatchingProperties` (plain structured filtering on
  budget/location/property type, not embeddings/RAG), reading from this module's `inventory_units`
  instead of apps/crm's `properties`. Refuses to guess and returns `insufficient_profile` if the lead has
  no budget, location, or property-type signal on file — same safety rule as the original it's modeled
  on.
- `src/db/client.ts`, `src/db/queries.ts`: db layer against the shared schema + this module's new tables.
- Config: `package.json` (CLI + seed/reset-db/typecheck/test scripts), `tsconfig.json`, `.env.example`.

## In progress
- Session was interrupted mid-way through `src/db/queries.ts` per the last recorded action — some query
  functions referenced by `matching.ts` (`getMatchableLead`, `listWarmLeads`, `listAvailableInventoryUnits`)
  may not all be fully implemented yet; **verify this file's completeness first thing next session** before
  assuming the matching layer is wired end-to-end.
- No CLI command wiring (`src/cli/index.ts`, referenced in `matching.ts`'s and `csv.ts`'s doc comments as
  `inventory import --stdin` etc.) was confirmed to exist on disk.
- No seed script or test suite confirmed to exist despite being referenced in `package.json`.

## Next
1. **Finish `src/db/queries.ts`** — confirm/complete `getMatchableLead`, `listWarmLeads`,
   `listAvailableInventoryUnits` and any other query functions `matching.ts`/`mou.ts` depend on.
2. **Verify what actually exists**: check whether `src/cli/index.ts`, `src/db/seed.ts`, `src/db/reset.ts`,
   `src/tests/run.ts` (all referenced by `package.json` scripts) were written — likely still missing given
   where the interruption landed.
3. Run `npm install && npx tsc --noEmit` (or `npm run typecheck`) — **not run yet this session**,
   interrupted before verification. Do not trust "Done" items above as typechecked until this runs.
4. Apply `packages/shared-db/migrations/006_developer_inventory.sql` to a scratch local Postgres (after
   `schema.sql`) and verify it applies cleanly, same discipline as Phase 0 — **not done yet this session**,
   only written and documented, not executed.
5. Build the CLI import flow end-to-end (`inventory import <file.csv>` / `--stdin` for paste) and the
   "upcoming MOU renewals" / "expiring soon" view called for in SPEC.md.
6. Screenshot-parse ingestion (AI-vision) is explicitly scoped OUT of this session's work — CSV/paste is
   the real, working slice. If picked up later, it must go through a budget-governor-style call cap per
   CLAUDE.md, same as any other paid AI call.

## Blockers / needs human input
- **Migration filename collision risk at integration time**: this branch's new migration is numbered
  `006_developer_inventory.sql`. The `pipeline-listings` module branch (built in parallel, in an isolated
  worktree, with no visibility into this branch) independently also created a
  `006_transaction_pipeline_and_listings.sql`. The two don't conflict in content (different, unrelated new
  tables/columns), but **both are numbered 006** and will collide by filename once both branches are
  merged. Needs human resolution during the integration pass (Step 3) — renumber sequentially in whatever
  order they're actually merged, rather than guessing here since neither branch can see the other's final
  state. See PROGRESS-pipeline.md for the same flag from that side.
- **Hard rule reconfirmed, not violated**: no DAMAC/Sobha portal login-and-scrape flow was built, not even
  a stub, per CLAUDE.md's explicit prohibition. Portal ingestion beyond CSV/paste stays a human action or
  a future, separately-scoped AI-vision-on-screenshot feature.
- **This run was cut short by an account-wide session/API rate limit**, not a code or design blocker.
  Nothing in "Done" has been typechecked, migration-applied, or run this session — treat all of it as
  unverified, and specifically re-check `src/db/queries.ts`'s completeness before trusting `matching.ts`.

## Notes / decisions made
- **Branched off `origin/claude/shared-schema`, not `master`.** The orchestration run book's literal
  instruction is "create the branch off the repository's default branch (master)", but `master` does not
  yet have Phase 0 merged into it — `packages/shared-*` doesn't exist there. Building against master
  would force a forked local copy of shared types, explicitly forbidden by CLAUDE.md. So this branch
  (`claude/inventory-developer`) was cut from `origin/claude/shared-schema` instead, which is tagged
  `phase0-complete` (commit `cde0189`, independently verified). **A human will need to rebase this branch
  onto `master` once Phase 0 is actually merged there.** Same deviation applied by all 6 module branches
  this run, for the same reason.
- Chose new, related-but-distinct tables over extending `properties` for developer inventory — see "Done"
  above and the migration file header for the full reasoning (different source, different ownership,
  different fields, would otherwise bloat `properties` with always-null columns for CRM-owned rows).
