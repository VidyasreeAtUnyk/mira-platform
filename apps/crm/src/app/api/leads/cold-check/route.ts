/**
 * POST /api/leads/cold-check
 * Flags leads with no activity in 7+ days
 * Called by Supabase Edge Function (secured by CRON_SECRET)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { COLD_LEAD_DAYS } from '@/lib/constants';

export async function POST(request: NextRequest) {
  // Verify cron secret
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = createServiceClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - COLD_LEAD_DAYS);

  const { data: coldLeads, error } = await service
    .from('leads')
    .select('id, name, agent_id')
    .lt('last_contacted_at', cutoff.toISOString())
    .not('status', 'in', '(closed_won,closed_lost)')
    .is('next_followup_at', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Set next_followup_at to today for cold leads with no upcoming follow-up
  if (coldLeads && coldLeads.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    await service
      .from('leads')
      .update({ next_followup_at: today })
      .in('id', coldLeads.map((l: { id: string }) => l.id));
  }

  return NextResponse.json({
    flagged: coldLeads?.length ?? 0,
    message: `Flagged ${coldLeads?.length ?? 0} cold leads`,
  });
}
