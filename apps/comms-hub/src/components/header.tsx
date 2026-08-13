/**
 * App header -- now an async Server Component reading real data directly
 * (src/lib/data/comms.ts), same pattern as every other module's layout/
 * page components. RESOLVED (was a 'use client' component reading from
 * src/components/comms-store.tsx's in-memory state, see
 * PROGRESS-integration.md): interactive bits (notif bell toggle, viewer
 * switcher) extracted into header-interactive.tsx's client island.
 */
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { HeaderNav } from '@/components/header-nav';
import { HeaderInteractive } from '@/components/header-interactive';
import { getCurrentViewer } from '@/lib/auth/viewer';
import { listNotifications, listThreads } from '@/lib/data/comms';
import { filterNotificationsForViewer, filterThreadsForViewer } from '@/lib/rbac';

export async function Header() {
  const [{ viewer, viewers }, threads, notifications] = await Promise.all([
    getCurrentViewer(),
    listThreads(),
    listNotifications(),
  ]);

  const threadsById = new Map(threads.map((t) => [t.id, t]));
  const visibleNotifications = filterNotificationsForViewer(notifications, threadsById, viewer)
    .filter((n) => !n.read)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const visibleThreadCount = filterThreadsForViewer(threads, viewer).length;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="mr-2 flex items-center gap-2 font-semibold">
          <Inbox className="h-5 w-5 text-primary" />
          Mira Comms Hub
        </Link>

        <HeaderNav />

        <HeaderInteractive
          viewer={viewer}
          viewers={viewers}
          visibleThreadCount={visibleThreadCount}
          visibleNotifications={visibleNotifications}
        />
      </div>
    </header>
  );
}
