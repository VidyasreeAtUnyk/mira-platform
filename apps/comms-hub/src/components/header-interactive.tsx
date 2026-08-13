'use client';

/**
 * Client island for header.tsx's two interactive bits (notification bell
 * dropdown toggle, viewer-switcher auto-submit) -- extracted so the header
 * itself can be an async Server Component fetching real data directly
 * (src/lib/data/comms.ts), same reasoning as apps/pipeline/src/app/
 * layout.tsx not needing a client wrapper of its own.
 */
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { setViewerAction } from '@/app/actions';
import { TierBadge, TimeAgo } from '@/components/badges';
import { COMMS_ROLE_LABELS } from '@/lib/rbac';
import type { Notification, Viewer } from '@/types';

interface HeaderInteractiveProps {
  viewer: Viewer;
  viewers: Viewer[];
  visibleThreadCount: number;
  visibleNotifications: Notification[];
}

export function HeaderInteractive({ viewer, viewers, visibleThreadCount, visibleNotifications }: HeaderInteractiveProps) {
  const roleLabel = (role: Viewer['role']) => COMMS_ROLE_LABELS[role];
  const [notifOpen, setNotifOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
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
              Notifications for {roleLabel(viewer.role)} ({visibleThreadCount} thread
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

      <form ref={formRef} action={setViewerAction} className="flex items-center gap-2 text-sm">
        <label className="hidden text-muted-foreground sm:inline" htmlFor="agentId">
          Viewing as
        </label>
        <select
          id="agentId"
          name="agentId"
          defaultValue={viewer.agentId}
          onChange={() => formRef.current?.requestSubmit()}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          {viewers.map((v) => (
            <option key={v.agentId} value={v.agentId}>
              {v.displayName} ({roleLabel(v.role)})
            </option>
          ))}
        </select>
      </form>
    </div>
  );
}
