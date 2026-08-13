/**
 * Thread detail view -- now an async Server Component. Enforces
 * `canViewThread()` here too, not just at the inbox list level -- a viewer
 * who guesses/bookmarks a thread URL they shouldn't see (e.g.
 * Marketing/Social hitting a lead-linked thread) gets blocked at this
 * layer independently of list filtering.
 *
 * RESOLVED (was a 'use client' page marking a thread read via a
 * useEffect against src/components/comms-store.tsx's in-memory state, see
 * PROGRESS-integration.md): markThreadRead now runs directly in this
 * Server Component's render, a real Postgres UPDATE, no client effect
 * needed. The reply box (src/components/reply-box.tsx) only ever calls
 * addReplyDraftAction, which only ever writes status: 'draft'.
 */
import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { getCurrentViewer } from '@/lib/auth/viewer';
import { getLeadSummary, listMessages, listThreads, markThreadRead } from '@/lib/data/comms';
import { canViewThread, COMMS_ROLE_LABELS } from '@/lib/rbac';
import { ChannelIcon, StatusBadge, TierBadge, TimeAgo } from '@/components/badges';
import { ReplyBox } from '@/components/reply-box';
import { cn } from '@/lib/utils';

export const revalidate = 0;

export default async function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ viewer, viewers }, threads, allMessages] = await Promise.all([getCurrentViewer(), listThreads(), listMessages()]);

  const thread = threads.find((t) => t.id === id);
  const allowed = thread ? canViewThread(thread, viewer) : false;
  const linkedLead = thread?.leadId ? await getLeadSummary(thread.leadId) : null;
  const assignedAgent = thread?.agentId ? viewers.find((v) => v.agentId === thread.agentId) : null;

  if (thread && allowed && thread.unread) {
    await markThreadRead(thread.id);
  }

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
          <span className="font-medium">{COMMS_ROLE_LABELS[viewer.role]}</span> does not have access to this thread
          under comms-hub&apos;s RBAC rules (src/lib/rbac.ts). Switch viewer in the header to confirm.
        </p>
        <Link href="/" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to inbox
        </Link>
      </div>
    );
  }

  const messages = allMessages
    .filter((m) => m.threadId === thread.id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

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
          {linkedLead
            ? `Linked to lead: ${linkedLead.name}${linkedLead.phone ? ` (${linkedLead.phone})` : ''}`
            : thread.leadId
              ? 'Linked to a lead no longer in the system'
              : 'Not linked to a CRM lead'}
          {assignedAgent ? ` · Assigned to ${assignedAgent.displayName}` : thread.agentId ? ' · Assigned to an agent no longer in the system' : ' · Unassigned'}
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

      <ReplyBox threadId={thread.id} channel={thread.channel} />
    </div>
  );
}
