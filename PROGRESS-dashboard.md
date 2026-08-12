# Progress — dashboard

Status: done
<!-- Change to "Status: done" only when fully complete, tested, and committed.
     monitor.sh checks for this exact string (case-insensitive) to know when
     to stop resuming / trigger the next phase. Don't mark done prematurely. -->

## Done
- Cold-started `apps/dashboard` (Next.js 16, same stack as apps/crm: React 19, Tailwind 4, TypeScript).
- `src/lib/db.ts`: read-only Postgres pool against the shared schema (`@mira/shared-types` row shapes,
  `numeric` type parser fix carried over from apps/lead-agent/apps/crm's pattern). No schema.sql
  application here — dashboard is a consumer, not a provisioner. `DATABASE_URL` from env, no hardcoded
  credentials.
  - **This session added a second type-parser fix, found by actually running the app against seeded
    data (not by typechecking):** `pg` returns `timestamptz`/`timestamp` columns as JS `Date` objects by
    default, but every shared row type (`@mira/shared-types`' `Lead`, `Agent`, ...) declares these fields
    as ISO `string`, and `src/lib/utils.ts`'s `timeAgo()` calls date-fns' `parseISO()` on them, which
    throws on a `Date` input (`TypeError: dateString.split is not a function`). Added
    `types.setTypeParser` for `TIMESTAMPTZ`/`TIMESTAMP` → `.toISOString()`, same pattern as the existing
    `NUMERIC` fix. This was a real bug in the previously-committed code, invisible to `tsc` because `pg`'s
    types aren't precise enough to catch it statically — only surfaced by running the page against real
    rows. Fixed in `src/lib/db.ts`.
- `src/lib/queries.ts`: real read-only queries against shared tables for `getDashboardStats()` (mirrors
  apps/crm's cold/active/today-follow-up definitions, translated onto the canonical `stage` column).
  Verified against seeded data this session (see Verification below) — every number matches an
  independently-run `psql` query against the same rows.
- `src/lib/roles.ts`: a deliberately **local, UI-only** `DashboardRole` type + role-to-section-visibility
  scaffold for the Today view shell. Explicitly NOT auth — no session, no server-side enforcement, role
  chosen via a `?role=` query param. See Blockers/Notes for the real gap this surfaces. **Left exactly as
  found this session** — not touched, per the task's explicit instruction not to unilaterally resolve the
  RBAC gap.
- `src/components/ui/{badge,button}.tsx`, `src/components/layout/role-switcher.tsx`: base UI pieces.
- `src/app/layout.tsx`, `src/app/error.tsx`, `src/app/globals.css`: app shell scaffolding. `error.tsx`'s
  DB-unreachable path verified this session (see below).
- **`src/app/page.tsx` (written this session)** — the Today view. Server component: reads `?role=`
  (defaults to `owner_coo` on missing/invalid values, via `isDashboardRole`), calls
  `getDashboardStats()` + `getColdLeads()` from `src/lib/queries.ts`, and renders: 4 stat tiles (active
  leads / contacted this week / won this month / cold leads), a role switcher + role-scoped nav chips
  (`navItemsForRole`) + founder-only note, a "Today's Follow-ups" list (`stats.todayFollowUps`, empty
  state when none), a "Needs Attention" cold-leads list (`getColdLeads`, empty state when none), and a
  clearly-labeled, statically-rendered "Agent suggestions & review queue — Not built yet" placeholder
  section (does not query `proposals`/`ai_suggestions` — SPEC.md's Agent Core is phase 1, unbuilt, so
  nothing agent-generated is faked here). Reuses `Badge`/`Button`/`RoleSwitcher` as instructed; no new
  shared components added.
- Config: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`,
  `.gitignore`. **`.env.example` was added this session** — the previous session's "Done" list claimed it
  existed but it was never actually committed (confirmed by listing the actual tracked files); `error.tsx`
  references it by name, so a missing file would have been a real gap for the next session. Added with
  just `DATABASE_URL` (dashboard has no other external dependencies).

## Verification (this session, real — not just "it compiles")
- `npm install` at repo root: clean, workspace-aware, `@mira/shared-types` builds via `postinstall`.
- `npx tsc --noEmit` in `apps/dashboard`: **exit 0, zero errors.**
- `npx eslint .` in `apps/dashboard`: **exit 0, zero warnings/errors.**
- `npx next build` in `apps/dashboard`: **succeeds** (Turbopack production build, `/` compiled as a
  dynamic server route, as expected for a live-DB page).
- Stood up a scratch local Postgres 16 (`mira_dev`), applied `packages/shared-db/schema.sql` directly,
  then ran apps/lead-agent's **real** seeder (`npm run seed --workspace=lead-followup`, i.e.
  `apps/lead-agent/src/db/seed.ts`'s `seedDatabase()` — did not invent ad hoc fixtures) against it: 8
  leads (Alice/Bob/Carol/Dave/Erin/Frank/Grace/Henry) across `new`/`contacted`/`qualified`/`dormant`/
  `canceled` stages, plus properties/engagement events. That real seeder doesn't populate
  `next_followup_at` or `agents`, so to actually exercise (not just compile-check) the "today's
  follow-ups" query and the agent-context columns, this session additionally: set `next_followup_at` on
  2 of the *already-seeded, real* leads (Alice → later today, Grace → later today) plus 2 control rows
  that should NOT show up (Dave → tomorrow, Carol → yesterday), via direct `psql UPDATE` against the
  scratch DB only — not a code change, not committed, purely local verification setup — and inserted the
  same 2 agent rows apps/crm's own seed migration already uses (Ahmed Al-Rashidi / Sarah Mitchell) so
  `agents` isn't empty. This is disclosed in full here per CLAUDE.md's "note any decision that isn't
  obviously implied" — the reused-seeder-plus-supplement approach, not fabricated leads.
- Ran `npm run dev` (Turbopack, real `DATABASE_URL` pointed at the scratch DB) and hit `/` with `curl`.
  Confirmed against an independently-run `psql` query on the same database:
  - Stat tiles rendered `8 / 0 / 0 / 5` (active leads / contacted this week / won this month / cold
    leads) — matches `psql` exactly (0 contacted-this-week is correct: the one `last_contacted_at` inside
    7 days, Carol's, falls before this week's Monday cutoff; 0 won-this-month is correct, no `won` rows
    in the seed).
  - "Today's Follow-ups" rendered exactly Alice Nguyen and Grace Huang, with `due 3:1…` / `due 6:1…`
    (their actual seeded times) — Dave (tomorrow) and Carol (yesterday) correctly did **not** appear,
    confirming the date-range filter is real, not decorative.
  - "Needs Attention" (cold leads) rendered exactly Bob, Alice, Dave, Erin, Grace — Carol (contacted 5
    days ago, inside the 7-day window) and Frank/Henry (`dormant`/`canceled`, excluded by stage) correctly
    did **not** appear.
  - `?role=marketing_social` rendered "Marketing / Social" everywhere the role label appears (header,
    switcher, nav highlighting); `?role=nonsense` fell back to `owner_coo` (`isDashboardRole` guard
    verified live, not just by reading the code).
  - Pointed `DATABASE_URL` at a database that doesn't exist: `/` returned HTTP 500 and `error.tsx`
    rendered with the real Postgres error (`database "mira_nonexistent_db" does not exist`) surfaced in
    the error boundary, not swallowed — confirms the "fail loudly" design in `src/lib/db.ts`'s header
    comment actually holds.
- Dev server and all scratch ports (3411–3413) stopped after verification; scratch Postgres (`mira_dev`
  db) left running/seeded locally in this container in case a human wants to re-inspect it, but nothing
  about it is committed to the repo or referenced by default config (`DEFAULT_DATABASE_URL` still points
  at the conventional `postgres://localhost:5432/mira_dev`, same as before — that's the existing fallback
  convention, not a new pointer to this specific scratch run).

## Next
- Nothing blocking remains for this module's originally-scoped work (page.tsx written, typechecked,
  linted, built, and verified against real seeded data end-to-end).
- Real candidates for a *future* session, none of them this module's call to make unilaterally:
  1. Resolve the RBAC gap in Blockers below (needs a human/product decision).
  2. Once Agent Core (SPEC.md phase 1) exists, revisit the placeholder "Agent suggestions & review queue"
     section in `page.tsx` — `getReviewQueue()` already exists in `src/lib/queries.ts` (reads
     `proposals`/`ai_suggestions`) and is ready to wire in once there's real agent-generated content to
     show; it is deliberately unused by `page.tsx` right now.
  3. A human still needs to rebase `claude/dashboard` onto `master` once Phase 0 actually merges there
     (see Notes below — this was already true before this session, restated for the next reader).

## Blockers / needs human input
- **RBAC model gap**: `@mira/shared-types`' `AgentRole` (`AGENT_ROLES` in domain.ts, from Phase 0) is a
  3-value enum (`agent`/`manager`/`admin`) tied to the `agents.role` DB column. SPEC.md's RBAC table
  defines 6 roles (Owner/COO, Senior Agent, Junior Agent, Marketing/Social, Admin/Ops, Finance) with
  boundaries that aren't just "seniority" (e.g. Marketing/Social has zero CRM/financial access, which
  isn't expressible as a level of the 3-value enum). `src/lib/roles.ts`'s `DashboardRole` type is
  deliberately kept local/UI-only rather than forking a competing definition into `packages/shared-types`
  (per CLAUDE.md's module-boundary rule). **A human needs to decide**: does `agents.role` grow to 6
  values, does a separate `agents.dashboard_role` column get added, or something else — this affects
  every module that will eventually need real RBAC (comms-hub hit the same gap independently, see
  PROGRESS-comms.md), so it should be a single cross-module decision, not five different guesses.
- **No real auth exists yet.** The `?role=` query param is a visible, unauthenticated UI toggle only —
  do not mistake this for access control when reviewing. Real auth is out of scope for this module per
  SPEC.md's build-phase ordering (dashboard is phase 2; auth/RBAC enforcement isn't itemized as its own
  phase yet either — flagging that gap too).
- ~~This run was cut short by an account-wide session/API rate limit...~~ **Resolved this session**: the
  interrupted run's gap (`page.tsx` unwritten, nothing typechecked/built/run) is what this session picked
  up and finished — see Done/Verification above. Kept struck through rather than deleted so the history is
  legible to whoever reads this file next.

## Notes / decisions made
- **Branched off `origin/claude/shared-schema`, not `master`.** The orchestration run book's literal
  instruction is "create the branch off the repository's default branch (master)", but `master` does not
  yet have Phase 0 merged into it — `packages/shared-*` doesn't exist there, only the initial `apps/crm`
  + `apps/lead-agent` import. Building against master would mean no shared schema to import against,
  forcing a forked local copy of types — explicitly forbidden by CLAUDE.md ("add to shared packages,
  don't fork a local copy"). So this branch (`claude/dashboard`) was cut from `origin/claude/shared-schema`
  instead, which is tagged `phase0-complete` (commit `cde0189`, independently verified — see
  PROGRESS-phase0.md on that branch for the full verification log). **A human will need to rebase this
  branch onto `master` once Phase 0 is actually merged there** — flagging this as a genuine orchestration
  gap: Step 2 (module fan-out) is currently gated only on the `phase0-complete` *tag* existing, not on
  Phase 0 being merged into the branch modules are told to fork from. The same deviation was applied by
  all 6 module branches this run, for the same reason.
- Dashboard is read-only by design (no writes) — SPEC.md's review/approval queue and Agent Core's
  reasoning loop are separate future phases (SPEC.md build-phase order: phase 1 = agent core, phase 2 =
  dashboard shell), so nothing here should attempt to fake agent-generated content.
- **`page.tsx` doesn't gate which data loads by role**, only nav-chip highlighting and the founder-only
  caption — matches `src/lib/roles.ts`'s own docstring ("this currently only affects which nav items
  render on this shell, not which data loads"). Didn't invent per-role data hiding that the existing
  scaffold explicitly says it doesn't do.
- **`db.ts` timestamp type-parser fix (this session)**: root-caused rather than patched around the
  symptom. Could have instead changed `utils.ts`'s `timeAgo()` to accept `Date | string`, but that would
  leave every other current/future consumer of `Lead`/`Agent` timestamp fields silently getting `Date`
  objects while the shared type contract says `string` — fixing it at the driver boundary (`db.ts`) makes
  this app's actual runtime data match `@mira/shared-types` everywhere, not just at the one call site that
  happened to crash first.
- **`.env.example` gap**: the interrupted session's PROGRESS listed it as done; it was never actually
  committed (confirmed by listing tracked files, not just trusting the prior write-up). Recreated this
  session with just `DATABASE_URL`, matching what `db.ts`/`error.tsx` actually reference.
  - Doing so required changing `.gitignore`: it had a blanket `.env*` pattern (copied from apps/crm's,
    which also has no committed `.env.example`), which silently swallows `.env.example` too. Narrowed it
    to `.env` / `.env.local` / `.env.*.local`, matching apps/lead-agent's convention, which *does* commit
    a real `.env.example`. No credentials are in the committed file (just the `DATABASE_URL=` key, no
    value) — this doesn't weaken the "never commit credentials" rule, it just stops the gitignore from
    also blocking the credential-free documentation file.
