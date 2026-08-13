/**
 * Unified inbox -- now an async Server Component reading real data
 * directly (src/lib/data/comms.ts), RBAC-filtered server-side before
 * anything reaches the client. RESOLVED (was a 'use client' page reading
 * from src/components/comms-store.tsx's in-memory mock state, see
 * PROGRESS-integration.md): tier-tab filtering (which doesn't need a
 * server round-trip) lives in src/components/inbox-list.tsx's client
 * island; everything else (RBAC filtering, data fetching) happens here,
 * server-side.
 */
import { getCurrentViewer } from '@/lib/auth/viewer';
import { listMessages, listThreads } from '@/lib/data/comms';
import { filterThreadsForViewer, COMMS_ROLE_LABELS } from '@/lib/rbac';
import { InboxList } from '@/components/inbox-list';

export const revalidate = 0;

export default async function InboxPage() {
  const [{ viewer }, threads, messages] = await Promise.all([getCurrentViewer(), listThreads(), listMessages()]);

  const visibleThreads = filterThreadsForViewer(threads, viewer);

  const snippets: Record<string, string> = {};
  for (const thread of visibleThreads) {
    const msgs = messages.filter((m) => m.threadId === thread.id);
    if (msgs.length === 0) continue;
    const latest = msgs.reduce((a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a));
    snippets[thread.id] = `${latest.direction === 'outbound' ? 'You: ' : ''}${latest.body}`;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Viewing as <span className="font-medium">{COMMS_ROLE_LABELS[viewer.role]}</span> — {visibleThreads.length} of{' '}
            {threads.length} total threads visible
          </p>
        </div>
      </div>

      <InboxList visibleThreads={visibleThreads} snippets={snippets} />
    </div>
  );
}
