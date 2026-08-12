/**
 * Canonical lead lifecycle. This is the funnel graph moved here from
 * apps/lead-agent/src/domain/stateMachine.ts during the Phase 0 merge --
 * both apps must agree on what stage a lead is in and which transitions are
 * legal, so the state machine itself belongs in the shared contract, not in
 * one app's private domain layer.
 *
 * apps/crm's pre-merge `status` field used a narrower 7-value vocabulary
 * (new/contacted/interested/viewing/offer/closed_won/closed_lost). See
 * CRM_STATUS_TO_STAGE below for the mapping applied when merging existing
 * rows onto this enum. CRM's Kanban UI (apps/crm/src/app/pipeline) still
 * reads/writes the legacy `status` column as of this migration -- switching
 * it to `stage` natively is tracked as a Phase 0 follow-up in
 * PROGRESS-phase0.md, not done in this pass (it changes user-facing pipeline
 * column labels, which is a product call, not a mechanical rename).
 */
export const STAGES = [
    "new",
    "contacted",
    "qualified",
    "viewing_scheduled",
    "decision_pending",
    "won",
    "lost",
    "canceled",
    "dormant",
];
export const SEGMENTS = ["prospect", "client"];
/**
 * Legal next stages from a given stage. Deliberately does NOT include
 * dormant -> contacted or canceled -> contacted: those two edges only exist
 * through a reactivation flow that requires fresh evidence (see the
 * lead-agent's reactivate_lead tool), never through this generic edge table.
 */
export const STAGE_EDGES = {
    new: ["contacted"],
    contacted: ["qualified", "dormant"],
    qualified: ["viewing_scheduled", "dormant"],
    viewing_scheduled: ["decision_pending"],
    decision_pending: ["won", "lost", "canceled"],
    canceled: ["dormant"],
    dormant: [],
    won: [],
    lost: [],
};
export const REACTIVATABLE_STAGES = ["dormant", "canceled"];
export function isLegalStageTransition(from, to) {
    return (STAGE_EDGES[from] ?? []).includes(to);
}
export function canReactivateFrom(stage) {
    return REACTIVATABLE_STAGES.includes(stage);
}
/**
 * apps/crm's legacy 7-value `status` enum, kept only to interpret/backfill
 * pre-merge rows and to give the not-yet-updated Kanban UI a type. Do not
 * add new code against this -- write `stage` instead.
 */
export const LEGACY_CRM_STATUSES = [
    "new",
    "contacted",
    "interested",
    "viewing",
    "offer",
    "closed_won",
    "closed_lost",
];
export const CRM_STATUS_TO_STAGE = {
    new: "new",
    contacted: "contacted",
    interested: "qualified",
    viewing: "viewing_scheduled",
    offer: "decision_pending",
    closed_won: "won",
    closed_lost: "lost",
};
/**
 * Best-effort reverse mapping for rendering the legacy Kanban board from a
 * canonical stage. Lossy: 'qualified' round-trips to 'interested' even if a
 * lead reached 'qualified' a different way; that's expected until the board
 * itself is migrated to render `stage` directly.
 */
export const STAGE_TO_CRM_STATUS = {
    new: "new",
    contacted: "contacted",
    qualified: "interested",
    viewing_scheduled: "viewing",
    decision_pending: "offer",
    won: "closed_won",
    lost: "closed_lost",
    canceled: "offer",
    dormant: "contacted",
};
