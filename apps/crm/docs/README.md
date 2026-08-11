# RealEstateIntel

AI-powered real estate CRM and market intelligence platform for Dubai-based real estate firms.

## Overview

RealEstateIntel helps agents manage leads, track follow-ups, log interactions, and leverage AI to score leads, generate follow-up messages, and identify property upgrade opportunities using DLD price index data.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript strict, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Realtime, Edge Functions)
- **AI**: OpenAI API (GPT-4o) for lead scoring and suggestion generation
- **Email**: Resend for magic link and notification emails
- **Deployment**: Vercel

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- An OpenAI API key
- A Resend API key

### Local Development

```bash
# 1. Clone and install
git clone <repo>
cd real-estate-intel
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Fill in all values in .env.local

# 3. Apply Supabase migrations
npx supabase db push
# or run supabase/migrations/*.sql in order in the Supabase SQL editor

# 4. Seed the database
# Run supabase/seed.sql in the Supabase SQL editor

# 5. Start dev server
npm run dev
```

### Environment Variables

See `.env.example` for all required variables with descriptions.

## Module Registry

Modules are registered in `src/lib/modules.ts`. Each module has an `enabled` flag — disabled modules are documented but not rendered.

| Module | Status | Description |
|--------|--------|-------------|
| CRM | ✅ Enabled | Lead management, pipeline, interactions |
| Market Intelligence | ✅ Enabled | DLD price index, upgrade calculator |
| Lead Scoring (AI) | ✅ Enabled | OpenAI lead scoring on creation |
| Follow-up AI | ✅ Enabled | AI-generated follow-up messages |
| Apollo Lead Gen | 🔒 Phase 2 | B2B lead generation via Apollo API |
| WhatsApp Capture | 🔒 Phase 2 | WhatsApp webhook for lead capture |
| Portal Sync | 🔒 Phase 2 | Bayut/Property Finder integration |
| Email Outreach | 🔒 Phase 2 | Automated email sequences |
| Arabic RTL | 🔒 Phase 3 | Multi-language support |
| DLD Area Intel | 🔒 Phase 2 | Area-level transaction data |

## Test Accounts

After seeding, these accounts are available via magic link:

| Email | Role | Notes |
|-------|------|-------|
| agent@realestateintel.com | agent | Sees own leads only |
| manager@realestateintel.com | manager | Sees all leads |

To log in: go to `/login`, enter the email, check the Supabase Auth logs (or email inbox if Resend is configured) for the magic link.

## Key Directories

```
src/
  app/              # Next.js App Router pages and API routes
  components/       # Reusable UI components
    ui/             # shadcn/ui primitives
    layout/         # Navigation, sidebar, bottom nav
  lib/              # Utilities, Supabase clients, types
  types/            # TypeScript type definitions
docs/               # Architecture docs and decision records
supabase/
  migrations/       # SQL migrations in order
  functions/        # Supabase Edge Functions
```
