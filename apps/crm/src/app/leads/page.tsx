/**
 * Leads list page — sortable, filterable, searchable
 */

import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/app-shell';
import { LeadCard } from '@/components/leads/lead-card';
import { QuickAddFAB } from '@/components/leads/quick-add-fab';
import { LeadsFilter } from './leads-filter';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import type { Lead, LeadStatus, LeadType } from '@/types';

export const revalidate = 0;

interface SearchParams {
  status?: string;
  type?: string;
  search?: string;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  let query = supabase
    .from('leads')
    .select('*')
    .order('next_followup_at', { ascending: true, nullsFirst: false });

  if (params.status) {
    query = query.eq('status', params.status);
  }
  if (params.type) {
    query = query.eq('lead_type', params.type);
  }
  if (params.search) {
    query = query.or(`name.ilike.%${params.search}%,phone.ilike.%${params.search}%`);
  }

  const { data: leads } = await query;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Leads</h1>
            <p className="text-sm text-muted-foreground">{leads?.length ?? 0} leads</p>
          </div>
          <Link href="/leads/new">
            <Button size="sm" className="hidden md:flex gap-2">
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </Link>
        </div>

        <LeadsFilter />

        <div className="mt-4 space-y-3">
          {leads && leads.length > 0 ? (
            leads.map((lead: Lead) => <LeadCard key={lead.id} lead={lead} />)
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No leads found.{' '}
              <Link href="/leads/new" className="text-primary hover:underline">
                Add your first lead
              </Link>
            </div>
          )}
        </div>
      </div>
      <QuickAddFAB />
    </AppShell>
  );
}
