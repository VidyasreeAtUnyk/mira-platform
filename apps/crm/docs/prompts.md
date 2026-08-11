# Build Log — RealEstateIntel

This file tracks every phase of the build: decisions made, bugs found, fixes applied. Updated continuously during development.

---

## Phase 1 — Project Setup

**Date**: 2026-06-29

**Actions**:
- Bootstrapped with `create-next-app@latest` — TypeScript strict, Tailwind, ESLint, App Router, src/ dir
- Installed runtime deps: `@supabase/supabase-js`, `@supabase/ssr`, `openai`, `zod`, `resend`, `lucide-react`, `recharts`, `date-fns`, `class-variance-authority`, `clsx`, `tailwind-merge`
- Installed dev deps: `prettier`, `prettier-plugin-tailwindcss`
- Added shadcn/ui components via CLI: button, card, input, label, select, textarea, badge, dialog, sheet, tabs, avatar, separator, skeleton, toast

**Decisions**:
- Using `@supabase/ssr` (not the deprecated `auth-helpers-nextjs`) — it's the current recommended package for Next.js App Router
- Using `src/` directory layout for cleaner separation
- Module registry in `src/lib/modules.ts` — see ADR 01

**Directory structure created**:
```
src/
  app/           # Pages and API routes
  components/    # Shared components
    ui/          # shadcn/ui primitives
    layout/      # Navigation components
  lib/           # Utilities
  types/         # TypeScript types
docs/
supabase/
  migrations/
  functions/
```

---

## Phase 2 — Documentation

All docs written before code. Rationale: forces clarity on what we're building before touching a component.

Files created:
- `docs/README.md`
- `docs/architecture.md`
- `docs/decisions/01-config-driven-modules.md`
- `docs/decisions/02-supabase-over-custom-backend.md`
- `docs/decisions/03-mobile-first-design.md`
- `docs/decisions/04-dld-data-strategy.md`
- `docs/modules/crm.md`
- `docs/modules/upgrade-engine.md`
- `docs/modules/lead-generation.md`
- `docs/modules/market-intelligence.md`

---

## Phase 3 — Database Schema

Migrations written in `supabase/migrations/`:
- `001_initial_schema.sql` — all 5 tables with RLS
- `002_rls_policies.sql` — detailed RLS policies
- `003_seed.sql` — test agents, 10 leads, 5 interactions, DLD data

Key decisions:
- `preferred_areas` stored as `text[]` (PostgreSQL array) — simpler than a junction table for Phase 1
- `bedrooms` stored as text ('studio' / '1' / '2' / '3' / '4+') — not integer, to allow 'studio' and '4+'
- `ai_score` on leads table (not just ai_suggestions) for fast sorting/filtering
- RLS uses a helper function `get_agent_role()` to avoid N+1 role lookups

---

## Phase 4 — Core Library & Types

Files created:
- `src/types/index.ts` — all TypeScript types derived from DB schema
- `src/lib/supabase/client.ts` — browser client
- `src/lib/supabase/server.ts` — server client (RSC)
- `src/lib/supabase/service.ts` — service client (API routes)
- `src/lib/modules.ts` — module registry
- `src/lib/utils.ts` — cn() and other utilities
- `src/lib/constants.ts` — Dubai areas, lead sources, etc.

---

## Phase 5 — UI Components

shadcn/ui primitives added. Custom components built:
- `LeadCard` — lead list item with status badge, cold indicator
- `InteractionForm` — bottom sheet for logging interactions
- `AISuggestionCard` — AI output with approve/reject
- `UpgradeCalculator` — DLD-based equity calculator
- `ColdLeadBadge` — amber warning
- `BottomNav` — mobile bottom tab bar
- `Sidebar` — desktop navigation
- `QuickAddFAB` — mobile floating action button

---

## Phase 6 — Pages

All pages built. Notes:
- Dashboard uses Supabase Realtime for live lead updates
- Pipeline page uses drag-to-reorder on desktop, tap-to-move on mobile
- Lead profile fetches AI suggestion on demand (not on load)

---

## Phase 7 — API Routes

- `/api/leads/score` — lead scoring with rate limiting (20/user/hour)
- `/api/leads/[id]/suggest` — follow-up / upgrade proposal generation
- `/api/leads/cold-check` — called by Edge Function

---

## Phase 8 — Edge Function

`supabase/functions/cold-lead-detector/index.ts` — daily cron, flags cold leads

---

## Known Issues / TODOs

- [ ] Pipeline drag-and-drop uses @dnd-kit — test on touch devices
- [ ] DLD price index data needs monthly manual update until automation
- [ ] Rate limiting uses in-memory store — won't work across Vercel serverless instances; upgrade to Upstash Redis for production
- [ ] Email notifications from cold-lead-detector not implemented (Edge Function logs only)
