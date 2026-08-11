# Architecture

## System Overview

```
Browser (Next.js SSR/CSR)
    │
    ├─ App Router pages (RSC + Client Components)
    │     ├─ Server Components → Supabase server client (cookie-based auth)
    │     └─ Client Components → Supabase browser client (Realtime subscriptions)
    │
    ├─ API Routes (/api/*)
    │     ├─ Zod validation on all inputs
    │     ├─ Supabase service client (bypasses RLS for background jobs)
    │     └─ OpenAI API calls (rate-limited per user)
    │
    └─ Middleware (auth guard on all non-public routes)

Supabase
    ├─ PostgreSQL (5 tables: agents, leads, interactions, ai_suggestions, dld_price_index)
    ├─ Auth (magic link, invite-only)
    ├─ RLS (row-level security per agent/role)
    ├─ Realtime (leads table → dashboard live updates)
    └─ Edge Functions (cold-lead-detector, daily cron)
```

## Data Flow

### Lead Creation
1. Agent fills `/leads/new` form
2. POST to Supabase → creates lead row
3. Background: POST `/api/leads/score` → OpenAI scores lead → updates `leads.ai_score`
4. Dashboard updates in realtime via Supabase Realtime subscription

### AI Suggestion
1. Agent opens `/leads/[id]`
2. Clicks "Get AI Suggestion"
3. POST `/api/leads/[id]/suggest`
4. API reads lead + recent interactions + DLD data (if owns_property)
5. OpenAI returns follow-up message or upgrade proposal
6. Stored in `ai_suggestions`, rendered in UI

### Cold Lead Detection
1. Supabase Edge Function runs daily at 8am UAE (UTC+4 = 4am UTC)
2. Queries leads where `last_contacted_at < now() - 7 days`
3. Updates records, future: triggers email notification

## Module Registry Pattern

All feature modules are declared in `src/lib/modules.ts`:

```typescript
const modules = [
  { id: 'crm', enabled: true, ... },
  { id: 'apollo', enabled: false, phase: 2, ... },
]
```

The navigation and feature flags read from this registry. Adding a new module = adding one entry. This means the codebase documents its own roadmap.

See `docs/decisions/01-config-driven-modules.md` for the rationale.

## Auth Pattern

- Magic link only (no passwords) — managed by Supabase Auth
- Middleware reads session from cookies (SSR-compatible)
- Role (`agent` / `manager` / `admin`) is read from the `agents` table on every request, never from JWT claims
- This means role changes take effect immediately without token refresh
- Service client (uses `SUPABASE_SERVICE_ROLE_KEY`) is only used in API routes for background jobs

## RLS Strategy

Row-level security is enforced in PostgreSQL, not just in application code:

- `leads`: `agent_id = auth.uid()` for agents; managers/admins see all rows
- `interactions`: same pattern as leads
- `ai_suggestions`: same pattern as leads
- `dld_price_index`: read-only for all authenticated users
- `agents`: can only read own row

This means even if the API is bypassed, data is protected.

## Tech Decisions

See `docs/decisions/` for full ADRs on:
- Config-driven module registry
- Supabase over custom backend
- Mobile-first design
- DLD data strategy
