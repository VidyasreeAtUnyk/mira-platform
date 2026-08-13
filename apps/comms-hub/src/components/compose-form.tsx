'use client';

/**
 * Client island for the compose form -- only ever calls
 * createDraftThreadAction (src/app/actions.ts), which creates a new thread
 * with one status: 'draft' message. Same draft-and-hold guarantee as the
 * thread-detail reply box (src/components/reply-box.tsx).
 */
import { useActionState, useState } from 'react';
import type { Channel } from '@/types';
import { createDraftThreadAction } from '@/app/actions';

export function ComposeForm({ agentId }: { agentId: string | null }) {
  const [state, formAction] = useActionState(createDraftThreadAction, undefined);
  const [channel, setChannel] = useState<Channel>('whatsapp');

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <input type="hidden" name="agentId" value={agentId ?? ''} />
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-muted-foreground">Channel</legend>
        <div className="flex gap-2">
          {(['whatsapp', 'email'] as Channel[]).map((c) => (
            <label key={c}>
              <input
                type="radio"
                name="channel"
                value={c}
                checked={channel === c}
                onChange={() => setChannel(c)}
                className="peer sr-only"
              />
              <span
                className={`inline-block cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium capitalize ${
                  channel === c
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent'
                }`}
              >
                {c}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="contactName" className="mb-1 block text-xs font-medium text-muted-foreground">
          Contact name
        </label>
        <input
          id="contactName"
          name="contactName"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g. Sana Iqbal"
        />
      </div>

      <div>
        <label htmlFor="contactHandle" className="mb-1 block text-xs font-medium text-muted-foreground">
          {channel === 'whatsapp' ? 'Phone number (E.164)' : 'Email address'}
        </label>
        <input
          id="contactHandle"
          name="contactHandle"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder={channel === 'whatsapp' ? '+971501112222' : 'name@example.com'}
        />
      </div>

      {channel === 'email' && (
        <div>
          <label htmlFor="subject" className="mb-1 block text-xs font-medium text-muted-foreground">
            Subject
          </label>
          <input
            id="subject"
            name="subject"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      <div>
        <label htmlFor="body" className="mb-1 block text-xs font-medium text-muted-foreground">
          Message
        </label>
        <textarea
          id="body"
          name="body"
          rows={4}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
        Save Draft
      </button>
    </form>
  );
}
