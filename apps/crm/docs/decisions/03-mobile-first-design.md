# ADR 03: Mobile-First Design

## Status
Accepted

## Context

Dubai real estate agents work in the field — they're at viewings, at client offices, in cars. They need to log interactions, check follow-ups, and capture new leads from their phones. Desktop is secondary.

## Decision

Build **mobile-first**: design for 375px viewport, progressively enhance to desktop. Navigation uses bottom tabs on mobile, sidebar on desktop (md: breakpoint = 768px).

## Responsive Breakpoints

| Breakpoint | Target | Layout |
|-----------|--------|--------|
| default (< 768px) | Mobile (phone) | Bottom nav, full-width cards, FAB |
| md: (768px+) | Tablet / small laptop | Sidebar, 2-col grid |
| lg: (1024px+) | Desktop | Sidebar, 3-col grid, wider cards |

## Mobile-Specific Patterns

**Bottom Navigation**: 4 tabs — Today, Leads, Pipeline, Intelligence. Fixed at bottom, safe-area aware (for iPhone notch).

**FAB (Floating Action Button)**: On `/leads`, a `+` button in the bottom-right opens `/leads/new`. Primary action is always reachable with one thumb.

**Drawer/Sheet for secondary actions**: "Log Interaction" and "Edit Lead" open as bottom sheets on mobile (not full-page navigations). This keeps context visible.

**Form design**: 
- Large touch targets (minimum 44px tap area)
- Segmented controls instead of small radio buttons
- Native date pickers where possible
- One thumb operable — primary CTA always at the bottom of the screen

**No horizontal scroll**: All layouts tested at 375px. Tables are replaced with card stacks on mobile.

## Why Not a Native App

Phase 1 is a web app. Reasons:
- Faster to build and iterate
- No app store approval process
- Agents access from any device (desktop for managers)
- PWA capabilities cover offline basics if needed in Phase 2

## Agent Workflow on Mobile

Typical field workflow:
1. Morning: open Today tab → see follow-ups due today
2. After a call: tap lead → "Log Interaction" → drawer opens, type summary, set next follow-up
3. New lead met at a viewing: tap FAB → fill form → done in 30 seconds
4. Check AI suggestion on lead profile before calling
