# Market Intelligence Module Spec

## Overview

The market intelligence module gives agents data-driven insight into Dubai property market trends, primarily using DLD price index data.

## Phase 1 Features (Built)

### Price Index Chart
- Line chart showing apartment and villa price index over time
- Data source: `dld_price_index` table
- Chart library: Recharts
- Rendered in `/intelligence` page

### Upgrade Calculator
- Input: property type (apartment/villa), purchase year, purchase price
- Output: estimated current value, equity gained (AED + %)
- Based on DLD price index ratio calculation
- Useful for agents in client conversations

## Phase 2 Features (Planned)

### Area-Level Transaction Data

When `dld_transactions.csv` is imported:
- Transaction volume by area (heatmap or bar chart)
- Average price per sqft by area
- Year-over-year price change by area
- "Hot areas" — areas with >20% YoY price increase

### Upgrade Opportunity Map

Identifies leads in the CRM who:
- Own a property purchased 3+ years ago
- Have not been contacted in 30 days
- Estimated equity > AED 200,000

Shown as a prioritised list: "These 5 leads have significant equity — time to call them."

### Portfolio Tracker

For agents with multiple landlord/investor clients:
- Track each property's estimated value over time
- Show portfolio total value and equity
- Export as PDF for client presentations

## Data Refresh

- Price index: manual import monthly (automated in Phase 2)
- Transactions: batch import from DLD (Phase 2)
- Future: webhooks or DLD API if available

## Module Registry Entry

```typescript
{
  id: 'market-intelligence',
  name: 'Market Intelligence',
  description: 'DLD price index, upgrade calculator, area trends',
  enabled: true,
  phase: 1,
  path: '/intelligence',
}
```
