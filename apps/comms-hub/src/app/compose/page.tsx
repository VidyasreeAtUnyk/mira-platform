/**
 * Compose a new outbound thread -- now an async Server Component (just
 * resolves the current viewer for the "assigned agent" default), form
 * interactivity lives in src/components/compose-form.tsx's client island.
 */
import { getCurrentViewer } from '@/lib/auth/viewer';
import { ComposeForm } from '@/components/compose-form';

export const revalidate = 0;

export default async function ComposePage() {
  const { viewer } = await getCurrentViewer();
  // Owner/COO drafts are unassigned by default (agency-wide), matching the
  // original in-memory store's behavior -- every other role's drafts
  // default to themselves as the assigned agent.
  const defaultAgentId = viewer.role === 'owner_coo' ? null : viewer.agentId;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold">Compose</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Creates a new thread with one draft message. Nothing is sent — draft-and-hold by design (no live BSP/email
        credentials exist in this build).
      </p>

      <ComposeForm agentId={defaultAgentId} />
    </div>
  );
}
