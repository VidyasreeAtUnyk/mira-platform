# ADR 04: DLD Data Strategy

## Status
Accepted

## Context

Dubai Land Department (DLD) publishes real estate transaction data. This is publicly available and used by the upgrade engine to estimate current property values and equity.

## What's Available

**DLD Price Index** (used in Phase 1):
- Monthly price index for apartments and villas
- Source: DLD official publications / data.gov.ae
- Available as CSV download
- Fields: date, all_monthly_index, flat_monthly_index, villa_monthly_index, price variants
- Imported into `dld_price_index` table

**DLD Transactions** (Phase 2):
- Individual transaction records (sale date, area, property type, price, size)
- These contain buyer/seller names but NO contact details (by law)
- Useful for: identifying who recently bought and might be ready to upgrade
- Will be imported as `dld_transactions` table when `transactions.csv` is available
- Import script will be in `supabase/scripts/import-dld-transactions.ts`

## Limitations

- **No contact details**: DLD data has names but no phone numbers or emails. Pairing with Apollo (Phase 2) is the only way to get contact info for DLD-sourced leads.
- **Historical only**: DLD doesn't provide real-time transaction data via API. Data is batch-imported.
- **Price index is an index, not AED/sqft**: The upgrade calculator uses the index ratio to estimate current value from purchase price. It's an estimate, not a valuation.

## Upgrade Calculation Formula

```
current_estimated_value = purchase_price × (current_index / purchase_month_index)
equity_gained = current_estimated_value - purchase_price
equity_percentage = (equity_gained / purchase_price) × 100
```

Where `current_index` and `purchase_month_index` come from `dld_price_index`, selecting the appropriate row for flat or villa based on property type.

## Import Process

DLD price index CSV → `supabase/scripts/import-dld-price-index.ts` → `dld_price_index` table

The CSV has been provided and imported as seed data. Monthly updates are manual for now; Phase 2 will automate.

## Why Not a Third-Party Data API

- Most commercial real estate data APIs for Dubai (e.g., Property Monitor, REIDIN) require expensive subscriptions
- DLD public data is free and authoritative
- For Phase 1, the price index is sufficient for upgrade proposals
- Phase 2 will evaluate data partnerships based on usage
