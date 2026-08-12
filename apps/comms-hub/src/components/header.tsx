'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, PenSquare, Bell } from 'lucide-react';
import { useCommsStore } from '@/components/comms-store';
import { COMMS_ROLE_LABELS, filterNotificationsForViewer, filterThreadsForViewer } from '@/lib/rbac';
import { TierBadge, TimeAgo } from '@/components/badges';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function Header() {
  const pathname = usePathname();
  const { viewer, viewers, setViewerId, threads, notifications } = useCommsStore();
  const [notifOpen, setNotifOpen] = useState(false);

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

        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium',
              pathname === '/' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
            )}
          >
            Inbox
          </Link>
          <Link
            href="/compose"
            className={cn(
              'flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium',
              pathname === '/compose'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent'
            )}
          >
            <PenSquare className="h-3.5 w-3.5" />
            Compose
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              className="relative rounded-md p-2 text-muted-foreground hover:bg-accent"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {visibleNotifications.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                  {visibleNotifications.length}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-md border border-border bg-card shadow-lg">
                <div className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
                  Notifications for {COMMS_ROLE_LABELS[viewer.role]} ({visibleThreadCount} thread
                  {visibleThreadCount === 1 ? '' : 's'} visible)
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {visibleNotifications.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">Nothing unread.</p>
                  ) : (
                    visibleNotifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.threadId ? `/thread/${n.threadId}` : '/'}
                        onClick={() => setNotifOpen(false)}
                        className="block border-b border-border px-3 py-2 last:border-0 hover:bg-accent"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <TierBadge tier={n.tier} />
                          <span className="truncate text-sm font-medium">{n.title}</span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                        <TimeAgo date={n.createdAt} className="mt-0.5 block text-[11px] text-muted-foreground" />
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">Viewing as</span>
            <select
              value={viewer.agentId}
              onChange={(e) => setViewerId(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {viewers.map((v) => (
                <option key={v.agentId} value={v.agentId}>
                  {v.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
