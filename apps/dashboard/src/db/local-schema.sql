-- App-local tables for apps/dashboard, applied against the same Postgres
-- database as packages/shared-db/schema.sql. NOT part of the shared
-- contract (CLAUDE.md's module-boundary rule) -- dashboard is the only
-- consumer of `meetings` today, same precedent as apps/lead-agent's
-- run_state/run_metrics and apps/social-assistant's ai_call_log (see
-- packages/shared-db/README.md's "Tables that stay app-local" note).
--
-- Answers a real gap: nothing anywhere in this platform tracked the COO's
-- (or anyone's) meetings -- online or physical-location -- before this.
-- Closest prior art was apps/lead-agent's `propose_viewing` (a single
-- `proposed_time` timestamp on a `proposals` row, no location field at
-- all) -- not reused here since that's a lead-agent-owned proposal
-- workflow for buyer property viewings specifically, a different concept
-- from a person's own calendar.

create table if not exists meetings (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  location_type text not null check (location_type in ('online', 'physical')),
  -- URL for online (video call link), address for physical.
  location_value text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  -- Free text, not a lead_id/agent_id FK -- a COO's meetings are often
  -- with people who aren't in this system at all (developer partner
  -- desks, vendors, prospective hires). lead_id below covers the case
  -- where it genuinely is tied to an existing lead.
  with_name text,
  lead_id uuid references leads(id) on delete set null,
  organizer_agent_id uuid references agents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_meetings_starts_at on meetings(starts_at);

-- Attendees -- real agents only (see src/lib/meetings.ts's header for why:
-- "gets notified" only means something for someone who can actually log
-- into this system; there is no live email/push-send infrastructure
-- anywhere in this platform, and CLAUDE.md forbids sending anything live
-- outside a review/approval flow this app doesn't have yet). External
-- people stay on `meetings.with_name` as free text, same as before.
create table if not exists meeting_attendees (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (meeting_id, agent_id)
);

create index if not exists idx_meeting_attendees_meeting on meeting_attendees(meeting_id);
create index if not exists idx_meeting_attendees_agent on meeting_attendees(agent_id);

-- ============================================================
-- Strategy brief (src/lib/strategy.ts) -- SPEC.md's Agent Core, module 1
-- of it: "reasons using current state, decides ... inform." Everything
-- else in this app is a system of record; this is the one place that
-- actually thinks -- given the real cross-module state (pipeline load,
-- compliance/legal backlog, cold leads, team size), what's the single
-- highest-leverage thing a 2-person team should focus on today to grow
-- revenue or their network, sourced and specific (not "network more").
-- Cached/regenerated on an interval (STRATEGY_REFRESH_MINUTES, see
-- src/lib/strategy.ts), not on every page load -- SPEC.md's scheduling
-- policy is explicit that only the social module runs a frequent loop,
-- everything else is "hourly or coarser."
-- ============================================================
create table if not exists strategy_briefs (
  id uuid primary key default uuid_generate_v4(),
  generated_at timestamptz not null default now(),
  context_snapshot jsonb not null,
  headline text not null,
  focus_type text not null check (focus_type in ('lead', 'networking', 'market', 'action')),
  focus_title text not null,
  focus_detail text not null,
  -- Where this came from -- SPEC.md's own requirement: "give them the
  -- info of the lead along with where they found it" / "their info and
  -- how it would benefit them." Never a bare suggestion with no source.
  focus_source text not null,
  focus_benefit text not null,
  educational_nugget text not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_strategy_briefs_generated_at on strategy_briefs(generated_at desc);

-- Budget governor's ledger for this feature specifically -- same
-- app-local pattern as apps/lead-agent's src/agent/budgetGovernor.ts
-- (see that file's header for the full reasoning), separate cap from
-- lead-agent's own since these are different features with very
-- different call frequencies.
create table if not exists strategy_call_log (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now()
);
