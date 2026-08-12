# Progress — pipeline-listings

Status: in-progress
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
  per-unit event log). Applies cleanly after `schema.sql`, does not modify any existing Phase 0
  table/column meaning.
- `src/lib/stage-machine.ts`: a transaction-pipeline state machine (showing → offer → under_contract →
  inspection → closing → closed_won/closed_lost) — deliberately **separate** from
  `packages/shared-types/src/stage.ts`'s lead-stage machine. Full reasoning documented in the file header
  and below in Notes: a lead's qualification funnel and a specific deal's close-process progress are
  related but distinct concepts (1-to-many: one lead can have zero, one, or rarely more than one
  transaction over its lifetime).
- `src/lib/transactions.ts`, `src/lib/listings.ts`: data-access + stage-transition logic against the
  shared schema, using `listing_price_changes` for price-change history and days-on-market calculation.
- `src/lib/db.ts`, `src/types.ts`: shared-schema-consuming db client and local (non-shared) types layer.
- `src/app/api/transactions/route.ts`, `src/app/api/transactions/[id]/transition/route.ts`: API routes
  for creating transactions and driving stage transitions through the state machine (with validation of
  legal transitions).
- `src/app/{page,pipeline/page,listings/page}.tsx`, `layout.tsx`, `globals.css`: UI shell pages.
- Config: `package.json` (includes `seed`/`reset-db`/`test` scripts), `tsconfig.json`, `next.config.ts`,
  `eslint.config.mjs`, `postcss.config.mjs`, `.env.example`.

## In progress
- Session was interrupted mid-way through "the API routes" per the last recorded action — the two API
  route files above exist but **have not been verified** (no typecheck, no test run, no manual exercise
  against a real database this session).
- No seed script (`src/scripts/seed.ts`, referenced by `package.json`'s `seed` script) or test suite
  (`src/tests/run.ts`, referenced by the `test` script) were confirmed to exist on disk — check for these
  next session; the `package.json` scripts reference paths that may not have been created yet before the
  interruption.

## Next
1. **Verify what actually exists**: confirm whether `src/scripts/seed.ts` and `src/tests/run.ts` (referenced
   by `package.json`) were written or are still missing — `package.json` was drafted early and may be
   ahead of the actual file tree.
2. Run `npm install && npx tsc --noEmit` — **not run yet this session**, interrupted before verification.
   Do not trust "Done" items above as typechecked until this actually runs.
3. Apply `packages/shared-db/migrations/006_transaction_pipeline_and_listings.sql` to a scratch local
   Postgres (after `schema.sql`) and verify it applies cleanly, same discipline as Phase 0 — **not done
   yet this session**, only written and documented, not executed.
4. Write/finish the seed script and a basic test suite for the stage machine's transition validation
   (legal vs. illegal transitions), mirroring apps/lead-agent's test discipline.
5. Once verified, revisit whether `src/app/{pipeline,listings}/page.tsx` are functional pages or still
   scaffolding-only — not deeply reviewed this session due to the interruption.

## Blockers / needs human input
- **Migration filename collision risk at integration time**: this branch's new migration is numbered
  `006_transaction_pipeline_and_listings.sql`. The `inventory-developer` module branch (built in parallel,
  in an isolated worktree, with no visibility into this branch) independently also created a
  `006_developer_inventory.sql`. The two don't conflict in content (different tables — this one adds
  `listing_price_changes` + columns on `properties`; inventory's adds entirely new
  `developer_partners`/`inventory_units`/etc. tables), but **both are numbered 006** and will collide by
  filename once both branches are merged. This needs human resolution during the integration pass (Step
  3) — renumber one sequentially (e.g. 006/007 in merge order) rather than guessing an order here, since
  neither module branch can see the other's final state.
- **This run was cut short by an account-wide session/API rate limit**, not a code or design blocker.
  Nothing in "Done" has been typechecked, migration-applied, or run this session — treat all of it as
  unverified until that happens.

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
