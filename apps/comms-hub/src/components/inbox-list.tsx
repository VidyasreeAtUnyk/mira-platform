'use client';

/**
 * Client island for the inbox's tier-tab filtering (urgent/today/fyi/all)
 * -- pure client-side filtering over an already-fetched, already-RBAC-
 * filtered thread list (src/app/page.tsx does both server-side), so
 * switching tabs doesn't need a server round-trip. See src/app/page.tsx's
 * header comment for the RBAC/tier split this used to all live in one
 * 'use client' page (src/components/comms-store.tsx, since deleted).
 */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { sortThreadsByTier, TIER_LABELS, TIER_ORDER } from '@/lib/tiers';
import { ChannelIcon, TierBadge, TimeAgo } from '@/components/badges';
import { cn } from '@/lib/utils';
import type { MessageThread, NotificationTier } from '@/types';

type TierFilter = NotificationTier | 'all';

export function InboxList({
  visibleThreads,
  snippets,
}: {
  visibleThreads: MessageThread[];
  snippets: Record<string, string>;
}) {
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');

  const sorted = useMemo(() => sortThreadsByTier(visibleThreads), [visibleThreads]);
  const shown = tierFilter === 'all' ? sorted : sorted.filter((t) => t.tier === tierFilter);

  const tierCounts: Record<TierFilter, number> = {
    all: visibleThreads.length,
    urgent: visibleThreads.filter((t) => t.tier === 'urgent').length,
    today: visibleThreads.filter((t) => t.tier === 'today').length,
    fyi: visibleThreads.filter((t) => t.tier === 'fyi').length,
  };

  return (
    <>
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
            {visibleThreads.length === 0 ? 'No threads visible under this role\'s RBAC rules.' : 'No threads match this filter.'}
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
                {thread.subject && <p className="truncate text-sm text-muted-foreground">{thread.subject}</p>}
                <p className="truncate text-sm text-muted-foreground">{snippets[thread.id] ?? ''}</p>
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
              <TimeAgo date={thread.lastMessageAt} className="shrink-0 whitespace-nowrap text-xs text-muted-foreground" />
            </Link>
          ))
        )}
      </div>
    </>
  );
}
