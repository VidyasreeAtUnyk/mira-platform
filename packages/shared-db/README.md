# @mira/shared-db

The canonical Phase 0 Postgres schema (`schema.sql`) for the merged
CRM + lead-agent data model. Types for these tables live in
`packages/shared-types`.

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

## Post-Phase-0 migrations

`schema.sql` is the frozen Phase 0 snapshot. Additions made by module
branches after Phase 0 land in `migrations/`, one file per addition, applied
in numeric order **after** `schema.sql`:

```
psql mira_dev -f packages/shared-db/schema.sql
psql mira_dev -f packages/shared-db/migrations/001_trackers_goals.sql
```

- `001_trackers_goals.sql` (apps/trackers, module 10): `goals` and
  `goal_progress_entries` tables. Promoted to shared rather than kept
  apps/trackers-local because revenue/activity targets are read by the
  Today view (module 2) and monthly report (module 11) too -- see the
  migration file's header and `PROGRESS-trackers.md` for the full reasoning.
  Additive only; does not touch any Phase 0 table. Verified applying
  cleanly to a scratch local Postgres 16 database (constraint checks
  exercised, not just DDL).
