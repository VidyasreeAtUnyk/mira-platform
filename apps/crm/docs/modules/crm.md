# CRM Module Spec

## Overview

The CRM module manages the complete lead lifecycle from capture to close. It is the core module of RealEstateIntel.

## Lead Lifecycle

```
new → contacted → interested → viewing → offer → closed_won
                                                ↘ closed_lost
```

Transitions happen manually (agent drags card in pipeline or updates status on lead profile).

## Pipeline Stages

| Stage | Description | Key Action |
|-------|-------------|-----------|
| new | Just captured, not yet reached | First call/message |
| contacted | Agent reached out, awaiting response | Follow up |
| interested | Lead confirmed interest | Schedule viewing |
| viewing | Property viewing scheduled/done | Submit offer |
| offer | Offer submitted | Negotiate/close |
| closed_won | Deal closed | Referral ask |
| closed_lost | Deal fell through | Re-engage in 6 months |

## Lead Fields

Core identification: name, phone, email, lead_type, source
Property intent: property_type, budget_min/max, preferred_areas, bedrooms
Current ownership: owns_property, owned_property_type, owned_property_area, owned_purchase_year, owned_purchase_price
CRM state: status, last_contacted_at, next_followup_at
AI: ai_score (1-10), ai_score_reason

## Interaction Logging

Every touchpoint is logged as an interaction:
- **type**: call / whatsapp / email / viewing / meeting / note
- **summary**: what was discussed (free text)
- **outcome**: positive / neutral / negative / no_answer
- **next_action**: what to do next (free text)
- **next_action_date**: when to follow up

Logging an interaction automatically updates `leads.last_contacted_at`.

## Cold Lead Detection

A lead is "cold" if `last_contacted_at < now() - 7 days` and status is not closed.
- Shown with amber highlight in lead list
- Shown as badge count on dashboard
- Edge Function runs daily to flag these

## Task List (Follow-ups)

The dashboard Today's Tasks view shows leads where `next_followup_at = today`.
Agents can mark follow-up directly from the lead profile.

## Lead Sources

family / friend / referral / bayut / property_finder / instagram / apollo / dld / walk_in / other

## Scoring

AI scores each lead 1-10 on creation based on:
- Budget vs market averages
- Number of preferred areas (specificity = intent)
- Lead type and property type
- Source quality
- Whether they own a property (upgrade potential)
