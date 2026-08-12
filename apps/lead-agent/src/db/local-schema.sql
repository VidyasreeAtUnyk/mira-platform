-- App-local tables for apps/lead-agent, applied against the same Postgres
-- database as packages/shared-db/schema.sql (which must be applied first --
-- run_metrics/run_state both reference leads(id)). NOT part of the shared
-- contract: internal operational/resumability state, scoped to this app's
-- own worktree per CLAUDE.md's module-boundary rule. See PROGRESS-phase0.md.

create table if not exists run_state (
  id integer primary key check (id = 1),
  current_lead_id uuid references leads(id) on delete set null,
  updated_at timestamptz not null
);

create table if not exists run_metrics (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  outcome text not null check (outcome in ('escalated', 'proposal_created', 'sent', 'no_action')),
  tool_call_count integer not null,
  estimated_token_cost numeric not null
);

create index if not exists idx_run_metrics_lead on run_metrics(lead_id);
