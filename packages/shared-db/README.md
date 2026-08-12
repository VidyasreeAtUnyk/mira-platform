# @mira/shared-db

The canonical Phase 0 Postgres schema (`schema.sql`) for the merged
CRM + lead-agent data model. Types for these tables live in
`packages/shared-types`.

## `migrations/` (post-Phase-0 additions)

`schema.sql` is the frozen Phase 0 snapshot -- module branches building
after Phase 0 don't edit it in place. When a module needs a genuinely
cross-module table (read by more than its own app -- e.g. the Dashboard's
Today view or the Monthly report), it adds a new, numbered, additive-only
file under `migrations/` instead, with a header explaining why the table is
shared rather than app-local. Apply `schema.sql` first, then `migrations/`
files in numeric order:

```
psql mira_dev -f packages/shared-db/schema.sql
psql mira_dev -f packages/shared-db/migrations/001_trackers_goals.sql
psql mira_dev -f packages/shared-db/migrations/002_social_posts.sql
psql mira_dev -f packages/shared-db/migrations/003_transaction_pipeline_and_listings.sql
```

Current migrations:
- `001_trackers_goals.sql` (apps/trackers, module 10): `goals` and
  `goal_progress_entries` tables. Promoted to shared rather than kept
  apps/trackers-local because revenue/activity targets are read by the
  Today view (module 2) and monthly report (module 11) too -- see the
  migration file's header and `PROGRESS-trackers.md` for the full reasoning.
  Additive only; does not touch any Phase 0 table. Verified applying
  cleanly to a scratch local Postgres 16 database (constraint checks
  exercised, not just DDL).
- `002_social_posts.sql` (apps/social-assistant, SPEC.md module 7):
  `social_posts` (content calendar, draft-and-hold status) and
  `social_post_metrics` (performance monitoring, structure only -- no live
  posting integration exists yet). See that file's header for the full
  promotion rationale and what deliberately stayed app-local instead.
  <!-- Both this and 001_trackers_goals.sql were built in parallel module
       branches without visibility into each other, so both originally
       numbered themselves 001 -- renumbered during the integration pass
       (claude/integration) so `migrations/` has a single, unambiguous
       apply order. See PROGRESS-integration.md. -->
- `003_transaction_pipeline_and_listings.sql` (apps/pipeline, SPEC.md
  modules 2 & 3): new columns on the shared `properties` table plus a new
  `listing_price_changes` table. Additive/idempotent, safe to re-run. Any
  other module reading/writing `properties` (apps/inventory, apps/crm's
  intelligence page) should be aware these now exist.
  <!-- Originally numbered 006 on its source branch (apps/pipeline built
       without visibility into apps/trackers' or apps/social-assistant's
       migrations); renumbered to 003 during the integration pass for a
       gap-free sequence. See PROGRESS-integration.md. -->

Tables that stay app-local (not promoted here) keep their own migration
under the owning app's directory -- e.g. `apps/lead-agent`'s `run_state`/
`run_metrics`, or `apps/social-assistant/db/schema.sql`'s
`listing_marketing_details` / `developer_brand_profiles` / `ai_call_log`.

## What applies this schema where

- **apps/crm** (production data store): the real Supabase project. The
  incremental Supabase migration that brings it from its pre-merge schema
  (`apps/crm/supabase/migrations/001-003`) up to this shape is
  `apps/crm/supabase/migrations/004_shared_schema_merge.sql`. Apply via the
  Supabase CLI (`supabase db push`) -- not done automatically by this repo.
- **apps/lead-agent** (dev/test): connects directly via `DATABASE_URL` (see
  `apps/lead-agent/.env.example`) using the `pg` driver, and applies
  `schema.sql` verbatim on startup (same pattern as its old
  `node:sqlite`-backed `schema.sql`, just against Postgres now).

Both apps end up pointed at the same physical tables once `DATABASE_URL` /
the Supabase project are the same database -- that's what "shared schema"
means here. No credentials for a real shared Postgres instance exist in this
repo yet (see PROGRESS-phase0.md blockers); until they're set, each app can
be run/tested against its own local Postgres with identical schema, but
they are not actually sharing data until pointed at the same instance.

## Local dev/test database

```
createdb mira_dev
psql mira_dev -f packages/shared-db/schema.sql
```

`apps/lead-agent`'s own db client does this automatically against whatever
`DATABASE_URL` it's given (see `apps/lead-agent/src/db/client.ts`).
