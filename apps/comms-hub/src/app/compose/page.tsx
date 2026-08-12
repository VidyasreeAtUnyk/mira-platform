'use client';

/**
 * Compose a new outbound thread. Only calls `createDraftThread`, which
 * appends a status: 'draft' Message and a new MessageThread -- same
 * draft-and-hold guarantee as the thread-detail reply box, see
 * src/components/comms-store.tsx.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Channel } from '@/types';
import { useCommsStore } from '@/components/comms-store';

export default function ComposePage() {
  const router = useRouter();
  const { viewer, createDraftThread } = useCommsStore();

  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [contactName, setContactName] = useState('');
  const [contactHandle, setContactHandle] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName.trim() || !contactHandle.trim() || !body.trim()) {
      setError('Contact name, contact handle, and message body are all required.');
      return;
    }
    if (channel === 'email' && !subject.trim()) {
      setError('Subject is required for email threads.');
      return;
    }
    setError(null);
    const threadId = createDraftThread({
      channel,
      contactName,
      contactHandle,
      subject: channel === 'email' ? subject : null,
      body,
      agentId: viewer.role === 'owner_coo' ? null : viewer.agentId,
    });
    router.push(`/thread/${threadId}`);
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold">Compose</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Creates a new thread with one draft message. Nothing is sent — draft-and-hold by design (no live
        BSP/email credentials exist in this build).
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-4">
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-muted-foreground">Channel</legend>
          <div className="flex gap-2">
            {(['whatsapp', 'email'] as Channel[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium capitalize ${
                  channel === c
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="contactName" className="mb-1 block text-xs font-medium text-muted-foreground">
            Contact name
          </label>
          <input
            id="contactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
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
            value={contactHandle}
            onChange={(e) => setContactHandle(e.target.value)}
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
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
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
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Save Draft
        </button>
      </form>
    </div>
  );
}
