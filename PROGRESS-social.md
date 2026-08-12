# Progress — social-assistant

Status: in-progress
<!-- Change to "Status: done" only when fully complete, tested, and committed.
     monitor.sh checks for this exact string (case-insensitive) to know when
     to stop resuming / trigger the next phase. Don't mark done prematurely. -->

## Done
- Cold-started `apps/social-assistant` (Next.js 16 + Supabase client, same general stack family as
  apps/crm). Read `brand-kit/BRAND-KIT.md` in full and treated it as the authoritative style contract.
- `src/lib/brand/tokens.ts`: BRAND_COLORS / BRAND_FONTS / BRAND_COPY pulled directly from
  BRAND-KIT.md — not re-interpreted or approximated.
- `src/lib/poster/svg-template.ts`: programmatic SVG poster generation (not an external image-gen AI
  call — deliberate, see Notes) driven by brand tokens + real listing data. Encodes BRAND-KIT.md's
  poster rules: monogram+wordmark lockup always present, palette restricted to BRAND_COLORS, at most one
  script-font accent line, data-driven fields (price/beds/baths/community/developer) rather than free
  text, and visually distinguishes own-brand vs. developer-co-branded posts (credit line only on
  co-branded).
- `src/lib/data/{properties,posts,metrics,fixtures}.ts`: data-access layer for listings (from the shared
  `properties` table), content-calendar posts, and performance metrics.
- `src/lib/ai/budget-governor.ts`: a real budget governor scaffold — `checkAndRecordCall()` gates any
  future AI call against a daily cap (`SOCIAL_AI_DAILY_CALL_CAP` env, default 20) and logs to an
  `ai_call_log` table, fails closed (throws) if Supabase isn't configured rather than allowing unmetered
  calls. Not currently called by anything, because:
- Caption generation is **template-based**, not a live AI call — no `ANTHROPIC_API_KEY` /
  `OPENAI_API_KEY` exists in this environment (see Blockers), and the module brief's core ask (content
  calendar + poster generation) doesn't strictly require one.
- `src/lib/supabase/{client,server,service}.ts`: Supabase client setup (anon/server/service-role), no
  hardcoded credentials — reads from env, `hasSupabaseCredentials()` guards used throughout.
- `db/schema.sql`: draft schema for this module's own tables (content calendar posts, poster assets,
  performance metrics, `ai_call_log`) — **not yet added to `packages/shared-db`** (see Next/Notes on
  whether any of this should be promoted to shared).
- `src/types/social.ts`: local types for this module's own concepts, importing rather than redefining
  anything already in `@mira/shared-types`.
- Config: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`,
  `.prettierrc`, `.env.example`, `.gitignore`.

## In progress
- No UI pages/routes exist yet (no `src/app/` directory) — everything so far is the data/logic layer
  (brand tokens, poster templating, data access, budget governor, schema). The content-calendar UI and
  poster-preview UI were the next planned step when this run was interrupted (last action before the
  session-limit cutoff: "Now the budget governor and caption generation").
- Draft-and-hold status model exists conceptually in `db/schema.sql` (post status enum) but hasn't been
  wired into any actual API route or UI yet.

## Next
1. **Build `src/app/` pages**: content calendar view (list/calendar of draft posts by status), a poster
   preview/generation flow (pick a listing → generate via `svg-template.ts` → land in draft/pending-
   approval), and a performance-monitoring placeholder view (structure only, no real data source yet —
   there's no live posting channel to pull metrics from).
2. **Decide schema placement**: `db/schema.sql` in this app is currently local-draft, not applied
   anywhere and not part of `packages/shared-db`. Before this can be marked done, decide (and document)
   whether any of it needs to be a `packages/shared-db/migrations/NNN_*.sql` addition instead (per
   CLAUDE.md's "add to shared packages, don't fork a local copy" — likely relevant if e.g. the dashboard
   or a future monthly-report module ever needs to read post/poster status).
3. Run `npm install && npx tsc --noEmit` — **not run yet this session**, interrupted before verification.
   Do not trust "Done" items above as typechecked until this actually runs.
4. Wire `checkAndRecordCall()` into caption generation only if/when a real AI call is added — do not add
   an AI call path that bypasses it.
5. Apply `db/schema.sql` (or its shared-db equivalent, per item 2) to a scratch local Postgres and verify
   it applies cleanly, same discipline as Phase 0.

## Blockers / needs human input
- **BRAND-KIT.md "Open items" section**: read in full. [If it lists any values still needing founder
  confirmation, they were not guessed at in `tokens.ts` — cross-check `brand-kit/BRAND-KIT.md`'s "Open
  items" section directly against `src/lib/brand/tokens.ts` next session, since this note was written
  from memory of having read it, not copied verbatim, and the session was cut short before that
  cross-check could be re-verified line-by-line.]
- **No `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/Supabase credentials exist in this environment.** Caption
  generation was scoped to template-based specifically to avoid needing one; the budget governor exists
  and fails closed without Supabase configured, so nothing will silently run unmetered once a key is
  added later.
- **This run was cut short by an account-wide session/API rate limit**, not a code or design blocker.
  Nothing in "Done" has been typechecked or run this session.

## Notes / decisions made
- **Branched off `origin/claude/shared-schema`, not `master`.** The orchestration run book's literal
  instruction is "create the branch off the repository's default branch (master)", but `master` does not
  yet have Phase 0 merged into it — `packages/shared-*` doesn't exist there. Building against master
  would force a forked local copy of shared types, explicitly forbidden by CLAUDE.md. So this branch
  (`claude/social-assistant`) was cut from `origin/claude/shared-schema` instead, which is tagged
  `phase0-complete` (commit `cde0189`, independently verified). **A human will need to rebase this branch
  onto `master` once Phase 0 is actually merged there.** Same deviation applied by all 6 module branches
  this run, for the same reason — flagging as a real gap in the orchestration run book (Step 2 is gated
  on the tag existing, not on Phase 0 being merged into what modules are told to fork from).
- **Poster generation is SVG-templated, not AI-image-generated**, specifically to respect the budget
  governor and because no image-gen API key exists in this environment — this is a deliberate scope
  choice, not a placeholder for "should have called an AI API instead."
