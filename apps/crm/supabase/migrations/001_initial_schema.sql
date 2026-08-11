-- Migration 001: Initial Schema
-- Creates all tables for RealEstateIntel Phase 1

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- agents
-- ============================================================
create table if not exists agents (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  phone text,
  role text not null default 'agent' check (role in ('agent', 'manager', 'admin')),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table agents enable row level security;

-- ============================================================
-- leads
-- ============================================================
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references agents(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  lead_type text not null check (lead_type in ('buyer', 'seller', 'tenant', 'landlord')),
  property_type text check (property_type in ('apartment', 'villa', 'townhouse', 'commercial', 'land')),
  budget_min numeric,
  budget_max numeric,
  currency text not null default 'AED',
  preferred_areas text[],
  bedrooms text check (bedrooms in ('studio', '1', '2', '3', '4+')),
  status text not null default 'new' check (status in ('new', 'contacted', 'interested', 'viewing', 'offer', 'closed_won', 'closed_lost')),
  source text check (source in ('family', 'friend', 'referral', 'bayut', 'property_finder', 'instagram', 'apollo', 'dld', 'walk_in', 'other')),
  notes text,
  owns_property boolean not null default false,
  owned_property_type text check (owned_property_type in ('apartment', 'villa', 'townhouse', 'commercial', 'land')),
  owned_property_area text,
  owned_purchase_year integer,
  owned_purchase_price numeric,
  last_contacted_at timestamptz,
  next_followup_at timestamptz,
  ai_score integer check (ai_score >= 1 and ai_score <= 10),
  ai_score_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table leads enable row level security;

-- Auto-update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at_column();

-- ============================================================
-- interactions
-- ============================================================
create table if not exists interactions (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  type text not null check (type in ('call', 'whatsapp', 'email', 'viewing', 'meeting', 'note')),
  summary text not null,
  outcome text check (outcome in ('positive', 'neutral', 'negative', 'no_answer')),
  next_action text,
  next_action_date date,
  created_at timestamptz not null default now()
);

alter table interactions enable row level security;

-- Auto-update lead's last_contacted_at when interaction is logged
create or replace function update_lead_last_contacted()
returns trigger as $$
begin
  update leads
  set last_contacted_at = new.created_at,
      updated_at = now()
  where id = new.lead_id;
  return new;
end;
$$ language plpgsql;

create trigger interactions_update_lead_contacted
  after insert on interactions
  for each row execute function update_lead_last_contacted();

-- ============================================================
-- ai_suggestions
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

alter table ai_suggestions enable row level security;

-- ============================================================
-- dld_price_index
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

alter table dld_price_index enable row level security;
