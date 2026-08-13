# Progress — integration

Status: done
<!-- Was "needs-human-review", then "in-progress" -- both blocking product
     decisions (RBAC, notification tiers) are made and implemented, cross-app
     navigation works (Multi-Zones), the dashboard now has real widgets for
     every module with a database (review queue, team goals, pipeline
     summary, compliance alerts), and both documented bugs from the human
     verification pass are fixed (plus two more of the same class, found
     along the way -- see "Remaining work completed" below). The two items
     that were previously "Explicitly out of scope" -- comms-hub having no
     live database, and apps/social-assistant's narrower ViewerRole not
     being folded into the shared AgentRole -- have both since been done;
     see "Remaining work completed" for the comms-hub database rewrite and
     the dashboard Review Queue wiring that followed from it. -->

## Product decisions resolved (2026-08-13, human + Claude working session)

Both items from "Needs a product decision" below are now decided and
implemented on this branch (commit `0e4ea3b`), not left for a future pass:

- **RBAC**: `AgentRole` in `packages/shared-types` is now SPEC.md's 6-role
  table directly (`owner_coo`/`senior_agent`/`junior_agent`/
  `marketing_social`/`admin_ops`/`finance`), replacing the old 3-value
  seniority enum. Every real RLS policy and app-code check that depended
  on the old "manager or admin = unrestricted" pattern was updated to
  `owner_coo` (the only SPEC.md role with unrestricted access -- see
  `apps/crm/supabase/migrations/006_rbac_roles.sql`'s header for the full
  reasoning). `apps/dashboard`'s `DashboardRole` and `apps/comms-hub`'s
  `CommsRole` -- the two independent implementations that had already
  converged on this exact shape -- now both import the shared type instead
  of each defining it locally.
- **Notification tiers**: `NotificationTier` (`urgent`/`today`/`fyi`) is
  now shared too, promoted from `apps/comms-hub`'s local concept. Only the
  type + display labels + sort order are shared -- per-type tier
  *computation* stays local to whoever's aggregating (dashboard's
  `queries.ts` has its own heuristics for proposals/suggestions/social
  posts, comms-hub keeps its own `computeTier()`), matching how comms-hub's
  own heuristic was already local business logic, not a shared algorithm.
- **Dashboard now actually reads other modules**: `getReviewQueue()`
  (previously defined but never called) merges `proposals` +
  `ai_suggestions` (Phase 0) with `social_posts` where
  `status = 'pending_approval'` (apps/social-assistant) into one
  tiered, sorted list, replacing the old "Agent Core -- not built yet"
  placeholder. That placeholder conflated two different things -- "no
  automated suggestions exist yet" (still true, Agent Core isn't built)
  and "nothing is waiting for review" (not true -- real drafted content
  already exists) -- the new section is honest about which of those it is.

Verified against a real, fully-migrated local Postgres, not just
typechecked: recreated `mira_staging_dev` from scratch, applied all 11
migrations in sequence (CRM 001-006, shared-db 001-004, trackers 002) with
zero errors, reseeded pipeline then trackers, and ran dashboard/trackers/
comms-hub live. Caught one real bug this way that typecheck alone would
have missed: migration 006's data remap originally ran *before* dropping
the old constraint, so it violated its own target state on first real
apply -- fixed by reordering (drop constraint -> remap data -> add new
constraint). Screenshotted the Review Queue with three real items (one
from each source table) rendering correctly, tiered and sorted as
designed, and confirmed the role switcher still narrows nav correctly for
all 6 roles.

At the time this section was written, `apps/comms-hub`'s pending message
drafts were not in the merged queue (that app had no live database
connection yet). See "Remaining work completed" below for the comms-hub
database rewrite and the Review Queue update that closed this gap.

## Remaining work completed (2026-08-13, same working session, continued)

- **Cross-app navigation** (commit `94c98da`): works now, via Next.js
  Multi-Zones -- `apps/dashboard` is the root zone, each of
  `apps/pipeline`/`apps/trackers`/`apps/social-assistant`/`apps/comms-hub`
  keeps its own `basePath` and stays independently deployed, proxied
  through dashboard's `next.config.ts` rewrites. Verified with all 5 apps
  running together, clicking through from the dashboard, not just
  individually. `financials` nav item stays `"planned"` -- no app exists
  for it (SPEC.md module 5 was never assigned to a build module). Caught
  and fixed a real bug along the way: `apps/pipeline`'s root page did
  `redirect("/pipeline")` to a same-named sub-route, which under
  Multi-Zones' automatic basePath-prepending became a real HTTP redirect
  that leaked the zone's own origin back to the browser (manifested as a
  proxy socket hang up, not just a cosmetic double-slash) -- fixed by
  rendering the board directly at root instead of redirecting to it.
- **Dashboard widgets** (commit `5c0eec6`): trackers/pipeline/inventory now
  have real presence on the Today view -- Team Goals (active team-scope
  goals with progress bars), Deals in Motion (active transaction counts by
  stage), Compliance Alerts (overdue/expiring-soon MOU terms). Each reads
  the shared database directly, same as the Review Queue already did.
  Found and fixed a real rendering bug building the last one, by actually
  rendering it: `apps/dashboard/src/lib/db.ts` had type-parser overrides
  for numeric/timestamptz/timestamp but not plain `date` columns
  (`mou_terms.term_end`) -- pg's default date handling returns a JS `Date`
  object, which crashes React and can shift the calendar date by a day
  depending on server timezone. Fixed with a `DATE` type parser.
- **Both documented bugs from the human verification pass, fixed, plus two
  more of the same underlying class found along the way** (commit
  `5c0eec6`):
  - `apps/pipeline`'s seed script no longer blanket-`TRUNCATE`s shared
    tables it doesn't own -- switched to `apps/trackers`' safer pattern
    (delete only its own rows, by natural identifier). Verified by seeding
    trackers then pipeline against the same database and confirming both
    survive.
  - The "`apps/inventory` test fixtures miss `agent_id`" bug reported
    previously turned out to be a **false positive** -- that verification
    was built against `apps/crm`'s incremental migrations, not the
    canonical `packages/shared-db/schema.sql` `apps/inventory`'s own test
    infrastructure actually uses. Running the real test suite (23/23
    passing) surfaced the actual bug: `schema.sql` declares
    `leads.agent_id` nullable, `apps/crm`'s migration declares it `NOT
    NULL` -- genuine drift between two representations of "the same
    schema" that migration 004 had already fixed for `interactions.
    agent_id` but missed for `leads`. New migration 007 closes that gap.
  - Same class of drift, second instance: `schema.sql` defaults
    `leads.lead_type` to `'buyer'`, `apps/crm`'s migration has no default.
    Found running `apps/inventory`'s real dev seed script, which also had
    pipeline's original bug (never set `lead_type` at all) -- fixed that
    insert directly, migration 008 closes the default-value drift.

Verified against a freshly rebuilt database (all 13 migrations, zero
errors) with trackers, pipeline, and inventory all seeded together into
one shared database (previously impossible without pipeline wiping the
others), and the dashboard actually rendering real data in every section,
screenshotted, not just typechecked.

- **`apps/social-assistant`'s `ViewerRole` folded into shared `AgentRole`**:
  the local `'founder'`/`'marketing'`/`'other'` stand-in (`src/types/
  social.ts`) is now an alias of `@mira/shared-types`' `AgentRole`/
  `AGENT_ROLE_LABELS`; `canCreatePosters()` and the role switcher's default
  now key off `'owner_coo'` instead of `'founder'`. All 8 call sites
  updated (including hardcoded "founder" copy in `posters/new/page.tsx`
  and `components/nav.tsx`, and `created_by_role: 'founder'` in the demo
  fixtures). Verified live: role switcher renders real labels, poster
  creation gate still restricts to Owner/COO only.
- **`apps/comms-hub` given a real Postgres-backed database**, replacing
  its in-memory mock store (`src/lib/mock-data.ts` + `src/components/
  comms-store.tsx`, both deleted): applied its previously-unapplied
  `supabase/migrations/001_comms_hub_schema.sql` to `mira_staging_dev`,
  converted every page to an async Server Component reading `src/lib/
  data/comms.ts` directly (new data-access layer: `listThreads`,
  `listMessages`, `listNotifications`, `listViewers` against the real
  `agents` table, `computeAndPersistTier`, `markThreadRead`,
  `addReplyDraft`, `createDraftThread`), moved all mutations into Server
  Actions (`src/app/actions.ts`), and extracted the few genuinely
  interactive bits (notification-bell toggle, viewer switcher, tier-tab
  filter, `usePathname()` nav highlighting) into small client-island
  components since Server Components can't hold that state. Added a real
  seed script (`src/db/seed.ts`) that resolves real lead/agent ids by
  name instead of hardcoding uuids, reuses the app's own `computeTier()`
  rather than re-deriving tiers, and -- since no other module's seed
  created agents in the `senior_agent`/`marketing_social`/`admin_ops`/
  `finance` roles -- adds four demo agents in those roles via
  `INSERT ... ON CONFLICT (email) DO UPDATE` so the RBAC viewer switcher
  has something real to exercise for every role. Draft-and-hold is
  preserved by construction, not convention: no code path anywhere in
  this rewrite ever sets an outbound message's `status` to `'sent'`
  (verified by reading every write path, not just the state-machine
  comment in the schema). Two `pg` type-parser gotchas found the same way
  as dashboard's (by running it, not typechecking): `TIMESTAMPTZ`/
  `TIMESTAMP` need `.toISOString()`, and passing a function
  (`roleLabel`) from a Server Component to a Client Component fails
  outright ("Functions cannot be passed directly to Client Components")
  -- fixed by having the client island import the shared label map itself
  instead of receiving it as a prop.
- **Dashboard's `getReviewQueue()` extended to include comms-hub's pending
  drafts**, closing the exact gap the "Explicitly out of scope" section
  used to describe: now queries `messages` joined to `message_threads`
  for rows where `direction = 'outbound'` and `status in ('draft',
  'pending_approval')`, reusing the `tier` comms-hub already computed and
  persisted on the thread rather than recomputing it. `ReviewQueueItem`
  gained a `"comms_draft"` kind; `apps/dashboard/src/app/page.tsx`'s
  `ReviewQueueRow` renders it as "Comms Hub draft" alongside proposals/
  suggestions/social posts. Verified live: seeded two real comms-hub
  drafts, confirmed both render in the dashboard's Review Queue with the
  correct tier badge and relative timestamp.

## Done

- Confirmed `phase0-complete` tag exists (on `claude/shared-schema`'s tip,
  `cde0189`) and every module's PROGRESS-*.md says `Status: done`
  (dashboard, trackers, social-assistant, comms-hub, pipeline-listings,
  inventory-developer) -- all had commits within the last 20 minutes at the
  time this pass started, so per the staleness rule this run treated them
  as "leave alone, just verified `Status: done`", not resumed.
- Created `claude/integration` fresh off `origin/master` (cold start, branch
  didn't exist yet).
- Merged all 7 branches into `claude/integration`, in MODULES.json order,
  one at a time: `claude/shared-schema`, `claude/dashboard`,
  `claude/trackers`, `claude/social-assistant`, `claude/comms-hub`,
  `claude/pipeline-listings`, `claude/inventory-developer`. All pushed.
- **One real git conflict**, in `claude/social-assistant`'s merge:
  `packages/shared-types/src/domain.ts` (+ its `dist/` build output). Both
  `claude/trackers` and `claude/social-assistant` appended a new section to
  the end of the same file (`Goal`/`GoalProgress*` types vs.
  `SocialPost`/`SocialPostMetric` types) -- purely additive, no shared
  symbol names, no semantic overlap. Resolved by keeping both sections in
  full. Rebuilt `packages/shared-types/dist/` from the resolved `src/`
  using `npx -p typescript@5.6.3` (pinned to the package's own
  devDependency -- this environment's global `tsc` is 6.0.2 and throws a
  stricter `rootDir` error against this package's `tsconfig.build.json`
  that 5.6.3 doesn't). `tsc -p tsconfig.json --noEmit` passes clean on the
  merged file.
- **Two migration-numbering collisions**, both self-flagged in advance by
  the module branches' own commits/PROGRESS notes (each module built
  without visibility into sibling branches, so each independently picked
  the "next" number off what it could see):
  - `claude/social-assistant`'s `001_social_posts.sql` collided with
    `claude/trackers`' `001_trackers_goals.sql`. Renumbered social's to
    `002_social_posts.sql` (kept trackers' as `001` since it merged
    first). Updated its self-referencing header comment and all in-repo
    references (`apps/social-assistant/src/types/social.ts`,
    `apps/social-assistant/db/schema.sql`).
  - `claude/pipeline-listings`' `006_transaction_pipeline_and_listings.sql`
    and `claude/inventory-developer`'s `006_developer_inventory.sql` both
    used `006` (pipeline's own `PROGRESS-pipeline.md` already flagged this
    exact collision by name before this pass started). Renumbered to `003`
    and `004` respectively (no `003`-`005` gap existed to justify keeping
    `006`). Updated both files' self-referencing headers and all in-repo
    path references (`apps/pipeline/src/lib/db.ts`,
    `apps/pipeline/src/tests/testHelpers.ts`,
    `apps/inventory/src/db/client.ts`,
    `apps/inventory/src/tests/testHelpers.ts`,
    `apps/inventory/src/domain/types.ts`).
  - `packages/shared-db/README.md` had two independently-written, mutually
    contradictory "current migrations" sections (one from trackers, one
    from social) after the merge. Reconciled into a single ordered list:
    `001_trackers_goals.sql` → `002_social_posts.sql` →
    `003_transaction_pipeline_and_listings.sql` →
    `004_developer_inventory.sql`.
- Checked for shared-types redefinition violations (CLAUDE.md's "don't
  fork a local copy" rule) across all module-local `types.ts`/`domain`
  files (`apps/pipeline/src/types.ts`, `apps/inventory/src/domain/types.ts`,
  `apps/comms-hub/src/types/index.ts`,
  `apps/social-assistant/src/types/social.ts`). No collisions -- every
  module-local type is a genuinely new domain concept (`Listing`,
  `Transaction`, `DeveloperPartner`, `MouTerm`, `Viewer`, `MessageThread`,
  etc.), none shadow or duplicate an existing `@mira/shared-types` export.
- Confirmed root `package.json`'s `workspaces: ["apps/*", "packages/*"]` is
  glob-based, so all 6 new `apps/*` directories are picked up automatically
  -- no manual workspace-list edit needed.

## Needs a product decision (not fixed here)

- **The dashboard (`apps/dashboard`) doesn't read any of the 5 modules that
  merged after it was built.** `apps/dashboard/src/lib/queries.ts` only
  queries Phase-0 tables (`leads`, `proposals`, `ai_suggestions`,
  `agents`). Nothing reads `goals`/`goal_progress_entries` (trackers),
  `social_posts`/`social_post_metrics` (social-assistant), `transactions`/
  `listings`/`listing_price_changes` (pipeline), developer-inventory
  tables (inventory), or comms-hub's threads/notifications. This is a
  self-documented gap, not a surprise: `apps/dashboard/src/lib/roles.ts`
  explicitly marks every non-`today` nav item as `status: "planned"` with
  a comment saying this is "not resolved here" because "the other module
  worktrees haven't merged" yet at build time -- well, they have now.
  I did not attempt to wire this up myself because it's genuinely
  feature-scoped judgment, not a mechanical fix:
  - SPEC.md's review/approval queue is supposed to be where "nearly
    everything routes" -- social's own migration header explicitly says
    "pending-approval social posts are exactly that kind of item," and
    comms-hub's `pending_approval` message status is the same shape. But
    *how* to merge proposals + ai_suggestions + pending social posts +
    pending comms drafts into one prioritized queue (sort order, dedup,
    per-item action affordances) is a UX decision.
  - comms-hub independently built its own three-tier notification
    priority concept (`urgent`/`today`/`fyi`, `apps/comms-hub/src/lib/
    tiers.ts`, type `NotificationTier` local to
    `apps/comms-hub/src/types/index.ts`) matching SPEC.md module 6. If the
    dashboard is going to show a unified "what needs attention" feed, this
    tiering concept (or something compatible with it) needs to become a
    cross-module concept -- almost certainly promoted into
    `packages/shared-types`, the same way `Goal`/`SocialPost` were. That's
    exactly the kind of "add to shared packages, don't fork" call
    CLAUDE.md says a human should be able to review the intent of, not
    something to unilaterally decide in an automated pass.
  - `apps/dashboard/src/lib/roles.ts`'s own header flags a second,
    related open item: `@mira/shared-types`' `AgentRole` is a 3-value
    enum (`agent`/`manager`/`admin`) but SPEC.md's RBAC table has 6 roles
    with materially different "sees" boundaries (e.g. Marketing/Social has
    zero CRM access, which isn't expressible as a seniority level). Wiring
    the dashboard's per-role module visibility to real data hits this same
    unresolved schema question. Left as `apps/dashboard`-local
    (`DashboardRole`) per that file's own reasoning; flagging here since
    it now blocks the dashboard-integration work above, not just a
    hypothetical.

  Recommend treating "wire the dashboard up to the 5 merged modules" as
  its own scoped follow-up (possibly its own module/branch) rather than
  something a future integration pass does ad hoc, given the shared-type
  promotion and RBAC-shape decisions embedded in it.

## Next

- A human should review this branch (`claude/integration`) and merge it to
  `staging` if satisfied -- this pass does not merge to `staging`/`main`
  itself, per instructions.
- Once merged to `staging`, decide on the dashboard cross-module wiring
  above (possibly as a new fan-out module) before treating Phase 2+ as
  "done."
- No merge conflicts remain unresolved; nothing was left in a broken git
  state.

## Re-verification pass -- 2026-08-12T18:xx UTC

This run's staleness rule flagged this branch as stalled (last commit
>2h old, status not "done") and told me to resume it, so I independently
re-checked everything below from scratch (no memory of the prior pass)
rather than trust its own PROGRESS entry at face value:

- `git log claude/integration..origin/claude/<x>` is empty for all 7
  merged branches (`shared-schema`, `dashboard`, `trackers`,
  `social-assistant`, `comms-hub`, `pipeline-listings`,
  `inventory-developer`) -- confirms every module branch is still fully
  merged in and none has moved since. Nothing new to merge this run.
- Searched the working tree for unresolved conflict markers
  (`<<<<<<<`/`=======`/`>>>>>>>`) -- none found.
- `packages/shared-db/migrations/` contains exactly `001_trackers_goals.sql`,
  `002_social_posts.sql`, `003_transaction_pipeline_and_listings.sql`,
  `004_developer_inventory.sql` -- sequential, no gaps, no duplicates,
  matching what "Done" above claims.
- Rebuilt-typechecked `packages/shared-types` with the pinned
  `typescript@5.6.3` (same pin the prior pass used, for the same
  `tsconfig.build.json` `rootDir` reason) -- `tsc --noEmit` clean.

Conclusion: nothing mechanical is left to do here. The one open item
(dashboard cross-module wiring + the `AgentRole` vs. SPEC.md 6-role RBAC
gap) is still a genuine product decision, not something this pass should
guess at -- leaving `Status: needs-human-review` unchanged rather than
marking it `done`, so a future run's staleness check keeps surfacing it
for a human rather than silently dropping it. Not resubmitting the
`phase0-complete` tag push attempt this run since it's already present on
the remote (see "Blockers" below, unchanged).

## Human verification pass -- 2026-08-13, local machine, real Postgres 17

The prior automated passes explicitly skipped running the apps together
against one shared database (see "Notes / decisions made" below -- cost
of installing 6 apps' worth of dependencies and spinning up Postgres per
app in an ephemeral sandbox). Did exactly that by hand this pass: `npm
install` at the repo root on `staging`, one Postgres 17 database
(`mira_staging_dev`) with every migration applied in sequence (CRM's
`001`-`005`, then `shared-db`'s `001`-`004`), then ran each app for real.

**Confirmed genuinely working, not just typechecked:**
- `apps/dashboard` -- live against seeded data, role switcher, stats,
  follow-ups list.
- `apps/comms-hub` -- notification tiers, draft-and-hold verified in the
  UI (no code path reaches a real send), RBAC-narrowed thread count shown
  live ("7 of 7 total threads visible").
- `apps/social-assistant` -- real `BRAND-KIT.md` taglines rendering,
  draft vs. pending-approval workflow, co-branded vs. own-brand
  distinction.
- `apps/trackers` -- real goals/streaks/progress-to-target once correctly
  seeded (see bug below).
- `apps/pipeline` -- kanban board with real seeded transactions across
  every stage, after fixing a real bug (below).
- `apps/inventory` -- no web UI (CLI/test-only by design, confirmed
  against its own `package.json`). 18/23 unit tests pass against a real
  scratch Postgres; the other 5 fail on a real bug (below).

**Three real bugs found by actually running the merged tree together --
exactly the class of issue the skipped combined-test pass was meant to
catch:**

1. **Fixed this pass**: `apps/pipeline/src/scripts/seed.ts`'s
   `insertLead()` never set `lead_type`, which is `NOT NULL` with a check
   constraint (`buyer`/`seller`/`tenant`/`landlord`) on the shared `leads`
   table. Every seed attempt failed outright. Fixed by setting `'buyer'`
   (these leads are explicitly buyer-side, moving toward a transaction --
   see the seed script's own comment above `insertLead`). Verified: seed
   now succeeds, kanban board renders all 4 seeded deals correctly.
2. **Found, not fixed**: the same seed script's reset step --
   `TRUNCATE audit_log, proposals, ai_suggestions, interactions,
   engagement_events, property_price_history, properties, leads, agents
   CASCADE` -- destroys shared tables (`agents`, `leads`, `properties`) it
   doesn't own. The script's own comment above the line warns "never
   point it at a shared/production database" -- but nothing *enforces*
   that, and running pipeline's seed after trackers' seed (both pointed
   at `mira_staging_dev`, the only sensible thing to do when testing
   modules together) silently wiped the agent trackers had just created.
   Symptom looked like a broken login/auth flow in `apps/trackers`; root
   cause was pipeline's seed script, not trackers. `apps/inventory` and
   `apps/trackers`'s own seed/reset scripts were checked and correctly
   scope their `TRUNCATE`s to tables they own -- this is specific to
   pipeline.
3. **Found, not fixed**: `apps/inventory`'s test fixtures
   (`src/tests/matching.test.ts`) and `src/db/seed.ts` insert into the
   shared `leads` table without setting `agent_id`, which is also `NOT
   NULL`. Same root cause as bug 1 (a module-local view of `leads`'
   required columns that doesn't match the table's actual constraints),
   different column. 5 of inventory's 23 unit tests fail on this against
   a real database (they pass against nothing, i.e. were apparently never
   run against a schema with this constraint enforced before now).

**Recommend as a follow-up, not guessed at here**: a single shared
test-fixture/seed helper for creating a valid `leads` row (or at minimum
a documented list of its `NOT NULL` columns), so individual modules stop
each re-deriving an incomplete view of a table they don't own. Also worth
scoping every seed script's `TRUNCATE`/reset step to tables that module
actually owns, given bug 2 above -- `apps/pipeline` is the only offender
found, but the same audit should probably cover any future module too.

This pass does not change `Status` -- the dashboard cross-module wiring
and RBAC gap above are still the real blocker to calling this "done", and
these three bugs don't block that decision either way. Recorded here so
whoever picks up the dashboard-wiring follow-up (or anyone else touching
`apps/pipeline` or `apps/inventory`) doesn't rediscover the same thing
from scratch.

## Blockers / needs human input

- See "Needs a product decision" above -- dashboard/notification-tier
  unification and the `AgentRole` vs. SPEC.md 6-role RBAC gap.
- See "Human verification pass" above -- `apps/pipeline`'s seed script
  destructively truncates shared tables (bug 2) and `apps/inventory`'s
  test fixtures/seed miss a required `leads.agent_id` (bug 3). Neither
  fixed yet; bug 1 (pipeline's missing `lead_type`) is fixed and
  committed.
- (Inherited, not new to this pass) `PROGRESS-phase0.md` notes the
  `phase0-complete` git tag failed to push at least once mid-build due to
  sandbox credential scoping (branch pushes only, no tag-ref/API tag
  creation available). By the time this integration pass ran, `git fetch
  --tags` showed `phase0-complete` present on the remote, so it evidently
  went through on a later attempt or via a human push -- noting only
  because PROGRESS-phase0.md's own text says a human should double check
  this rather than assume.

## Notes / decisions made

- Chose to renumber the *newer*-in-merge-order branch's migration file in
  each collision (social's `001`→`002`, kept trackers' `001`; pipeline's
  and inventory's `006`s → `003`/`004` in the order they were merged into
  this branch) rather than trying to infer "true" chronological order from
  commit timestamps -- the files are independent and additive regardless
  of number, so the choice is arbitrary and low-stakes; consistency of the
  final sequence (`001`-`004`, no gaps, no duplicates) is what matters.
- Did not re-run `npm install`/full builds/test suites for each
  individual app in this pass (would require installing dependencies for
  6 separate Next.js apps + CLIs, several needing a real Postgres
  instance per their own PROGRESS files) -- relied on each module's own
  PROGRESS-*.md recording its local verification (typecheck/tests) before
  marking itself `Status: done`, and independently re-verified only the
  one package every module actually shares and that this pass touched:
  `packages/shared-types` (`tsc --noEmit` clean, `dist/` rebuilt and
  committed).
