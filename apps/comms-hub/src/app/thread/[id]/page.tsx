'use client';

/**
 * Thread detail view. Enforces `canViewThread()` here too, not just at the
 * inbox list level -- a viewer who guesses/bookmarks a thread URL they
 * shouldn't see (e.g. Marketing/Social hitting a lead-linked thread) gets
 * blocked at this layer independently of list filtering.
 *
 * The reply box only ever calls `addReplyDraft`, which appends a
 * status: 'draft' Message -- there is no "Send" action anywhere on this
 * page, by design (see src/components/comms-store.tsx's header comment).
 */
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useCommsStore } from '@/components/comms-store';
import { canViewThread, COMMS_ROLE_LABELS } from '@/lib/rbac';
import { ChannelIcon, StatusBadge, TierBadge, TimeAgo } from '@/components/badges';
import { cn } from '@/lib/utils';

export default function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { viewer, threadById, messagesForThread, markThreadRead, addReplyDraft } = useCommsStore();
  const [reply, setReply] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const thread = threadById(id);
  const allowed = thread ? canViewThread(thread, viewer) : false;

  useEffect(() => {
    if (thread && allowed && thread.unread) {
      markThreadRead(thread.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, allowed]);

  if (!thread) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Thread not found.</p>
        <Link href="/" className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to inbox
        </Link>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-600" />
        <h1 className="text-lg font-semibold">Not visible to this role</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          <span className="font-medium">{COMMS_ROLE_LABELS[viewer.role]}</span> does not have access to
          this thread under comms-hub&apos;s RBAC rules (src/lib/rbac.ts). Switch viewer in the header to
          confirm.
        </p>
        <Link href="/" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to inbox
        </Link>
      </div>
    );
  }

  const messages = messagesForThread(thread.id);

  function handleSaveDraft() {
    if (reply.trim().length === 0) return;
    addReplyDraft(thread!.id, reply);
    setReply('');
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  }

  return (
    <div>
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to inbox
      </Link>

      <div className="mb-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ChannelIcon channel={thread.channel} />
          <h1 className="text-lg font-semibold">{thread.contactName}</h1>
          <TierBadge tier={thread.tier} />
          {thread.tags.map((tag) => (
            <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{thread.contactHandle}</p>
        {thread.subject && <p className="mt-1 text-sm font-medium">{thread.subject}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {thread.leadId ? `Linked to lead ${thread.leadId}` : 'Not linked to a CRM lead'}
          {thread.agentId ? ` · Assigned to ${thread.agentId}` : ' · Unassigned'}
        </p>
      </div>

      <div className="mb-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[80%] rounded-lg border px-3 py-2',
                m.direction === 'outbound' ? 'border-primary/20 bg-primary/10' : 'border-border bg-card'
              )}
            >
              <p className="whitespace-pre-wrap text-sm">{m.body}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <StatusBadge status={m.status} />
                <TimeAgo date={m.createdAt} className="text-[11px] text-muted-foreground" />
              </div>
              {m.heldReason && <p className="mt-1 text-[11px] text-muted-foreground">{m.heldReason}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <label htmlFor="reply" className="mb-1 block text-xs font-medium text-muted-foreground">
          Draft a reply ({thread.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}) — saved as draft only,
          never sent
        </label>
        <textarea
          id="reply"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={3}
          placeholder="Type a reply…"
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {savedNotice ? 'Saved as draft.' : 'No send path exists in this build — draft-and-hold by design.'}
          </p>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={reply.trim().length === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Draft
          </button>
        </div>
      </div>
    </div>
  );
}
