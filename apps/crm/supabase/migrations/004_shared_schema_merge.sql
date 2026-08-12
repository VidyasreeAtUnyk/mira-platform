-- Migration 004: Phase 0 shared-schema merge
--
-- Brings this Supabase project's schema up to the canonical shape defined in
-- packages/shared-db/schema.sql, so apps/lead-agent can read/write the same
-- `leads`/`interactions`/`proposals`/`audit_log`/`properties` tables this
-- project already serves to apps/crm. Additive only -- no columns dropped,
-- no existing data touched beyond a one-time `stage` backfill. See
-- PROGRESS-phase0.md "Notes / decisions made" for the full reasoning,
-- especially why `status` is kept (unenforced) rather than dropped here.

-- ============================================================
-- leads: new columns for the merged lead-agent concepts
-- ============================================================
alter table leads
  add column if not exists location_pref text,
  add column if not exists timeline text,
  add column if not exists segment text not null default 'prospect' check (segment in ('prospect', 'client')),
  add column if not exists stage text,
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists contact_count integer not null default 0,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text;

-- Backfill `stage` from the existing `status` enum (see
-- packages/shared-types/src/stage.ts CRM_STATUS_TO_STAGE for the mapping
-- this mirrors) and make it the go-forward canonical lifecycle column.
update leads set stage = case status
  when 'new' then 'new'
  when 'contacted' then 'contacted'
  when 'interested' then 'qualified'
  when 'viewing' then 'viewing_scheduled'
  when 'offer' then 'decision_pending'
  when 'closed_won' then 'won'
  when 'closed_lost' then 'lost'
  else 'new'
end
where stage is null;

alter table leads
  alter column stage set default 'new',
  alter column stage set not null,
  add constraint leads_stage_check check (stage in (
    'new', 'contacted', 'qualified', 'viewing_scheduled', 'decision_pending',
    'won', 'lost', 'canceled', 'dormant'
  ));

-- `status` itself is intentionally left in place, unenforced (its CHECK
-- constraint already exists from migration 001 and still applies to it).
-- apps/crm's Kanban board (src/app/pipeline) still reads/writes `status`;
-- migrating it to read `stage` directly is a tracked Phase 0 follow-up, not
-- done in this migration.

create index if not exists idx_leads_stage on leads(stage);

-- Relax `source`: was CHECK-constrained to apps/crm's own 10-value list,
-- which lead-agent doesn't share. Free text now; recommended values live in
-- packages/shared-types (RECOMMENDED_LEAD_SOURCES) as documentation, not a
-- DB-level constraint.
alter table leads drop constraint if exists leads_source_check;

-- interactions.agent_id was NOT NULL; lead-agent's automated tool calls may
-- log interactions with no human agent attached.
alter table interactions alter column agent_id drop not null;

-- interactions.contact_count bookkeeping: extend the existing trigger to
-- also increment leads.contact_count (previously only set last_contacted_at).
create or replace function update_lead_last_contacted()
returns trigger as $$
begin
  update leads
  set last_contacted_at = new.created_at,
      contact_count = contact_count + 1,
      updated_at = now()
  where id = new.lead_id;
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- engagement_events (passive signals; formerly lead-agent's `interactions`)
-- ============================================================
create table if not exists engagement_events (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  type text not null check (type in ('page_view', 'email_open', 'reply', 'inquiry')),
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_engagement_events_lead on engagement_events(lead_id);
alter table engagement_events enable row level security;

create policy "engagement_events_select_own"
  on engagement_events for select
  using (
    exists (
      select 1 from leads
      where leads.id = engagement_events.lead_id
        and leads.agent_id = auth.uid()
    )
  );

create policy "engagement_events_select_all_for_managers"
  on engagement_events for select
  using (get_current_agent_role() in ('manager', 'admin'));

-- ============================================================
-- proposals (lead-agent's draft-and-hold message/viewing proposals)
-- ============================================================
create table if not exists proposals (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  type text not null check (type in ('message', 'viewing')),
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  proposed_time timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_proposals_lead on proposals(lead_id);
create index if not exists idx_proposals_status on proposals(status);
alter table proposals enable row level security;

create policy "proposals_select_own"
  on proposals for select
  using (
    exists (
      select 1 from leads
      where leads.id = proposals.lead_id
        and leads.agent_id = auth.uid()
    )
  );

create policy "proposals_select_all_for_managers"
  on proposals for select
  using (get_current_agent_role() in ('manager', 'admin'));

create policy "proposals_update_own"
  on proposals for update
  using (
    exists (
      select 1 from leads
      where leads.id = proposals.lead_id
        and leads.agent_id = auth.uid()
    )
  );

-- ============================================================
-- audit_log (governance/budget trail; promoted from lead-agent to shared)
-- ============================================================
create table if not exists audit_log (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id) on delete cascade,
  tool_name text not null,
  input_json jsonb not null,
  output_json jsonb not null,
  actor text not null check (actor in ('agent', 'human')),
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_lead on audit_log(lead_id);
create index if not exists idx_audit_log_tool_time on audit_log(tool_name, created_at);
alter table audit_log enable row level security;

-- Audit trail is access-logged data itself (SPEC.md cross-cutting security
-- requirement) -- read access restricted to managers/admins, not per-agent.
create policy "audit_log_select_for_managers"
  on audit_log for select
  using (get_current_agent_role() in ('manager', 'admin'));

-- ============================================================
-- properties / property_price_history (promoted to shared; feeds module 4)
-- ============================================================
create table if not exists properties (
  id uuid primary key default uuid_generate_v4(),
  address text not null,
  area text not null,
  type text not null,
  price numeric not null,
  bedrooms integer not null,
  tier text not null check (tier in ('standard', 'upgrade')),
  created_at timestamptz not null default now()
);

create table if not exists property_price_history (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  year integer not null,
  avg_price numeric not null
);

create index if not exists idx_price_history_property on property_price_history(property_id);
alter table properties enable row level security;
alter table property_price_history enable row level security;

-- Listing/inventory data: any authenticated agent can read (matches
-- dld_price_index's existing "all authenticated users can read" pattern).
create policy "properties_select_authenticated"
  on properties for select
  using (auth.uid() is not null);

create policy "property_price_history_select_authenticated"
  on property_price_history for select
  using (auth.uid() is not null);
