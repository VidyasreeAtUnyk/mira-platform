'use client';

/**
 * Unified inbox -- thread list filtered by:
 *  1. `canViewThread()` (src/lib/rbac.ts) for the currently-selected demo
 *     viewer (see the role switcher in the header). This is where the
 *     Marketing/Social "no CRM/lead access" exclusion rule is exercised
 *     end-to-end against the seeded lead-linked threads.
 *  2. A tier tab (urgent/today/fyi/all), sorted by src/lib/tiers.ts's
 *     `sortThreadsByTier`.
 */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useCommsStore } from '@/components/comms-store';
import { filterThreadsForViewer, COMMS_ROLE_LABELS } from '@/lib/rbac';
import { sortThreadsByTier, TIER_LABELS, TIER_ORDER } from '@/lib/tiers';
import { ChannelIcon, TierBadge, TimeAgo } from '@/components/badges';
import { cn } from '@/lib/utils';
import type { NotificationTier } from '@/types';

type TierFilter = NotificationTier | 'all';

export default function InboxPage() {
  const { viewer, threads, messages } = useCommsStore();
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');

  const visibleThreads = useMemo(() => filterThreadsForViewer(threads, viewer), [threads, viewer]);
  const sorted = useMemo(() => sortThreadsByTier(visibleThreads), [visibleThreads]);
  const shown = tierFilter === 'all' ? sorted : sorted.filter((t) => t.tier === tierFilter);

  const tierCounts: Record<TierFilter, number> = {
    all: visibleThreads.length,
    urgent: visibleThreads.filter((t) => t.tier === 'urgent').length,
    today: visibleThreads.filter((t) => t.tier === 'today').length,
    fyi: visibleThreads.filter((t) => t.tier === 'fyi').length,
  };

  function snippet(threadId: string): string {
    const msgs = messages.filter((m) => m.threadId === threadId);
    if (msgs.length === 0) return '';
    const latest = msgs.reduce((a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a));
    const prefix = latest.direction === 'outbound' ? 'You: ' : '';
    return `${prefix}${latest.body}`;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Viewing as <span className="font-medium">{COMMS_ROLE_LABELS[viewer.role]}</span> —{' '}
            {visibleThreads.length} of {threads.length} total threads visible
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(['all', ...TIER_ORDER] as TierFilter[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTierFilter(t)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
              tierFilter === t
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-accent'
            )}
          >
            {t === 'all' ? 'All' : TIER_LABELS[t]} ({tierCounts[t]})
          </button>
        ))}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {visibleThreads.length === 0
              ? `No threads visible for ${COMMS_ROLE_LABELS[viewer.role]} under this role's RBAC rules.`
              : 'No threads match this filter.'}
          </p>
        ) : (
          shown.map((thread) => (
            <Link
              key={thread.id}
              href={`/thread/${thread.id}`}
              className="flex items-start gap-3 px-4 py-3 hover:bg-accent"
            >
              <ChannelIcon channel={thread.channel} className="mt-1 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('truncate text-sm', thread.unread ? 'font-semibold' : 'font-medium')}>
                    {thread.contactName}
                  </span>
                  {thread.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <TierBadge tier={thread.tier} className="ml-auto shrink-0 sm:ml-2" />
                </div>
                {thread.subject && (
                  <p className="truncate text-sm text-muted-foreground">{thread.subject}</p>
                )}
                <p className="truncate text-sm text-muted-foreground">{snippet(thread.id)}</p>
                {thread.tags.length > 0 && (
                  <div className="mt-1 flex gap-1">
                    {thread.tags.map((tag) => (
                      <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <TimeAgo
                date={thread.lastMessageAt}
                className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
              />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
