/**
 * LeadCard — displays a lead summary in list and pipeline views
 */

import Link from 'next/link';
import { MapPin, Clock, TrendingUp, Phone, Flame } from 'lucide-react';
import { cn, formatBudget, formatStatus, statusColor, timeAgo, isColdLead, scoreColor, daysSince, displayStatus } from '@/lib/utils';
import type { Lead } from '@/types';

interface LeadCardProps {
  lead: Lead;
  compact?: boolean;
}

export function LeadCard({ lead, compact = false }: LeadCardProps) {
  const cold = isColdLead(lead.last_contacted_at);
  const days = daysSince(lead.last_contacted_at);

  return (
    <Link href={`/leads/${lead.id}`}>
      <div
        className={cn(
          'group rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30',
          cold && 'border-amber-200 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/10'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Avatar + name */}
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
              cold
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                : 'bg-primary/10 text-primary'
            )}>
              {lead.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{lead.name}</span>
                {cold && <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                {lead.lead_type}{lead.property_type ? ` · ${lead.property_type}` : ''}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <span className={cn(
            'shrink-0 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap',
            statusColor(displayStatus(lead))
          )}>
            {formatStatus(displayStatus(lead))}
          </span>
        </div>

        {!compact && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(lead.budget_min || lead.budget_max) && (
                <p className="text-xs font-medium text-foreground/80">
                  {formatBudget(lead.budget_min, lead.budget_max)}
                </p>
              )}
              {lead.preferred_areas && lead.preferred_areas.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{lead.preferred_areas.slice(0, 2).join(', ')}</span>
                  {lead.preferred_areas.length > 2 && <span className="text-muted-foreground">+{lead.preferred_areas.length - 2}</span>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className={cn(
                'flex items-center gap-1.5 text-xs',
                cold ? 'text-amber-600 font-medium' : 'text-muted-foreground'
              )}>
                <Clock className="h-3 w-3" />
                <span>{timeAgo(lead.last_contacted_at)}</span>
              </div>
              {lead.ai_score !== null && (
                <div className={cn('flex items-center gap-1 text-xs font-semibold', scoreColor(lead.ai_score))}>
                  <TrendingUp className="h-3 w-3" />
                  <span>{lead.ai_score}/10</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
