/**
 * InteractionForm — bottom sheet for logging an interaction with a lead
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { INTERACTION_TYPES, INTERACTION_OUTCOMES } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import type { InteractionType, InteractionOutcome } from '@/types';
import { Plus } from 'lucide-react';

interface InteractionFormProps {
  leadId: string;
  agentId: string;
}

export function InteractionForm({ leadId, agentId }: InteractionFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: '' as InteractionType,
    summary: '',
    outcome: '' as InteractionOutcome | '',
    next_action: '',
    next_action_date: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.type || !form.summary) return;

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.from('interactions').insert({
      lead_id: leadId,
      agent_id: agentId,
      type: form.type,
      summary: form.summary,
      outcome: form.outcome || null,
      next_action: form.next_action || null,
      next_action_date: form.next_action_date || null,
    });

    if (!error) {
      // Also update next_followup_at if date was set
      if (form.next_action_date) {
        await supabase
          .from('leads')
          .update({ next_followup_at: form.next_action_date })
          .eq('id', leadId);
      }
      setOpen(false);
      setForm({ type: '' as InteractionType, summary: '', outcome: '', next_action: '', next_action_date: '' });
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Log Interaction
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle>Log Interaction</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((f) => ({ ...f, type: v as InteractionType }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {INTERACTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Summary *</Label>
            <Textarea
              placeholder="What happened in this interaction?"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              rows={3}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Outcome</Label>
            <Select
              value={form.outcome}
              onValueChange={(v) => setForm((f) => ({ ...f, outcome: v as InteractionOutcome }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select outcome" />
              </SelectTrigger>
              <SelectContent>
                {INTERACTION_OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Next Action</Label>
            <Input
              placeholder="What to do next?"
              value={form.next_action}
              onChange={(e) => setForm((f) => ({ ...f, next_action: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Follow-up Date</Label>
            <Input
              type="date"
              value={form.next_action_date}
              onChange={(e) => setForm((f) => ({ ...f, next_action_date: e.target.value }))}
            />
          </div>

          <Button type="submit" disabled={loading || !form.type || !form.summary} className="w-full">
            {loading ? 'Saving...' : 'Save Interaction'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
