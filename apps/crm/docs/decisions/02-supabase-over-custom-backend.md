# ADR 02: Supabase Over Custom Backend

## Status
Accepted

## Context

We need: PostgreSQL database, authentication (magic link, invite-only), row-level security, realtime subscriptions, scheduled jobs, and serverless functions. Options:

1. Custom Express/Fastify API + PostgreSQL (self-hosted or managed)
2. Supabase BaaS
3. Firebase / PlanetScale + custom auth

## Decision

Use **Supabase** as the complete backend.

## Rationale

**Auth is solved**: Magic link auth, invite flows, and session management are built in. Building this from scratch is 2-3 weeks of work that adds zero product value.

**RLS in the database**: Row-level security lives in PostgreSQL, not in application middleware. This means data is protected even if we make a mistake in an API route. For a CRM where agents must never see each other's leads, this is a hard requirement.

**Realtime subscriptions**: The dashboard needs live updates when a new lead is assigned or a follow-up is due. Supabase Realtime handles this with zero infrastructure.

**Edge Functions**: The cold-lead-detector cron job needs to run server-side. Supabase Edge Functions (Deno) deploy in one command without managing a separate job scheduler.

**Developer velocity**: The team is small. Every hour spent on auth/DB infrastructure is an hour not spent on CRM features.

## RLS Strategy

Every table has RLS enabled. Policies follow this pattern:
- `agents` table: `auth.uid() = id` (own row only)
- `leads`, `interactions`, `ai_suggestions`: agents see their own (`agent_id = auth.uid()`), managers/admins see all (via role check against `agents` table)
- `dld_price_index`: read-only for all authenticated users

## Service Client Pattern

Some operations must bypass RLS:
- Background AI scoring after lead creation
- Cold lead detection cron job
- Admin operations

These use `SUPABASE_SERVICE_ROLE_KEY` (the admin key) in API routes only. The service client is never exposed to the browser. All service client usage is documented with a comment.

## Tradeoffs

- Supabase is a third-party dependency — vendor lock-in risk. Mitigation: standard PostgreSQL schema, migrations are portable.
- Free tier has connection limits. At scale, move to Supabase Pro or self-host.
- Edge Functions use Deno, not Node. Minor ecosystem difference.
