/**
 * @mira/shared-types -- the Phase 0 data contract.
 *
 * Canonical TypeScript types for the shared Postgres schema (see
 * packages/shared-db). Both apps/crm and apps/lead-agent import from here
 * instead of defining their own row types -- see CLAUDE.md's "don't redefine
 * types that already exist there" rule.
 */
export * from "./stage.js";
export * from "./domain.js";
