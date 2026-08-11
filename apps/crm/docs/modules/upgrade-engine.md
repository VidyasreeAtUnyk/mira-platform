# Upgrade Engine Module Spec

## Overview

The upgrade engine identifies leads who own a property, calculates their estimated equity gain using DLD price index data, and uses OpenAI to generate a personalised upgrade proposal.

## When It Activates

On a lead profile where `owns_property = true` and the lead has provided:
- `owned_property_type` (apartment or villa)
- `owned_property_area` (Dubai area)
- `owned_purchase_year`
- `owned_purchase_price`

## DLD Price Index Calculation

1. Find the price index for the purchase month (approximate: use January of `owned_purchase_year`)
2. Find the current month's price index
3. Calculate ratio: `current_index / purchase_index`
4. Apply ratio to purchase price: `estimated_current_value = purchase_price × ratio`
5. Calculate equity: `equity = estimated_current_value - purchase_price`

Formula uses `flat_monthly_index` for apartments, `villa_monthly_index` for villas.

## AI Upgrade Proposal

The `/api/leads/[id]/suggest` endpoint generates an upgrade proposal when `owns_property = true`:

**Prompt inputs**:
- Lead name, property type, area, purchase year, purchase price
- Calculated current estimated value and equity
- Lead's stated budget and preferred areas for new property
- Recent interaction summary

**Output**: A personalised WhatsApp-ready message in English suggesting the agent discuss upgrading from their current property using the equity as a deposit for their next property.

## Upgrade Calculator UI

On the `/intelligence` page, agents can also use a standalone calculator:
- Inputs: property type, purchase year, purchase price
- Output: estimated current value, equity gained, equity %
- Shows a simple chart of index over time

## Limitations

- Price index is national/city-level, not area-specific — actual gains may differ
- Does not account for mortgage outstanding
- Does not account for DLD fees on resale
- For illustration purposes; agents should verify with a formal valuation
