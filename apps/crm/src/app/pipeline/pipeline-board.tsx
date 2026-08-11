/**
 * PipelineBoard — client-side kanban board with drag/tap to move
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatBudget, formatStatus, statusColor, timeAgo, cn, daysSince } from '@/lib/utils';
import { LEAD_STATUSES } from '@/lib/constants';
import type { Lead, LeadStatus } from '@/types';

interface PipelineBoardProps {
  leads: Lead[];
}

const COLUMNS: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'new', label: 'New', color: 'border-t-blue-400' },
  { status: 'contacted', label: 'Contacted', color: 'border-t-yellow-400' },
  { status: 'interested', label: 'Interested', color: 'border-t-purple-400' },
  { status: 'viewing', label: 'Viewing', color: 'border-t-orange-400' },
  { status: 'offer', label: 'Offer', color: 'border-t-pink-400' },
  { status: 'closed_won', label: 'Closed Won', color: 'border-t-green-400' },
  { status: 'closed_lost', label: 'Closed Lost', color: 'border-t-gray-300' },
];

export function PipelineBoard({ leads: initialLeads }: PipelineBoardProps) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [movingLead, setMovingLead] = useState<string | null>(null);

  async function moveToStatus(leadId: string, newStatus: LeadStatus) {
    setMovingLead(leadId);
    const supabase = createClient();
    await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
    setMovingLead(null);
  }

  const leadsByStatus = COLUMNS.reduce(
    (acc, col) => {
      acc[col.status] = leads.filter((l) => l.status === col.status);
      return acc;
    },
    {} as Record<LeadStatus, Lead[]>
  );

  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex gap-3 min-w-max md:min-w-0 md:grid md:grid-cols-4 lg:grid-cols-7 pb-4">
        {COLUMNS.map(({ status, label, color }) => (
          <div key={status} className="w-64 md:w-auto flex-shrink-0">
            <div className={`rounded-lg border bg-card border-t-4 ${color}`}>
              <div className="px-3 py-2.5 border-b">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                  <span className="text-xs bg-muted rounded-full px-1.5 py-0.5 font-medium">
                    {leadsByStatus[status].length}
                  </span>
                </div>
              </div>
              <div className="p-2 space-y-2 min-h-[80px]">
                {leadsByStatus[status].map((lead) => (
                  <PipelineCard
                    key={lead.id}
                    lead={lead}
                    onMove={moveToStatus}
                    isMoving={movingLead === lead.id}
                    currentStatus={status}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineCard({
  lead,
  onMove,
  isMoving,
  currentStatus,
}: {
  lead: Lead;
  onMove: (id: string, status: LeadStatus) => void;
  isMoving: boolean;
  currentStatus: LeadStatus;
}) {
  const [showMove, setShowMove] = useState(false);
  const days = daysSince(lead.last_contacted_at);

  return (
    <div className={cn('rounded-md border bg-background p-2.5 text-xs', isMoving && 'opacity-50')}>
      <Link href={`/leads/${lead.id}`} className="block">
        <p className="font-medium truncate">{lead.name}</p>
        {(lead.budget_min || lead.budget_max) && (
          <p className="text-muted-foreground mt-0.5 truncate">
            {formatBudget(lead.budget_min, lead.budget_max)}
          </p>
        )}
        {lead.preferred_areas && lead.preferred_areas.length > 0 && (
          <p className="text-muted-foreground mt-0.5 truncate">
            {lead.preferred_areas[0]}
          </p>
        )}
        {days !== null && (
          <p className={cn('mt-1', days >= 7 ? 'text-amber-600 font-medium' : 'text-muted-foreground')}>
            {days === 0 ? 'Today' : `${days}d ago`}
          </p>
        )}
      </Link>
      <button
        onClick={() => setShowMove(!showMove)}
        className="mt-1.5 text-muted-foreground hover:text-foreground text-xs underline"
      >
        Move
      </button>
      {showMove && (
        <div className="mt-1 space-y-0.5">
          {COLUMNS.filter((c) => c.status !== currentStatus).map(({ status, label }) => (
            <button
              key={status}
              onClick={() => { onMove(lead.id, status); setShowMove(false); }}
              className="block w-full text-left px-2 py-1 rounded hover:bg-accent text-xs"
            >
              → {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
