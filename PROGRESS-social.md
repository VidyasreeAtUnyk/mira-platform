# Progress — social-assistant

Status: done
<!-- Change to "Status: done" only when fully complete, tested, and committed.
     monitor.sh checks for this exact string (case-insensitive) to know when
     to stop resuming / trigger the next phase. Don't mark done prematurely. -->

## Done
- **Resumed from the prior session's cold-start** (data/logic layer: brand tokens, poster SVG
  templating, budget governor, data-access layer, local draft schema) -- read all of it before
  writing anything new, per the resume instructions. Nothing in that layer was rewritten; it was
  extended (bulk listing helper, developer-profiles data access, caption generator) and, for the
  schema-placement decision below, partially relocated.
- **Built `src/app/` UI, all three requested views**:
  - **Content calendar** (`/calendar`): four-column board (draft / pending_approval / approved /
    held) reading `listPosts()` + `listListingsForPoster()`. Each `PostCard` shows kind/platform/
    brand-mode/developer/listing/caption/schedule/notes and only the status-transition buttons
    `ALLOWED_TRANSITIONS` (src/lib/data/posts.ts) actually permits from that state -- calling
    `transitionPostStatus` (`src/app/calendar/actions.ts`, a Server Action wrapping
    `updatePostStatus`). No "posted" transition exists anywhere in the UI, matching the data layer.
  - **Poster generation/preview** (`/posters/new`): pick a listing (optional) → live SVG preview via
    `generatePosterSVG` (re-rendered client-side on every field change, zero network calls) → submit
    → `createPosterDraft` Server Action (`src/app/posters/new/actions.ts`) → `createPost()`, which
    always lands as `status: 'draft'` → redirects to `/calendar`. Caption is auto-filled from the new
    `src/lib/ai/caption.ts` template generator (see below) and freely editable before submit.
    Founder-only gate (`canCreatePosters`) enforced **both** in the page (friendly notice for other
    roles) **and** again inside the Server Action itself (Next.js's own forms guide: "Always verify
    authorization inside each Server Action, even if the form is only rendered on an authenticated
    page").
  - **Performance monitoring** (`/performance`): structure-only, per scope -- lists every post with
    `getMetricsForPost()`'s result, which is honestly "not connected" for all of them (no live
    posting integration exists, so no real numbers to show). Verified no fabricated numbers render
    (see Verification below).
  - Small local Tailwind-only UI primitives (`src/components/ui/{badge,button}.tsx`) -- no
    component-library dependency added, matching apps/trackers' documented same-session decision to
    skip `@base-ui/react`/shadcn for a similar reason (this app's `package.json` already didn't
    declare it).
  - Viewer-role stand-in (`src/lib/auth/viewer-role.ts`, cookie-based, explicitly documented as NOT
    real auth/RBAC -- no login flow exists in this app) so `canCreatePosters()`'s founder-only gate
    has something real to gate against end-to-end, with a nav switcher (`src/components/
    role-switcher.tsx`) to demo both allowed and blocked states.
- **Wrote the caption generator that was referenced but never created**:
  `src/lib/ai/caption.ts` -- template-based (not an AI call, no `checkAndRecordCall()` needed, same
  reasoning as the poster generator), deterministic, pulls facts straight from the listing record.
  `budget-governor.ts`'s header comment referred to this file as if it already existed; it didn't --
  written now as part of the poster flow.
- **Small data-access additions** (same fixture-fallback pattern as the existing files, not a
  rewrite): `listListingsForPoster()` in `src/lib/data/properties.ts` (bulk version of
  `getListingForPoster`, for the picker) and a new `src/lib/data/developers.ts`
  (`listDeveloperProfiles()`, reading `developer_brand_profiles`).
- **Resolved the schema-placement question** (see Notes for full writeup): promoted `social_posts`
  and `social_post_metrics` from `apps/social-assistant/db/schema.sql` to
  `packages/shared-db/migrations/001_social_posts.sql`, and their TypeScript shapes
  (`PostStatus`/`SocialPlatform`/`PostKind`/`BrandMode`/`SocialPost`/`CreateSocialPostInput`/
  `SocialMetricType`/`SocialPostMetric`) from `apps/social-assistant/src/types/social.ts` to
  `packages/shared-types/src/domain.ts` -- same precedent apps/trackers used for its `goals` tables
  (verified by reading `origin/claude/trackers`'s `PROGRESS-trackers.md` and its
  `packages/shared-db/migrations/001_trackers_goals.sql`). `apps/social-assistant/db/schema.sql` and
  `src/types/social.ts` were updated to match (kept: `listing_marketing_details`,
  `developer_brand_profiles`, `ai_call_log`, `ViewerRole`/`canCreatePosters`,
  `DeveloperBrandProfile`, `ListingForPoster`/`ListingMarketingDetails` -- genuinely app-local).
  `packages/shared-db/README.md` updated to document the new `migrations/` convention.
- **`npx tsc --noEmit` clean** -- `npm run typecheck --workspace=social-assistant` exits 0, confirmed
  fresh after every file added in this session (not trusted from memory, actually re-run at the end).
  `npm run typecheck --workspace=@mira/shared-types` also clean after the domain.ts addition + a
  `npm run build --workspace=@mira/shared-types` rebuild of `dist/`. `npm run lint --workspace=
  social-assistant` also clean.
- **Real end-to-end verification, not just compilation** -- see "Verification" section below for the
  full method and results. Both the schema (against real scratch Postgres) and the UI (against a
  real running dev server, driven by an actual headless browser, not curl) were exercised for real.
- Installed dependencies at the repo root (`npm install`, workspaces-aware) since this was never done
  in the cold-start session -- this is also what proved the `@mira/shared-types` workspace link
  resolves correctly for `apps/social-assistant`.

## In progress
- Nothing left in progress for this session's scope. See Next for what a follow-up session /
  integration pass should pick up.

## Verification
**Schema (packages/shared-db/schema.sql → packages/shared-db/migrations/001_social_posts.sql →
apps/social-assistant/db/schema.sql), against a real scratch Postgres 16 (`mira_social_scratch`,
this sandbox's local instance)**:
- All three files applied cleanly, in that order, with zero errors.
- Re-applied all three a second time to confirm idempotency (`if not exists` / `create or replace`
  throughout) -- clean, exit 0 each time.
- Constraint-tested for real, not just read: `insert ... brand_mode='own', developer_partner_name=
  'DAMAC'` correctly **rejected** by `social_posts_brand_mode_consistency`; the equivalent
  `co_branded` insert with a developer name **succeeded**. This also proves the cross-file
  `ai_call_log.post_id → social_posts(id)` FK works correctly when `social_posts` lives in the
  shared migration and `ai_call_log` stays in the app-local file, applied in the documented order.
- Database dropped after verification (scratch only, nothing persisted).

**UI end-to-end, against a real running dev server** (`npm run dev --workspace=social-assistant`,
no `.env.local` present → this app's own documented fixture/in-memory fallback path --
`hasSupabaseCredentials()` is false, exactly the "reviewable without live infrastructure" path every
file in `src/lib/data/` was already written to support): driven with real headless Chromium
(Playwright, not curl -- actual clicks/selects/form submission/navigation), screenshots captured.
- `/calendar`: renders both fixture posts in the correct status columns (draft, pending_approval),
  approved/held columns correctly empty.
- `/posters/new`: renders the form and a live inline SVG poster preview. Selecting a fixture listing
  updates the preview with real price/beds/baths/community facts (confirmed `AED` appears in the
  rendered SVG only after selection). Switching to co-branded + picking a developer adds the "IN
  PARTNERSHIP WITH …" credit line to the SVG (confirmed present). Caption box auto-fills from
  `generateCaption()` and reflects the co-branding change live.
  Submitting the form (with notes text `"e2e smoke test post"`) redirected to `/calendar`, where the
  new draft post is now visible with that note text and the post count went from 2 → 3 -- proves the
  Server Action → `createPost()` → in-memory store → revalidated calendar path works for real, not
  just that each piece typechecks in isolation.
- Founder-only gate: switching "Viewing as" to `marketing` and visiting `/posters/new` correctly
  shows the founder-only notice instead of the form (confirmed by page text, not just code reading).
- `/performance`: renders all three posts (including the one just created) with an honest
  "Not connected — No database configured..." message for every one; confirmed via regex that no
  `impressions: <number>`-shaped fake metric ever renders.
- Zero browser console errors and zero page errors across the whole flow (`console --errors`
  equivalent checked after every navigation).
- Dev server killed cleanly afterward (no leftover process).

**What was NOT verified, and why**: the UI was not run against a live Supabase project / PostgREST
instance, because none exists anywhere in this repo -- confirmed this is a repo-wide blocker, not
specific to this module (see `origin/claude/trackers`'s `PROGRESS-trackers.md`: "No live Supabase
project/credentials exist anywhere in this repo"; same in `PROGRESS-phase0.md`). This sandbox also
has no Supabase CLI and no accessible Docker daemon (`docker pull` fails: `dial unix
/var/run/docker.sock: connect: no such file or directory`), so standing up a local
Postgres+PostgREST stack to more faithfully emulate Supabase wasn't possible here either. The
Postgres-level schema verification above and the fixture-mode UI verification together are the most
complete end-to-end check available in this environment; they exercise the same code paths
(`src/lib/data/*.ts`) a live Supabase project would, branching only on `hasSupabaseCredentials()`.
A human with real Supabase credentials should still do one live pass before trusting this in
production, same as every other module in this repo currently needs.

## Next
- When real Supabase credentials exist (`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in
  `.env.local`, never committed), do one live-DB pass through the same calendar → poster → performance
  flow verified here in fixture mode, applying `packages/shared-db/schema.sql` →
  `packages/shared-db/migrations/001_social_posts.sql` → `apps/social-assistant/db/schema.sql` to
  that real project first (same order verified against scratch Postgres in this session).
- Integration pass (scripts/integration.sh): reconcile `packages/shared-db/migrations/` numbering
  across module branches -- this branch added `001_social_posts.sql` independently of
  `origin/claude/trackers`'s own `001_trackers_goals.sql` (each module branch only sees its own
  branch's state; a human/integration step needs to renumber one of them before both land on the
  same branch). Also fold `listing_marketing_details` into the shared `properties` table and
  reconcile `developer_brand_profiles` with module 4's real developer partner directory once it
  ships (both already flagged in `apps/social-assistant/db/schema.sql`'s header).
- Wire `checkAndRecordCall()` into caption generation ONLY IF a real AI-assisted captioning path is
  added later -- today's `src/lib/ai/caption.ts` is template-only and correctly does not call it.
- If/when a real posting integration is ever built (own future session, explicit human decision, not
  assumed): extend `PostStatus`/`METRIC_TYPES` deliberately at that point, wire `recordMetric()`
  (already exists, unused, `source: 'platform_api'` only), and only then does `/performance` get real
  numbers.
- A human still needs to rebase this branch onto `master` once Phase 0 is actually merged there (see
  prior session's Notes below -- unchanged, still true).

## Blockers / needs human input
- **BRAND-KIT.md "Open items" section — re-verified line-by-line this session, cross-check confirmed
  accurate, nothing new to flag.** BRAND-KIT.md lists exactly three open items: (1) exact hex values,
  (2) exact typeface names/licenses, (3) any additional approved photography library. Checked each
  against `src/lib/brand/tokens.ts` directly:
  - Hex values: `BRAND_COLORS` uses exactly BRAND-KIT.md's approximate hexes (`#0B1B20`, `#0D1F26`,
    `#C9A24C`, `#D8B36A`, `#F2ECE0`), flagged via `BRAND_COLOR_CONFIDENCE.needsFounderConfirmation:
    true` with BRAND-KIT.md's own caveat sentence quoted verbatim. Confirmed still true: **founder
    still needs to confirm exact hex from source logo files (AI/EPS/Figma) before these are locked
    in** -- no such source file exists in `brand-kit/` for this session to check against either.
  - Typefaces: `BRAND_FONTS` uses labeled Google Fonts stand-ins (Playfair Display / Cormorant
    Garamond / Inter / Petit Formal Script), explicitly not claimed as final, flagged via
    `BRAND_FONT_CONFIDENCE`. Confirmed still true: **founder still needs to confirm real typeface
    names/licenses.**
  - Photography library: `BRAND_OPEN_ITEMS` correctly notes posters fall back to a brand-motif
    background (no photo) when a listing has no `photo_url`, and that no approved photography beyond
    the live site has been confirmed. Confirmed still true: **founder still needs to confirm an
    approved photography library** (no photos were added or assumed anywhere in this session's UI
    either -- the poster form has no photo upload/picker, matching this gap honestly).
  - One thing tokens.ts flags that BRAND-KIT.md doesn't explicitly list as an "open item" but
    logically follows from it: no real logo source file exists in `brand-kit/`, so the poster
    generator draws a programmatic monogram+flame glyph instead of compositing real artwork
    (`BRAND_ASSET_CONFIDENCE`). This is a reasonable, explicitly-labeled extrapolation, not an
    invented value -- left as-is.
  **None of these were guessed at or silently resolved in this session's UI work** -- the poster
  preview visibly uses the approximate palette/stand-in fonts, and nothing in the new UI implies
  these are final.
- **No `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/Supabase credentials exist in this environment** (still
  true, unchanged from the prior session). Caption generation stayed template-based for exactly this
  reason (see `src/lib/ai/caption.ts`'s header); the budget governor exists, fails closed without
  Supabase, and nothing in this session's new code calls an AI/model API. See "Verification" above
  for exactly what this meant for testing this session's UI work.
- **This session did not have access to a live Supabase project, Supabase CLI, or a working Docker
  daemon** (confirmed: `docker pull` fails with "no such file or directory" on the docker socket) --
  see "What was NOT verified, and why" above for the precise scope of what that limited.
- **Migration filename collision at integration time, added after this PROGRESS entry was otherwise
  finalized**: this branch's new migration is `packages/shared-db/migrations/001_social_posts.sql`.
  The `trackers` module branch (`claude/trackers`, built independently in a separate worktree with no
  visibility into this branch) also created `packages/shared-db/migrations/001_trackers_goals.sql`.
  The two don't conflict in content (`goals`/`goal_progress_entries` vs. `social_posts`/
  `social_post_metrics` -- entirely different tables), but **both are numbered 001** and will collide
  by filename once both branches are merged. Same class of issue as the separately-flagged `006_*`
  collision between `claude/pipeline-listings` and `claude/inventory-developer` (see those PROGRESS
  files) -- needs human resolution during the integration pass (Step 3): renumber sequentially in
  whatever order the branches are actually merged, rather than guessing here since neither branch can
  see the other's final state.

## Notes / decisions made
- **Branched off `origin/claude/shared-schema`, not `master`.** The orchestration run book's literal
  instruction is "create the branch off the repository's default branch (master)", but `master` does
  not yet have Phase 0 merged into it -- `packages/shared-*` doesn't exist there. Building against
  master would force a forked local copy of shared types, explicitly forbidden by CLAUDE.md. So this
  branch (`claude/social-assistant`) was cut from `origin/claude/shared-schema` instead, which is
  tagged `phase0-complete` (commit `cde0189`, independently verified -- re-verified again this
  session: `git tag -l` confirms the tag exists in this worktree). **A human will need to rebase this
  branch onto `master` once Phase 0 is actually merged there.** Same deviation applied by all 6 module
  branches this run, for the same reason -- flagging as a real gap in the orchestration run book (Step
  2 is gated on the tag existing, not on Phase 0 being merged into what modules are told to fork
  from). Unchanged from the prior session; still true this session.
- **Poster generation is SVG-templated, not AI-image-generated**, specifically to respect the budget
  governor and because no image-gen API key exists in this environment -- this is a deliberate scope
  choice, not a placeholder for "should have called an AI API instead." Unchanged from the prior
  session; the new poster-generation UI (`/posters/new`) renders this SVG template live in the browser
  with zero network calls, which is the natural conclusion of that original decision.
- **Schema-placement decision, in full**: `social_posts` and `social_post_metrics` are promoted to
  `packages/shared-db/migrations/001_social_posts.sql`; `listing_marketing_details`,
  `developer_brand_profiles`, and `ai_call_log` stay in `apps/social-assistant/db/schema.sql`.
  Reasoning: SPEC.md module 2 (Dashboard "Today view") is explicitly meant to be the one home screen
  surfacing what needs attention across modules via the review/approval queue -- "nearly everything
  routes here at launch" -- and a `pending_approval` social post is squarely that kind of item.
  SPEC.md module 11 (Monthly report) explicitly rolls up "marketing ROI", which needs both what ran
  (`social_posts`) and how it performed (`social_post_metrics`) once a real posting integration
  exists. Neither of those modules should have to reach into `apps/social-assistant/`'s directory
  (forbidden by CLAUDE.md's module-boundary rule) or fork a competing posts/metrics concept
  (forbidden by CLAUDE.md's "don't redefine types that already exist" rule once they DO need this
  data) -- promoting now avoids both. `listing_marketing_details` and `developer_brand_profiles`
  stayed local because nothing outside this module reads them today, and both are explicitly flagged
  as provisional (pending a real `properties` schema extension and pending module 4's real developer
  directory, respectively) -- promoting a table that's expected to be replaced/folded in soon would
  make the shared schema noisier, not more useful. `ai_call_log` stayed local following the exact
  precedent `packages/shared-db/schema.sql`'s own header comment sets for apps/lead-agent's
  `run_state`/`run_metrics` (internal operational bookkeeping, not part of the shared contract).
  Because `developer_brand_profiles` stays local, `social_posts.developer_partner_name` in the shared
  migration is plain `text`, not a foreign key (a shared table can't FK into an app-local one without
  breaking the module-boundary rule in the other direction) -- application-layer consistency
  (`assertBrandModeConsistency` in `src/lib/data/posts.ts`) plus the DB CHECK constraint on brand-mode
  consistency still hold the real invariant.
  **Discovered while verifying this against `origin/claude/trackers`'s actual state**: that branch
  independently created its own `packages/shared-db/migrations/001_trackers_goals.sql` -- since each
  module branch only sees its own branch's file tree (by design, per CLAUDE.md's module-boundary/
  parallel-fan-out setup), this branch's own `001_social_posts.sql` is *also* numbered `001`. This
  is an expected, documented collision for the integration pass to resolve (renumber one before both
  land on the same branch), not a mistake in either branch -- flagged explicitly in Next above so a
  human/integration script doesn't silently drop one.
- **Viewer-role switcher is a stand-in, not real RBAC/auth** -- there is no login flow, no Supabase
  auth session, and no `apps/crm`-style `src/proxy.ts` session-refresh middleware in this app. This
  was a deliberate scope decision for this session (out of scope per the task's explicit UI list:
  calendar / poster flow / performance placeholder -- auth wasn't asked for and wiring real Supabase
  auth without live credentials to test against would itself be unverifiable). A cookie-based
  `ViewerRole` selector was added instead so `canCreatePosters()` (already written in the prior
  session, previously unused by any UI) has something real to gate end-to-end, and so a future
  auth-wiring session has one obvious place to swap in a real session role. Documented in the nav UI
  itself, not just code comments, so nobody mistakes it for a security boundary.
