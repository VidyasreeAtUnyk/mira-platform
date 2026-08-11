-- Migration 002: RLS Policies
-- All row-level security policies for RealEstateIntel

-- ============================================================
-- Helper: get current agent's role
-- ============================================================
create or replace function get_current_agent_role()
returns text as $$
  select role from agents where id = auth.uid();
$$ language sql security definer stable;

-- ============================================================
-- agents policies
-- ============================================================

-- Agents can read their own row
create policy "agents_select_own"
  on agents for select
  using (id = auth.uid());

-- Managers and admins can read all agents
create policy "agents_select_all_for_managers"
  on agents for select
  using (get_current_agent_role() in ('manager', 'admin'));

-- ============================================================
-- leads policies
-- ============================================================

-- Agents see their own leads
create policy "leads_select_own"
  on leads for select
  using (agent_id = auth.uid());

-- Managers and admins see all leads
create policy "leads_select_all_for_managers"
  on leads for select
  using (get_current_agent_role() in ('manager', 'admin'));

-- Agents can insert their own leads
create policy "leads_insert_own"
  on leads for insert
  with check (agent_id = auth.uid());

-- Agents can update their own leads
create policy "leads_update_own"
  on leads for update
  using (agent_id = auth.uid());

-- Managers and admins can update all leads
create policy "leads_update_all_for_managers"
  on leads for update
  using (get_current_agent_role() in ('manager', 'admin'));

-- Agents can delete their own leads (managers can delete any)
create policy "leads_delete_own"
  on leads for delete
  using (agent_id = auth.uid() or get_current_agent_role() in ('manager', 'admin'));

-- ============================================================
-- interactions policies
-- ============================================================

create policy "interactions_select_own"
  on interactions for select
  using (agent_id = auth.uid());

create policy "interactions_select_all_for_managers"
  on interactions for select
  using (get_current_agent_role() in ('manager', 'admin'));

create policy "interactions_insert_own"
  on interactions for insert
  with check (agent_id = auth.uid());

create policy "interactions_update_own"
  on interactions for update
  using (agent_id = auth.uid());

create policy "interactions_delete_own"
  on interactions for delete
  using (agent_id = auth.uid() or get_current_agent_role() in ('manager', 'admin'));

-- ============================================================
-- ai_suggestions policies
-- ============================================================

-- Join to leads to get agent_id (service role handles inserts)
create policy "ai_suggestions_select_own"
  on ai_suggestions for select
  using (
    exists (
      select 1 from leads
      where leads.id = ai_suggestions.lead_id
        and leads.agent_id = auth.uid()
    )
  );

create policy "ai_suggestions_select_all_for_managers"
  on ai_suggestions for select
  using (get_current_agent_role() in ('manager', 'admin'));

create policy "ai_suggestions_update_own"
  on ai_suggestions for update
  using (
    exists (
      select 1 from leads
      where leads.id = ai_suggestions.lead_id
        and leads.agent_id = auth.uid()
    )
  );

-- ============================================================
-- dld_price_index policies
-- ============================================================

-- All authenticated users can read price index
create policy "dld_price_index_select_authenticated"
  on dld_price_index for select
  using (auth.uid() is not null);
