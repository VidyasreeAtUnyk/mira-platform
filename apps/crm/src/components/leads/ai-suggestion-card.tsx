/**
 * AISuggestionCard — displays an AI-generated follow-up or upgrade proposal
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AISuggestion } from '@/types';

interface AISuggestionCardProps {
  leadId: string;
  suggestion: AISuggestion | null;
}

export function AISuggestionCard({ leadId, suggestion: initialSuggestion }: AISuggestionCardProps) {
  const router = useRouter();
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(initialSuggestion);
  const [generating, setGenerating] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function generateSuggestion() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/suggest`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json() as { suggestion: AISuggestion };
        setSuggestion(data.suggestion);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function updateStatus(status: 'approved' | 'rejected') {
    if (!suggestion) return;
    setUpdating(true);
    const supabase = createClient();
    await supabase
      .from('ai_suggestions')
      .update({ status })
      .eq('id', suggestion.id);
    setSuggestion((s) => (s ? { ...s, status } : null));
    setUpdating(false);
    router.refresh();
  }

  const typeLabel = suggestion?.suggestion_type === 'upgrade_proposal'
    ? 'Upgrade Proposal'
    : 'Follow-up Message';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Suggestion
          {suggestion && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {typeLabel}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!suggestion ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Generate a personalised follow-up message or upgrade proposal
            </p>
            <Button onClick={generateSuggestion} disabled={generating} size="sm">
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Suggestion
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">
              {suggestion.content}
            </p>
            {suggestion.status === 'pending' && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus('approved')}
                  disabled={updating}
                  className="gap-1.5 flex-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus('rejected')}
                  disabled={updating}
                  className="gap-1.5 flex-1"
                >
                  <X className="h-3.5 w-3.5" />
                  Reject
                </Button>
                <Button size="sm" variant="ghost" onClick={generateSuggestion} disabled={generating}>
                  Regenerate
                </Button>
              </div>
            )}
            {suggestion.status === 'approved' && (
              <p className="text-xs text-green-600 font-medium">✓ Approved</p>
            )}
            {suggestion.status === 'rejected' && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Rejected</p>
                <Button size="sm" variant="ghost" onClick={generateSuggestion} disabled={generating}>
                  Try Again
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
