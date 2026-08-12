# Progress — comms-hub

Status: in-progress
<!-- Change to "Status: done" only when fully complete, tested, and committed.
     monitor.sh checks for this exact string (case-insensitive) to know when
     to stop resuming / trigger the next phase. Don't mark done prematurely. -->

## Done
- Cold-started `apps/comms-hub` (Next.js 16, same stack family as apps/crm).
- `src/types/index.ts`: unified message/thread data model — `MessageThread`, `Message` with a `channel`
  field (email | whatsapp), direction (in/out), and status (draft/pending-approval/approved/held/sent —
  everything stays draft-and-hold, nothing marks "sent" for real).
- `src/lib/bsp/{types,index,mock-adapter}.ts`: a real BSP-agnostic adapter interface for WhatsApp
  send/receive (Interakt/Wati/Twilio are interchangeable behind it, per SPEC.md) with a mock adapter —
  no live BSP credentials exist or were invented.
- `src/lib/email/{types,index,mock-adapter}.ts`: same adapter-interface pattern for email.
- `src/lib/tiers.ts`: notification priority tiers (urgent/today/fyi per SPEC.md) as a real, independently-
  testable pure function (`computeTier()`) — documented v1 heuristic (urgent lead stages,
  unread-duration thresholds), not SPEC-specified exact thresholds since SPEC.md doesn't give them.
- `src/lib/rbac.ts`: role-based thread/notification filtering (`canViewThread()`) derived from SPEC.md's
  RBAC table. Implements SPEC's one explicit comms-relevant rule exactly (Marketing/Social: no CRM/lead
  access) and extends SPEC's general table to comms-specific cases as best-effort (Senior/Junior Agent
  "own" scoping, Admin/Ops operational-only, Finance total exclusion) — flagged for human review since
  SPEC doesn't spell these out per-module.
- `src/lib/mock-data.ts`: seed data including a lead-linked thread specifically to exercise the
  Marketing/Social exclusion rule.
- `supabase/migrations/001_comms_hub_schema.sql`: draft Supabase migration for this module's own tables.
- Config: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`,
  `.env.example`, `.gitignore`.

## In progress
- No UI pages/routes exist yet (no `src/app/` directory) — everything so far is the data model, adapter
  interfaces, and RBAC/tiering logic layer. Session was interrupted while about to write the mock
  data/demo store layer that would back an actual inbox UI.

## Next
1. **Build `src/app/` pages**: a unified inbox list (threads, filtered by tier and by `canViewThread()`
   for the current viewer), a thread detail view, and a compose/draft view that creates messages in
   `draft` status only — no send path should exist end-to-end yet given no live BSP/email credentials.
2. Finish the mock data / demo store layer that was in progress when this run was cut short, so the
   inbox UI has something real to render against without needing live credentials.
3. Run `npm install && npx tsc --noEmit` — **not run yet this session**, interrupted before verification.
   Do not trust "Done" items above as typechecked until this actually runs.
4. **Resolve the RBAC gap below** (needs a human/product decision, not a guess) before treating
   `rbac.ts` as final.
5. Decide whether `supabase/migrations/001_comms_hub_schema.sql` needs any cross-module shared-schema
   promotion (e.g. if the dashboard's Today view ever wants to surface urgent comms items) — currently
   kept fully local to this app, which seems right for now but wasn't deeply stress-tested against that
   question this session.

## Blockers / needs human input
- **Same RBAC model gap apps/dashboard hit independently**: `@mira/shared-types`' `AgentRole` (Phase 0)
  is a 3-value enum (`agent`/`manager`/`admin`), but SPEC.md's RBAC table has 6 roles with boundaries
  that aren't expressible as levels of that enum (e.g. Marketing/Social's "no CRM/lead access" isn't a
  seniority distinction). `src/lib/rbac.ts`'s `Viewer`/`CommsRole` type is kept local rather than forking
  a competing shared definition. **This is a single cross-module decision a human should make once**
  (not independently per module) — see PROGRESS-dashboard.md for the same flag from that module.
- **`senior_agent` "assigned team leads/deals" scoping is unresolved**: the Phase 0 shared schema has no
  `manager_id`/`team_id` column on `agents`, so `rbac.ts` currently narrows Senior Agent visibility to
  "own" only (same limitation as SPEC's literal RBAC table can't yet express). Needs either a schema
  addition (cross-module, human call) or an explicit product decision that "own only" is fine for now.
- **No live BSP (Interakt/Wati/Twilio) or email API credentials exist anywhere in this environment** —
  by design, nothing beyond the mock adapters was built, and no live send path exists.
- **This run was cut short by an account-wide session/API rate limit**, not a code or design blocker.
  Nothing in "Done" has been typechecked or run this session.

## Notes / decisions made
- **Branched off `origin/claude/shared-schema`, not `master`.** The orchestration run book's literal
  instruction is "create the branch off the repository's default branch (master)", but `master` does not
  yet have Phase 0 merged into it — `packages/shared-*` doesn't exist there. Building against master
  would force a forked local copy of shared types, explicitly forbidden by CLAUDE.md. So this branch
  (`claude/comms-hub`) was cut from `origin/claude/shared-schema` instead, which is tagged
  `phase0-complete` (commit `cde0189`, independently verified). **A human will need to rebase this branch
  onto `master` once Phase 0 is actually merged there.** Same deviation applied by all 6 module branches
  this run, for the same reason.
- The BSP and email adapters are a real interface + mock implementation, deliberately not a single
  hardcoded provider integration — swapping in a real Interakt/Wati/Twilio client later should mean
  writing one new adapter file, not restructuring callers.
