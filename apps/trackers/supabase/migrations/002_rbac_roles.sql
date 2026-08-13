-- Migration 002: promote SPEC.md's 6-role RBAC into agents.role
--
-- Companion to apps/crm/supabase/migrations/006_rbac_roles.sql -- same
-- rename (agents.role's 3-value enum -> SPEC.md's 6 roles), applied here
-- because this app's own 001_goals.sql defined its own
-- "_all_for_managers"-shaped RLS policies against the same shared
-- agents.role column. See that migration's header and
-- PROGRESS-integration.md for the full decision writeup -- every
-- "manager or admin" check here meant unrestricted access, which maps to
-- owner_coo, not the narrower senior_agent.
--
-- Does not repeat the agents.role constraint/default ALTER or the data
-- remap -- 006_rbac_roles.sql already does that once, on the one shared
-- `agents` table. This migration only touches this app's own RLS policies.

drop policy if exists "goals_select_all_for_managers" on goals;
create policy "goals_select_all_for_owner"
  on goals for select
  using (get_current_agent_role() = 'owner_coo');

drop policy if exists "goals_insert_all_for_managers" on goals;
create policy "goals_insert_all_for_owner"
  on goals for insert
  with check (get_current_agent_role() = 'owner_coo');

drop policy if exists "goals_update_all_for_managers" on goals;
create policy "goals_update_all_for_owner"
  on goals for update
  using (get_current_agent_role() = 'owner_coo');

drop policy if exists "goal_progress_entries_select_visible_goal" on goal_progress_entries;
create policy "goal_progress_entries_select_visible_goal"
  on goal_progress_entries for select
  using (
    exists (
      select 1 from goals
      where goals.id = goal_progress_entries.goal_id
        and (
          (goals.scope = 'individual' and goals.agent_id = auth.uid())
          or (goals.scope = 'team' and auth.uid() is not null)
          or get_current_agent_role() = 'owner_coo'
        )
    )
  );

drop policy if exists "goal_progress_entries_insert_visible_goal" on goal_progress_entries;
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
          or get_current_agent_role() = 'owner_coo'
        )
    )
  );
