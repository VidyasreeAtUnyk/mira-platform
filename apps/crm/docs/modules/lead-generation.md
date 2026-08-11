# Lead Generation Module Spec

## Status: Phase 2 (not built)

## Overview

The lead generation module will automatically source new leads from multiple channels:
1. Apollo API — B2B professionals in Dubai likely to be buying property
2. DLD Transactions — people who recently bought and may be ready to upgrade
3. Social Capture — form submissions from Instagram/Facebook ads (Phase 3)

## Apollo API Integration Plan

Apollo.io provides B2B contact data including company, title, and email. The plan:

1. Search Apollo for Dubai-based professionals in target industries (finance, tech, real estate, healthcare) with 5+ years seniority
2. Filter by company size (SME to enterprise)
3. Import as leads with `source = 'apollo'`
4. AI scores each lead based on profile
5. Agent reviews and accepts/rejects batch

**API endpoint planned**: `/api/lead-gen/apollo` (POST)
**Module registry ID**: `apollo`
**Requires**: `APOLLO_API_KEY` environment variable

## DLD Transaction Targeting

When `dld_transactions` table is populated (Phase 2):

1. Find transactions from 3-5 years ago (prime upgrade window)
2. Filter by transaction type (first sale, not resale) to find original buyers
3. Cross-reference with `leads` table to avoid duplicates
4. Create leads with `source = 'dld'` and pre-fill ownership data

Note: DLD has names but no contact info. Pairing with LinkedIn/Apollo to find contact details is the activation path.

## Social Capture (Phase 3)

- Landing page with lead capture form
- Webhook from Facebook/Instagram lead ads
- Auto-creates lead in CRM with `source = 'instagram'`

## Module Registry Entry

```typescript
{
  id: 'apollo',
  name: 'Apollo Lead Generation',
  description: 'Automatically source B2B leads from Apollo API',
  enabled: false,
  phase: 2,
  path: '/lead-generation',
}
```
