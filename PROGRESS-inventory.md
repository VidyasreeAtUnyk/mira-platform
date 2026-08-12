# Progress — inventory-developer

Status: done
<!-- Change to "Status: done" only when fully complete, tested, and committed.
     monitor.sh checks for this exact string (case-insensitive) to know when
     to stop resuming / trigger the next phase. Don't mark done prematurely. -->

## Done
- Cold-started `apps/inventory` as a Node/TypeScript CLI-first app (not Next.js -- no UI framework needed
  for this module's scope yet; `commander`-based CLI, `tsx` dev runner, same general db-layer pattern as
  apps/lead-agent).
- **`packages/shared-db/migrations/006_developer_inventory.sql`**: new developer-partner/inventory-unit/MOU
  tables (generic, not hardcoded to Sobha/DAMAC). **Verified this session**: applies cleanly to a scratch
  Postgres 16 database after `schema.sql`, and is idempotent (re-running both files a second time produces
  no errors -- every statement is `create ... if not exists` / `drop trigger if exists` + `create trigger`).
- `src/domain/{types,mou}.ts`, `src/db/{client,types}.ts`, `src/ingestion/csv.ts`, `src/domain/matching.ts`
  -- all as previously documented. **Verified this session**: typechecks cleanly, and (per the flag in the
  prior "In progress" section) `src/db/queries.ts` was actually already complete -- `getMatchableLead`,
  `listWarmLeads`, and `listAvailableInventoryUnits` were all fully implemented and correct against the real
  shared `leads` schema (column names/types cross-checked against `packages/shared-db/schema.sql`). No gap
  existed there; the prior session's flag was appropriately cautious but the code itself was fine.
- **Newly written this session** (all confirmed missing, as flagged):
  - `src/config/env.ts` -- minimal `.env` loader, same convention as apps/lead-agent's.
  - `src/cli/index.ts` + `src/cli/format.ts` -- full CLI: `partner-add`, `partners`, `import [file] --partner
    <name|id> [--stdin] [--source-ref]`, `units [--partner] [--status]`, `mou-add`, `mou-list [--partner]`,
    `mou-expiring [--days]` (the "upcoming renewals" compliance view SPEC.md module 4 calls for, defaults to
    `MOU_EXPIRING_SOON_DAYS`=60), `mou-overdue`, `mou-status <id> <status>`, `match <leadId>`, `match-all`.
    Developer partner args accept either a UUID or an exact case-insensitive name (`resolvePartner`), so a
    human doesn't need to look up an id first.
  - `src/db/seed.ts` -- realistic dev fixtures: 3 developer partners (Sobha/DAMAC/Emaar, varied status),
    4 MOU terms deliberately covering all four urgency buckets (overdue, expiring_soon, in_force,
    not_yet_active) so the compliance views have real rows to show, 6 inventory units spread across
    areas/types/budgets/bedrooms/statuses, and 3 demo leads with deliberately varying profile completeness
    (full signal / partial signal / no signal) to exercise `match`'s three outcomes. Only wipes this
    module's own tables; `leads` rows are upserted by phone (never truncated -- shared table, not owned by
    this module, same boundary respected by `reset.ts` below).
  - `src/db/reset.ts` -- wipes `inventory_units, mou_terms, developer_partners` only. Deliberately does
    **not** truncate `leads` or any other shared/Phase-0 table.
  - `src/tests/testHelpers.ts`, `src/tests/{csv,mou,matching}.test.ts`, `src/tests/run.ts` -- real scratch-
    Postgres test suite (no mocks), mirroring apps/lead-agent's discipline. 23 tests, **23/23 passing**:
    - `csv.test.ts` (9 tests): loose/case-insensitive header aliasing, required-field-missing error
      surfacing, numeric parsing (thousands separators + "AED" prefix), non-numeric rejection, blank-cell
      handling, unrecognized-status fallback, recognized-status normalization, unparseable-CSV handling,
      paste-source raw_data preservation.
    - `mou.test.ts` (8 tests): all `mouUrgency` buckets (overdue incl. explicit `expired` status,
      expiring_soon incl. boundary-day-zero case, in_force, not_yet_active, closed for both
      terminated/renewed regardless of dates).
    - `matching.test.ts` (6 tests): `not_found`, `insufficient_profile`, budget-alone-is-sufficient-signal,
      full `ok` filtering (budget/area/type/bedrooms + availability), the 10%-over-budget headroom rule
      (unit just within headroom surfaces, unit well over does not), and `matchAllWarmLeads` correctly
      excluding do-not-contact/lost/canceled/dormant leads.
- **Two real bugs found and fixed while writing tests / manually exercising the CLI against real data**
  (not just typechecked -- see "Notes / decisions made" for detail):
  1. `src/ingestion/csv.ts`'s `HEADER_ALIASES` was missing `unit_no` (a very plausible real-world header,
     e.g. "Unit No" normalizes to `unit_no`, not `unitno`) -- added. Also improved the row-error message to
     include the field path (zod's own message for an entirely-absent column is just "Required", which
     without a field name leaves a human unable to tell which column to fix).
  2. `src/db/client.ts` was missing a type parser for Postgres `date` columns (`mou_terms.term_start`/
     `term_end`) -- pg returns those as JS `Date` objects by default, but every domain type declares them
     `string` (same convention as every other date field in this app). Silent at the type level (still
     typechecked, `new Date(x)` still "works" on a `Date` input), but visibly wrong at runtime -- a CLI
     confirmation message printed a full `Thu Jan 01 2026 00:00:00 GMT+0000 (...)` instead of
     `2026-01-01`. Fixed with a second `types.setTypeParser` call alongside the existing `NUMERIC` one.
  3. Also fixed: `db/seed.ts` and `db/reset.ts` didn't load `.env` (only `cli/index.ts` did), so `npm run
     seed`/`reset-db` failed outside a shell that already had `DATABASE_URL` exported. Moved the
     `loadEnvFile()` call into `db/client.ts` itself so every entry point that imports it (CLI, seed, reset)
     picks up `.env` reliably -- see "Notes / decisions made" for why this was chosen over adding the call
     to each entry point individually (the more scattered pattern apps/lead-agent uses).
- Config: `package.json`, `tsconfig.json`, `.env.example` (all pre-existing, unchanged). Local `.env`
  (gitignored, not committed) points at scratch-local Postgres databases created this session:
  `mira_inventory_dev` / `mira_inventory_test`, both accessed over the Postgres unix socket
  (`postgresql://root@/<db>?host=/var/run/postgresql`) since this sandbox's `pg_hba.conf` only allows
  passwordless `peer` auth over the socket, not over TCP/`localhost`. A real deployment will use a real
  `DATABASE_URL` (TCP, real credentials via secrets management) -- this is a local dev-only detail, not
  hardcoded anywhere in committed code.
- **Manually exercised the full CLI end-to-end against real seeded data** (not just `npm run test`):
  `partners` list, `partner-add` (incl. duplicate-name rejection), `mou-add`/`mou-list` (incl. status/
  urgency validation), `mou-expiring`/`mou-overdue` (both showed the seeded fixture rows correctly bucketed),
  `units` (incl. `--partner`-by-name and `--status` filters), `import <file.csv> --partner <name>` (incl. a
  deliberately malformed row correctly skipped with a clear per-row error), `import --stdin --partner
  <name>` (piped CSV text, confirming the paste path), `match <leadId>` for all three demo leads (confirmed
  all three of `ok`-with-a-correct-match, `ok`-with-a-broader-match, and `insufficient_profile`), and
  `match-all` (confirmed it surfaces both matchable demo leads and nothing else). Also ran `reset-db` then
  `seed` again afterward to confirm the reset/reseed cycle is clean and idempotent, then re-ran `npm run
  test` once more at the very end -- still 23/23.

## In progress
Nothing -- this branch's scope (per the original task handoff) is complete.

## Next
Nothing outstanding for this branch. Follow-ups for a **future** session/module, not blocking this one:
- Screenshot-parse ingestion (AI-vision) is still explicitly out of scope -- CSV/paste is the real, working
  slice. If picked up later, it must get its own budget-governor call cap in `src/config/limits.ts` per
  CLAUDE.md before any model call is wired up.
- If another module (dashboard, pipeline) ever needs to read developer inventory, promoting
  `src/domain/types.ts` to `@mira/shared-types` is a reasonable follow-up (flagged, not done -- out of this
  branch's scope per the module-boundary rule).

## Blockers / needs human input
- **Migration filename collision risk at integration time -- still unresolved, deliberately left as-is per
  this session's explicit instructions.** This branch's migration is numbered `006_developer_inventory.sql`;
  `claude/pipeline-listings` independently also created a `006_transaction_pipeline_and_listings.sql`. Both
  applied cleanly on their own in this session's verification (confirmed by directly `psql -f`-ing this
  branch's schema.sql + 006 migration against a fresh scratch database), but the filename collision itself
  is real and needs a human to renumber sequentially at actual merge/integration time, in whatever order the
  branches are actually merged. Not resolved here on purpose -- see PROGRESS-pipeline.md for the same flag
  from that side.
- **Hard rule reconfirmed, not violated**: no DAMAC/Sobha portal login-and-scrape flow was built, not even a
  stub, this session either. Portal ingestion beyond CSV/paste stays a human action or a future, separately-
  scoped AI-vision-on-screenshot feature with its own budget cap.
- No other blockers. Everything in scope for this branch is typechecked, migration-verified against a real
  scratch Postgres, tested (23/23, real Postgres, no mocks), and manually verified end-to-end via the CLI
  against real seeded data.

## Notes / decisions made
- **Branched off `origin/claude/shared-schema`, not `master`** -- unchanged from prior session, see git
  history; `phase0-complete` tag confirmed present and reachable from this branch before starting work.
- Chose new, related-but-distinct tables over extending `properties` -- unchanged from prior session, see
  the migration file header for full reasoning.
- **`loadEnvFile()` moved into `src/db/client.ts`** (this session), rather than calling it separately at the
  top of each entry point (`cli/index.ts`, `db/seed.ts`, `db/reset.ts`) the way apps/lead-agent does across
  several of its own entry points. Reasoning: every one of this module's entry points already imports
  `db/client.ts` (directly or transitively via `db/queries.ts`) to reach the database, so centralizing the
  env load there means every current *and future* entry point gets it automatically, with no risk of a new
  script forgetting the call. `cli/index.ts` still calls `loadEnvFile()` explicitly too (harmless --
  `loadEnvFile` never overrides an already-set var, so a double call is a no-op) rather than removing it, to
  keep the CLI's own intent self-evident without relying on a reader knowing `client.ts`'s internals.
- **`types.setTypeParser(types.builtins.DATE, ...)` added in `db/client.ts`** alongside the existing
  `NUMERIC` parser -- see "Done" above for the bug this fixes. Same file, same pattern, so it's the natural
  place for any future column-type gotcha like this to live too.
- **Test-suite DB isolation**: `src/tests/testHelpers.ts`'s `createTestDb()` truncates this module's own
  tables *and* the shared `leads` table (with `CASCADE`) before each test run, unlike `db/reset.ts` (which
  deliberately never touches `leads`). This is intentional and scoped narrowly: it only ever runs against
  `TEST_DATABASE_URL` (a dedicated scratch test database, never the dev database), exactly mirroring
  apps/lead-agent's own `testHelpers.ts`, which also truncates `leads` in its test-only pool. Production/dev
  `leads` data is never at risk from this.
