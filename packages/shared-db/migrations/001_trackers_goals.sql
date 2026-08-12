-- packages/shared-db/migrations/001_trackers_goals.sql
--
-- Post-Phase-0 addition, added by the apps/trackers module build
-- (SPEC.md module 10, "Days/Goals Trackers"). Kept as a separate,
-- clearly-labelled migration file rather than edited into schema.sql
-- directly, per CLAUDE.md's module-boundary rule ("add a clearly-separated
-- migration file, don't touch existing shared tables") -- this file is
-- ADDITIVE ONLY: it creates two new tables and touches nothing that
-- schema.sql already defines.
--
-- Why this lives in packages/shared-db (shared) instead of being an
-- apps/trackers-local table: goal/target data is read by more than just
-- the trackers UI --
--   * SPEC.md module 2 (Dashboard / "Today view") will want per-agent and
--     team progress-to-goal for its briefing.
--   * SPEC.md module 11 (Monthly report) rolls up revenue vs. target.
-- Nothing else in the schema needs to change to support that: goals here
-- reference the existing shared `agents` table by id, same as every other
-- shared table.
--
-- Apply order: this file assumes packages/shared-db/schema.sql has already
-- been applied to the target database (same pattern apps/lead-agent's
-- local-schema.sql uses for its own app-local tables).
--
-- Local dev/test:
--   psql mira_dev -f packages/shared-db/schema.sql
--   psql mira_dev -f packages/shared-db/migrations/001_trackers_goals.sql
--
-- Supabase (production) apply path: this canonical DDL is mirrored, with
-- RLS policies added, at apps/trackers/supabase/migrations/001_goals.sql --
-- see that file's header for why RLS lives there instead of here (this file
-- stays Supabase-auth-agnostic, same as schema.sql, since apps/lead-agent's
-- plain-`pg` dev/test path needs to apply it without any `auth.*` schema
-- existing).

-- ============================================================
-- goals
-- ============================================================
create table if not exists goals (
  id uuid primary key default uuid_generate_v4(),
  scope text not null check (scope in ('individual', 'team')),
  -- Owning agent for an individual goal; null for a team-wide goal.
  -- Enforced together by the check constraint below.
  agent_id uuid references agents(id) on delete cascade,
  -- Agent who created/assigned the goal -- may differ from agent_id (a
  -- manager setting a junior agent's target). Null allowed so a goal
  -- created by a since-deleted agent doesn't cascade-delete the goal itself.
  created_by uuid references agents(id) on delete set null,
  -- Free text on purpose (see packages/shared-types RECOMMENDED_GOAL_METRICS)
  -- -- the set of things a COO wants to track is expected to grow.
  metric text not null,
  -- Cosmetic display unit only ("AED", "calls", "viewings"); not used in
  -- any arithmetic.
  unit text,
  target_value numeric not null check (target_value > 0),
  period_type text not null default 'monthly' check (period_type in ('daily', 'weekly', 'monthly', 'quarterly', 'custom')),
  period_start date not null,
  period_end date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_scope_agent_consistency check (
    (scope = 'individual' and agent_id is not null) or
    (scope = 'team' and agent_id is null)
  ),
  constraint goals_period_valid check (period_end >= period_start)
);

create index if not exists idx_goals_agent on goals(agent_id);
create index if not exists idx_goals_scope_status on goals(scope, status);

drop trigger if exists goals_updated_at on goals;
create trigger goals_updated_at
  before update on goals
  for each row execute function update_updated_at_column();

-- ============================================================
-- goal_progress_entries
-- ============================================================
-- Additive, not cumulative: sum(value) over a goal's entries (within the
-- goal's period) is its total progress. entry_date (not created_at) is the
-- date progress is attributed to, so a same-day correction/backfill entry
-- logged later doesn't distort the streak/cadence view.
create table if not exists goal_progress_entries (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid not null references goals(id) on delete cascade,
  entry_date date not null,
  value numeric not null,
  note text,
  logged_by uuid references agents(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_goal_progress_entries_goal on goal_progress_entries(goal_id);
create index if not exists idx_goal_progress_entries_goal_date on goal_progress_entries(goal_id, entry_date);
