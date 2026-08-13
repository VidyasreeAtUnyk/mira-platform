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

-- Budget governor's audited call ledger (src/agent/budgetGovernor.ts), per
-- SPEC.md's "Budget governor -- hard caps on AI call volume/spend, enforced
-- in the agent core itself, not left to convention" and CLAUDE.md's "no
-- unbounded loops of calls" rule. App-local by the same precedent as
-- apps/social-assistant/db/schema.sql's own ai_call_log (see
-- packages/shared-db/README.md's "Tables that stay app-local" note) --
-- each AI-calling module ledgers its own spend against its own table; there
-- is no cross-module shared cap yet, since no cross-module Agent Core
-- exists to enforce one.
create table if not exists ai_call_log (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id) on delete set null,
  purpose text not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_call_log_created on ai_call_log(created_at);
