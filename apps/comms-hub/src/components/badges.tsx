'use client';

// Needed explicitly now (was previously only ever imported from already-
// 'use client' page files, which was enough to put it in the client
// bundle without its own directive) -- now that src/app/page.tsx and
// src/app/thread/[id]/page.tsx are Server Components (see
// PROGRESS-integration.md), TimeAgo's hooks need this file to declare its
// own client boundary rather than inherit one from its importer.
import { useEffect, useState } from 'react';
import { Mail, MessageCircle } from 'lucide-react';
import type { Channel, MessageStatus, NotificationTier } from '@/types';
import { TIER_LABELS } from '@/lib/tiers';
import { cn, timeAgo } from '@/lib/utils';

/**
 * Client-only relative timestamp. Renders nothing until after mount so the
 * server-rendered markup and the first client render always agree (both
 * empty) -- computing `timeAgo()` directly in JSX would make the server's
 * render (built at request time) diverge from the client's render (built
 * moments later at hydration time) and trip a React hydration-mismatch
 * warning.
 */
export function TimeAgo({ date, className }: { date: string; className?: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    // react-hooks/set-state-in-effect flags this, but it's the deliberate
    // exception: `text` must stay null through the first client render (to
    // match the server-rendered null and avoid a hydration mismatch), then
    // adopt the real client-clock value immediately after mount. There's no
    // SSR-safe way to compute this without an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(timeAgo(date));
    const id = setInterval(() => setText(timeAgo(date)), 60_000);
    return () => clearInterval(id);
  }, [date]);

  return (
    <span className={className} suppressHydrationWarning>
      {text ?? ' '}
    </span>
  );
}

const TIER_STYLES: Record<NotificationTier, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  today: 'bg-amber-100 text-amber-800 border-amber-200',
  fyi: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function TierBadge({ tier, className }: { tier: NotificationTier; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        TIER_STYLES[tier],
        className
      )}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}

export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  return channel === 'whatsapp' ? (
    <MessageCircle className={cn('h-4 w-4 text-emerald-600', className)} aria-label="WhatsApp" />
  ) : (
    <Mail className={cn('h-4 w-4 text-blue-600', className)} aria-label="Email" />
  );
}

const STATUS_STYLES: Record<MessageStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  pending_approval: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-blue-100 text-blue-700 border-blue-200',
  held: 'bg-purple-100 text-purple-700 border-purple-200',
  sent: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const STATUS_LABELS: Record<MessageStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  held: 'Held (not sent)',
  sent: 'Sent',
};

export function StatusBadge({ status, className }: { status: MessageStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        STATUS_STYLES[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
