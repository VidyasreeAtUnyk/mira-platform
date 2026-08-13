-- Migration 006: promote SPEC.md's 6-role RBAC table into agents.role
--
-- Replaces the original 3-value seniority enum ('agent'/'manager'/'admin')
-- with SPEC.md's 6 roles (owner_coo/senior_agent/junior_agent/
-- marketing_social/admin_ops/finance). Two independent module builds
-- (apps/dashboard's DashboardRole, apps/comms-hub's CommsRole) each arrived
-- at this exact shape from SPEC.md without seeing each other's work --
-- see PROGRESS-integration.md for the full decision writeup. Nothing in
-- this codebase depended on the old 3 values for real behavior beyond the
-- "manager or admin = elevated/see-all" RLS pattern below, which this
-- migration remaps rather than leaves broken.
--
-- Every existing 'manager'/'admin' policy check in this codebase followed
-- the same shape: "_all_for_managers" / "_all_for_admins" policies that
-- grant unrestricted see-everything/edit-everything access, not a partial
-- "team lead" tier. That maps to exactly one SPEC.md role -- owner_coo
-- ("Sees Everything, Edits Everything") -- not senior_agent, which SPEC.md
-- explicitly limits to "Own + assigned team leads/deals". So every
-- `get_current_agent_role() in ('manager', 'admin')` check below becomes
-- `get_current_agent_role() = 'owner_coo'`, preserving the actual access
-- level rather than just swapping labels.

-- ============================================================
-- Constraint drop FIRST -- the data remap below must run while no CHECK
-- constraint is active, since every remapped value (e.g. 'owner_coo') is
-- rejected by the OLD constraint that's still in effect until this runs.
-- (Caught by actually applying this migration to a real database, not
-- just reading it -- the original draft had this backwards.)
-- ============================================================
alter table agents drop constraint if exists agents_role_check;

-- ============================================================
-- Data remap (safe no-op if this table is empty, which it is in every
-- environment this migration has been applied to so far -- no live
-- Supabase project exists anywhere in this repo, see PROGRESS-phase0.md).
-- Old 'manager'/'admin' both already had unrestricted access under the
-- old policies, so both map to the new unrestricted role (owner_coo) to
-- preserve behavior, not to senior_agent (which would be a silent access
-- downgrade for anyone already tagged 'manager').
-- ============================================================
update agents set role = 'owner_coo' where role in ('manager', 'admin');
update agents set role = 'junior_agent' where role = 'agent';

-- ============================================================
-- New default + constraint, now that existing data satisfies it.
-- ============================================================
alter table agents alter column role set default 'junior_agent';
alter table agents add constraint agents_role_check check (
  role in ('owner_coo', 'senior_agent', 'junior_agent', 'marketing_social', 'admin_ops', 'finance')
);

-- ============================================================
-- RLS policies -- drop and recreate each "_all_for_managers"-shaped policy
-- (and the two mixed own-or-manager policies) with the new predicate.
-- ============================================================

drop policy if exists "agents_select_all_for_managers" on agents;
create policy "agents_select_all_for_owner"
  on agents for select
  using (get_current_agent_role() = 'owner_coo');

drop policy if exists "leads_select_all_for_managers" on leads;
create policy "leads_select_all_for_owner"
  on leads for select
  using (get_current_agent_role() = 'owner_coo');

drop policy if exists "leads_update_all_for_managers" on leads;
create policy "leads_update_all_for_owner"
  on leads for update
  using (get_current_agent_role() = 'owner_coo');

drop policy if exists "leads_delete_own" on leads;
create policy "leads_delete_own"
  on leads for delete
  using (agent_id = auth.uid() or get_current_agent_role() = 'owner_coo');

drop policy if exists "interactions_select_all_for_managers" on interactions;
create policy "interactions_select_all_for_owner"
  on interactions for select
  using (get_current_agent_role() = 'owner_coo');

drop policy if exists "interactions_delete_own" on interactions;
create policy "interactions_delete_own"
  on interactions for delete
  using (agent_id = auth.uid() or get_current_agent_role() = 'owner_coo');

drop policy if exists "ai_suggestions_select_all_for_managers" on ai_suggestions;
create policy "ai_suggestions_select_all_for_owner"
  on ai_suggestions for select
  using (get_current_agent_role() = 'owner_coo');

drop policy if exists "engagement_events_select_all_for_managers" on engagement_events;
create policy "engagement_events_select_all_for_owner"
  on engagement_events for select
  using (get_current_agent_role() = 'owner_coo');

drop policy if exists "proposals_select_all_for_managers" on proposals;
create policy "proposals_select_all_for_owner"
  on proposals for select
  using (get_current_agent_role() = 'owner_coo');

drop policy if exists "audit_log_select_for_managers" on audit_log;
create policy "audit_log_select_for_owner"
  on audit_log for select
  using (get_current_agent_role() = 'owner_coo');
