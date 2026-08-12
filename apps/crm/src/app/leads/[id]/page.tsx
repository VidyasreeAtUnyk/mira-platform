/**
 * Lead profile page — details, interaction timeline, AI suggestion, upgrade calculator
 */

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/app-shell';
import { InteractionForm } from '@/components/leads/interaction-form';
import { AISuggestionCard } from '@/components/leads/ai-suggestion-card';
import { UpgradeCalculator } from '@/components/leads/upgrade-calculator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Phone, Mail, MessageCircle, MapPin, Calendar, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import {
  formatBudget,
  formatStatus,
  statusColor,
  timeAgo,
  scoreColor,
  whatsappLink,
  cn,
  displayStatus,
} from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import type { Lead, Interaction, AISuggestion, DLDPriceIndex } from '@/types';

export const revalidate = 0;

export default async function LeadProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: lead },
    { data: interactions },
    { data: suggestions },
    { data: priceIndex },
    { data: { user } },
  ] = await Promise.all([
    supabase.from('leads').select('*').eq('id', id).single(),
    supabase.from('interactions').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    supabase
      .from('ai_suggestions')
      .select('*')
      .eq('lead_id', id)
      .in('suggestion_type', ['followup_message', 'upgrade_proposal'])
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('dld_price_index').select('*').order('first_date_of_month'),
    supabase.auth.getUser(),
  ]);

  if (!lead) notFound();

  const latestSuggestion = suggestions?.[0] ?? null;
  const agentId = user?.id ?? '';

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link href="/leads">
            <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-xl font-bold truncate">{lead.name}</h1>
              <span className={cn('shrink-0 text-xs font-medium px-2 py-1 rounded-full', statusColor(displayStatus(lead)))}>
                {formatStatus(displayStatus(lead))}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {lead.lead_type.charAt(0).toUpperCase() + lead.lead_type.slice(1)}
              {lead.property_type && ` · ${lead.property_type}`}
              {lead.source && ` · via ${lead.source.replace('_', ' ')}`}
            </p>
          </div>
        </div>

        {/* Contact actions */}
        <div className="flex gap-2">
          <a href={`tel:${lead.phone}`} className="flex-1">
            <Button variant="outline" className="w-full gap-2" size="sm">
              <Phone className="h-4 w-4" />
              Call
            </Button>
          </a>
          <a href={whatsappLink(lead.phone)} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="outline" className="w-full gap-2" size="sm">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </a>
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="flex-1">
              <Button variant="outline" className="w-full gap-2" size="sm">
                <Mail className="h-4 w-4" />
                Email
              </Button>
            </a>
          )}
        </div>

        {/* Lead details */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            {(lead.budget_min || lead.budget_max) && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Budget</span>
                <span className="font-medium">{formatBudget(lead.budget_min, lead.budget_max)}</span>
              </div>
            )}
            {lead.preferred_areas && lead.preferred_areas.length > 0 && (
              <div className="flex justify-between text-sm gap-2">
                <span className="text-muted-foreground shrink-0">Areas</span>
                <span className="font-medium text-right">{lead.preferred_areas.join(', ')}</span>
              </div>
            )}
            {lead.bedrooms && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bedrooms</span>
                <span className="font-medium">{lead.bedrooms === 'studio' ? 'Studio' : `${lead.bedrooms} BR`}</span>
              </div>
            )}
            {lead.ai_score !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">AI Score</span>
                <span className={cn('font-medium', scoreColor(lead.ai_score))}>
                  {lead.ai_score}/10
                </span>
              </div>
            )}
            {lead.ai_score_reason && (
              <p className="text-xs text-muted-foreground italic">{lead.ai_score_reason}</p>
            )}
            {lead.next_followup_at && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Next follow-up</span>
                <span className="font-medium">
                  {format(parseISO(lead.next_followup_at), 'd MMM yyyy')}
                </span>
              </div>
            )}
            {lead.notes && (
              <>
                <Separator />
                <p className="text-sm text-muted-foreground">{lead.notes}</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* AI Suggestion */}
        <AISuggestionCard leadId={lead.id} suggestion={latestSuggestion as AISuggestion | null} />

        {/* Upgrade Calculator (if owns property) */}
        {lead.owns_property && (
          <UpgradeCalculator
            priceIndex={priceIndex as DLDPriceIndex[] ?? []}
            prefillPropertyType={
              lead.owned_property_type === 'apartment' || lead.owned_property_type === 'villa'
                ? lead.owned_property_type
                : undefined
            }
            prefillPurchaseYear={lead.owned_purchase_year ?? undefined}
            prefillPurchasePrice={lead.owned_purchase_price ?? undefined}
          />
        )}

        {/* Interaction timeline */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Interactions</h2>
            <InteractionForm leadId={lead.id} agentId={agentId} />
          </div>

          {interactions && interactions.length > 0 ? (
            <div className="space-y-3">
              {interactions.map((interaction: Interaction) => (
                <Card key={interaction.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {interaction.type}
                        </Badge>
                        {interaction.outcome && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              interaction.outcome === 'positive' && 'border-green-300 text-green-700',
                              interaction.outcome === 'negative' && 'border-red-300 text-red-700',
                              interaction.outcome === 'no_answer' && 'border-gray-300 text-gray-500'
                            )}
                          >
                            {interaction.outcome.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {timeAgo(interaction.created_at)}
                      </span>
                    </div>
                    <p className="text-sm">{interaction.summary}</p>
                    {interaction.next_action && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Next: {interaction.next_action}
                        {interaction.next_action_date && (
                          <span> — {format(parseISO(interaction.next_action_date), 'd MMM')}</span>
                        )}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No interactions logged yet. Click &quot;Log Interaction&quot; to add one.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
