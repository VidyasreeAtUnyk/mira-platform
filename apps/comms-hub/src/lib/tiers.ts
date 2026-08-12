import type { Lead } from '@mira/shared-types';
import type { Message, MessageThread, NotificationTier } from '@/types';

/**
 * Priority tier heuristic (SPEC.md module 6: "Notification center with
 * priority tiers (urgent / today / fyi)"). SPEC.md doesn't define exact
 * thresholds -- this is a documented v1 heuristic, easy to retune once
 * real usage data exists (see PROGRESS-comms.md Notes). Kept as a pure
 * function so it's independently testable and reusable outside the UI
 * layer (e.g. by a future notification-generation job).
 */
const URGENT_LEAD_STAGES: ReadonlySet<Lead['stage']> = new Set(['viewing_scheduled', 'decision_pending']);
const URGENT_UNREAD_HOURS = 2;
const TODAY_UNREAD_HOURS = 24;

export function computeTier(params: {
  threadUnread: boolean;
  latestMessage: Pick<Message, 'direction' | 'createdAt'> | null;
  leadStage?: Lead['stage'] | null;
  doNotContact?: boolean;
}): NotificationTier {
  const { threadUnread, latestMessage, leadStage, doNotContact } = params;

  // A lead flagged do-not-contact is never urgent, regardless of message
  // activity -- surfacing it as urgent would push toward exactly the kind
  // of contact that flag exists to prevent.
  if (doNotContact) return 'fyi';

  // Only unread, inbound activity drives urgency -- drafts awaiting
  // approval and already-read threads are informational, not time-pressure.
  if (!threadUnread || !latestMessage || latestMessage.direction !== 'inbound') return 'fyi';

  if (leadStage && URGENT_LEAD_STAGES.has(leadStage)) return 'urgent';

  const hoursSinceLatest = (Date.now() - new Date(latestMessage.createdAt).getTime()) / 3_600_000;
  if (hoursSinceLatest <= URGENT_UNREAD_HOURS) return 'urgent';
  if (hoursSinceLatest <= TODAY_UNREAD_HOURS) return 'today';
  return 'fyi';
}

export function sortThreadsByTier(threads: MessageThread[]): MessageThread[] {
  const rank: Record<NotificationTier, number> = { urgent: 0, today: 1, fyi: 2 };
  return [...threads].sort((a, b) => {
    const tierDiff = rank[a.tier] - rank[b.tier];
    if (tierDiff !== 0) return tierDiff;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
}

export const TIER_LABELS: Record<NotificationTier, string> = {
  urgent: 'Urgent',
  today: 'Today',
  fyi: 'FYI',
};

export const TIER_ORDER: readonly NotificationTier[] = ['urgent', 'today', 'fyi'];
