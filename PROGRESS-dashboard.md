# Progress — dashboard

Status: in-progress
<!-- Change to "Status: done" only when fully complete, tested, and committed.
     monitor.sh checks for this exact string (case-insensitive) to know when
     to stop resuming / trigger the next phase. Don't mark done prematurely. -->

## Done
- Cold-started `apps/dashboard` (Next.js 16, same stack as apps/crm: React 19, Tailwind 4, TypeScript).
- `src/lib/db.ts`: read-only Postgres pool against the shared schema (`@mira/shared-types` row shapes,
  `numeric` type parser fix carried over from apps/lead-agent/apps/crm's pattern). No schema.sql
  application here — dashboard is a consumer, not a provisioner. `DATABASE_URL` from env, no hardcoded
  credentials.
- `src/lib/queries.ts`: real read-only queries against shared tables for `getDashboardStats()` (mirrors
  apps/crm's cold/active/today-follow-up definitions, translated onto the canonical `stage` column).
- `src/lib/roles.ts`: a deliberately **local, UI-only** `DashboardRole` type + role-to-section-visibility
  scaffold for the Today view shell. Explicitly NOT auth — no session, no server-side enforcement, role
  chosen via a `?role=` query param. See Blockers/Notes for the real gap this surfaces.
- `src/components/ui/{badge,button}.tsx`, `src/components/layout/role-switcher.tsx`: base UI pieces.
- `src/app/layout.tsx`, `src/app/error.tsx`, `src/app/globals.css`: app shell scaffolding.
- Config: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`,
  `.env.example`, `.gitignore`.

## In progress
- `src/app/page.tsx` (the actual Today view page, wiring `getDashboardStats()` + role scaffold into a
  real rendered page) was **not yet written** when this run was interrupted — the app currently has a
  layout and error boundary but no home page. This is the single largest gap.

## Next
1. **Write `src/app/page.tsx`** — a server component that calls `getDashboardStats()` from
   `src/lib/queries.ts`, reads `?role=` via `roles.ts`, and renders a real Today-view briefing (counts,
   today's follow-ups, cold leads) using the existing `Badge`/`Button`/`role-switcher` components. This
   is the immediate next step, not a redesign.
2. Run `npm install && npx tsc --noEmit` at the repo root / in apps/dashboard — **this has not been run
   yet this session** (interrupted before verification). Do not trust anything above as "typechecks
   clean" until this is actually run.
3. Run `npm run dev` and visually confirm the page renders against a real local Postgres seeded via
   apps/crm's or apps/lead-agent's seed script (dashboard has no seed of its own — it's read-only).
4. Once `page.tsx` exists and typechecks/renders, revisit whether more of SPEC.md's "Today view" briefing
   (agent-core-generated suggestions, review/approval queue items) should get placeholder sections —
   Agent Core (SPEC.md phase 1) doesn't exist yet, so those should stay clearly marked TODO, not faked.
5. Resolve the RBAC gap in Blockers below (needs a human/product decision, not a guess).

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
- **This run was cut short by an account-wide session/API rate limit** (mid-way through writing
  `page.tsx`), not by any code or design blocker. Nothing here has been typechecked, built, or run this
  session — see Next item 2.

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
