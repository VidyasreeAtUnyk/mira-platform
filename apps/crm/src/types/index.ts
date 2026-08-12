/**
 * apps/crm's type surface -- re-exports the Phase 0 shared contract from
 * @mira/shared-types rather than redefining row types locally (see
 * CLAUDE.md's "don't redefine types that already exist there" rule).
 *
 * `LeadStatus` / `LeadSource` are kept as local aliases for the legacy,
 * crm-only vocabularies (see @mira/shared-types' stage.ts for why `status`
 * survives as an unenforced display column post-merge).
 */
export * from '@mira/shared-types';
export type { LegacyCrmStatus as LeadStatus, RecommendedLeadSource as LeadSource } from '@mira/shared-types';
