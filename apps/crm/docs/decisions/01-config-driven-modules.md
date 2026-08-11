# ADR 01: Config-Driven Module Registry

## Status
Accepted

## Context

RealEstateIntel is Phase 1 of a multi-phase product. Several features are planned but not built: Apollo lead generation, WhatsApp capture, Bayut/Property Finder portal sync, Arabic RTL, email outreach automation.

The question is: how do we handle these in the codebase? Options:
1. Don't mention them at all — add when built
2. Feature flags in environment variables
3. A module registry in code

## Decision

Use a **module registry** in `src/lib/modules.ts` — an array of module descriptors, each with `id`, `name`, `description`, `enabled`, `phase`, and `path`.

Navigation, dashboard cards, and feature gates all read from this registry. Disabled modules appear in the registry but their routes are not rendered and their UI components are not loaded.

## Why this over alternatives

**vs. "don't mention them"**: The roadmap becomes invisible. New engineers don't know what's planned. Product decisions about module ordering get lost.

**vs. environment variable flags**: Env flags are good for A/B testing and gradual rollouts. Here, these are planned phases — not experiments. Env flags would require documentation outside the code. The registry documents the roadmap *in the code*, where it's always visible.

**vs. separate repo per module**: Over-engineered for a CRM. This is a monorepo product, not a plugin marketplace.

## How to add a new module

1. Add an entry to `src/lib/modules.ts` with `enabled: false` and `phase: N`
2. Build the page/components
3. Flip `enabled: true` when ready to ship
4. Update docs/modules/ with the spec

## Consequences

- The module list in `src/lib/modules.ts` becomes the authoritative roadmap source
- All navigation changes happen in one place
- Phase 2 engineers can see exactly what's planned and why
