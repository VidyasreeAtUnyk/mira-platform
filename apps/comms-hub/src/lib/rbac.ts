import type { CommsRole, MessageThread, Notification, Viewer } from '@/types';

/**
 * Comms-hub visibility rules, derived from SPEC.md's "Roles (RBAC +
 * ownership)" table. SPEC.md gives one explicit, comms-relevant rule --
 * Marketing/Social: "No CRM/lead access" -- which this file guarantees
 * exactly (see the `marketing_social` case and the tests implied by
 * src/lib/mock-data.ts's seed, which includes a lead-linked thread a
 * marketing viewer must never see). The remaining cases (Senior vs Junior
 * Agent "own" scoping, Admin/Ops's operational-only view, Finance's total
 * exclusion) are this module's best-effort application of SPEC's general
 * table to comms specifically, since SPEC doesn't spell out comms-hub
 * per-role rules beyond the Marketing/Social note. Flagged for human
 * review in PROGRESS-comms.md.
 */
export function canViewThread(thread: MessageThread, viewer: Viewer): boolean {
  switch (viewer.role) {
    case 'owner_coo':
      // SPEC: "Sees: Everything"
      return true;

    case 'senior_agent':
      // SPEC: "Sees: Own + assigned team leads/deals". The Phase 0 shared
      // schema has no team/manager hierarchy on `agents` yet (no
      // `manager_id` / `team_id` column), so "assigned team" can't be
      // resolved here -- this narrows to "own" until that lands. See Notes
      // in PROGRESS-comms.md.
      return thread.agentId === viewer.agentId;

    case 'junior_agent':
      // SPEC: "Sees: Own leads only"
      return thread.agentId === viewer.agentId;

    case 'marketing_social':
      // SPEC: "Sees: Social, posters, content calendar, ad ROI" / "No CRM/
      // lead access, no financials". The hard requirement: any
      // lead-linked thread is invisible to this role, full stop, regardless
      // of who it's assigned to.
      return thread.leadId === null;

    case 'admin_ops':
      // SPEC: "Sees: Trackers, task automation, doc status, compliance
      // alerts" / "No financials". Comms-hub isn't named in that list, so
      // this is interpreted narrowly: operational/compliance-tagged
      // threads and non-CRM-linked comms, not per-lead sales
      // conversations (those live under Owner/Senior/Junior visibility).
      return thread.leadId === null || thread.tags.includes('compliance');

    case 'finance':
      // SPEC: "Sees: Commission/financials only" / "Edits: Financial
      // records" / "Nothing else". No comms-hub access at all.
      return false;

    default: {
      const exhaustive: never = viewer.role;
      return exhaustive;
    }
  }
}

export function filterThreadsForViewer(threads: MessageThread[], viewer: Viewer): MessageThread[] {
  return threads.filter((t) => canViewThread(t, viewer));
}

/**
 * Notifications inherit their linked thread's visibility. Thread-less
 * (platform-wide) notifications default to owner-only visibility -- the
 * conservative choice until a real "notification audience" concept exists.
 */
export function filterNotificationsForViewer(
  notifications: Notification[],
  threadsById: Map<string, MessageThread>,
  viewer: Viewer
): Notification[] {
  return notifications.filter((n) => {
    if (n.threadId === null) return viewer.role === 'owner_coo';
    const thread = threadsById.get(n.threadId);
    return thread ? canViewThread(thread, viewer) : false;
  });
}

export const COMMS_ROLE_LABELS: Record<CommsRole, string> = {
  owner_coo: 'Owner / COO',
  senior_agent: 'Senior Agent',
  junior_agent: 'Junior Agent',
  marketing_social: 'Marketing / Social',
  admin_ops: 'Admin / Ops',
  finance: 'Finance',
};
