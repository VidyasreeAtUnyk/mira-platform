'use client';

/**
 * In-memory demo store for the comms-hub UI.
 *
 * There is no live database connection in this build (see .env.example /
 * PROGRESS-comms.md) -- src/lib/mock-data.ts's seed is the starting state,
 * held here in React state (client-side, scoped to the browser tab) rather
 * than module-level server state, so it behaves predictably across Next.js
 * server-render/client-hydration boundaries and Fast Refresh.
 *
 * Deliberately does NOT call src/lib/bsp or src/lib/email's adapters --
 * every mutation this store exposes (`addReplyDraft`, `createDraftThread`)
 * only ever appends a Message with status: 'draft'. There is no action
 * anywhere in this store that transitions a message to 'sent', and nothing
 * here calls WhatsAppAdapter.send()/EmailAdapter.send(). That keeps
 * "no send path exists end-to-end" true by construction, not convention --
 * per CLAUDE.md's draft-and-hold rule.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Channel, Message, MessageThread, Notification, Viewer } from '@/types';
import { DEMO_VIEWERS, MESSAGES, NOTIFICATIONS, THREADS } from '@/lib/mock-data';
import { computeTier } from '@/lib/tiers';

/**
 * Persistence key for this browser tab's demo session (selected viewer +
 * any drafts created in this session). localStorage, not a real backend --
 * there is no server/DB in this build. This exists so that (a) the RBAC
 * role you're demoing as survives a hard reload or a directly-typed/
 * bookmarked thread URL, which is the realistic way to exercise
 * `canViewThread()`'s enforcement rather than only via in-app clicks, and
 * (b) drafts created via compose/reply survive a refresh instead of
 * silently vanishing. Bumping the version key invalidates old shapes
 * instead of crashing on a stale schema.
 */
const STORAGE_KEY = 'comms-hub-demo-state-v1';

interface PersistedState {
  viewerId: string;
  threads: MessageThread[];
  messages: Message[];
  notifications: Notification[];
}

function loadPersisted(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || !Array.isArray(parsed.threads) || !Array.isArray(parsed.messages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Stand-in "our side" addresses for drafted outbound messages -- matches the
 *  convention already used in src/lib/mock-data.ts's seed messages. */
const AGENCY_EMAIL_ADDRESS = 'agent@example.com';
const AGENCY_WHATSAPP_NUMBER = '+971500000001';

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

interface NewThreadInput {
  channel: Channel;
  contactName: string;
  contactHandle: string;
  subject: string | null;
  body: string;
  agentId: string | null;
}

interface CommsStoreValue {
  viewer: Viewer;
  viewers: Viewer[];
  setViewerId: (agentId: string) => void;

  threads: MessageThread[];
  messages: Message[];
  notifications: Notification[];

  messagesForThread: (threadId: string) => Message[];
  threadById: (threadId: string) => MessageThread | undefined;

  markThreadRead: (threadId: string) => void;
  addReplyDraft: (threadId: string, body: string) => void;
  createDraftThread: (input: NewThreadInput) => string;
}

const CommsStoreContext = createContext<CommsStoreValue | null>(null);

/** Recompute a thread's tier from its own unread flag + latest message, the
 *  same heuristic src/lib/mock-data.ts uses to seed initial tiers -- keeps
 *  tiers.ts as the single source of truth instead of duplicating the rule. */
function retier(thread: MessageThread, allMessages: Message[]): MessageThread {
  const threadMsgs = allMessages.filter((m) => m.threadId === thread.id);
  const latest =
    threadMsgs.length === 0
      ? null
      : threadMsgs.reduce((a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a));
  return {
    ...thread,
    tier: computeTier({ threadUnread: thread.unread, latestMessage: latest }),
  };
}

export function CommsStoreProvider({ children }: { children: ReactNode }) {
  // Initial state always matches the server-rendered seed (React SSRs
  // client components too) -- any localStorage-persisted session is applied
  // in a mount-only effect below, after hydration, to avoid a hydration
  // mismatch between server and client markup.
  const [viewer, setViewer] = useState<Viewer>(DEMO_VIEWERS[0]);
  const [threads, setThreads] = useState<MessageThread[]>(THREADS);
  const [messages, setMessages] = useState<Message[]>(MESSAGES);
  const [notifications, setNotifications] = useState<Notification[]>(NOTIFICATIONS);
  // Deliberately useState, not useRef, for the hydration flag: it needs to
  // participate in the same batched re-render as the setThreads/setMessages/
  // etc calls below so the persist effect (which depends on it) only ever
  // observes hydrated-and-consistent state, never a torn
  // "hydrated=true but still seed data" intermediate.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // react-hooks/set-state-in-effect flags these too, for the same reason
    // as TimeAgo above: localStorage doesn't exist during SSR, so adopting
    // a persisted session can only happen post-mount, in an effect. This is
    // the one-time "hydrate from an external store" exception, not a
    // pattern to replicate elsewhere in this app.
    const persisted = loadPersisted();
    if (persisted) {
      const persistedViewer = DEMO_VIEWERS.find((v) => v.agentId === persisted.viewerId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (persistedViewer) setViewer(persistedViewer);
      setThreads(persisted.threads);
      setMessages(persisted.messages);
      setNotifications(persisted.notifications);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Skip the pre-hydration render so we don't clobber a persisted session
    // with the seed data before loadPersisted() has had a chance to apply.
    if (!hydrated) return;
    if (typeof window === 'undefined') return;
    const state: PersistedState = { viewerId: viewer.agentId, threads, messages, notifications };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, viewer, threads, messages, notifications]);

  const value = useMemo<CommsStoreValue>(
    () => ({
      viewer,
      viewers: DEMO_VIEWERS,
      setViewerId: (agentId: string) => {
        const next = DEMO_VIEWERS.find((v) => v.agentId === agentId);
        if (next) setViewer(next);
      },

      threads,
      messages,
      notifications,

      messagesForThread: (threadId: string) =>
        messages
          .filter((m) => m.threadId === threadId)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),

      threadById: (threadId: string) => threads.find((t) => t.id === threadId),

      markThreadRead: (threadId: string) => {
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId && t.unread ? retier({ ...t, unread: false }, messages) : t))
        );
        setNotifications((prev) => prev.map((n) => (n.threadId === threadId ? { ...n, read: true } : n)));
      },

      addReplyDraft: (threadId: string, body: string) => {
        const thread = threads.find((t) => t.id === threadId);
        if (!thread || body.trim().length === 0) return;

        const draft: Message = {
          id: newId('msg'),
          threadId,
          channel: thread.channel,
          direction: 'outbound',
          status: 'draft',
          body: body.trim(),
          from: thread.channel === 'whatsapp' ? AGENCY_WHATSAPP_NUMBER : AGENCY_EMAIL_ADDRESS,
          to: thread.contactHandle,
          bspProvider: null,
          emailProvider: null,
          heldReason: null,
          approvedBy: null,
          createdAt: new Date().toISOString(),
        };

        const nextMessages = [...messages, draft];
        setMessages(nextMessages);
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId ? retier({ ...t, lastMessageAt: draft.createdAt }, nextMessages) : t
          )
        );
      },

      createDraftThread: (input: NewThreadInput) => {
        const threadId = newId('thread');
        const now = new Date().toISOString();

        const thread: MessageThread = {
          id: threadId,
          channel: input.channel,
          subject: input.channel === 'email' ? input.subject : null,
          contactName: input.contactName.trim(),
          contactHandle: input.contactHandle.trim(),
          leadId: null,
          agentId: input.agentId,
          tags: [],
          tier: 'fyi',
          unread: false,
          lastMessageAt: now,
          createdAt: now,
        };

        const draft: Message = {
          id: newId('msg'),
          threadId,
          channel: input.channel,
          direction: 'outbound',
          status: 'draft',
          body: input.body.trim(),
          from: input.channel === 'whatsapp' ? AGENCY_WHATSAPP_NUMBER : AGENCY_EMAIL_ADDRESS,
          to: input.contactHandle.trim(),
          bspProvider: null,
          emailProvider: null,
          heldReason: null,
          approvedBy: null,
          createdAt: now,
        };

        setThreads((prev) => [...prev, retier(thread, [...messages, draft])]);
        setMessages((prev) => [...prev, draft]);

        return threadId;
      },
    }),
    [viewer, threads, messages, notifications]
  );

  return <CommsStoreContext.Provider value={value}>{children}</CommsStoreContext.Provider>;
}

export function useCommsStore(): CommsStoreValue {
  const ctx = useContext(CommsStoreContext);
  if (!ctx) throw new Error('useCommsStore must be used within a CommsStoreProvider');
  return ctx;
}
