'use client';

/**
 * Client island for the thread-detail reply form. Only ever calls
 * addReplyDraftAction (src/app/actions.ts), which only ever writes
 * status: 'draft' -- there is no "Send" action anywhere on this page, by
 * design (see src/lib/data/comms.ts's header comment).
 */
import { useRef, useState } from 'react';
import { addReplyDraftAction } from '@/app/actions';

export function ReplyBox({ threadId, channel }: { threadId: string; channel: 'whatsapp' | 'email' }) {
  const [savedNotice, setSavedNotice] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    const body = formData.get('body');
    if (typeof body !== 'string' || body.trim().length === 0) return;
    await addReplyDraftAction(threadId, formData);
    formRef.current?.reset();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  }

  return (
    <form ref={formRef} action={handleSubmit} className="rounded-lg border border-border bg-card p-3">
      <label htmlFor="body" className="mb-1 block text-xs font-medium text-muted-foreground">
        Draft a reply ({channel === 'whatsapp' ? 'WhatsApp' : 'Email'}) — saved as draft only, never sent
      </label>
      <textarea
        id="body"
        name="body"
        rows={3}
        placeholder="Type a reply…"
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {savedNotice ? 'Saved as draft.' : 'No send path exists in this build — draft-and-hold by design.'}
        </p>
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          Save Draft
        </button>
      </div>
    </form>
  );
}
