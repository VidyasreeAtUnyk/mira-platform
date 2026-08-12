'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ALLOWED_TRANSITIONS } from '@/lib/data/posts';
import { transitionPostStatus } from './actions';
import type { SocialPost, ListingForPoster } from '@/types/social';

const TRANSITION_LABELS: Record<string, string> = {
  pending_approval: 'Send for approval',
  approved: 'Approve',
  held: 'Hold',
  draft: 'Back to draft',
};

interface PostCardProps {
  post: SocialPost;
  listing?: ListingForPoster;
}

export function PostCard({ post, listing }: PostCardProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const transitions = ALLOWED_TRANSITIONS[post.status];

  function handleTransition(next: SocialPost['status']) {
    setError(null);
    startTransition(async () => {
      const result = await transitionPostStatus(post.id, next);
      if (!result.ok) setError(result.error ?? 'Failed to update.');
    });
  }

  return (
    <div className="rounded-lg border border-brand-hairline bg-brand-bg-alt p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <StatusBadge status={post.status} />
        <Badge>{post.kind.replace('_', ' ')}</Badge>
        <Badge>{post.platform.replace('_', ' ')}</Badge>
        <Badge>{post.brand_mode === 'co_branded' ? `co-branded · ${post.developer_partner_name}` : 'own brand'}</Badge>
        {post.caption_source === 'ai' && <Badge>AI caption</Badge>}
      </div>

      {listing && (
        <p className="mb-1 text-xs text-brand-gold-light">
          {listing.community_name ?? listing.area} — {listing.address}
        </p>
      )}

      <p className="mb-2 text-sm text-brand-body/90">{post.caption || <em className="text-brand-body/40">No caption</em>}</p>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-body/50">
        <span>
          {post.scheduled_for ? `Scheduled ${format(new Date(post.scheduled_for), 'PP p')}` : 'Not scheduled'} · by{' '}
          {post.created_by_role}
        </span>
        <div className="flex gap-2">
          {transitions.map((next) => (
            <Button
              key={next}
              variant={next === 'held' ? 'danger' : 'secondary'}
              disabled={pending}
              onClick={() => handleTransition(next)}
            >
              {TRANSITION_LABELS[next] ?? next}
            </Button>
          ))}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      {post.notes && <p className="mt-2 text-xs italic text-brand-body/40">Note: {post.notes}</p>}
    </div>
  );
}
