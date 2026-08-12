# Progress — comms-hub

Status: done
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
  SPEC doesn't spell these out per-module. **Left exactly as-is this session, per explicit instruction —
  the gaps below are still unresolved on purpose.**
- `src/lib/mock-data.ts`: seed data including a lead-linked thread specifically to exercise the
  Marketing/Social exclusion rule.
- `supabase/migrations/001_comms_hub_schema.sql`: draft Supabase migration for this module's own tables.
- Config: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`,
  `.env.example`, `.gitignore`.
- **`src/components/comms-store.tsx`** — the demo data/state layer that was in progress when the prior
  session was cut short. Client-side React context wrapping `src/lib/mock-data.ts`'s seed (`THREADS`,
  `MESSAGES`, `NOTIFICATIONS`, `DEMO_VIEWERS`), with actions `setViewerId`, `markThreadRead`,
  `addReplyDraft`, `createDraftThread`. Persists to `localStorage` (key `comms-hub-demo-state-v1`) so
  the selected demo role and any drafts survive a reload — this matters because it's what makes RBAC
  enforcement testable via a directly-typed/bookmarked thread URL, not just via in-app link clicks (see
  Verification below). Initial React state always matches the server-rendered seed; the persisted
  session is applied in a mount-only `useEffect`, specifically to avoid a hydration mismatch between
  server and client markup. **Neither `addReplyDraft` nor `createDraftThread` ever calls
  `src/lib/bsp`/`src/lib/email`'s adapters** — they only ever append a `Message` with `status: 'draft'`.
  There is no code path anywhere in the UI that can reach `WhatsAppAdapter.send()` / `EmailAdapter.send()`
  or produce a `status: 'sent'` message — draft-and-hold is true by construction, not convention.
- **`src/app/` pages** (all client components — this app has no server/DB, so there's no server-rendered
  data to fetch):
  - `src/app/layout.tsx` + `src/app/globals.css`: root shell, wraps the tree in `CommsStoreProvider` and
    a persistent `Header`. Minimal self-contained Tailwind v4 theme (no shadcn dependency in this app,
    unlike apps/crm — kept this app's `package.json` as the prior session left it rather than adding a
    new dependency for this pass).
  - `src/components/header.tsx`: nav (Inbox/Compose), a role switcher (`<select>` over
    `DEMO_VIEWERS`), and a notification bell showing unread notifications filtered through
    `filterNotificationsForViewer()` for the current viewer.
  - `src/app/page.tsx`: unified inbox. Filters `threads` through `filterThreadsForViewer()` for the
    current viewer, then by a tier tab (all/urgent/today/fyi), sorted via `sortThreadsByTier()`. Shows
    "N of M total threads visible" so the RBAC narrowing is visible in the UI itself, not just inferred.
  - `src/app/thread/[id]/page.tsx`: thread detail. Calls `canViewThread()` independently of the inbox
    list filter — a viewer who navigates straight to a thread URL they shouldn't see (e.g.
    Marketing/Social hitting a lead-linked thread) is blocked here too, not just hidden from the list.
    Message bubbles show `StatusBadge` (draft/held/etc.). The reply box's only action is "Save Draft" —
    there is no "Send" control anywhere on this page.
  - `src/app/compose/page.tsx`: new-thread form (channel, contact name/handle, subject-if-email, body)
    → `createDraftThread()` → redirects to the new thread. Also "Save Draft" only.
  - `src/components/badges.tsx`: `TierBadge`, `ChannelIcon`, `StatusBadge`, and `TimeAgo` (a client-only
    relative-timestamp component — computing `timeAgo()` inline in JSX caused a real hydration mismatch
    during verification, since the server-render instant and the client-hydration instant differ by a
    few seconds/minutes and `formatDistanceToNow` renders different text for each; `TimeAgo` renders
    nothing until a post-mount `useEffect` fills it in, so the first client render always matches the
    server-rendered markup).

## Verification (this session, actually run, not just typechecked)
- `npx tsc --noEmit -p tsconfig.json` — **clean, 0 errors.**
- `npx eslint` — **clean, 0 errors/warnings** (two justified, commented
  `eslint-disable-next-line react-hooks/set-state-in-effect` — the "hydrate from localStorage /
  compute a client-only timestamp post-mount, to avoid an SSR/client hydration mismatch" pattern is a
  legitimate exception to that rule, not a pattern used elsewhere in this app).
- `npm run dev` (Next 16 / Turbopack) actually started and served the app on a local port. Fetched with
  `curl` and driven end-to-end with Playwright (already present in this environment at
  `/opt/node22/lib/node_modules/playwright`, chromium pre-installed) — a real headless browser clicking
  through the running app, not a static render check. 16/16 scripted checks passed:
  - Owner/COO sees all 7 seeded threads (`filterThreadsForViewer` + inbox list count both agree).
  - **Marketing/Social RBAC exclusion (the case this task specifically called out)**: switching the
    role switcher to Meera (Marketing/Social) drops the visible thread count from 7 to 2, the seeded
    lead-linked "Amir Hassan" thread (`lead-1`) disappears from the list, and the non-CRM-linked
    "Studio Lumen" thread stays visible. **Additionally verified at the thread-detail layer**: with
    Marketing/Social selected, a hard page load of `/thread/thread-1` (the lead-linked thread) directly
    — not a link click — renders the "Not visible to this role" block instead of the thread. This only
    works because the viewer selection is now persisted (see `comms-store.tsx` above); without that,
    a hard navigation would silently reset to the Owner default and the block would never actually be
    exercised — caught and fixed during this session's verification pass.
  - Finance sees 0 threads; Junior Agent (Zara) sees exactly her 2 own threads (`agent-junior-1`).
  - Drafting: opened the seeded "Priya Nair" thread, typed a reply, clicked "Save Draft" — the new
    message appears in the thread with a "Draft" status badge and the "saved as draft" confirmation
    shows; no "Send" button exists anywhere (`button:has-text("Send")` count = 0, checked on the
    thread-detail page).
  - Compose: filled out the new-thread form, saved, redirected to the new thread showing the draft
    body, and the new thread then appears back in the Owner's inbox list (count 7 → 8).
  - Zero browser console errors / page errors captured across the full run (separate Playwright pass
    with `page.on('console'/'pageerror')` listeners attached) — including no hydration-mismatch
    warnings, confirming the `TimeAgo` fix above actually resolved the issue caught mid-session.
- Screenshotted the inbox, thread-detail, and compose pages for a visual sanity check (not just DOM
  assertions) — layout, badges, and the role switcher all render as intended in both empty and
  populated states.

## Not done / out of scope for this pass (by explicit instruction)
- **`src/lib/rbac.ts` was not touched.** The Blockers below (coarse shared `AgentRole` enum,
  missing `manager_id`/`team_id` for Senior Agent "assigned team" scoping) are cross-module/schema
  decisions for a human, not something to guess at from a single module worktree — left exactly as the
  prior session scoped them.
- Whether `supabase/migrations/001_comms_hub_schema.sql` needs cross-module shared-schema promotion is
  still an open question, unchanged from last session — not stress-tested this pass either; this pass
  was UI-focused per instruction.
- No real BSP/email/Supabase credentials were added or invented (still none anywhere in this repo).

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
  by design, nothing beyond the mock adapters was built, and no live send path exists anywhere in the
  UI (verified this session — see above).

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
- **All UI pages are client components (`'use client'`), including the pages themselves, not just leaf
  interactive widgets.** Unlike apps/crm (server components + Supabase server client), comms-hub has no
  database in this build, so there's no server-side data-fetch to justify server components; the whole
  UI is driven by the client-side demo store instead. Once a real Postgres/Supabase connection exists,
  the inbox/thread pages are the natural place to convert to server components with the demo store kept
  only as a fallback/dev mode.
- **Demo state now persists to `localStorage`** (see `comms-store.tsx` above) — this wasn't in the
  original plan but was added after the first verification pass showed the RBAC-block-on-direct-URL
  case and the "does a draft survive navigation" case were both untestable (and arguably not really
  true) without it, since a hard page load previously reset the in-memory-only state back to the Owner
  default. This is demo/local-only persistence, not a substitute for real auth/session — noted so a
  human doesn't mistake it for one.

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
