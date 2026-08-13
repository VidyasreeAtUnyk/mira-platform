-- packages/shared-db/schema.sql
--
-- Canonical Phase 0 shared schema. This file is the single source of truth
-- for the merged CRM + lead-agent data model described in
-- packages/shared-types. It is written to apply cleanly to a fresh Postgres
-- 16+ database (used for local dev/test -- see apps/lead-agent/src/db) and
-- mirrors what apps/crm/supabase/migrations/004_shared_schema_merge.sql
-- applies incrementally to the real Supabase project.
--
-- Merge decisions (full rationale in PROGRESS-phase0.md "Notes / decisions
-- made"):
--   * `leads.stage` (9-value) is the canonical lifecycle column, taken from
--     apps/lead-agent's state machine since it's the only side with real
--     enforced transition rules. `leads.status` (apps/crm's legacy 7-value
--     enum) is kept, unenforced, for the not-yet-migrated Kanban UI.
--   * apps/crm's `interactions` (human contact log) and apps/lead-agent's
--     `interactions` (passive engagement signals) are different concepts
--     that happened to share a name. The former stays `interactions`; the
--     latter is renamed `engagement_events`.
--   * `proposals` (lead-agent) and `ai_suggestions` (crm) both feed the
--     review/approval queue but serve different shapes of draft (message,
--     viewing) and score/text (lead score, upgrade proposal). Kept as two
--     tables for Phase 0; consolidating into one review-queue model is
--     Agent Core (Phase 1) work, not a Phase 0 schema call.
--   * `audit_log`, `properties`, `property_price_history` are promoted from
--     lead-agent-only to shared, since access logging and buyer-demand-to-
--     inventory matching are platform-wide concerns (SPEC.md cross-cutting
--     requirements, module 4).
--   * lead-agent's `run_state` / `run_metrics` stay app-local (its own
--     migration under apps/lead-agent) -- internal operational tables, not
--     part of the shared contract, per CLAUDE.md's module-boundary rule.

create extension if not exists "uuid-ossp";

-- ============================================================
-- agents
-- ============================================================
create table if not exists agents (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  phone text,
  -- SPEC.md's 6-role RBAC table. Defaults to the least-privileged role
  -- (principle of least privilege for a row created without an explicit
  -- role) rather than the old 3-value 'agent' default -- see migration 006
  -- and PROGRESS-integration.md for the full rename/decision writeup.
  role text not null default 'junior_agent' check (
    role in ('owner_coo', 'senior_agent', 'junior_agent', 'marketing_social', 'admin_ops', 'finance')
  ),
  created_at timestamptz not null default now()
);

-- ============================================================
-- leads
-- ============================================================
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references agents(id) on delete set null,
  name text not null,
  phone text not null,
  email text,
  lead_type text not null default 'buyer' check (lead_type in ('buyer', 'seller', 'tenant', 'landlord')),
  property_type text check (property_type in ('apartment', 'villa', 'townhouse', 'commercial', 'land')),
  budget_min numeric,
  budget_max numeric,
  currency text not null default 'AED',
  preferred_areas text[],
  location_pref text,
  bedrooms text check (bedrooms in ('studio', '1', '2', '3', '4+')),
  -- Freeform discovery-stage text ("house", "condo", "studio apartment"),
  -- distinct from the structured `property_type` enum above -- see
  -- apps/crm/supabase/migrations/005_lead_agent_property_interest.sql and
  -- PROGRESS-phase0.md for why lead-agent's fixtures need this instead of
  -- forcing them onto property_type.
  property_interest text,
  timeline text,
  segment text not null default 'prospect' check (segment in ('prospect', 'client')),
  stage text not null default 'new' check (stage in (
    'new', 'contacted', 'qualified', 'viewing_scheduled', 'decision_pending',
    'won', 'lost', 'canceled', 'dormant'
  )),
  -- Legacy apps/crm status column. Unenforced (no CHECK) on purpose: it's a
  -- read/display compatibility shim for the not-yet-migrated Kanban board,
  -- not part of the canonical lifecycle. New code should use `stage`.
  status text,
  source text,
  notes text,
  owns_property boolean not null default false,
  owned_property_type text check (owned_property_type in ('apartment', 'villa', 'townhouse', 'commercial', 'land')),
  owned_property_area text,
  owned_purchase_year integer,
  owned_purchase_price numeric,
  do_not_contact boolean not null default false,
  last_contacted_at timestamptz,
  next_followup_at timestamptz,
  contact_count integer not null default 0,
  locked_at timestamptz,
  locked_by text,
  ai_score integer check (ai_score >= 1 and ai_score <= 10),
  ai_score_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leads_stage on leads(stage);
create index if not exists idx_leads_agent on leads(agent_id);

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_updated_at on leads;
create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at_column();

-- ============================================================
-- interactions (agent-initiated human contact log -- apps/crm's concept)
-- ============================================================
create table if not exists interactions (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  type text not null check (type in ('call', 'whatsapp', 'email', 'viewing', 'meeting', 'note')),
  summary text not null,
  outcome text check (outcome in ('positive', 'neutral', 'negative', 'no_answer')),
  next_action text,
  next_action_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_interactions_lead on interactions(lead_id);

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

drop trigger if exists interactions_update_lead_contacted on interactions;
create trigger interactions_update_lead_contacted
  after insert on interactions
  for each row execute function update_lead_last_contacted();

-- ============================================================
-- engagement_events (passive signals -- apps/lead-agent's former `interactions`)
-- ============================================================
create table if not exists engagement_events (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  type text not null check (type in ('page_view', 'email_open', 'reply', 'inquiry')),
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_engagement_events_lead on engagement_events(lead_id);

-- ============================================================
-- proposals (AI-drafted message/viewing proposals awaiting approval)
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

-- ============================================================
-- ai_suggestions (apps/crm's scoring/upgrade-proposal suggestions)
-- ============================================================
create table if not exists ai_suggestions (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  suggestion_type text not null check (suggestion_type in ('followup_message', 'upgrade_proposal', 'lead_score')),
  content text,
  score integer check (score >= 1 and score <= 10),
  score_reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'sent')),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_suggestions_lead on ai_suggestions(lead_id);

-- ============================================================
-- audit_log (governance/budget trail -- promoted from lead-agent to shared)
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

-- ============================================================
-- dld_price_index (apps/crm's market data table)
-- ============================================================
create table if not exists dld_price_index (
  id uuid primary key default uuid_generate_v4(),
  first_date_of_month date not null unique,
  all_monthly_index numeric,
  flat_monthly_index numeric,
  villa_monthly_index numeric,
  all_monthly_price_index numeric,
  flat_monthly_price_index numeric,
  villa_monthly_price_index numeric
);
