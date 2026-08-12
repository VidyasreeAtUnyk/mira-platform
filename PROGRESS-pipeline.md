# Progress — pipeline-listings

Status: done
<!-- Change to "Status: done" only when fully complete, tested, and committed.
     monitor.sh checks for this exact string (case-insensitive) to know when
     to stop resuming / trigger the next phase. Don't mark done prematurely. -->

## Done
- Cold-started `apps/pipeline` (Next.js 16 + `pg`, same stack family as apps/crm; `tsx`-based
  seed/reset/test scripts mirroring apps/lead-agent's pattern).
- **`packages/shared-db/migrations/006_transaction_pipeline_and_listings.sql`** (cross-module-relevant —
  see Blockers): additive migration adding columns to the existing shared `properties` table plus one new
  shared table, `listing_price_changes` (a per-listing price-change event log — explicitly documented as
  distinct from Phase 0's `property_price_history`, which is an annual market-index figure, not a
  per-unit event log). **Verified this session**: applied cleanly to a fresh scratch Postgres 16 database
  after `schema.sql`, and is idempotent (re-running it produces only `NOTICE ... skipping` lines, no
  errors) — confirmed twice, including once more as a final clean-room check right before this commit.
- `src/lib/stage-machine.ts`: a transaction-pipeline state machine (showing → offer → under_contract →
  inspection → closing → closed_won/closed_lost) — deliberately **separate** from
  `packages/shared-types/src/stage.ts`'s lead-stage machine. Full reasoning documented in the file header
  and below in Notes: a lead's qualification funnel and a specific deal's close-process progress are
  related but distinct concepts (1-to-many: one lead can have zero, one, or rarely more than one
  transaction over its lifetime).
- `src/lib/transactions.ts`, `src/lib/listings.ts`: data-access + stage-transition logic against the
  shared schema, using `listing_price_changes` for price-change history and days-on-market calculation.
- `src/lib/db.ts`, `src/types.ts`: shared-schema-consuming db client and local (non-shared) types layer.
  **Fixed this session** — see Notes for a real bug found and fixed here during manual verification.
- `src/app/api/transactions/route.ts`, `src/app/api/transactions/[id]/transition/route.ts`: API routes
  for creating transactions and driving stage transitions through the state machine (with validation of
  legal transitions). **Verified this session** against a real running server (see "Manual verification"
  below) — create (201), legal transition (200), illegal transition (409, state left unchanged).
- `src/app/{page,pipeline/page,listings/page}.tsx`, `layout.tsx`, `globals.css`: UI shell pages.
  **Confirmed this session to be functional, not scaffolding-only** — both `/pipeline` and `/listings`
  render real seeded data server-side (see "Manual verification").
- Config: `package.json` (includes `seed`/`reset-db`/`test` scripts), `tsconfig.json`, `next.config.ts`,
  `eslint.config.mjs`, `postcss.config.mjs`, `.env.example`.
- **`src/scripts/seed.ts`, `src/scripts/reset.ts`, `src/tests/{testHelpers,run,stage-machine.test,
  transactions.test,listings.test}.ts` — written this session** (did not exist before; `package.json`'s
  `seed`/`reset-db`/`test` scripts were referencing paths that hadn't been created yet, exactly as flagged
  by the prior session). `seed.ts` populates 2 agents, 4 leads, 5 properties/listings (varied statuses —
  active, under_offer, withdrawn — and listed_at ages for days-on-market), 2 price-change events on one
  listing, and 4 transactions driven through real stage transitions (mid-pipeline, a full closed_won run,
  a closed_lost with a required lost_reason, and one still at the entry stage) — it calls the actual
  `createTransaction`/`transitionTransaction`/`recordPriceChange`/`updateListingStatus` lib functions
  rather than raw INSERTs for pipeline-owned tables, so seeding doubles as an end-to-end smoke test.
  `reset.ts` truncates every table this app owns/shares. The test suite (23 tests, all passing against a
  real scratch Postgres — see below) mirrors apps/lead-agent's `createTestDb()` truncate-before-each
  discipline against a real database, not mocks: `stage-machine.test.ts` is pure-function coverage of
  every legal/illegal edge in `PIPELINE_STAGE_EDGES` (happy path, closed_lost-from-anywhere, no backward
  edges, no stage-skipping, terminal-stage lockout, the specific `IllegalStageTransitionError` type);
  `transactions.test.ts` exercises the same legal/illegal matrix through the real DB-backed
  `transitionTransaction` (including: rejected transitions leave the history table untouched, terminal
  transactions reject all further transitions, `closed_lost` without `lost_reason` is rejected, the full
  happy path sets `closed_at` and produces the right history-row count); `listings.test.ts` covers
  days-on-market calculation and `recordPriceChange`'s old-price-read-from-row-not-caller guarantee.

## Verification performed this session (all steps from the prior session's "Next" list)
1. **Confirmed `src/scripts/seed.ts`/`reset.ts` and `src/tests/run.ts` did not exist** — written from
   scratch this session (see "Done" above).
2. **`npm install && npx tsc --noEmit`**: ran clean, zero errors, both on first pass and again after the
   `db.ts` date-handling fix (see Notes). `npx eslint .` also clean throughout.
3. **Migration verification**: `packages/shared-db/schema.sql` then
   `packages/shared-db/migrations/006_transaction_pipeline_and_listings.sql` applied cleanly to a scratch
   local Postgres 16 database (`mira_pipeline_scratch`, later re-verified against a fresh
   `mira_pipeline_verify`); re-running the migration is idempotent (no errors, only expected `skipping`
   notices).
4. **Test suite run for real** against a scratch Postgres (`mira_pipeline_test`, connected via
   `TEST_DATABASE_URL` pointed at the local Unix socket — see the environment note below): **23/23 passed**
   both before and after the `db.ts` fix (the fix required two test assertions to be rewritten to compare
   by value instead of by object reference — see Notes, this was a test bug, not a stage-machine bug).
5. **Manual end-to-end verification against real data** (`npm run dev` equivalent, on port 3411 against a
   `mira_pipeline_dev` scratch database, seeded via `npm run seed`):
   - `GET /pipeline` and `GET /listings` — both returned real seeded data server-rendered (kanban board
     with correct per-stage counts; listings table with computed days-on-market).
   - `GET /api/transactions` — returned the 4 seeded transactions with correct shapes.
   - `POST /api/transactions/{id}/transition` with `{"to_stage":"offer",...}` on a `showing`-stage
     transaction → **200**, stage updated.
   - Same transaction, `{"to_stage":"under_contract",...}` → **200**.
   - Same transaction, `{"to_stage":"closed_won"}` (illegal — skips `inspection`/`closing`) → **409**,
     with a clear error message listing the actually-legal next stages; re-fetched the transaction
     afterward and confirmed its stage was unchanged (`under_contract`), proving the rejection didn't
     partially apply.
   - Same transaction, legal `{"to_stage":"inspection"}` → **200**.
   - `POST /api/transactions` (create) → **201**, new transaction at `showing`.
   - Torn down afterward: dev server killed, `mira_pipeline_dev`/`_test`/`_scratch`/`_verify` scratch
     databases all dropped. No scratch state left behind.

## Blockers / needs human input
- **Migration filename collision risk at integration time** (unchanged from before, not touched per
  instructions): this branch's new migration is numbered `006_transaction_pipeline_and_listings.sql`. The
  `inventory-developer` module branch (built in parallel, in an isolated worktree, with no visibility into
  this branch) independently also created a `006_developer_inventory.sql`. The two don't conflict in
  content (different tables — this one adds `listing_price_changes` + columns on `properties`; inventory's
  adds entirely new `developer_partners`/`inventory_units`/etc. tables), but **both are numbered 006** and
  will collide by filename once both branches are merged. **Left as-is per instructions** — needs human
  resolution during the integration pass, renumbering one sequentially in actual merge order.
- **Local dev/test Postgres in this sandbox requires connecting over the Unix socket, not TCP**: the
  app's `DEFAULT_DATABASE_URL`/`TEST_DATABASE_URL` fallbacks (`postgres://localhost:5432/...`) don't work
  unauthenticated in this environment — `pg_hba.conf` requires `scram-sha-256` for TCP/`127.0.0.1`
  connections but only allows passwordless `peer` auth over the local Unix socket. This isn't a code
  problem (no credentials are or should be hardcoded — CLAUDE.md), just an environment note for whoever
  resumes local verification: set `DATABASE_URL`/`TEST_DATABASE_URL` to
  `postgres://<os-user>@/<dbname>?host=/var/run/postgresql` (e.g.
  `postgres://root@/mira_pipeline_dev?host=/var/run/postgresql`) rather than relying on the TCP fallback,
  or configure a real password + `.env.local` (gitignored) if a persistent local setup is preferred.

## Notes / decisions made
- **Branched off `origin/claude/shared-schema`, not `master`.** The orchestration run book's literal
  instruction is "create the branch off the repository's default branch (master)", but `master` does not
  yet have Phase 0 merged into it — `packages/shared-*` doesn't exist there. Building against master
  would force a forked local copy of shared types, explicitly forbidden by CLAUDE.md. So this branch
  (`claude/pipeline-listings`) was cut from `origin/claude/shared-schema` instead, which is tagged
  `phase0-complete` (commit `cde0189`, independently verified). **A human will need to rebase this branch
  onto `master` once Phase 0 is actually merged there.** Same deviation applied by all 6 module branches
  this run, for the same reason.
- **`transactions.stage` is intentionally a separate state machine from `leads.stage`**, not an extension
  or reuse of `packages/shared-types/src/stage.ts`. A lead's stage answers "how warmed-up is this
  prospect"; a transaction's stage answers "how far through the legal/operational close process is this
  specific deal against this specific property". `decision_pending` (lead-side) and `offer`
  (transaction-side) look similar but aren't synonyms — a lead can sit in `decision_pending` with no
  transaction row yet. Transactions reference leads via `transactions.lead_id` (1-to-many). Full reasoning
  in `src/lib/stage-machine.ts`'s header comment.
- `listing_price_changes` (new) vs. `property_price_history` (Phase 0, unchanged) are deliberately
  different concepts — the latter is an annual market-index figure per property type/area used by
  apps/lead-agent's comps/matching, not a per-listing event log. Documented at length in the migration
  file header to prevent future confusion between the two.
- **Real bug found and fixed this session, in `src/lib/db.ts`**: `GET /pipeline` 500'd with "Objects are
  not valid as a React child (found: [object Date])". Root cause: `src/types.ts` declares every
  date/timestamp field (`created_at`, `expected_closing_date`, `listed_at`, `closed_at`, ...) as `string`,
  but `pg`'s default type parsers turn Postgres `date`/`timestamp`/`timestamptz` columns into JS `Date`
  objects at runtime — the app's own types didn't match what the driver actually returns. It was silently
  fine everywhere the value only ever got JSON-serialized (`Date.toJSON()` auto-converts to an ISO string,
  which is why the API routes looked fine) but broke the moment a page rendered a raw date field directly
  as JSX (`{t.expected_closing_date}` on `/pipeline`). Fixed by registering `pg` type parsers for `DATE`/
  `TIMESTAMP`/`TIMESTAMPTZ` that return the raw wire text unchanged, mirroring the existing `NUMERIC`
  parser already in this file for the equivalent price-as-string gotcha — now every consumer (JSX, JSON
  responses, `new Date(...)` call sites in `src/lib`) gets an actual string, matching what `src/types.ts`
  already claimed. This was only caught because of the manual "hit the real running pages" verification
  step — `tsc --noEmit` and the unit test suite (before the fix) both passed anyway, since neither exercises
  React rendering or asserts on date-field *type* (they used `!==` on the returned value, which happened to
  produce a confusing "expected X, got X" failure message once the fix changed `Date`-object comparisons
  into string comparisons — two test assertions were rewritten to compare by parsed timestamp value rather
  than by reference/type, and are now robust to either representation).
- Seed data uses realistic Dubai-market fixtures (AED prices, Dubai Marina/Palm Jumeirah/Downtown/Dubai
  Hills/JVC areas) consistent with SPEC.md's DAMAC/Sobha/UAE context, rather than generic placeholder
  addresses.

## Next
Nothing outstanding for this module. Remaining work is the cross-module migration-numbering collision
noted above, which is explicitly integration-pass (human) work, not something to resolve from within this
worktree.
