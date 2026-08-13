'use client';

import { useMemo, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ALLOWED_TRANSITIONS } from '@/lib/data/posts';
import { generatePosterSVG } from '@/lib/poster/svg-template';
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
  const [detailOpen, setDetailOpen] = useState(false);
  const transitions = ALLOWED_TRANSITIONS[post.status];

  // Regenerated on demand from the post's own stored fields (kind/brand_mode/
  // developer_partner_name/listing) rather than persisted -- generatePosterSVG
  // is deterministic given the same input (see svg-template.ts's header), so
  // this reproduces exactly what posters/new's live preview showed at
  // creation time. Was previously only ever rendered once, at creation --
  // the calendar had no way to see the actual poster again, only its caption.
  const svgMarkup = useMemo(
    () =>
      generatePosterSVG({
        kind: post.kind,
        brandMode: post.brand_mode,
        developerPartnerName: post.developer_partner_name,
        listing: listing ?? null,
      }),
    [post.kind, post.brand_mode, post.developer_partner_name, listing]
  );

  function handleTransition(next: SocialPost['status']) {
    setError(null);
    startTransition(async () => {
      const result = await transitionPostStatus(post.id, next);
      if (!result.ok) setError(result.error ?? 'Failed to update.');
    });
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setDetailOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setDetailOpen(true);
        }}
        className="cursor-pointer rounded-lg border border-brand-hairline bg-brand-bg-alt p-4 transition-colors hover:border-brand-gold/50"
      >
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
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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

      {detailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="grid max-h-[90vh] w-full max-w-3xl grid-cols-1 gap-6 overflow-y-auto rounded-lg border border-brand-hairline bg-brand-bg p-6 sm:grid-cols-[280px_1fr]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-lg border border-brand-hairline shadow-lg [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={post.status} />
                <Badge>{post.kind.replace('_', ' ')}</Badge>
                <Badge>{post.platform.replace('_', ' ')}</Badge>
                <Badge>{post.brand_mode === 'co_branded' ? `co-branded · ${post.developer_partner_name}` : 'own brand'}</Badge>
              </div>
              {listing && (
                <p className="mb-2 text-sm text-brand-gold-light">
                  {listing.community_name ?? listing.area} — {listing.address}
                </p>
              )}
              <p className="mb-3 whitespace-pre-wrap text-sm text-brand-body/90">{post.caption || <em className="text-brand-body/40">No caption</em>}</p>
              <dl className="space-y-1.5 text-xs text-brand-body/60">
                <div>
                  <dt className="inline text-brand-body/40">Scheduled: </dt>
                  <dd className="inline">{post.scheduled_for ? format(new Date(post.scheduled_for), 'PPPP p') : 'Not scheduled'}</dd>
                </div>
                <div>
                  <dt className="inline text-brand-body/40">Created by: </dt>
                  <dd className="inline">{post.created_by_role}</dd>
                </div>
                {post.notes && (
                  <div>
                    <dt className="inline text-brand-body/40">Notes: </dt>
                    <dd className="inline italic">{post.notes}</dd>
                  </div>
                )}
              </dl>
              <button
                onClick={() => setDetailOpen(false)}
                className="mt-4 text-xs text-brand-body/50 hover:text-brand-body"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
