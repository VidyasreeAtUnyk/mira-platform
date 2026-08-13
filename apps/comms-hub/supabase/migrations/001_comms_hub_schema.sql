-- apps/comms-hub/supabase/migrations/001_comms_hub_schema.sql
--
-- Comms-hub's own schema, additive to the Phase 0 shared schema in
-- packages/shared-db/schema.sql (applies to the SAME Supabase project,
-- referencing `leads`/`agents` by uuid -- but lives under this app's own
-- migrations directory per CLAUDE.md's module-boundary rule: "packages/
-- shared-*" is read-only from a module worktree, module-specific tables are
-- added in the module's own directory, not by editing packages/shared-db).
--
-- NOT applied anywhere in this build -- there is no live Supabase project
-- connected (no credentials exist in this repo, see .env.example and
-- PROGRESS-comms.md Blockers). The running app in this session reads/writes
-- src/lib/mock-data.ts in memory instead; this file defines the schema that
-- data layer is modeled after, so swapping to real Postgres later is a
-- storage-layer change, not a type/shape change. A human with real
-- Supabase access should review and apply this migration when ready.

-- ============================================================
-- message_threads
-- ============================================================
create table if not exists message_threads (
  id uuid primary key default uuid_generate_v4(),
  channel text not null check (channel in ('email', 'whatsapp')),
  subject text,
  contact_name text not null,
  -- E.164 phone for whatsapp threads, email address for email threads.
  contact_handle text not null,
  -- Nullable: comms-hub also carries non-CRM-linked comms (e.g. general
  -- inbound inquiries not yet tied to a lead, or Marketing/Social-facing
  -- threads that must NEVER resolve to a lead per SPEC.md's RBAC note).
  lead_id uuid references leads(id) on delete set null,
  agent_id uuid references agents(id) on delete set null,
  tags text[] not null default '{}',
  tier text not null default 'fyi' check (tier in ('urgent', 'today', 'fyi')),
  unread boolean not null default true,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_message_threads_lead on message_threads(lead_id);
create index if not exists idx_message_threads_agent on message_threads(agent_id);
create index if not exists idx_message_threads_tier on message_threads(tier);

-- ============================================================
-- messages
-- ============================================================
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  direction text not null check (direction in ('inbound', 'outbound')),
  -- draft -> pending_approval -> approved -> sent, with `held` reachable
  -- from any pre-sent state. See src/types/index.ts for the full state
  -- machine note -- no adapter in this codebase can ever write 'sent' for
  -- an outbound message; that column value is reserved for a future real
  -- BSP/email integration explicitly wired by a human.
  status text not null default 'draft' check (
    status in ('draft', 'pending_approval', 'approved', 'held', 'sent')
  ),
  body text not null,
  from_handle text not null,
  to_handle text not null,
  bsp_provider text check (bsp_provider in ('interakt', 'wati', 'twilio', 'mock')),
  email_provider text check (email_provider in ('gmail', 'outlook', 'mock')),
  held_reason text,
  approved_by uuid references agents(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_thread on messages(thread_id);
create index if not exists idx_messages_status on messages(status);

drop trigger if exists messages_update_thread_last_message on messages;
create or replace function update_thread_last_message()
returns trigger as $$
begin
  update message_threads
  set last_message_at = new.created_at
  where id = new.thread_id;
  return new;
end;
$$ language plpgsql;

create trigger messages_update_thread_last_message
  after insert on messages
  for each row execute function update_thread_last_message();

-- ============================================================
-- notifications
-- ============================================================
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  tier text not null check (tier in ('urgent', 'today', 'fyi')),
  title text not null,
  body text not null,
  thread_id uuid references message_threads(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_tier on notifications(tier);
create index if not exists idx_notifications_thread on notifications(thread_id);

-- ============================================================
-- RLS (mirrors apps/crm/supabase/migrations/002_rls_policies.sql's
-- get_current_agent_role() pattern). CommsRole has since been promoted into
-- the shared `agents.role` enum (see apps/crm/supabase/migrations/
-- 006_rbac_roles.sql and PROGRESS-integration.md) -- src/types/index.ts now
-- imports AgentRole from @mira/shared-types instead of defining its own.
-- Mirroring src/lib/rbac.ts's checks as real RLS policies (rather than just
-- app-layer filtering) is still follow-up work, since this migration was
-- never applied to a live project in this build (no Supabase credentials
-- exist anywhere in this repo) -- the policies below stay simple
-- (auth.uid() is not null) until a human with real access revisits this.
-- ============================================================
alter table message_threads enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;

-- Placeholder: authenticated-only read, until CommsRole exists at the DB
-- layer. Real per-role policies should replace this before go-live.
create policy "message_threads_select_authenticated"
  on message_threads for select
  using (auth.uid() is not null);

create policy "messages_select_authenticated"
  on messages for select
  using (auth.uid() is not null);

create policy "notifications_select_authenticated"
  on notifications for select
  using (auth.uid() is not null);
