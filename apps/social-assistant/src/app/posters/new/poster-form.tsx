'use client';

import { useActionState, useMemo, useState } from 'react';
import { generatePosterSVG } from '@/lib/poster/svg-template';
import { generateCaption } from '@/lib/ai/caption';
import { Button } from '@/components/ui/button';
import { createPosterDraft, type CreatePosterState } from './actions';
import { POST_KINDS, SOCIAL_PLATFORMS, BRAND_MODES } from '@/types/social';
import type { ListingForPoster, DeveloperBrandProfile, PostKind, SocialPlatform, BrandMode } from '@/types/social';

interface PosterFormProps {
  listings: ListingForPoster[];
  developerProfiles: DeveloperBrandProfile[];
}

const KIND_LABELS: Record<PostKind, string> = {
  new_listing: 'New listing',
  price_update: 'Price update',
  sold: 'Sold',
  market_update: 'Market update',
  brand_general: 'Brand / general',
};

const initialState: CreatePosterState = { ok: false };

export function PosterForm({ listings, developerProfiles }: PosterFormProps) {
  const [state, formAction, pending] = useActionState(createPosterDraft, initialState);

  const [kind, setKind] = useState<PostKind>('new_listing');
  const [platform, setPlatform] = useState<SocialPlatform>('instagram');
  const [brandMode, setBrandMode] = useState<BrandMode>('own');
  const [propertyId, setPropertyId] = useState<string>('');
  const [developerPartnerName, setDeveloperPartnerName] = useState<string>('');
  const [scriptAccentLine, setScriptAccentLine] = useState<string>('');
  const [scheduledFor, setScheduledFor] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [captionTouched, setCaptionTouched] = useState(false);
  const [caption, setCaption] = useState<string>('');

  const listing = useMemo(() => listings.find((l) => l.id === propertyId) ?? null, [listings, propertyId]);

  const autoCaption = useMemo(
    () =>
      generateCaption({
        kind,
        brandMode,
        developerPartnerName: developerPartnerName || null,
        listing,
      }),
    [kind, brandMode, developerPartnerName, listing]
  );

  const effectiveCaption = captionTouched ? caption : autoCaption;

  const svgMarkup = useMemo(
    () =>
      generatePosterSVG({
        kind,
        brandMode,
        developerPartnerName: developerPartnerName || null,
        listing,
        scriptAccentLine: scriptAccentLine || undefined,
      }),
    [kind, brandMode, developerPartnerName, listing, scriptAccentLine]
  );

  const eligibleDevelopers = developerProfiles.filter((d) => d.allow_co_branding);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="caption" value={effectiveCaption} />

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-brand-body/60">Post kind</label>
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as PostKind)}
            className="w-full rounded border border-brand-hairline bg-brand-bg-alt px-3 py-2 text-sm"
          >
            {POST_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-brand-body/60">Platform</label>
          <select
            name="platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
            className="w-full rounded border border-brand-hairline bg-brand-bg-alt px-3 py-2 text-sm"
          >
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-brand-body/60">Listing (optional)</label>
          <select
            name="property_id"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full rounded border border-brand-hairline bg-brand-bg-alt px-3 py-2 text-sm"
          >
            <option value="">No listing (brand / market post)</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {(l.community_name ?? l.area)} — {l.address}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-brand-body/60">Brand mode</label>
          <select
            name="brand_mode"
            value={brandMode}
            onChange={(e) => {
              const next = e.target.value as BrandMode;
              setBrandMode(next);
              if (next === 'own') setDeveloperPartnerName('');
            }}
            className="w-full rounded border border-brand-hairline bg-brand-bg-alt px-3 py-2 text-sm"
          >
            {BRAND_MODES.map((m) => (
              <option key={m} value={m}>
                {m === 'own' ? 'Own brand' : 'Co-branded (developer)'}
              </option>
            ))}
          </select>
        </div>

        {brandMode === 'co_branded' && (
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-brand-body/60">
              Developer partner
            </label>
            <select
              name="developer_partner_name"
              value={developerPartnerName}
              onChange={(e) => setDeveloperPartnerName(e.target.value)}
              className="w-full rounded border border-brand-hairline bg-brand-bg-alt px-3 py-2 text-sm"
            >
              <option value="">Select a developer…</option>
              {eligibleDevelopers.map((d) => (
                <option key={d.developer_name} value={d.developer_name}>
                  {d.developer_name}
                </option>
              ))}
            </select>
            {developerPartnerName &&
              developerProfiles.find((d) => d.developer_name === developerPartnerName)?.requires_developer_approval && (
                <p className="mt-1 text-xs text-brand-gold-light">
                  {developerProfiles.find((d) => d.developer_name === developerPartnerName)?.brand_guideline_notes ??
                    'This developer requires marketing-compliance approval before combining marks.'}
                </p>
              )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-brand-body/60">
            Script accent line (optional, one max — BRAND-KIT.md rule)
          </label>
          <input
            type="text"
            name="script_accent_line"
            value={scriptAccentLine}
            onChange={(e) => setScriptAccentLine(e.target.value)}
            placeholder="e.g. Rooted in heritage."
            maxLength={60}
            className="w-full rounded border border-brand-hairline bg-brand-bg-alt px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-brand-body/60">Caption</label>
          <textarea
            value={effectiveCaption}
            onChange={(e) => {
              setCaptionTouched(true);
              setCaption(e.target.value);
            }}
            rows={3}
            className="w-full rounded border border-brand-hairline bg-brand-bg-alt px-3 py-2 text-sm"
          />
          {captionTouched && (
            <button
              type="button"
              onClick={() => setCaptionTouched(false)}
              className="mt-1 text-xs text-brand-gold-light underline"
            >
              Reset to template caption
            </button>
          )}
          <p className="mt-1 text-xs text-brand-body/40">
            Template-generated from listing data, not AI (see src/lib/ai/caption.ts) — edit freely above.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-brand-body/60">
            Schedule for (optional — lands in draft either way)
          </label>
          <input
            type="datetime-local"
            name="scheduled_for"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="w-full rounded border border-brand-hairline bg-brand-bg-alt px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-brand-body/60">Internal notes</label>
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-brand-hairline bg-brand-bg-alt px-3 py-2 text-sm"
          />
        </div>

        {state.error && <p className="text-sm text-red-300">{state.error}</p>}

        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save as draft'}
        </Button>
        <p className="text-xs text-brand-body/40">
          Lands in the calendar as a <strong>draft</strong>. Nothing here posts automatically — every post routes
          through the approval queue by design.
        </p>
      </form>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs uppercase tracking-wide text-brand-body/60">Live preview</p>
        <div
          className="overflow-hidden rounded-lg border border-brand-hairline shadow-lg [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      </div>
    </div>
  );
}
