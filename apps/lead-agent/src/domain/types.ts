/**
 * Re-exports the canonical shared types (see CLAUDE.md: don't redefine types
 * that already exist in packages/shared-*) under the names this app's code
 * already uses, plus the handful of types that stay app-local (run_metrics
 * is this app's own operational table, not part of the shared contract).
 *
 * Renames from the pre-merge local types, since the shared schema settled
 * different names during the Phase 0 merge (see PROGRESS-phase0.md):
 *   - `Interaction` (this app's passive page_view/email_open/reply/inquiry
 *     signals) -> `EngagementEvent`. apps/crm's `Interaction` is now a
 *     different, human-contact-log concept -- importing the old name here
 *     would silently collide with it.
 *   - `Actor` -> `AuditActor` (same two values: 'agent' | 'human').
 */
export type {
  Stage,
  Segment,
  Lead,
  EngagementEvent,
  EngagementEventType,
  Proposal,
  ProposalType,
  ProposalStatus,
  AuditLogRow,
  AuditActor,
  Property,
  PropertyPriceHistory,
  PropertyTier,
} from "@mira/shared-types";

export {
  STAGES,
  SEGMENTS,
  STAGE_EDGES,
  REACTIVATABLE_STAGES,
  ENGAGEMENT_EVENT_TYPES,
  PROPOSAL_TYPES,
  PROPOSAL_STATUSES,
  AUDIT_ACTORS,
  PROPERTY_TIERS,
} from "@mira/shared-types";

// ============================================================
// App-local: run_metrics (see src/db/local-schema.sql)
// ============================================================

export const RUN_OUTCOMES = ["escalated", "proposal_created", "sent", "no_action"] as const;
export type RunOutcomeKind = (typeof RUN_OUTCOMES)[number];

export interface RunMetric {
  id: string;
  lead_id: string;
  started_at: string;
  ended_at: string;
  outcome: RunOutcomeKind;
  tool_call_count: number;
  estimated_token_cost: number;
}
