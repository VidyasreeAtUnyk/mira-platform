/**
 * Pipeline page — Kanban board view of leads by status
 */

import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/app-shell';
import { PipelineBoard } from './pipeline-board';
import type { Lead } from '@/types';

export const revalidate = 0;

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('updated_at', { ascending: false });

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <p className="text-muted-foreground text-sm">{leads?.length ?? 0} total leads</p>
        </div>
        <PipelineBoard leads={(leads as Lead[]) ?? []} />
      </div>
    </AppShell>
  );
}
