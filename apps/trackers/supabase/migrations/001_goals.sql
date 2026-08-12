-- apps/trackers/supabase/migrations/001_goals.sql
--
-- Supabase-flavored mirror of packages/shared-db/migrations/001_trackers_goals.sql,
-- with RLS policies added (mirroring apps/crm/supabase/migrations/002_rls_policies.sql's
-- pattern). Apply order against the real Supabase project: after
-- apps/crm/supabase/migrations/001 through 005 (those bring the project up to
-- the shared Phase 0 schema and define `get_current_agent_role()`), then this
-- file.
--
-- DEPENDENCY: this file calls `get_current_agent_role()`, defined in
-- apps/crm/supabase/migrations/002_rls_policies.sql. It is NOT redefined
-- here -- if that function doesn't exist yet in the target project, apply
-- apps/crm's migrations first.
--
-- Not yet applied to any real Supabase project -- no live Supabase
-- credentials exist anywhere in this repo (same blocker PROGRESS-phase0.md
-- and PROGRESS-trackers.md flag). The DDL portion (table definitions) is
-- verified against a scratch local Postgres via
-- packages/shared-db/migrations/001_trackers_goals.sql; the RLS policies
-- below are UNVERIFIED against a real Postgres+PostgREST stack -- see
-- apps/trackers/src/lib/db.ts's header for why apps/trackers' own server
-- code does not currently rely on these policies being enforced (it reads/
-- writes via direct `pg`, with equivalent authorization implemented in
-- src/lib/goals.ts instead). Keep the two in sync by hand.

-- ============================================================
-- goals
-- ============================================================
create table if not exists goals (
  id uuid primary key default uuid_generate_v4(),
  scope text not null check (scope in ('individual', 'team')),
  agent_id uuid references agents(id) on delete cascade,
  created_by uuid references agents(id) on delete set null,
  metric text not null,
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

-- ============================================================
-- RLS
-- ============================================================
alter table goals enable row level security;
alter table goal_progress_entries enable row level security;

-- ---- goals: select ----

-- Agents see their own individual goals.
create policy "goals_select_own_individual"
  on goals for select
  using (scope = 'individual' and agent_id = auth.uid());

-- Everyone (any authenticated agent) sees team goals.
create policy "goals_select_team"
  on goals for select
  using (scope = 'team' and auth.uid() is not null);

-- Managers and admins see everything.
create policy "goals_select_all_for_managers"
  on goals for select
  using (get_current_agent_role() in ('manager', 'admin'));

-- ---- goals: insert ----

-- Agents can create their own individual goals.
create policy "goals_insert_own_individual"
  on goals for insert
  with check (scope = 'individual' and agent_id = auth.uid());

-- Managers/admins can create any individual goal or a team goal.
create policy "goals_insert_all_for_managers"
  on goals for insert
  with check (get_current_agent_role() in ('manager', 'admin'));

-- ---- goals: update ----

-- Agents can update their own individual goals (target/period/status/notes;
-- app layer restricts which columns via the update statement it issues, RLS
-- here only gates which rows).
create policy "goals_update_own_individual"
  on goals for update
  using (scope = 'individual' and agent_id = auth.uid());

-- Managers/admins can update anything, including team goals.
create policy "goals_update_all_for_managers"
  on goals for update
  using (get_current_agent_role() in ('manager', 'admin'));

-- ---- goal_progress_entries: select ----

-- Visible to anyone who can see the parent goal.
create policy "goal_progress_entries_select_visible_goal"
  on goal_progress_entries for select
  using (
    exists (
      select 1 from goals
      where goals.id = goal_progress_entries.goal_id
        and (
          (goals.scope = 'individual' and goals.agent_id = auth.uid())
          or (goals.scope = 'team' and auth.uid() is not null)
          or get_current_agent_role() in ('manager', 'admin')
        )
    )
  );

-- ---- goal_progress_entries: insert ----

-- Any agent who can see the parent goal can log progress against it --
-- team goals are collective by design; individual goals are only visible
-- to their owner + managers, so this naturally restricts those to the owner.
create policy "goal_progress_entries_insert_visible_goal"
  on goal_progress_entries for insert
  with check (
    logged_by = auth.uid()
    and exists (
      select 1 from goals
      where goals.id = goal_progress_entries.goal_id
        and (
          (goals.scope = 'individual' and goals.agent_id = auth.uid())
          or (goals.scope = 'team' and auth.uid() is not null)
          or get_current_agent_role() in ('manager', 'admin')
        )
    )
  );
