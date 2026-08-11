/**
 * POST /api/leads/score
 * Scores a lead 1-10 using OpenAI based on lead data
 * Rate limited to AI_RATE_LIMIT calls per user per hour
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { AI_RATE_LIMIT } from '@/lib/constants';

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Simple in-memory rate limiter (use Upstash Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + 3600000 });
    return true;
  }

  if (entry.count >= AI_RATE_LIMIT) return false;

  entry.count += 1;
  return true;
}

const bodySchema = z.object({
  leadId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { leadId } = parsed.data;
  const service = createServiceClient();

  const { data: lead } = await service.from('leads').select('*').eq('id', leadId).single();
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const prompt = `You are a Dubai real estate CRM scoring assistant.
Score this lead from 1-10 based on buying intent and deal potential.

Lead data:
- Type: ${lead.lead_type}
- Property interest: ${lead.property_type ?? 'not specified'}
- Budget: ${lead.budget_min ? `AED ${lead.budget_min.toLocaleString()}` : 'not specified'} - ${lead.budget_max ? `AED ${lead.budget_max.toLocaleString()}` : 'not specified'}
- Preferred areas: ${lead.preferred_areas?.join(', ') ?? 'not specified'}
- Bedrooms: ${lead.bedrooms ?? 'not specified'}
- Source: ${lead.source ?? 'unknown'}
- Already owns property: ${lead.owns_property ? 'Yes' : 'No'}
- Notes: ${lead.notes ?? 'none'}

Scoring guide:
- 9-10: High budget, specific requirements, clear intent, pre-approved or owns property to upgrade
- 7-8: Good budget, some specificity, motivated buyer/seller
- 5-6: Mid-range, some intent signals, needs more qualification
- 3-4: Vague requirements, low budget, weak signal
- 1-2: Very vague, no budget, unlikely to convert

Respond with JSON only: {"score": <number 1-10>, "reason": "<one concise sentence explaining the score>"}`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 150,
    });

    const result = JSON.parse(completion.choices[0].message.content ?? '{}') as { score: number; reason: string };
    const score = Math.max(1, Math.min(10, Math.round(result.score)));

    await service.from('leads').update({ ai_score: score, ai_score_reason: result.reason }).eq('id', leadId);
    await service.from('ai_suggestions').insert({
      lead_id: leadId,
      suggestion_type: 'lead_score',
      score,
      score_reason: result.reason,
      status: 'approved',
    });

    return NextResponse.json({ score, reason: result.reason });
  } catch (err) {
    console.error('OpenAI scoring error:', err);
    return NextResponse.json({ error: 'AI scoring failed' }, { status: 500 });
  }
}
