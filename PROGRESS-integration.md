# Progress — integration

Status: needs-human-review
<!-- Not "done" -- merges are clean and pushed, but one cross-module seam
     (dashboard not reading the newer modules) is a real product-scope
     decision, not something this pass should guess at. See "Needs a
     product decision" below. -->

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

## Blockers / needs human input

- See "Needs a product decision" above -- dashboard/notification-tier
  unification and the `AgentRole` vs. SPEC.md 6-role RBAC gap.
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
